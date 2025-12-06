
import { GoogleGenAI, Chat, GenerateContentResponse, Type, Schema } from "@google/genai";
import { AnalysisResult, Language, Market, AnalysisMode, StructuredAnalysisData, BatchItem, MarketOverview, DeepMacroAnalysis, TimeHorizon, TradeSetup } from "../types";

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

export interface ChatSessionResult {
  analysis: AnalysisResult;
  chat: Chat | null; // Batch mode might not have a persistent chat session
}

// --- CONFIGURATION HELPER ---
const getEnvConfig = () => {
    // Helper to try getting a value safely without throwing ReferenceError
    const tryGet = (fn: () => string | undefined) => {
        try { return fn(); } catch { return undefined; }
    };

    const apiKey = 
        tryGet(() => process.env.API_KEY) ||
        tryGet(() => process.env.VITE_API_KEY) ||
        tryGet(() => process.env.NEXT_PUBLIC_API_KEY) ||
        // @ts-ignore
        tryGet(() => import.meta.env?.API_KEY) ||
        // @ts-ignore
        tryGet(() => import.meta.env?.VITE_API_KEY) ||
        // @ts-ignore
        tryGet(() => import.meta.env?.NEXT_PUBLIC_API_KEY) ||
        '';

    // Prioritize Environment Variables, fallback to user's known working proxy
    const baseUrl = 
        tryGet(() => process.env.GEMINI_BASE_URL) ||
        tryGet(() => process.env.VITE_GEMINI_BASE_URL) ||
        tryGet(() => process.env.NEXT_PUBLIC_GEMINI_BASE_URL) ||
        // @ts-ignore
        tryGet(() => import.meta.env?.GEMINI_BASE_URL) ||
        // @ts-ignore
        tryGet(() => import.meta.env?.VITE_GEMINI_BASE_URL) ||
        'https://gemini.kunkun1023.xyz'; 

    return { apiKey, baseUrl: baseUrl.replace(/\/$/, "") };
};

// Helper to safely initialize the client
const getGenAIClient = () => {
  const { apiKey, baseUrl } = getEnvConfig();

  if (!apiKey) {
    console.error("Gemini API Key missing. Please check your environment variables.");
    throw new Error("API Key is missing. Ensure 'API_KEY' (or 'VITE_API_KEY') is set.");
  }

  const options: any = { apiKey };
  if (baseUrl) {
      options.baseUrl = baseUrl;
  }

  return new GoogleGenAI(options);
};

// --- MODEL FALLBACK STRATEGY ---
// Priority order: 2.5 Flash (Best) -> 2.0 Flash Exp (New) -> 1.5 Flash (Stable)
const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash"];

/**
 * Executes an AI operation with automatic fallback to older models if the primary one fails
 * (e.g. due to 404 Not Found, 429 Rate Limit, or 503 Service Unavailable).
 */
const executeWithFallback = async <T>(
    operation: (modelId: string) => Promise<T>,
    contextDescription: string
): Promise<T> => {
    let lastError: any;

    for (const modelId of MODELS_TO_TRY) {
        try {
            // console.log(`Attempting ${contextDescription} with model: ${modelId}`);
            return await operation(modelId);
        } catch (error: any) {
            lastError = error;
            const msg = error.message || "";
            
            // Log warning but continue to next model
            console.warn(`Model ${modelId} failed for ${contextDescription}: ${msg}`);

            // If it's a "Failed to fetch" (Network/CORS) error, changing model won't help if proxy is down.
            // But if it's a 4xx/5xx from Google, changing model might help (e.g. model not found).
            // We continue regardless to be robust.
        }
    }
    
    // If all fail, throw the last error
    console.error(`All models failed for ${contextDescription}. Last error:`, lastError);
    throw lastError;
};

// --- DIAGNOSTIC TOOL ---
export const testProxyConnection = async (): Promise<{ status: number; message: string; url: string }> => {
    const { apiKey, baseUrl } = getEnvConfig();
    const testUrl = `${baseUrl}/v1beta/models?key=${apiKey}`; // Simple GET request
    
    try {
        const response = await fetch(testUrl, { method: 'GET' });
        return {
            status: response.status,
            message: response.statusText,
            url: baseUrl
        };
    } catch (e: any) {
        return {
            status: 0,
            message: e.message || "Network Error (Failed to fetch)",
            url: baseUrl
        };
    }
};

