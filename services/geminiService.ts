import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, Language, Market, AnalysisMode, StructuredAnalysisData, BatchItem, PortfolioItem } from "../types";

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
const getGenAIClient = () => {
  let apiKey = '';

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
    tryGet(() => import.meta.env?.NEXT_PUBLIC_API_KEY) ||
    '';

  if (!apiKey) {
    console.error("Gemini API Key missing. Please check your environment variables.");
    throw new Error("API Key is missing. Ensure 'API_KEY' (or 'VITE_API_KEY' for Vite) is set in your environment.");
  }

  return new GoogleGenAI({ apiKey });
};

// --- HELPER: Safe JSON Parser ---
const safeJsonParse = (text: string): any => {
    try {
        // 1. Remove Markdown code blocks
        let cleanText = text.replace(new RegExp("```(?:json)?", "gi"), "").replace(new RegExp("```", "g"), "").trim();
        
        // 2. Remove comments (single line and multi-line)
        cleanText = cleanText.replace(new RegExp("//.*", "g"), "").replace(new RegExp("/\\*[\\s\\S]*?\\*/", "g"), "");

        // 3. Find first '[' or '{' and last ']' or '}'
        const firstArr = cleanText.indexOf('\x5B'); // [
        const firstObj = cleanText.indexOf('\x7B'); // {
        const lastArr = cleanText.lastIndexOf('\x5D'); // ]
        const lastObj = cleanText.lastIndexOf('\x7D'); // }

        let start = -1;
        let end = -1;

        // Determine if array or object comes first
        if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
             start = firstArr;
             end = lastArr;
        } else if (firstObj !== -1) {
             start = firstObj;
             end = lastObj;
        }

        if (start !== -1 && end !== -1 && end > start) {
            cleanText = cleanText.substring(start, end + 1);
        }

        // 4. Handle trailing commas before closing brackets/braces
        // Replace ,] with ] and ,} with }
        cleanText = cleanText.replace(new RegExp(",\\s*\x5D", "g"), "\x5D").replace(new RegExp(",\\s*\x7D", "g"), "\x7D");

        return JSON.parse(cleanText);
    } catch (e) {
        console.warn("Safe JSON Parse failed:", e);
        return null;
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
    return codes.map(c => c.toString().replace(new RegExp("[^a-zA-Z0-9]", "g"), '')).slice(0, 6); // Limit to top 6

  } catch (error) {
    console.error("Smart Discovery Error", error);
    throw new Error("Failed to discover stocks.");
  }
};

