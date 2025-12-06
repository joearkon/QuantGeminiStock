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

// Helper to safely initialize the client only when needed
// Helper to safely initialize the client only when needed
const getGenAIClient = () => {
  let apiKey = '';
  let baseUrl = '';

  // Helper to try getting a value safely without throwing ReferenceError
  const tryGet = (fn: () => string | undefined) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };

  // Attempt to find the API Key in various common locations.
  apiKey = 
    tryGet(() => process.env.API_KEY) ||
    tryGet(() => process.env.VITE_API_KEY) ||
    tryGet(() => process.env.NEXT_PUBLIC_API_KEY) ||
    // @ts-ignore
    tryGet(() => import.meta.env?.API_KEY) ||
    // @ts-ignore
    tryGet(() => import.meta.env?.VITE_API_KEY) ||
    // @ts-ignore
    tryGet(() => import.meta.env?.NEXT_PUBLIC_GEMINI_API_KEY) ||
    '';

  // 修正代理地址（包含/v1beta路径前缀）
  baseUrl = 
    tryGet(() => process.env.GEMINI_BASE_URL) ||
    tryGet(() => process.env.VITE_GEMINI_BASE_URL) ||
    tryGet(() => process.env.NEXT_PUBLIC_GEMINI_BASE_URL) ||
    // @ts-ignore
    tryGet(() => import.meta.env?.GEMINI_BASE_URL) ||
    // @ts-ignore
    tryGet(() => import.meta.env?.VITE_GEMINI_BASE_URL) ||
    'https://gemini.kunkun1023.xyz/v1beta';

  if (!apiKey) {
    console.error("Gemini API Key missing. Please check your environment variables.");
    throw new Error("API Key is missing. Ensure 'API_KEY' (or 'VITE_API_KEY' for Vite) is set in your environment.");
  }

  // 修正SDK的baseUrl配置方式（嵌套在clientOptions中）
  const genAiOptions: any = {
    apiKey,
    clientOptions: {
      baseUrl: baseUrl.replace(/\/$/, "") // 确保无末尾斜杠
    }
  };

  // 安全的调试日志：打印代理地址，确认配置生效
  console.log("✅ Gemini代理地址已配置:", genAiOptions.clientOptions.baseUrl);

  const genAI = new GoogleGenAI(genAiOptions);

  // ========== 移除覆盖fetch的代码（浏览器中fetch是只读的） ==========
  // 改用浏览器开发者工具的“网络”面板查看请求地址

  return genAI;
};

// 【以下代码和原逻辑一致，无需修改】
// Robust JSON Parsing Helper
const safeJsonParse = (text: string): any => {
    try {
        // 1. Remove Markdown code blocks if present
        let cleanText = text.replace(new RegExp('```(?:json)?|```', 'g'), '').trim();
        
        // 2. Remove comments (single line // or multi-line /* */)
        cleanText = cleanText.replace(new RegExp('\\/\\/.*$', 'gm'), '').replace(new RegExp('\\/\\*[\\s\\S]*?\\*\\/', 'g'), '');

        // 3. Attempt to find the outermost JSON structure (Array or Object)
        const firstBrace = cleanText.indexOf(String.fromCharCode(0x7B)); // {
        const firstBracket = cleanText.indexOf(String.fromCharCode(0x5B)); // [
        
        let startIdx = -1;
        let endIdx = -1;
        
        // Determine if we are looking for object or array
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

        // 4. Fix trailing commas and use Hex escapes for brackets to prevent build errors
        // Regex looks for comma followed by optional whitespace and then a closing brace/bracket
        cleanText = cleanText.replace(new RegExp(',\\s*([\\x5D\\x7D])', 'g'), '$1');

        return JSON.parse(cleanText);
    } catch (e) {
        console.warn("safeJsonParse failed:", e);
        return null; // Return null so caller can handle fallback
    }
};