// Robust JSON Parsing Helper
const safeJsonParse = (text: string): any => {
    try {
        // 1. Remove Markdown code blocks
        let cleanText = text.replace(new RegExp('```(?:json)?|```', 'g'), '').trim();
        // 2. Remove comments
        cleanText = cleanText.replace(new RegExp('\\/\\/.*$', 'gm'), '').replace(new RegExp('\\/\\*[\\s\\S]*?\\*\\/', 'g'), '');
        // 3. Find outer braces
        const firstBrace = cleanText.indexOf(String.fromCharCode(0x7B)); // {
        const firstBracket = cleanText.indexOf(String.fromCharCode(0x5B)); // [
        let startIdx = -1;
        let endIdx = -1;
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            startIdx = firstBrace;
            endIdx = cleanText.lastIndexOf(String.fromCharCode(0x7D)); // }
        } else if (firstBracket !== -1) {
            startIdx = firstBracket;
            endIdx = cleanText.lastIndexOf(String.fromCharCode(0x5D)); // ]
        }
        if (startIdx !== -1 && endIdx !== -1) {
            cleanText = cleanText.substring(startIdx, endIdx + 1);
        }
        // 4. Fix trailing commas
        cleanText = cleanText.replace(new RegExp(',\\s*([\\x5D\\x7D])', 'g'), '$1');
        return JSON.parse(cleanText);
    } catch (e) {
        console.warn("safeJsonParse failed:", e);
        return null;
    }
};

// --- MARKET OVERVIEW SERVICE ---
export const fetchMarketOverview = async (market: Market, lang: Language): Promise<MarketOverview> => {
    const marketName = MARKET_CONFIG[lang][market];
    let indicesRequest = "";
    if (market === 'A_SHARE') indicesRequest = "Shanghai Composite (上证指数), Shenzhen Component (深证成指), ChiNext (创业板指)";
    else if (market === 'US_STOCK') indicesRequest = "Dow Jones, Nasdaq, S&P 500";
    else if (market === 'HK_STOCK') indicesRequest = "Hang Seng Index (恒生指数), HS Tech (恒生科技), HS CEI (国企指数)";

    const systemInstruction = lang === 'en'
        ? `You are a Chief Market Strategist. Analyze the current ${marketName} situation. Output STRICT JSON format.`
        : `你是一位首席市场策略师。请分析当前 ${marketName} 的宏观局势。输出严格的 JSON 格式。`;

    const prompt = lang === 'en'
        ? `Analyze today's ${marketName}.
           1. Get REAL-TIME values for: ${indicesRequest}.
           2. CRITICAL: For each index, you MUST provide the 'timestamp' of the data (e.g., '14:35' or '12-03 Close').
           3. Analyze Sector Rotation Deeply.
           Return JSON: { "sentimentScore": number, "sentimentText": "string", "indices": [ {"name": "...", "value": "...", "change": "+...%", "timestamp": "..."} ], "hotSectors": [...], "rotationAnalysis": { "inflow": "...", "outflow": "...", "logic": "..." }, "monthlyStrategy": "...", "keyRisk": "..." }`
        : `分析 ${marketName} 今日行情。
           1. 获取**实时**指数数据: ${indicesRequest}。
           2. **核心要求**: 必须返回数据对应的时间 (timestamp)。
           3. 深度分析板块轮动。
           返回 JSON: { "sentimentScore": 0-100, "sentimentText": "...", "indices": [ {"name": "...", "value": "...", "change": "...", "timestamp": "..."} ], "hotSectors": [...], "rotationAnalysis": { "inflow": "...", "outflow": "...", "logic": "..." }, "monthlyStrategy": "...", "keyRisk": "..." }`;

    return executeWithFallback(async (modelId) => {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1,
                systemInstruction: systemInstruction,
            },
        });
        const response = await chat.sendMessage({ message: prompt });
        const text = response.text || "{}";
        const data = safeJsonParse(text);
        
        // Data Sanitization
        if (data && Array.isArray(data.indices)) {
             data.indices = data.indices.map((idx: any) => ({
                 name: idx.name || "Unknown",
                 value: idx.value || "0",
                 change: idx.change || "0%",
                 timestamp: idx.timestamp || "N/A"
             }));
        }

        if (!data || typeof data.sentimentScore !== 'number') throw new Error("Invalid Market Overview Data");
        return data as MarketOverview;
    }, "Market Overview");
};

