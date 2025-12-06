
import { GoogleGenAI, Chat } from "@google/genai";
import { AnalysisResult, Language, Market, AnalysisMode, StructuredAnalysisData, BatchItem, MarketOverview, DeepMacroAnalysis, TimeHorizon, TradeSetup } from "../types";

export interface ChatSessionResult {
  analysis: AnalysisResult;
  chat: Chat | null;
}

const MARKET_CONFIG = {
  en: {
    'A_SHARE': 'A-Share (Chinese Stock Market)',
    'US_STOCK': 'US Stock Market (NASDAQ/NYSE)',
    'HK_STOCK': 'Hong Kong Stock Market (HKEX)'
  },
  zh: {
    'A_SHARE': 'A股市场',
    'US_STOCK': '美股市场 (纳斯达克/纽交所)',
    'HK_STOCK': '港股市场'
  }
};

// ** STABLE MODEL LOCK **
// Using 2.0 Flash Exp as it supports Search Grounding and is widely available.
// 2.5 Flash is removed to prevent 404 errors.
const MODEL_ID = "gemini-2.0-flash-exp";

// --- CONFIGURATION ---
const getEnvConfig = () => {
    const tryGet = (fn: () => string | undefined) => { try { return fn(); } catch { return undefined; } };
    
    const apiKey = 
        tryGet(() => process.env.API_KEY) ||
        tryGet(() => process.env.VITE_API_KEY) ||
        '';

    // Default to the user's custom proxy if env var is missing
    const baseUrl = 
        tryGet(() => process.env.GEMINI_BASE_URL) ||
        tryGet(() => process.env.VITE_GEMINI_BASE_URL) ||
        'https://gemini.kunkun1023.xyz'; 

    return { apiKey, baseUrl: baseUrl.replace(/\/$/, "") };
};

const getGenAIClient = () => {
  const { apiKey, baseUrl } = getEnvConfig();
  if (!apiKey) throw new Error("API Key missing.");
  
  const options: any = { apiKey };
  if (baseUrl) {
      options.baseUrl = baseUrl;
  }
  return new GoogleGenAI(options);
};

// --- HELPERS ---
const safeJsonParse = (text: string): any => {
    try {
        if (!text) return null;
        // 1. Strip Markdown
        let cleanText = text.replace(new RegExp('```(?:json)?|```', 'g'), '').trim();
        // 2. Strip comments
        cleanText = cleanText.replace(new RegExp('\\/\\/.*$', 'gm'), '').replace(new RegExp('\\/\\*[\\s\\S]*?\\*\\/', 'g'), '');
        // 3. Extract JSON object/array
        const firstBrace = cleanText.indexOf('{');
        const firstBracket = cleanText.indexOf('[');
        let start = -1; 
        let end = -1;
        
        // Determine if it's an object or array
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            start = firstBrace;
            end = cleanText.lastIndexOf('}');
        } else if (firstBracket !== -1) {
            start = firstBracket;
            end = cleanText.lastIndexOf(']');
        }
        
        if (start !== -1 && end !== -1) {
            cleanText = cleanText.substring(start, end + 1);
        }
        
        // 4. Remove trailing commas
        cleanText = cleanText.replace(new RegExp(',\\s*([}\\]])', 'g'), '$1');
        
        return JSON.parse(cleanText);
    } catch (e) {
        console.warn("JSON Parse Error", e);
        return null;
    }
};

export const testProxyConnection = async (): Promise<{ status: number; message: string; url: string }> => {
    const { apiKey, baseUrl } = getEnvConfig();
    try {
        const response = await fetch(`${baseUrl}/v1beta/models?key=${apiKey}`, { method: 'GET' });
        return { status: response.status, message: response.statusText, url: baseUrl };
    } catch (e: any) {
        return { status: 0, message: e.message || "Network Error", url: baseUrl };
    }
};

// --- API SERVICES ---