// --- MARKET OVERVIEW SERVICE ---
export const fetchMarketOverview = async (market: Market, lang: Language): Promise<MarketOverview> => {
    const modelId = "gemini-2.5-flash";
    const marketName = MARKET_CONFIG[lang][market];
    const month = new Date().getMonth() + 1; // Current Month

    // Define specific indices based on market
    let indicesRequest = "";
    if (market === 'A_SHARE') indicesRequest = "Shanghai Composite (上证指数), Shenzhen Component (深证成指), ChiNext (创业板指)";
    else if (market === 'US_STOCK') indicesRequest = "Dow Jones, Nasdaq, S&P 500";
    else if (market === 'HK_STOCK') indicesRequest = "Hang Seng Index (恒生指数), HS Tech (恒生科技), HS CEI (国企指数)";

    const systemInstruction = lang === 'en'
        ? `You are a Chief Market Strategist. Analyze the current ${marketName} situation.
           Output STRICT JSON format.`
        : `你是一位首席市场策略师。请分析当前 ${marketName} 的宏观局势、指数表现和深度资金逻辑。
           输出严格的 JSON 格式。`;

    const prompt = lang === 'en'
        ? `Analyze today's ${marketName}.
           1. Get REAL-TIME values for: ${indicesRequest}.
           2. CRITICAL: For each index, you MUST provide the 'timestamp' of the data (e.g., '14:35' or '12-03 Close'). DO NOT HALLUCINATE. If live data is unavailable, state the last close time.
           3. Analyze Sector Rotation Deeply: Where is money going? Why?
           
           Return JSON:
           {
             "sentimentScore": number (0-100),
             "sentimentText": "string",
             "indices": [ {"name": "...", "value": "...", "change": "+...%", "timestamp": "..."} ],
             "hotSectors": ["sector1", "sector2", "sector3"],
             "rotationAnalysis": {
                "inflow": "Which sectors are getting money?",
                "outflow": "Which sectors are losing money?",
                "logic": "Deep reason for this rotation"
             },
             "monthlyStrategy": "Short investment advice",
             "keyRisk": "Biggest risk"
           }`
        : `分析 ${marketName} 今日行情。
           1. 获取**实时**指数数据: ${indicesRequest}。
           2. **核心要求**: 对于每个指数，你必须返回数据对应的具体时间 (timestamp)，例如 "14:35" (盘中) 或 "12-03 收盘"。如果你获取不到实时数据，请明确标记为 "昨日收盘"。严禁编造数值。
           3. 深度分析板块轮动: 资金到底在怎么动？
           
           返回 JSON:
           {
             "sentimentScore": 0-100,
             "sentimentText": "情绪短语",
             "indices": [ {"name": "指数名", "value": "点数", "change": "涨跌幅", "timestamp": "数据时间(如 14:35)"} ], 
             "hotSectors": ["热门板块1", "热门板块2", "热门板块3"],
             "rotationAnalysis": {
                "inflow": "资金流入的主战场",
                "outflow": "资金流出的避险区",
                "logic": "轮动背后的深度逻辑"
             },
             "monthlyStrategy": "${month}月核心策略",
             "keyRisk": "当前最大风险"
           }`;

    try {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.1, // Lower temperature for accuracy
                systemInstruction: systemInstruction,
            },
        });

        const response = await chat.sendMessage({ message: prompt });
        const text = response.text || "{}";
        
        const data = safeJsonParse(text);
        
        if (!data || typeof data.sentimentScore !== 'number') {
            throw new Error("Invalid Market Overview Data");
        }
        
        return data as MarketOverview;

    } catch (error) {
        console.error("Market Pulse Error", error);
        throw new Error("Failed to fetch market pulse.");
    }
};