// --- DEEP MACRO ANALYSIS SERVICE ---
export const fetchDeepMacroAnalysis = async (market: Market, lang: Language): Promise<DeepMacroAnalysis> => {
    const marketName = MARKET_CONFIG[lang][market];
    const systemInstruction = lang === 'en'
        ? `You are a Senior Portfolio Manager. Analyze style rotation in ${marketName}. Include Main Board Growth Stocks.`
        : `你是一位资深基金经理。深度分析 ${marketName} 风格切换。必须扫描主板 (600/000) 中的成长赛道。`;
    const prompt = lang === 'en'
        ? `Compare Main Board Value vs Broad Growth. Return strict JSON with 'aggressive' and 'balanced' profiles.`
        : `对比今日“主板价值”与“全域成长”。返回严格 JSON，包含 'aggressive' 和 'balanced' 两套配置模型。`;

    return executeWithFallback(async (modelId) => {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: { tools: [{ googleSearch: {} }], temperature: 0.2, systemInstruction: systemInstruction },
        });
        const response = await chat.sendMessage({ message: prompt });
        const data = safeJsonParse(response.text || "{}");
        if (!data || !data.strategy) throw new Error("Invalid Deep Analysis Data");
        return data as DeepMacroAnalysis;
    }, "Deep Macro Analysis");
};

// --- TRADE SETUP BY HORIZON SERVICE ---
export const fetchTradeSetupByHorizon = async (stockCode: string, market: Market, horizon: TimeHorizon, lang: Language): Promise<TradeSetup> => {
    const marketName = MARKET_CONFIG[lang][market];
    let horizonContext = "";
    if (lang === 'zh') {
        if (horizon === 'SHORT') horizonContext = "短线策略 (1个月内): 60分钟/日线, 快进快出。";
        if (horizon === 'MEDIUM') horizonContext = "中线波段 (2-4个月): 周线/日线, 趋势跟踪。";
        if (horizon === 'LONG') horizonContext = "长线配置 (6个月+): 月线/估值, 分批建仓。";
    } else {
        if (horizon === 'SHORT') horizonContext = "Short-Term (<1M): 60min/Daily, High freq.";
        if (horizon === 'MEDIUM') horizonContext = "Mid-Term (2-4M): Weekly/Daily, Swing.";
        if (horizon === 'LONG') horizonContext = "Long-Term (6M+): Monthly, Value.";
    }
    const systemInstruction = `You are a Technical Trading Specialist. Provide a Trade Setup for ${stockCode} based on ${horizonContext}.`;
    const prompt = `Analyze ${stockCode} for ${horizon} horizon. Return strict JSON with 'recommendation', 'entryZone', 'invalidLevel', 'targetLevel', 'technicalRationale', and 'updatedData'.`;

    return executeWithFallback(async (modelId) => {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: { tools: [{ googleSearch: {} }], temperature: 0.1, systemInstruction: systemInstruction },
        });
        const response = await chat.sendMessage({ message: prompt });
        const data = safeJsonParse(response.text || "{}");
        if (!data || !data.updatedData) throw new Error("Invalid Trade Setup Data");
        return data as TradeSetup;
    }, "Trade Setup");
};

// --- SMART DISCOVERY SERVICE ---
export const discoverStocksByTheme = async (theme: string, market: Market, lang: Language): Promise<string[]> => {
    const marketName = MARKET_CONFIG[lang][market];
    const systemInstruction = lang === 'en'
        ? `You are a Financial Assistant. Use Google Search to find top 3-5 stocks for theme "${theme}" in ${marketName}. Return ONLY a JSON array of codes.`
        : `你是一位金融助手。利用搜索找出 ${marketName} 中主题 "${theme}" 的 3-5 只龙头股。仅返回代码 JSON 数组。`;

    return executeWithFallback(async (modelId) => {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: { tools: [{ googleSearch: {} }], temperature: 0.1, systemInstruction: systemInstruction },
        });
        const response = await chat.sendMessage({ message: "Find stocks. JSON Array only." });
        const parsed = safeJsonParse(response.text || "[]");
        return Array.isArray(parsed) ? parsed.map(c => c.replace(new RegExp('[^a-zA-Z0-9]', 'g'), '')).slice(0, 6) : [];
    }, "Smart Discovery");
};