export const fetchMarketOverview = async (market: Market, lang: Language): Promise<MarketOverview> => {
    const marketName = MARKET_CONFIG[lang][market];
    const indices = market === 'A_SHARE' ? "Shanghai Composite, Shenzhen Component, ChiNext" : 
                    market === 'HK_STOCK' ? "Hang Seng, HS Tech, HS CEI" : "Dow Jones, Nasdaq, S&P 500";

    const systemInstruction = lang === 'en'
        ? `Chief Market Strategist. Analyze ${marketName}. Output STRICT JSON.`
        : `首席市场策略师。分析 ${marketName}。输出严格 JSON。`;

    const prompt = lang === 'en'
        ? `Get REAL-TIME values for: ${indices}. Include timestamps. Return JSON: { "sentimentScore": number, "sentimentText": "...", "indices": [ {"name": "...", "value": "...", "change": "+...%", "timestamp": "..."} ], "hotSectors": [...], "rotationAnalysis": { "inflow": "...", "outflow": "...", "logic": "..." }, "monthlyStrategy": "...", "keyRisk": "..." }`
        : `获取实时指数: ${indices}。必须含时间戳。返回 JSON: { "sentimentScore": 0-100, "sentimentText": "...", "indices": [ {"name": "...", "value": "...", "change": "...", "timestamp": "..."} ], "hotSectors": [...], "rotationAnalysis": { "inflow": "...", "outflow": "...", "logic": "..." }, "monthlyStrategy": "...", "keyRisk": "..." }`;

    const ai = getGenAIClient();
    const chat = ai.chats.create({ model: MODEL_ID, config: { tools: [{ googleSearch: {} }], temperature: 0.1, systemInstruction } });
    
    try {
        const response = await chat.sendMessage({ message: prompt });
        const data = safeJsonParse(response.text || "{}");
        
        if (!data || typeof data.sentimentScore !== 'number') {
            throw new Error("Invalid Data");
        }
        
        // Ensure indices array exists
        if (!Array.isArray(data.indices)) data.indices = [];
        return data as MarketOverview;
    } catch (e) {
        console.warn("Market Overview Fetch Failed", e);
        return {
            sentimentScore: 50, sentimentText: "Data Unavailable", indices: [], hotSectors: [], 
            rotationAnalysis: { inflow: "-", outflow: "-", logic: "Analysis failed" }, monthlyStrategy: "-", keyRisk: "-"
        };
    }
};

export const fetchDeepMacroAnalysis = async (market: Market, lang: Language): Promise<DeepMacroAnalysis> => {
    const marketName = MARKET_CONFIG[lang][market];
    
    // Explicit Schema to prevent "Deep Analysis Data Invalid"
    const jsonSchema = `
    {
      "mainBoard": { "opportunity": "string", "recommendedSectors": ["string"], "logic": "string" },
      "techGrowth": { "opportunity": "string", "recommendedSectors": ["string"], "logic": "string" },
      "strategy": "BALANCE", 
      "summary": "string",
      "profiles": {
        "aggressive": { "description": "string", "allocations": [{ "category": "string", "percentage": 50, "rationale": "string", "examples": ["string"] }] },
        "balanced": { "description": "string", "allocations": [{ "category": "string", "percentage": 50, "rationale": "string", "examples": ["string"] }] }
      }
    }`;

    const systemInstruction = lang === 'en'
        ? `Portfolio Manager. Analyze ${marketName} style rotation. Compare Main Board vs Growth. Return strict JSON matching: ${jsonSchema}`
        : `基金经理。分析 ${marketName} 风格切换。对比主板价值与全域成长。返回严格 JSON，符合结构: ${jsonSchema}`;

    const prompt = lang === 'en'
        ? `Analyze market style. Provide aggressive and balanced portfolios.`
        : `分析市场风格。提供激进和平衡两套配置。`;

    const ai = getGenAIClient();
    const chat = ai.chats.create({ model: MODEL_ID, config: { tools: [{ googleSearch: {} }], temperature: 0.1, systemInstruction } });
    
    try {
        const response = await chat.sendMessage({ message: prompt });
        const data = safeJsonParse(response.text || "{}");
        
        if (!data || !data.strategy) {
            console.warn("Deep Analysis: JSON invalid");
            throw new Error("Invalid Data");
        }
        return data as DeepMacroAnalysis;
    } catch (e) {
        console.error("Deep Analysis Failed:", e);
        // Safe fallback to prevent UI crash
        return {
            mainBoard: { opportunity: "Analysis Unavailable", recommendedSectors: [], logic: "Could not retrieve data." },
            techGrowth: { opportunity: "Analysis Unavailable", recommendedSectors: [], logic: "Could not retrieve data." },
            strategy: "BALANCE",
            summary: "Deep analysis service is temporarily unavailable. Please try again later.",
            profiles: {
                aggressive: { description: "N/A", allocations: [] },
                balanced: { description: "N/A", allocations: [] }
            }
        };
    }
};

export const fetchTradeSetupByHorizon = async (stockCode: string, market: Market, horizon: TimeHorizon, lang: Language): Promise<TradeSetup> => {
    const ai = getGenAIClient();
    const prompt = `Analyze ${stockCode} for ${horizon} horizon. Return JSON: { "recommendation", "entryZone", "invalidLevel", "targetLevel", "technicalRationale", "updatedData" }`;
    const chat = ai.chats.create({ model: MODEL_ID, config: { tools: [{ googleSearch: {} }], temperature: 0.1 } });
    const response = await chat.sendMessage({ message: prompt });
    const data = safeJsonParse(response.text || "{}");
    if (!data || !data.updatedData) throw new Error("Trade Setup Data Invalid");
    return data as TradeSetup;
};

