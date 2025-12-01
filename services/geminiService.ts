import { GoogleGenAI, Chat } from "@google/genai";
import { AnalysisResult, Language, Market, AnalysisMode } from "../types";

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
  chat: Chat;
}

// Helper to safely initialize the client only when needed
const getGenAIClient = () => {
  try {
    // Check if process is defined to avoid ReferenceError in some browser runtimes
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    // If the build tool replaced process.env.API_KEY with a string, the above might be dead code,
    // so we try the direct access pattern which is standard for the prompt requirements.
    // However, we wrap it to be safe.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  } catch (error) {
    console.error("Gemini Client Initialization Failed:", error);
    throw new Error("API Key configuration is missing or invalid. Please check your deployment settings.");
  }
};

export const startStockChat = async (stockCode: string, market: Market, lang: Language, mode: AnalysisMode): Promise<ChatSessionResult> => {
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

  // Calculate "Target Data Date" (e.g., if Sunday, target Friday)
  let targetDataDate = "Today";
  if (isWeekend) {
      const daysToSubtract = dayOfWeek === 0 ? 2 : 1; // Sun -> -2 days (Fri), Sat -> -1 day (Fri)
      const lastFriday = new Date(now);
      lastFriday.setDate(now.getDate() - daysToSubtract);
      const friStr = lastFriday.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { month: 'numeric', day: 'numeric' });
      targetDataDate = lang === 'en' ? `Last Friday (${friStr})` : `上周五 (${friStr})`;
  }

  // Base Identity
  let systemInstruction = lang === 'en' 
    ? `Act as a senior ${marketName} Quantitative Analyst. Current Time: ${dateStr}. `
    : `扮演一位资深${marketName}量化分析师。当前时间: ${dateStr}。`;

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

  // Initial Prompt Construction - Optimized for freshness
  const modePromptEn = mode === 'LIVE' 
    ? `FETCH LIVE DATA:
       1. Search for "${stockCode} latest price" and "${stockCode} stock quote ${now.getFullYear()}".
       2. If today is weekend, search for "${stockCode} closing price last Friday".
       3. VERIFY the date. If the data is not from Today or ${targetDataDate}, keep searching.`
    : `FETCH CLOSING DATA: Search for "${stockCode} closing price ${targetDataDate}" and "${stockCode} historical data".`;

  const modePromptZh = mode === 'LIVE'
    ? `【获取最新数据指令】:
       1. 搜索 "${stockCode} 最新股价", "${stockCode} 东方财富", "${stockCode} 新浪财经 实时".
       2. **必须验证日期**: 请确认数据是 **今日** 或 **${targetDataDate}** 的。
       3. 如果搜索结果显示的是几天前的数据（例如上周四），请忽略它，继续寻找 **${targetDataDate}** (上周五) 的数据。
       4. 如果无法获取实时数据，请明确说明使用“最近收盘价”。`
    : `获取收盘数据: 搜索 "${stockCode} 收盘价 ${targetDataDate}" 或 "${stockCode} 历史行情"。`;

  const initialPrompt = lang === 'en' ? `
    Target Stock: ${stockCode}
    Current System Time: ${dateStr}
    Analysis Mode: ${mode}
    
    ACTION REQUIRED: ${modePromptEn}
    
    Please perform a comprehensive analysis using Search Grounding.
    
    You MUST structure your response strictly in Markdown format with the following sections:

    # 📊 QUANT REPORT: ${stockCode} (${mode === 'LIVE' ? 'Intraday/Latest' : 'Closing Snapshot'})

    ## 1. Market Data Snapshot
    (List Price, Change %, PE, Volume. **CRITICAL: Explicitly state "Data Date: [YYYY-MM-DD]"** to prove freshness.)

    ## 2. Technical Analysis
    (Analyze MA, MACD, KDJ, Bollinger Bands. If LIVE, mention these are dynamic.)

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
    ` : `
    目标股票代码: ${stockCode}
    当前系统时间: ${dateStr}
    分析模式: ${mode === 'LIVE' ? '实时盘中/最新' : '收盘复盘'}
    
    关键指令: ${modePromptZh}
    
    请利用实时互联网数据（Search Grounding）对该股票进行全面分析。
    
    你必须严格按照以下 Markdown 格式组织你的回答：

    # 📊 量化分析报告: ${stockCode} (${mode === 'LIVE' ? '实时/最新' : '收盘复盘'})

    ## 1. 市场数据快照
    (列出价格, 涨跌幅, PE, 成交量。**重要: 必须在第一行明确标注: "数据日期: [YYYY年MM月DD日]"** 以证明数据的时效性。如果不匹配今日或${targetDataDate}，请发出警告。)

    ## 2. 技术面分析
    (分析均线 MA, MACD, KDJ, 布林带。**重要: 如果是LIVE模式，请注明指标随股价变动；如果是SNAPSHOT模式，基于确定的收盘价分析。**)

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
    `;

  try {
    // Initialize AI Client Here to prevent top-level crash on Vercel/Edge
    const ai = getGenAIClient();
    
    const chat = ai.chats.create({
      model: modelId,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1, 
        systemInstruction: systemInstruction,
      },
    });

    const response = await chat.sendMessage({ message: initialPrompt });
    const text = response.text || (lang === 'en' ? "No analysis generated." : "未生成分析结果。");
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingSources = groundingChunks
      .map((chunk) => chunk.web)
      .filter((web) => web !== undefined) as Array<{ uri: string; title: string }>;

    return {
      analysis: {
        rawText: text,
        symbol: stockCode,
        timestamp: new Date().toLocaleTimeString(),
        groundingSources,
      },
      chat: chat
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    const errorMsg = lang === 'en' 
      ? "Failed to analyze. Please check API Key in deployment settings."
      : "分析失败。请检查部署设置中的 API Key 配置。";
    throw new Error(error instanceof Error ? error.message : errorMsg);
  }
};

export const sendFollowUpMessage = async (chat: Chat, message: string): Promise<string> => {
  try {
    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Follow-up Error:", error);
    throw new Error("Failed to process follow-up message.");
  }
};