// --- PORTFOLIO SCREENSHOT SERVICE ---
export const parsePortfolioScreenshot = async (imageBase64: string, market: Market, lang: Language): Promise<any[]> => {
    const marketName = MARKET_CONFIG[lang][market];
    const systemInstruction = lang === 'en' 
        ? `Extract stock holdings from screenshot. Return JSON Array: { "code", "name", "quantity", "avgCost" }. Infer code from name if missing.`
        : `提取截图持仓。返回 JSON 数组: { "code", "name", "quantity", "avgCost" }。如果只显示名称，必须推断代码。`;

    return executeWithFallback(async (modelId) => {
        const ai = getGenAIClient();
        const chat = ai.chats.create({ model: modelId, config: { temperature: 0.1, systemInstruction: systemInstruction } });
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const mimeType = imageBase64.match(new RegExp('data:([^;]+);'))?.[1] || 'image/jpeg';
        
        const response = await chat.sendMessage({
            content: [ { text: `Extract holdings from ${marketName} app.` }, { inlineData: { mimeType, data: base64Data } } ]
        });
        const parsed = safeJsonParse(response.text || "[]");
        return Array.isArray(parsed) ? parsed : [];
    }, "Portfolio Screenshot");
};

// --- BATCH ANALYSIS SERVICE ---
export const startBatchAnalysis = async (stockCodes: string[], market: Market, lang: Language, onStream?: (text: string) => void): Promise<ChatSessionResult> => {
    const marketName = MARKET_CONFIG[lang][market];
    const codeList = stockCodes.join(", ");
    const systemInstruction = lang === 'en'
        ? `Quantitative Analyst. Get real-time data for: ${codeList}. Output STRICT JSON ARRAY. Check timestamps.`
        : `量化分析师。获取 ${codeList} 的实时行情。严格输出 JSON 数组。检查时间戳。`;

    const prompt = lang === 'en' 
        ? `Analyze [${codeList}]. Return JSON Array: [{ "code", "name", "price", "change", "lastUpdated", "signal", "confidence", "reason", "targetPrice", "stopLoss", "action" }]`
        : `分析 [${codeList}]。返回 JSON 数组: [{ "code", "name", "price", "change", "lastUpdated", "signal", "confidence", "reason", "targetPrice", "stopLoss", "action" }]`;

    return executeWithFallback(async (modelId) => {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: { tools: [{ googleSearch: {} }], temperature: 0.1, systemInstruction: systemInstruction },
        });

        const streamResponse = await chat.sendMessageStream({ message: prompt });
        let fullText = "";
        for await (const chunk of streamResponse) {
            if (chunk.text) {
                fullText += chunk.text;
                if (onStream) onStream(fullText);
            }
        }
        
        const parsed = safeJsonParse(fullText);
        let batchData: BatchItem[] = [];
        if (Array.isArray(parsed)) batchData = parsed;
        else if (parsed && typeof parsed === 'object') batchData = [parsed];

        return {
            analysis: { isBatch: true, batchData: batchData, rawText: fullText, symbol: "BATCH", timestamp: new Date().toLocaleTimeString(), groundingSources: [] },
            chat: null 
        };
    }, "Batch Analysis");
};