// --- PORTFOLIO PARSING SERVICE ---
export const parsePortfolioScreenshot = async (
    imageBase64: string,
    market: Market,
    lang: Language
): Promise<PortfolioItem[]> => {
    const modelId = "gemini-2.5-flash";
    const prompt = lang === 'en' 
      ? `Analyze this portfolio screenshot. Extract stock holdings.
         Return JSON Array: [{ "code": "string", "name": "string", "quantity": number, "avgCost": number }].
         If code is missing, INFER it from the name (e.g. 'AAPL' for Apple). For A-Shares, infer 6-digit code.`
      : `分析这张持仓截图。提取持仓信息。
         对于类似同花顺等APP截图，如果**没有直接显示股票代码**，你必须根据**股票名称**（如“云天化”）去推断并填充正确的 A股6位代码（如“600096”）。这是必须的。
         列映射提示：
         - "持仓/可用" -> quantity (取持仓数)
         - "成本/现价" -> avgCost (取成本价，通常是第一行的数字)
         
         返回严格的 JSON 数组: [{ "code": "代码", "name": "名称", "quantity": 数量, "avgCost": 成本均价 }]。
         不要输出 markdown，只输出 JSON。`;

    try {
        const ai = getGenAIClient();
        const chat = ai.chats.create({
            model: modelId,
            config: {
                systemInstruction: "You are a data extraction assistant. Output strict JSON only.",
                temperature: 0.1
            }
        });

        // Strip data prefix if present
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        const mimeType = imageBase64.match(new RegExp("data:([^;]+);"))?.[1] || 'image/jpeg';

        const response = await chat.sendMessage({
            message: [
                { text: prompt },
                { inlineData: { mimeType, data: base64Data } }
            ]
        });

        const text = response.text || "";
        const parsed = safeJsonParse(text);

        if (Array.isArray(parsed)) {
            return parsed.map((item: any) => ({
                code: item.code || "UNKNOWN",
                market: market,
                addedAt: Date.now(),
                name: item.name,
                quantity: Number(item.quantity) || 0,
                avgCost: Number(item.avgCost) || 0
            }));
        }
        return [];
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
    ? `You are a Strict Data Aggregator. User provides stock codes. 
       Get REAL-TIME data. 
       ANTI-HALLUCINATION RULE: If you cannot find the EXACT LATEST price in the search results, return "N/A" or the last available closing price and clearly mark the date. DO NOT INVENT NUMBERS.
       CRITICAL: Return strictly a JSON array. No markdown.`
    : `你是一位严谨的数据聚合师。用户提供股票代码。
       请获取**实时**数据。
       **反幻觉铁律**: 如果搜索结果中没有找到该股票**今日**的明确价格，必须返回 'N/A' 或**上一个交易日收盘价**，并必须在 "lastUpdated" 字段中注明日期。
       **严禁**捏造价格或张冠李戴（务必核对股票名称与代码是否匹配）。
       **关键**: 仅返回严格的 JSON 数组。`;

  const prompt = lang === 'en' 
    ? `Analyze these stocks in ${marketName}: [${codeList}].
       Fetch LATEST price (check date carefully!).
       
       Return JSON Array:
       {
         "code": "string",
         "name": "string", 
         "price": "string (e.g. 33.35)", 
         "lastUpdated": "string (e.g. 12-02 15:00 or 'Yesterday Close')",
         "change": "string (e.g. +1.2%)", 
         "signal": "BUY/SELL/HOLD/WAIT", 
         "confidence": number, 
         "reason": "summary", 
         "targetPrice": "string", 
         "stopLoss": "string", 
         "action": "Next day strategy"
       }`
    : `分析 ${marketName} 的这些股票: [${codeList}]。
       
       **任务要求**:
       1. 获取**最新**价格和涨跌幅。如果今日未开盘或数据缺失，使用**最近一次收盘数据**。
       2. **必须**填写 "lastUpdated" 字段，注明数据的时间来源（例如 "12-02 15:00" 或 "昨日收盘"）。
       3. 计算 "targetPrice" (第一止盈) 和 "stopLoss" (刚性止损)。
       4. 生成 "action" (明日简令)。

       返回 JSON 数组，包含:
       "code", "name", "price", "lastUpdated" (重要!), "change", "signal", "confidence", "reason", "targetPrice", "stopLoss", "action".`;

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

    if (parsed) {
        if (Array.isArray(parsed)) {
            batchData = parsed;
        } else if (typeof parsed === 'object') {
             // Handle single object return
             // @ts-ignore
             batchData = [parsed];
        }
    }

    if (batchData.length === 0) {
        console.error("Batch Analysis yielded no valid JSON array:", fullText);
        throw new Error("Invalid JSON format received from AI.");
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
        const mimeType = imageBase64.match(new RegExp("data:([^;]+);"))?.[1] || 'image/jpeg';
        
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
    
    // Parse Config JSON
    let structuredData: StructuredAnalysisData | undefined;
    
    // Use safeJsonParse to extract the last JSON block
    const parsed = safeJsonParse(text);
    if (parsed && !Array.isArray(parsed) && parsed.signal) {
        structuredData = parsed;
        // Optionally clean the text display
        // We do a simple replace of the last JSON block pattern if possible to keep UI clean
        // But markdown renderer also handles this.
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