// --- DEEP MACRO ANALYSIS SERVICE ---
export const fetchDeepMacroAnalysis = async (market: Market, lang: Language): Promise<DeepMacroAnalysis> => {
    const modelId = "gemini-2.5-flash";
    const marketName = MARKET_CONFIG[lang][market];

    const systemInstruction = lang === 'en'
        ? `You are a Senior Portfolio Manager. Analyze the style rotation in ${marketName}. 
           IMPORTANT: When analyzing "Growth/Tech", DO NOT limit yourself to Startup Boards (e.g., STAR/ChiNext). 
           You MUST include Main Board Growth Stocks (e.g., Shanghai 600xxx, Shenzhen 000xxx) such as big semi, auto, or electronics leaders.`
        : `你是一位资深基金经理。请深度分析 ${marketName} 中“价值/防守”与“成长/进攻”之间的风格切换逻辑。
           **核心指令**: 
           在分析“科技/成长”方向时，**严禁**局限于科创板(688)或创业板(300)。
           你**必须**扫描**主板 (600/000)** 中的成长赛道（如：主板的半导体龙头、消费电子、汽车智能化、CPO等），并将其纳入配置建议中。
           A股的主板成长股往往具有更好的流动性和确定性。`;

    const prompt = lang === 'en'
        ? `Compare Main Board Value vs Broad Growth (Main Board & Tech Board) today. 
           Return strict JSON:
           {
             "mainBoard": { "opportunity": "...", "recommendedSectors": ["..."], "logic": "..." },
             "techGrowth": { "opportunity": "...", "recommendedSectors": ["..."], "logic": "..." },
             "strategy": "SWITCH_TO_MAIN" | "SWITCH_TO_TECH" | "BALANCE" | "DEFENSIVE",
             "summary": "Actionable advice.",
             "profiles": {
                "aggressive": {
                    "description": "Focus on High Growth (STAR + Main Board Growth)",
                    "allocations": [
                         { "category": "Core Growth (Main Board)", "percentage": 40, "rationale": "...", "examples": ["60xxxx Semi", "00xxxx Auto"] },
                         { "category": "High Beta (STAR/ChiNext)", "percentage": 30, "rationale": "...", "examples": ["688xxx AI"] },
                         { "category": "Cash", "percentage": 30, "rationale": "...", "examples": [""] }
                    ]
                },
                "balanced": {
                    "description": "Steady growth + Value",
                    "allocations": [
                         { "category": "Defensive Value", "percentage": 40, "rationale": "...", "examples": ["Banks"] },
                         { "category": "Main Board Growth", "percentage": 40, "rationale": "...", "examples": ["Electronics"] },
                         { "category": "Cash", "percentage": 20, "rationale": "...", "examples": ["Bonds"] }
                    ]
                }
             }
           }`
        : `对比今日“主板价值”与“全域成长（包含科创板及主板成长股）”的表现。
           返回严格 JSON:
           {
             "mainBoard": { "opportunity": "主板价值/红利机会", "recommendedSectors": ["板块A"], "logic": "看好理由" },
             "techGrowth": { "opportunity": "全域成长(主板+科创)", "recommendedSectors": ["板块B"], "logic": "看好理由" },
             "strategy": "SWITCH_TO_MAIN" | "SWITCH_TO_TECH" | "BALANCE" | "DEFENSIVE",
             "summary": "一句话实战建议",
             "profiles": {
                "aggressive": {
                    "description": "激进型：全攻态势，覆盖科创弹性与主板核心成长",
                    "allocations": [
                         { "category": "核心成长 (主板600/000)", "percentage": 40, "rationale": "理由", "examples": ["CPO龙头", "汽车电子"] },
                         { "category": "高弹性 (科创688/创业300)", "percentage": 30, "rationale": "理由", "examples": ["半导体设备", "AI应用"] },
                         { "category": "轮动/周期", "percentage": 30, "rationale": "理由", "examples": ["有色"] }
                    ]
                },
                "balanced": {
                    "description": "平衡型：主板蓝筹打底，主板成长股增强",
                    "allocations": [
                         { "category": "底仓/防守 (红利/大金融)", "percentage": 40, "rationale": "理由", "examples": ["银行", "电力"] },
                         { "category": "稳健成长 (主板白马)", "percentage": 40, "rationale": "理由", "examples": ["立讯精密", "中际旭创"] },
                         { "category": "现金/债券", "percentage": 20, "rationale": "理由", "examples": ["逆回购"] }
                    ]
                }
             }
           }
           注意：allocations 中的 percentage 总和必须为 100。`;

    try {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: {
                tools: [{ googleSearch: {} }],
                temperature: 0.2,
                systemInstruction: systemInstruction,
            },
        });

        const response = await chat.sendMessage({ message: prompt });
        const text = response.text || "{}";
        const data = safeJsonParse(text);
        
        if (!data || !data.strategy) throw new Error("Invalid Deep Analysis Data");
        return data as DeepMacroAnalysis;
    } catch (e) {
        console.error("Deep Macro Error", e);
        throw new Error("Failed to perform deep macro analysis.");
    }
};

// --- TRADE SETUP BY HORIZON SERVICE ---
export const fetchTradeSetupByHorizon = async (
    stockCode: string,
    market: Market,
    horizon: TimeHorizon,
    lang: Language
): Promise<TradeSetup> => {
    const modelId = "gemini-2.5-flash";
    const marketName = MARKET_CONFIG[lang][market];

    let horizonContext = "";
    if (lang === 'zh') {
        if (horizon === 'SHORT') horizonContext = "短线策略 (1个月内): 关注日线/60分钟线。重点: 快进快出, 支撑位低吸, 压力位止盈。";
        if (horizon === 'MEDIUM') horizonContext = "中线波段 (2-4个月): 关注周线/日线趋势。重点: 均线多头排列, 回踩确认, 趋势跟踪。";
        if (horizon === 'LONG') horizonContext = "长线配置 (6个月+): 关注月线/基本面估值。重点: 价值发现, 分批建仓, 穿越牛熊。";
    } else {
        if (horizon === 'SHORT') horizonContext = "Short-Term (Within 1 Month): Focus on 60min/Daily charts. High frequency, tight stops.";
        if (horizon === 'MEDIUM') horizonContext = "Mid-Term (2-4 Months): Focus on Weekly/Daily trends. Swing trading, trend following.";
        if (horizon === 'LONG') horizonContext = "Long-Term (6 Months+): Focus on Monthly/Fundamentals. Value investing, DCA.";
    }

    const systemInstruction = lang === 'en'
        ? `You are a Technical Trading Specialist. Provide a precise Trade Setup for ${stockCode} based on ${horizonContext}.`
        : `你是一位技术交易专家。请为 ${stockCode} 制定一个精准的交易计划。
           **当前时间维度**: ${horizonContext}
           请基于该时间维度的技术指标（如短线看KDJ/布林带，中线看MACD/均线系统）给出具体的点位。`;

    const prompt = lang === 'en'
        ? `Analyze ${stockCode} for ${horizon} horizon.
           Return strict JSON:
           {
             "horizon": "${horizon}",
             "recommendation": "BUY" | "SELL" | "WAIT",
             "entryZone": "e.g. 20.50 - 20.80",
             "invalidLevel": "Price level that invalidates this logic (Stop Loss)",
             "targetLevel": "Expected price target",
             "technicalRationale": "Why these levels? (Max 15 words)",
             "updatedData": {
                 "signal": "BUY", "confidence": 80, "entryPrice": 20.65, "stopLoss": 19.80, "targetPrice": 22.50
             }
           }`
        : `请分析 ${stockCode} 的 ${horizon} 交易机会。
           返回严格 JSON:
           {
             "horizon": "${horizon}",
             "recommendation": "BUY" | "SELL" | "WAIT",
             "entryZone": "如 20.50 - 20.80 (区间)",
             "invalidLevel": "跌破哪里逻辑失效 (止损位)",
             "targetLevel": "预期目标位 (止盈位)",
             "technicalRationale": "极简技术理由 (不超过20字, 如'回踩60日线获支撑')",
             "updatedData": {
                 "signal": "BUY", "confidence": 80, "entryPrice": 20.65, "stopLoss": 19.80, "targetPrice": 22.50
             }
           }
           注意: updatedData 中的数值必须是数字类型，用于更新计算器。`;

    try {
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
        
        if (!data || !data.updatedData) throw new Error("Invalid Trade Setup Data");
        return data as TradeSetup;
    } catch (e) {
        console.error("Trade Setup Error", e);
        throw new Error("Failed to generate trade setup.");
    }
};