// --- SINGLE STOCK ANALYSIS SERVICE ---
export const startStockChat = async (
  stockCode: string, market: Market, lang: Language, mode: AnalysisMode, onStream?: (text: string) => void, imageBase64?: string
): Promise<ChatSessionResult> => {
    const marketName = MARKET_CONFIG[lang][market];
    const now = new Date();
    const dateStr = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let systemInstruction = lang === 'en' ? `Act as a senior ${marketName} Quant Analyst. Time: ${dateStr}. ` : `扮演${marketName}量化分析师。时间: ${dateStr}。`;
    if (imageBase64) systemInstruction += lang === 'en' ? ` \nVISUAL INPUT: Analyze attached image.` : ` \n视觉输入: 分析图片中的图表。`;
    systemInstruction += mode === 'LIVE' ? (lang === 'en' ? ` MODE: LIVE.` : ` 模式: 实时盘中。`) : (lang === 'en' ? ` MODE: SNAPSHOT.` : ` 模式: 收盘快照。`);
    systemInstruction += lang === 'en' ? `\nAppend JSON block at end: { "signal", "confidence", "entryPrice", "stopLoss", "targetPrice" }` : `\n最后附带 JSON 块: { "signal", "confidence", "entryPrice", "stopLoss", "targetPrice" }`;

    const prompt = lang === 'en' 
        ? `Analyze ${stockCode}. 1. Snapshot. 2. Technicals. 3. News. 4. Strategy. 5. Position. 6. Execution.`
        : `分析 ${stockCode}。1. 市场快照。2. 技术面。3. 消息面。4. 策略。5. 仓位。6. 交易计划。`;

    return executeWithFallback(async (modelId) => {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: { tools: [{ googleSearch: {} }], temperature: 0.1, systemInstruction: systemInstruction },
        });

        let messageContent: any = prompt;
        if (imageBase64) {
            const base64Data = imageBase64.split(',')[1] || imageBase64;
            const mimeType = imageBase64.match(new RegExp('data:([^;]+);'))?.[1] || 'image/jpeg';
            messageContent = [ { text: prompt }, { inlineData: { mimeType, data: base64Data } } ];
        }

        const streamResponse = await chat.sendMessageStream({ message: messageContent });
        let fullText = "";
        let groundingChunks: any[] = [];

        for await (const chunk of streamResponse) {
            if (chunk.text) {
                fullText += chunk.text;
                if (onStream) onStream(fullText);
            }
            if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                groundingChunks.push(...chunk.candidates[0].groundingMetadata.groundingChunks);
            }
        }

        let text = fullText || "No analysis.";
        let structuredData: StructuredAnalysisData | undefined;
        const parsed = safeJsonParse(text);
        if (parsed && parsed.signal) {
            structuredData = parsed;
            text = text.replace(new RegExp('```(?:json)?\\s*(\\{[\\s\\S]*?"signal"[\\s\\S]*?"entryPrice"[\\s\\S]*?\\})\\s*```', 'i'), '').trim();
        }

        const uniqueSources = groundingChunks
            .map((chunk) => chunk.web).filter(w => w).reduce((acc: any[], current) => {
                const x = acc.find(item => item.uri === current.uri);
                if (!x) return acc.concat([current]);
                return acc;
            }, []);

        return {
            analysis: { rawText: text, symbol: stockCode || 'IMAGE', timestamp: new Date().toLocaleTimeString(), groundingSources: uniqueSources, structuredData },
            chat: chat
        };
    }, "Single Stock Analysis");
};

// --- INLINE RE-ANALYSIS ---
export const reanalyzeStockWithUserPrice = async (code: string, name: string, userPrice: string, market: Market, lang: Language): Promise<BatchItem> => {
    const systemInstruction = lang === 'en' 
        ? `Technical Analyst. User override price: ${userPrice}. Recalculate signal.`
        : `技术分析师。用户修正价格: ${userPrice}。重新计算信号。`;
    const prompt = `Stock: ${code} (${name}). Price: ${userPrice}. Return JSON Object.`;

    return executeWithFallback(async (modelId) => {
        const ai = getGenAIClient();
        const chat = ai.chats.create({ model: modelId, config: { temperature: 0.1, systemInstruction: systemInstruction } });
        const response = await chat.sendMessage({ message: prompt });
        const data = safeJsonParse(response.text || "{}");
        if (data) {
            data.code = code; data.name = name; data.price = userPrice; data.lastUpdated = lang === 'en' ? "Manual Input" : "人工录入";
        }
        return data as BatchItem;
    }, "Re-Analysis");
};

export const sendFollowUpMessage = async (chat: Chat, message: string, onStream?: (text: string) => void): Promise<string> => {
    try {
        const streamResponse = await chat.sendMessageStream({ message });
        let fullText = "";
        for await (const chunk of streamResponse) {
            if (chunk.text) {
                fullText += chunk.text;
                if (onStream) onStream(fullText);
            }
        }
        return fullText;
    } catch (error) {
        console.error("Follow-up Error:", error);
        throw new Error("Failed to process follow-up message.");
    }
};