export const discoverStocksByTheme = async (theme: string, market: Market, lang: Language): Promise<string[]> => {
    const marketName = MARKET_CONFIG[lang][market];
    const systemInstruction = `Find top 3-5 stocks for "${theme}" in ${marketName}. Return JSON Array of codes ONLY.`;
    const ai = getGenAIClient();
    const chat = ai.chats.create({ model: MODEL_ID, config: { tools: [{ googleSearch: {} }], temperature: 0.1, systemInstruction } });
    const response = await chat.sendMessage({ message: "Go." });
    const parsed = safeJsonParse(response.text || "[]");
    return Array.isArray(parsed) ? parsed.map(c => c.toString().replace(/[^a-zA-Z0-9]/g, '')).slice(0, 6) : [];
};

export const parsePortfolioScreenshot = async (imageBase64: string, market: Market, lang: Language): Promise<any[]> => {
    const ai = getGenAIClient();
    const systemInstruction = `Extract holdings. Return JSON Array: { "code", "name", "quantity", "avgCost" }. Infer code from name.`;
    const chat = ai.chats.create({ model: MODEL_ID, config: { temperature: 0.1, systemInstruction } });
    
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const mimeType = imageBase64.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
    
    const response = await chat.sendMessage({
        content: [{ text: "Extract." }, { inlineData: { mimeType, data: base64Data } }]
    });
    const parsed = safeJsonParse(response.text || "[]");
    return Array.isArray(parsed) ? parsed : [];
};

export const startBatchAnalysis = async (stockCodes: string[], market: Market, lang: Language): Promise<ChatSessionResult> => {
    const codeList = stockCodes.join(", ");
    const systemInstruction = `Analyze [${codeList}]. JSON Array: [{ "code", "name", "price", "change", "lastUpdated", "signal", "confidence", "reason", "targetPrice", "stopLoss", "action" }]`;
    
    const ai = getGenAIClient();
    const chat = ai.chats.create({ model: MODEL_ID, config: { tools: [{ googleSearch: {} }], temperature: 0.1, systemInstruction } });
    const response = await chat.sendMessage({ message: "Analyze." });
    const text = response.text || "[]";
    const parsed = safeJsonParse(text);
    const batchData = Array.isArray(parsed) ? parsed : [];

    return {
        analysis: { isBatch: true, batchData, rawText: text, symbol: "BATCH", timestamp: new Date().toLocaleTimeString() },
        chat: null 
    };
};

export const startStockChat = async (stockCode: string, market: Market, lang: Language, mode: AnalysisMode, onStream?: (text: string) => void, imageBase64?: string): Promise<ChatSessionResult> => {
    const marketName = MARKET_CONFIG[lang][market];
    let systemInstruction = `Senior ${marketName} Analyst. Analyze ${stockCode}. JSON at end: { "signal", "confidence", "entryPrice", "stopLoss", "targetPrice" }`;
    
    const ai = getGenAIClient();
    const chat = ai.chats.create({ model: MODEL_ID, config: { tools: [{ googleSearch: {} }], temperature: 0.1, systemInstruction } });
    
    let messageContent: any = `Analyze ${stockCode}.`;
    if (imageBase64) {
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const mimeType = imageBase64.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
        messageContent = [{ text: messageContent }, { inlineData: { mimeType, data: base64Data } }];
    }

    const streamResponse = await chat.sendMessageStream({ message: messageContent });
    let fullText = "";
    
    for await (const chunk of streamResponse) {
        if (chunk.text) {
            fullText += chunk.text;
            if (onStream) onStream(fullText);
        }
    }

    const parsed = safeJsonParse(fullText);
    const structuredData = (parsed && parsed.signal) ? parsed : undefined;

    return {
        analysis: { rawText: fullText, symbol: stockCode || 'IMAGE', timestamp: new Date().toLocaleTimeString(), structuredData },
        chat
    };
};

export const reanalyzeStockWithUserPrice = async (code: string, name: string, userPrice: string, market: Market, lang: Language): Promise<BatchItem> => {
    const ai = getGenAIClient();
    const chat = ai.chats.create({ model: MODEL_ID, config: { temperature: 0.1 } });
    const response = await chat.sendMessage({ message: `Stock: ${code}. Price: ${userPrice}. Recalculate signal. Return JSON Object.` });
    const data = safeJsonParse(response.text || "{}");
    if (data) { data.code = code; data.name = name; data.price = userPrice; data.lastUpdated = "Manual"; }
    return data as BatchItem;
};

export const sendFollowUpMessage = async (chat: Chat, message: string, onStream?: (text: string) => void): Promise<string> => {
    const streamResponse = await chat.sendMessageStream({ message });
    let fullText = "";
    for await (const chunk of streamResponse) {
        if (chunk.text) {
            fullText += chunk.text;
            if (onStream) onStream(fullText);
        }
    }
    return fullText;
};