// --- SMART DISCOVERY SERVICE ---
export const discoverStocksByTheme = async (
  theme: string,
  market: Market,
  lang: Language
): Promise<string[]> => {
  const modelId = "gemini-2.5-flash";
  const marketName = MARKET_CONFIG[lang][market];
  
  const systemInstruction = lang === 'en'
    ? `You are a Senior Financial Research Assistant. 
       User will provide a theme, sector, or concept. 
       Use Google Search to find the top 3-5 most representative or trending stock codes for this theme in the ${marketName}.
       CRITICAL: Return ONLY a JSON array of stock code strings. No other text.`
    : `你是一位资深金融研究助手。
       用户将提供一个主题、板块或概念（如“低空经济”、“高股息”）。
       请利用 Google Search 搜索该主题在 ${marketName} 中最热门、最核心的 3-5 只龙头股票代码。
       **关键**: 仅返回一个包含股票代码字符串的 JSON 数组。不要输出任何其他解释文本。`;

  const prompt = lang === 'en'
    ? `Find top stocks for theme: "${theme}". Return strictly a JSON array of codes, e.g., ["AAPL", "MSFT"]. For A-Shares, use 6-digit codes.`
    : `挖掘主题: "${theme}" 的核心龙头股。仅返回代码 JSON 数组，例如 ["600519", "000858"]。`;

  try {
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
    const text = response.text || "";

    // Parse JSON Array
    let codes: string[] = [];
    const parsed = safeJsonParse(text);
    if (parsed && Array.isArray(parsed)) {
        codes = parsed;
    }

    // Clean codes (remove .SH, .SZ suffixes if present, though we want raw codes mostly)
    // A-Share codes are usually 6 digits.
    return codes.map(c => c.replace(new RegExp('[^a-zA-Z0-9]', 'g'), '')).slice(0, 6); // Limit to top 6

  } catch (error) {
    console.error("Smart Discovery Error", error);
    throw new Error("Failed to discover stocks.");
  }
};

// --- PORTFOLIO SCREENSHOT SERVICE ---
export const parsePortfolioScreenshot = async (
  imageBase64: string,
  market: Market,
  lang: Language
): Promise<any[]> => {
    const modelId = "gemini-2.5-flash";
    const marketName = MARKET_CONFIG[lang][market];

    const systemInstruction = lang === 'en' 
        ? `You are an OCR assistant for financial apps. Extract stock holdings from the screenshot.
           Return a JSON Array of objects: { "code": string, "name": string, "quantity": number, "avgCost": number }.
           If stock code is missing, INFER it from the stock name.`
        : `你是一个金融APP截图识别助手。请从截图中提取持仓信息。
           对于 A股 (同花顺/东方财富等APP)：
           1. 必须提取: "股票名称", "股票代码", "持仓/可用"(作为 quantity), "成本/现价"(取成本价作为 avgCost)。
           2. **关键**: 很多APP截图只显示股票名称(如"云天化")不显示代码。你**必须**根据名称推断出正确的6位A股代码 (如 "600096")。
           3. 返回严格的 JSON 数组: [{ "code": "600096", "name": "云天化", "quantity": 700, "avgCost": 31.455 }, ...]。
           4. 忽略表头和无关文字。`;

    try {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: {
                temperature: 0.1,
                systemInstruction: systemInstruction
            }
        });

        // Strip data prefix
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const mimeType = imageBase64.match(new RegExp('data:([^;]+);'))?.[1] || 'image/jpeg';

        const response = await chat.sendMessage({
            content: [
                { text: `Extract holdings from this ${marketName} app screenshot.` },
                { inlineData: { mimeType, data: base64Data } }
            ]
        });

        const text = response.text || "[]";
        const parsed = safeJsonParse(text);
        
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error("Portfolio Parse Error", error);
        return [];
    }
};

// --- BATCH ANALYSIS SERVICE ---
export const startBatchAnalysis = async (
  stockCodes: string[],
  market: Market,
  lang: Language,
  onStream?: (text: string) => void
): Promise<ChatSessionResult> => {
  const modelId = "gemini-2.5-flash";
  const marketName = MARKET_CONFIG[lang][market];
  const codeList = stockCodes.join(", ");
  
  const systemInstruction = lang === 'en'
    ? `You are a Quantitative Analyst. User will provide a list of stocks. 
       Get real-time data for ALL of them using the search tool.
       CRITICAL RULES:
       1. OUTPUT: STRICT JSON ARRAY ONLY. No markdown outside JSON.
       2. HALLUCINATION CHECK: Verify the Price and Name match the Code.
       3. TIME CHECK: If today is weekend/holiday, use LAST CLOSING price but MARK the date.
       4. MISSING DATA: If live price is not found, DO NOT INVENT ONE. Use "N/A".
       `
    : `你是一位量化分析师。
       **核心任务**: 获取以下 A股/美股/港股 的实时行情，并给出操作建议。
       **严格约束**:
       1. **反幻觉**: 必须通过搜索验证“股票名称”与“代码”是否匹配。如果搜索结果不明确，不要瞎编价格。
       2. **时效性**: 必须返回搜索结果中显示的数据时间 (lastUpdated)。不要自己计算价格。
       3. **输出格式**: 必须仅返回一个严格的 JSON 数组。禁止输出其他文字。`;

  const prompt = lang === 'en' 
    ? `Analyze: [${codeList}].
       Return JSON Array:
       [{
         "code": "string", "name": "string", 
         "price": "string", "change": "string", 
         "lastUpdated": "string (e.g. 12-02 15:00)",
         "signal": "BUY/SELL/HOLD", "confidence": number, 
         "reason": "short summary",
         "targetPrice": "string (Take Profit)",
         "stopLoss": "string (Hard Stop)",
         "action": "string (Next Day Strategy, e.g. 'Buy at 20.5')"
       }]`
    : `分析列表: [${codeList}]。
       返回 JSON 数组 (必须包含以下字段):
       [{
         "code": "代码", "name": "名称", 
         "price": "当前价格 (必需)", "change": "涨跌幅", 
         "lastUpdated": "数据时间 (如: 12-02 15:00, 必须准确)",
         "signal": "信号(BUY/SELL/HOLD)", "confidence": 0-100, 
         "reason": "简短理由",
         "targetPrice": "第一止盈位",
         "stopLoss": "刚性止损位",
         "action": "明日实操指令 (如: '回踩32.5低吸' 或 '冲高减仓')"
       }]`;

  try {
    const ai = getGenAIClient();
    const chat = ai.chats.create({
      model: modelId,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        systemInstruction: systemInstruction,
      },
    });

    const streamResponse = await chat.sendMessageStream({ message: prompt });
    
    let fullText = "";
    for await (const chunk of streamResponse) {
        if (chunk.text) {
            fullText += chunk.text;
            if (onStream) onStream(fullText);
        }
    }

    let batchData: BatchItem[] = [];
    
    const parsed = safeJsonParse(fullText);
    if (Array.isArray(parsed)) {
        batchData = parsed;
    } else if (parsed && typeof parsed === 'object') {
        // @ts-ignore
        batchData = [parsed];
    } else {
         console.warn("Failed to parse batch JSON, falling back to empty.");
    }

    return {
        analysis: {
            isBatch: true,
            batchData: batchData,
            rawText: fullText, 
            symbol: "BATCH",
            timestamp: new Date().toLocaleTimeString(),
            groundingSources: []
        },
        chat: null 
    };

  } catch (error) {
      console.error("Batch Error", error);
      throw new Error("Batch analysis failed.");
  }
};

// --- INLINE PRICE CORRECTION & RE-ANALYSIS ---
export const reanalyzeStockWithUserPrice = async (
    code: string,
    name: string,
    userPrice: string,
    market: Market,
    lang: Language
): Promise<BatchItem> => {
    const modelId = "gemini-2.5-flash";
    const marketName = MARKET_CONFIG[lang][market];

    const systemInstruction = lang === 'en'
        ? `You are a Technical Analyst. The user provides a MANUAL OVERRIDE price for a stock.
           Ignore previous search results. Trust this user price as current truth.
           Recalculate signals, stop loss, and target based on this new price level.`
        : `你是一位技术分析师。用户提供了股票 "${name}" (${code}) 的**人工修正价格**。
           **必须**以用户提供的价格 (${userPrice}) 为准，重新评估当前的技术面形态（是否突破、是否破位）。
           重新计算止盈位、止损位和明日操作策略。
           返回严格 JSON 对象。`;
    
    const prompt = lang === 'en'
        ? `Stock: ${code} (${name}). User Price: ${userPrice}.
           Return JSON Object: { "code": "${code}", "name": "${name}", "price": "${userPrice}", "change": "N/A", "lastUpdated": "Manual Input", "signal": "...", "confidence": ..., "reason": "...", "targetPrice": "...", "stopLoss": "...", "action": "..." }`
        : `股票: ${code} (${name})。当前价格修正为: ${userPrice}。
           请重新分析并返回 JSON 对象:
           {
             "code": "${code}", "name": "${name}", 
             "price": "${userPrice}", "change": "N/A", 
             "lastUpdated": "Manual Input",
             "signal": "...", "confidence": 0-100, 
             "reason": "基于新价格的分析...", 
             "targetPrice": "...", "stopLoss": "...", 
             "action": "..."
           }`;

    try {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: {
                temperature: 0.1,
                systemInstruction: systemInstruction
            }
        });

        const response = await chat.sendMessage({ message: prompt });
        const text = response.text || "{}";
        const data = safeJsonParse(text);

        // FORCE IDENTITY INTEGRITY
        if (data) {
            data.code = code;
            data.name = name;
            data.price = userPrice;
            data.lastUpdated = lang === 'en' ? "Manual Input" : "人工录入";
        }

        return data as BatchItem;

    } catch (e) {
        console.error("Reanalysis Error", e);
        throw new Error("Failed to re-analyze.");
    }
};

// --- SINGLE STOCK ANALYSIS SERVICE ---
export const startStockChat = async (
  stockCode: string, 
  market: Market, 
  lang: Language, 
  mode: AnalysisMode,
  onStream?: (text: string) => void,
  imageBase64?: string
): Promise<ChatSessionResult> => {
  const modelId = "gemini-2.5-flash";
  const marketName = MARKET_CONFIG[lang][market];
  
  // Get current date and time
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  const dateStr = now.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate "Target Data Date"
  let targetDataDate = "Today";
  if (isWeekend) {
      const daysToSubtract = dayOfWeek === 0 ? 2 : 1; 
      const lastFriday = new Date(now);
      lastFriday.setDate(now.getDate() - daysToSubtract);
      const friStr = lastFriday.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { month: 'numeric', day: 'numeric' });
      targetDataDate = lang === 'en' ? `Last Friday (${friStr})` : `上周五 (${friStr})`;
  }

  // Base Identity
  let systemInstruction = lang === 'en' 
    ? `Act as a senior ${marketName} Quantitative Analyst. Current Time: ${dateStr}. `
    : `扮演一位资深${marketName}量化分析师。当前时间: ${dateStr}。`;

  // Image Analysis Instruction
  if (imageBase64) {
      systemInstruction += lang === 'en' 
        ? ` \nVISUAL INPUT DETECTED: The user has uploaded an image (likely a chart, financial report, or news snippet).
           Combine the visual insights from the image with real-time market data search results.
           If the image is a K-line chart, analyze the technical patterns visible.`
        : ` \n**视觉输入检测**: 用户上传了一张图片（可能是K线图、财报或新闻截图）。
           请将图片中的视觉信息（如技术形态、关键点位）与实时联网搜索的市场数据结合进行综合分析。
           如果图片是K线图，请重点解读图中可见的趋势和形态。`;
  }

  // Mode Specific Instructions
  if (mode === 'LIVE') {
    systemInstruction += lang === 'en'
      ? `MODE: LIVE INTRADAY. 
         Priority 1: Find the absolute LATEST price for TODAY (${now.toLocaleDateString()}).
         Priority 2: If Market is CLOSED (Weekend/Night), you MUST find the CLOSE price of ${targetDataDate}. 
         CRITICAL: Do NOT return data older than ${targetDataDate}. Check the date on the search result.`
      : `当前模式: 实时盘中 (LIVE)。
         优先级 1: 获取今日 (${now.toLocaleDateString()}) 的最新实时价格。
         优先级 2: 如果现在是休市时间（周末/晚间），你必须获取 **${targetDataDate}** 的收盘数据。
         **关键要求**: 严禁使用比 ${targetDataDate} 更早的数据（如上周四的数据）。请仔细检查搜索结果的日期。`;
  } else {
    systemInstruction += lang === 'en'
      ? `MODE: SNAPSHOT (CLOSE). Priority: Analyze the LAST COMPLETED TRADING DAY (${targetDataDate}). Focus on precise, finalized technical indicators.`
      : `当前模式: 收盘快照 (SNAPSHOT)。优先级: 分析**上一个完整交易日 (${targetDataDate})** 的收盘数据。专注于基于确定的收盘价进行的精准技术面复盘。`;
  }

  systemInstruction += lang === 'en' 
    ? ` \nTECHNICAL ANALYSIS FALLBACK: If current intraday data is incomplete (e.g. missing High/Low/Volume) or specific indicators are not found, you MUST perform the technical analysis (MA, MACD, KDJ) based on the **Last Complete Trading Day's** data. 
    **DO NOT** state "insufficient data to calculate". Instead, analyze the trend based on the most recent Closing Price and historical context found.`
    : ` \n**技术面分析强制兜底规则**: 如果无法获取今日实时的完整K线数据（如缺失开盘价/最高价/成交量/技术指标），你**必须**基于**上一个完整交易日** (${targetDataDate}) 的收盘数据进行 MA、MACD、KDJ 分析。
    **绝对不要**回答“因数据不足无法分析指标”。你必须根据搜索到的历史K线或前一日收盘情况，推断当前的技术面形态（如：价格依然站在20日均线之上，MACD开口情况等）。`;

  // JSON Extraction Instruction
  const jsonInstruction = lang === 'en'
    ? `\nIMPORTANT: At the very end of your response, you MUST append a JSON block containing the specific trading values for my risk calculator.
       Format:
       \`\`\`json
       {
         "signal": "BUY", 
         "confidence": 85,
         "entryPrice": 78.50,
         "stopLoss": 75.00,
         "targetPrice": 85.00
       }
       \`\`\`
       (Use 'entryPrice' as the average/mid-point of your entry zone. Use 'confidence' as a number 0-100).`
    : `\n**重要指令**: 在回答的最后，你**必须**附带一个 JSON 代码块，提取具体的数值供我的风控计算器使用。
       格式:
       \`\`\`json
       {
         "signal": "BUY", 
         "confidence": 85,
         "entryPrice": 78.50,
         "stopLoss": 75.00,
         "targetPrice": 85.00
       }
       \`\`\`
       (entryPrice 取你建议建仓区间的中间值。confidence 为 0-100 的整数。价格单位统一为元/美元)。`;

  // Initial Prompt Construction
  const modePromptEn = mode === 'LIVE' 
    ? `FETCH LIVE DATA:
       1. Search for "${stockCode} latest price" and "${stockCode} stock quote ${now.getFullYear()}".
       2. If today is weekend/closed, search for "${stockCode} closing price ${targetDataDate}".
       3. ALSO Search for "${stockCode} technical analysis ${targetDataDate}" to get MA/MACD context if live data is just a price.`
    : `FETCH CLOSING DATA: Search for "${stockCode} closing price ${targetDataDate}" and "${stockCode} technical indicators MA MACD".`;

  const modePromptZh = mode === 'LIVE'
    ? `【获取数据指令】:
       1. 搜索 "${stockCode} 最新股价", "${stockCode} 东方财富", "${stockCode} 新浪财经 实时".
       2. **必须验证日期**: 请确认数据是 **今日** 或 **${targetDataDate}** 的。
       3. **技术面补充**: 如果今日只有价格没有指标，请同时搜索 "${stockCode} ${targetDataDate} 技术分析" 或 "${stockCode} 均线 MACD" 以获取前一日指标作为参考。
       4. 如果无法获取实时数据，明确说明使用“最近收盘价”。`
    : `获取收盘数据: 搜索 "${stockCode} 收盘价 ${targetDataDate}" 以及 "${stockCode} 均线 MACD 分析"。`;

  const initialPrompt = lang === 'en' ? `
    Target Stock/Context: ${stockCode}
    Current System Time: ${dateStr}
    Analysis Mode: ${mode}
    ${imageBase64 ? '[IMAGE ATTACHED]: Please analyze the chart or info in the image and cross-reference with live data.' : ''}
    
    ACTION REQUIRED: ${modePromptEn}
    
    Please perform a comprehensive analysis using Search Grounding.
    
    You MUST structure your response strictly in Markdown format with the following sections:

    # 📊 QUANT REPORT: ${stockCode} (${mode === 'LIVE' ? 'Intraday/Latest' : 'Closing Snapshot'})

    ## 1. Market Data Snapshot
    (List Price, Change %, PE, Volume. **CRITICAL: Explicitly state "Data Date: [YYYY-MM-DD]"**.)

    ## 2. Technical Analysis
    (Analyze MA, MACD, KDJ, Bollinger Bands. **RULE: If today's detailed data is missing, analyze the Previous Day's technicals instead. Do not say "unknown".**)
    ${imageBase64 ? '(Incorporate observations from the attached image here)' : ''}

    ## 3. Fundamental News
    (Summarize the top 3 recent news items.)

    ## 4. Quantitative Strategy
    **Signal:** [BUY / SELL / HOLD / WAIT]
    **Confidence:** [0-100]%
    **Risk Level:** [Low / Medium / High]
    
    ## 5. Position Guidance
    (Specific instruction on position sizing.)

    ## 6. Execution Plan & Detailed Setup
    - **Primary Entry Zone:** (Specific price range)
    - **Aggressive/Alternative Entry:** (Breakout level)
    - **Hard Stop Loss:** (Specific price trigger)
    - **Take Profit Target 1:** (Conservative target)
    - **Take Profit Target 2:** (Extended target)
    - **Execution Logic:** (Context/Setup)

    *Disclaimer: This analysis is generated by AI for simulation purposes only.*

    ${jsonInstruction}
    ` : `
    目标股票代码/上下文: ${stockCode}
    当前系统时间: ${dateStr}
    分析模式: ${mode === 'LIVE' ? '实时盘中/最新' : '收盘复盘'}
    ${imageBase64 ? '[已上传图片]: 请分析图片中的图表或信息，并与实时数据交叉验证。' : ''}
    
    关键指令: ${modePromptZh}
    
    请利用实时互联网数据（Search Grounding）对该股票进行全面分析。
    
    你必须严格按照以下 Markdown 格式组织你的回答：

    # 📊 量化分析报告: ${stockCode} (${mode === 'LIVE' ? '实时/最新' : '收盘复盘'})

    ## 1. 市场数据快照
    (列出价格, 涨跌幅, PE, 成交量。**重要: 必须在第一行明确标注: "数据日期: [YYYY年MM月DD日]"** 以证明数据的时效性。如果不匹配今日或${targetDataDate}，请发出警告。)

    ## 2. 技术面分析
    (分析均线 MA, MACD, KDJ, 布林带。**重要兜底规则: 如果今日数据不全，请务必基于上一交易日(${targetDataDate})的收盘数据进行完整分析，并注明“基于昨日收盘数据”。不要回答无法分析。**)
    ${imageBase64 ? '(请结合图片中的K线或信息进行解读)' : ''}

    ## 3. 基本面消息
    (总结影响该股票的前3条近期新闻或公告。)

    ## 4. 量化策略
    **信号:** [买入 / 卖出 / 持有 / 观望]
    **置信度:** [0-100]%
    **风险等级:** [低 / 中 / 高]
    
    ## 5. 仓位指导
    (具体的仓位管理建议。)

    ## 6. 精细化交易执行计划
    - **核心建仓区间:** (高胜率价格带)
    - **激进/备选策略:** (如突破关键位追涨)
    - **刚性止损位:** (明确价格)
    - **第一止盈位:** (保守目标)
    - **第二止盈位:** (博弈主升浪的目标价格)
    - **操作细节:** (如："分批低吸", "尾盘确认")

    *免责声明: 本分析由AI生成，仅用于模拟，不构成实际投资建议。*

    ${jsonInstruction}
    `;

  try {
    const ai = getGenAIClient();
    
    const chat = ai.chats.create({
      model: modelId,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1, 
        systemInstruction: systemInstruction,
      },
    });

    // Handle Multimodal (Image + Text) or Text only
    let messageContent: any = initialPrompt;
    
    if (imageBase64) {
        // Strip data prefix if present (e.g. data:image/png;base64,)
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const mimeType = imageBase64.match(new RegExp('data:([^;]+);'))?.[1] || 'image/jpeg';
        
        messageContent = [
            { text: initialPrompt },
            { 
                inlineData: { 
                    mimeType: mimeType, 
                    data: base64Data 
                } 
            }
        ];
    }

    const streamResponse = await chat.sendMessageStream({ message: messageContent });
    
    let fullText = "";
    let groundingChunks: any[] = [];

    for await (const chunk of streamResponse) {
      const c = chunk as GenerateContentResponse;
      const chunkText = c.text;
      
      if (chunkText) {
        fullText += chunkText;
        if (onStream) {
          onStream(fullText);
        }
      }

      if (c.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        groundingChunks.push(...c.candidates[0].groundingMetadata.groundingChunks);
      }
    }
    
    let text = fullText || (lang === 'en' ? "No analysis generated." : "未生成分析结果。");
    
    let structuredData: StructuredAnalysisData | undefined;
    
    const parsed = safeJsonParse(text);
    if (parsed && parsed.signal) {
        structuredData = parsed;
        const jsonBlockRegex = new RegExp('```(?:json)?\\s*(\\{[\\s\\S]*?"signal"[\\s\\S]*?"entryPrice"[\\s\\S]*?\\})\\s*```', 'i');
        text = text.replace(jsonBlockRegex, '').trim();
    }

    const groundingSources = groundingChunks
      .map((chunk) => chunk.web)
      .filter((web) => web !== undefined) as Array<{ uri: string; title: string }>;

    const uniqueSources = Array.from(new Map(groundingSources.map(s => [s.uri, s])).values()) as Array<{ uri: string; title: string }>;

    return {
      analysis: {
        rawText: text,
        symbol: stockCode || (lang === 'en' ? 'IMAGE ANALYSIS' : '图片分析'),
        timestamp: new Date().toLocaleTimeString(),
        groundingSources: uniqueSources,
        structuredData,
      },
      chat: chat
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    const errorMsg = lang === 'en' 
      ? "Failed to analyze. Please check API Key or try again later."
      : "分析失败。请检查网络或 API Key 设置。";
    throw new Error(error instanceof Error ? error.message : errorMsg);
  }
};

export const sendFollowUpMessage = async (
  chat: Chat, 
  message: string,
  onStream?: (text: string) => void
): Promise<string> => {
  try {
    const streamResponse = await chat.sendMessageStream({ message });
    let fullText = "";

    for await (const chunk of streamResponse) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        fullText += c.text;
        if (onStream) {
          onStream(fullText);
        }
      }
    }
    return fullText;
  } catch (error) {
    console.error("Follow-up Error:", error);
    throw new Error("Failed to process follow-up message.");
  }
};