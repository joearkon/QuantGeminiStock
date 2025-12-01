import React, { useState, useRef } from 'react';
import { startStockChat, sendFollowUpMessage } from './services/geminiService';
import { AnalysisResult, Language, Market, ChatMessage, AnalysisMode } from './types';
import { TerminalLoader } from './components/TerminalLoader';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { Chat } from '@google/genai';

const TRANSLATIONS = {
  en: {
    subtitle: "Global Quant Analysis v2.5",
    heroTitlePrefix: "AI-Powered",
    heroTitleHighlight: "Quant Strategy",
    heroDesc: "Select a market and enter a stock code. Our engine retrieves real-time global market data to generate professional trading guidance and position management strategies.",
    analyzeBtn: "Analyze",
    newAnalysis: "New Analysis",
    sources: "Live Data Sources",
    sourceGemini: "Data retrieved via Gemini Knowledge Base",
    strategyKey: "Strategy Key",
    buy: "Buy",
    buyDesc: "Entry signal active",
    sell: "Sell",
    sellDesc: "Exit/Risk reduction",
    hold: "Hold",
    holdDesc: "Maintain position",
    wait: "Wait",
    waitDesc: "No clear setup",
    disclaimer: "QuantGemini does not provide financial advice. All analysis is generated based on technical indicators and internet data. Stock market involves risk.",
    errorTitle: "Analysis Failed",
    tryAgain: "Try Again",
    exportMD: "Export MD",
    exportPDF: "Export PDF",
    followUpTitle: "Tactical Execution Log",
    followUpPlaceholder: "Update status or ask for adjustment (e.g., 'Bought at 20.50' or 'Volume spiking')...",
    send: "Send",
    thinking: "Analyst is thinking...",
    markets: {
      'A_SHARE': 'A-Share',
      'US_STOCK': 'US Stock',
      'HK_STOCK': 'HK Stock'
    },
    placeholders: {
      'A_SHARE': 'Enter Code (e.g., 600519)',
      'US_STOCK': 'Enter Symbol (e.g., AAPL, NVDA)',
      'HK_STOCK': 'Enter Code (e.g., 00700)'
    },
    quickActions: {
      entry: "🔵 Triggered Entry",
      stop: "🔴 Hit Stop Loss",
      target1: "🟢 Reached Target 1",
      breakout: "🚀 Price Breakout"
    },
    modes: {
      LIVE: '🚀 Live / Intraday',
      SNAPSHOT: '📸 Close / Snapshot'
    }
  },
  zh: {
    subtitle: "全球量化分析系统 v2.5",
    heroTitlePrefix: "AI驱动",
    heroTitleHighlight: "量化交易策略",
    heroDesc: "选择市场并输入股票代码。我们的引擎将检索全球实时市场数据，并生成专业的交易指导和仓位管理策略。",
    analyzeBtn: "开始分析",
    newAnalysis: "重新分析",
    sources: "实时数据源",
    sourceGemini: "数据检索自 Gemini 知识库",
    strategyKey: "策略图例",
    buy: "买入",
    buyDesc: "建仓信号激活",
    sell: "卖出",
    sellDesc: "离场/降低风险",
    hold: "持有",
    holdDesc: "维持当前仓位",
    wait: "观望",
    waitDesc: "暂无明确机会",
    disclaimer: "QuantGemini 不提供投资建议。所有分析基于技术指标和互联网数据生成。股市有风险，投资需谨慎。",
    errorTitle: "分析失败",
    tryAgain: "重试",
    exportMD: "导出 MD",
    exportPDF: "导出 PDF",
    followUpTitle: "战术执行日志",
    followUpPlaceholder: "更新状态或请求调整 (如: '已在 20.50 买入' 或 '量能突增')...",
    send: "发送",
    thinking: "分析师思考中...",
    markets: {
      'A_SHARE': 'A股',
      'US_STOCK': '美股',
      'HK_STOCK': '港股'
    },
    placeholders: {
      'A_SHARE': '输入代码 (如 600519, 茅台)',
      'US_STOCK': '输入代码 (如 AAPL, TSLA)',
      'HK_STOCK': '输入代码 (如 00700, 腾讯)'
    },
    quickActions: {
      entry: "🔵 已触发建仓",
      stop: "🔴 触发止损",
      target1: "🟢 到达第一止盈",
      breakout: "🚀 价格突破"
    },
    modes: {
      LIVE: '🚀 实时 / 盘中',
      SNAPSHOT: '📸 复盘 / 快照'
    }
  }
};

const App: React.FC = () => {
  const [stockCode, setStockCode] = useState('');
  const [market, setMarket] = useState<Market>('A_SHARE');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('LIVE');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('zh');
  
  // Chat Session State
  const chatSessionRef = useRef<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);

  const t = TRANSLATIONS[language];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockCode.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setChatHistory([]);

    try {
      const { analysis, chat } = await startStockChat(stockCode, market, language, analysisMode);
      setResult(analysis);
      chatSessionRef.current = chat;
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUpSubmit = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || followUpInput;
    
    if (!textToSend.trim() || !chatSessionRef.current) return;

    // Add user message to UI immediately
    const userMsg: ChatMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString()
    };
    setChatHistory(prev => [...prev, userMsg]);
    setFollowUpInput('');
    setIsFollowUpLoading(true);

    try {
      const responseText = await sendFollowUpMessage(chatSessionRef.current, textToSend);
      const aiMsg: ChatMessage = {
        role: 'model',
        content: responseText,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      // Optional: Show error toast
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  const clearAnalysis = () => {
    setResult(null);
    setStockCode('');
    setError(null);
    setChatHistory([]);
    chatSessionRef.current = null;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  const handleDownloadMD = () => {
    if (!result) return;
    let fullContent = result.rawText;
    chatHistory.forEach(msg => {
      fullContent += `\n\n## ${msg.role === 'user' ? 'User Update' : 'Analyst Follow-up'} (${msg.timestamp})\n${msg.content}`;
    });

    const blob = new Blob([fullContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QuantReport_${result.symbol}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800 no-print">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              Q
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Quant<span className="text-blue-500">Gemini</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
               onClick={toggleLanguage}
               className="px-3 py-1 rounded-full border border-slate-700 text-xs font-mono text-slate-400 hover:text-white hover:border-slate-500 transition-all"
             >
               {language === 'en' ? 'CN / EN' : '中 / 英'}
             </button>
             <div className="text-xs font-mono text-slate-500 hidden sm:block">
               {t.subtitle}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Intro Section */}
        {!result && !loading && (
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              {t.heroTitlePrefix} <br className="md:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                {t.heroTitleHighlight}
              </span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              {t.heroDesc}
            </p>
          </div>
        )}

        {/* Input Section */}
        {!result && !loading && (
          <div className="max-w-xl mx-auto space-y-4">
            
            {/* Market & Mode Selector Wrapper */}
            <div className="space-y-3">
                {/* Market Selector */}
                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                  {(['A_SHARE', 'US_STOCK', 'HK_STOCK'] as Market[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMarket(m)}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                        market === m 
                          ? 'bg-slate-800 text-white shadow-sm' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {t.markets[m]}
                    </button>
                  ))}
                </div>

                {/* Analysis Mode Toggle */}
                <div className="flex justify-center">
                   <div className="inline-flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                     <button
                        onClick={() => setAnalysisMode('LIVE')}
                        className={`px-4 py-1.5 text-xs font-mono rounded-md transition-all flex items-center gap-2 ${
                            analysisMode === 'LIVE'
                            ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50 shadow-sm'
                            : 'text-slate-500 hover:text-slate-400'
                        }`}
                     >
                       {t.modes.LIVE}
                     </button>
                     <button
                        onClick={() => setAnalysisMode('SNAPSHOT')}
                        className={`px-4 py-1.5 text-xs font-mono rounded-md transition-all flex items-center gap-2 ${
                            analysisMode === 'SNAPSHOT'
                            ? 'bg-purple-900/40 text-purple-300 border border-purple-800/50 shadow-sm'
                            : 'text-slate-500 hover:text-slate-400'
                        }`}
                     >
                       {t.modes.SNAPSHOT}
                     </button>
                   </div>
                </div>
            </div>

            <div className="bg-slate-900/50 p-2 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm transition-all hover:border-slate-700 hover:shadow-2xl">
              <form onSubmit={handleSearch} className="relative flex items-center">
                <input
                  type="text"
                  value={stockCode}
                  onChange={(e) => setStockCode(e.target.value)}
                  placeholder={t.placeholders[market]}
                  className="w-full bg-transparent text-white text-lg px-6 py-4 outline-none placeholder:text-slate-600 font-mono"
                />
                <button
                  type="submit"
                  disabled={!stockCode.trim()}
                  className="absolute right-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
                >
                  {t.analyzeBtn}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Loading View */}
        {loading && (
          <div className="mt-8">
            <TerminalLoader lang={language} key={language} />
          </div>
        )}

        {/* Error View */}
        {error && (
          <div className="mt-8 max-w-2xl mx-auto p-6 bg-rose-950/30 border border-rose-900/50 rounded-xl text-center">
             <div className="text-rose-500 text-lg font-semibold mb-2">{t.errorTitle}</div>
             <p className="text-rose-300/80 mb-4">{error}</p>
             <button 
               onClick={() => setError(null)}
               className="text-sm text-rose-400 hover:text-white underline underline-offset-4"
             >
               {t.tryAgain}
             </button>
          </div>
        )}

        {/* Result View */}
        {result && (
          <div className="animate-fade-in-up mt-4">
             {/* Toolbar */}
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 no-print">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={clearAnalysis}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    {t.newAnalysis}
                  </button>

                  {/* Mode Indicator in Result View */}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    analysisMode === 'LIVE' 
                      ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' 
                      : 'bg-purple-900/20 text-purple-400 border-purple-900/50'
                  }`}>
                    {analysisMode === 'LIVE' ? 'LIVE MODE' : 'SNAPSHOT MODE'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                   <button 
                     onClick={handleDownloadMD}
                     className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-2"
                   >
                     <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                     </svg>
                     {t.exportMD}
                   </button>
                   <button 
                     onClick={handlePrintPDF}
                     className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center gap-2"
                   >
                     <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                     </svg>
                     {t.exportPDF}
                   </button>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content Area (Report + Chat) */}
                <div id="printable-report" className="lg:col-span-8 flex flex-col gap-6">
                   
                   {/* Main Analysis Card */}
                   <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none no-print">
                          <svg className="w-32 h-32 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                          </svg>
                      </div>
                      <div className="mb-4 text-xs text-slate-500 font-mono no-print">
                          {market} | {result.timestamp}
                      </div>
                      <MarkdownRenderer content={result.rawText} />
                   </div>

                   {/* Chat History */}
                   {chatHistory.map((msg, index) => (
                     <div 
                       key={index} 
                       className={`rounded-2xl p-6 border ${
                         msg.role === 'user' 
                           ? 'bg-slate-800/50 border-slate-700 ml-8' 
                           : 'bg-slate-900 border-slate-800 mr-8 shadow-xl'
                       }`}
                     >
                       <div className="flex items-center gap-2 mb-2">
                         <div className={`w-2 h-2 rounded-full ${msg.role === 'user' ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>
                         <span className="text-xs font-mono text-slate-500 uppercase">
                           {msg.role === 'user' ? 'Trader' : 'Quant Analyst'} • {msg.timestamp}
                         </span>
                       </div>
                       {msg.role === 'user' ? (
                         <p className="text-slate-200">{msg.content}</p>
                       ) : (
                         <MarkdownRenderer content={msg.content} />
                       )}
                     </div>
                   ))}

                   {/* Follow-up Loading Indicator */}
                   {isFollowUpLoading && (
                     <div className="flex items-center gap-3 text-slate-500 p-4 animate-pulse">
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        <span className="text-sm font-mono">{t.thinking}</span>
                     </div>
                   )}
                   
                   {/* Tactical Command Input - Hidden when printing */}
                   <div className="no-print sticky bottom-6 z-40">
                     <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">{t.followUpTitle}</label>
                          </div>
                          
                          {/* Quick Actions */}
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleFollowUpSubmit(undefined, t.quickActions.entry)} className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-blue-900/40 hover:text-blue-300 border border-slate-700 rounded-md transition-colors">{t.quickActions.entry}</button>
                            <button onClick={() => handleFollowUpSubmit(undefined, t.quickActions.stop)} className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-rose-900/40 hover:text-rose-300 border border-slate-700 rounded-md transition-colors">{t.quickActions.stop}</button>
                            <button onClick={() => handleFollowUpSubmit(undefined, t.quickActions.target1)} className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-emerald-900/40 hover:text-emerald-300 border border-slate-700 rounded-md transition-colors">{t.quickActions.target1}</button>
                            <button onClick={() => handleFollowUpSubmit(undefined, t.quickActions.breakout)} className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-purple-900/40 hover:text-purple-300 border border-slate-700 rounded-md transition-colors">{t.quickActions.breakout}</button>
                          </div>

                          <form onSubmit={(e) => handleFollowUpSubmit(e)} className="relative">
                            <input
                              type="text"
                              value={followUpInput}
                              onChange={(e) => setFollowUpInput(e.target.value)}
                              placeholder={t.followUpPlaceholder}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-4 pr-12 text-sm focus:border-blue-500 outline-none text-slate-200 placeholder:text-slate-600"
                            />
                            <button 
                              type="submit" 
                              disabled={!followUpInput.trim() || isFollowUpLoading}
                              className="absolute right-1 top-1 bottom-1 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
                            >
                              {t.send}
                            </button>
                          </form>
                        </div>
                     </div>
                   </div>
                </div>

                {/* Sidebar - Strategy Key & Sources */}
                <div className="lg:col-span-4 space-y-6 no-print">
                   {/* Strategy Key */}
                   <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">{t.strategyKey}</h3>
                      <div className="space-y-3">
                         <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></span>
                            <div>
                               <div className="text-emerald-400 font-bold text-sm">{t.buy}</div>
                               <div className="text-slate-500 text-xs">{t.buyDesc}</div>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.5)]"></span>
                            <div>
                               <div className="text-rose-400 font-bold text-sm">{t.sell}</div>
                               <div className="text-slate-500 text-xs">{t.sellDesc}</div>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></span>
                            <div>
                               <div className="text-yellow-400 font-bold text-sm">{t.hold}</div>
                               <div className="text-slate-500 text-xs">{t.holdDesc}</div>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            <div>
                               <div className="text-slate-400 font-bold text-sm">{t.wait}</div>
                               <div className="text-slate-500 text-xs">{t.waitDesc}</div>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Sources */}
                   <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">{t.sources}</h3>
                      <div className="space-y-2">
                        {result.groundingSources && result.groundingSources.length > 0 ? (
                            result.groundingSources.map((source, idx) => (
                                <a 
                                  key={idx} 
                                  href={source.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="block text-xs text-blue-400 hover:text-blue-300 hover:underline truncate"
                                >
                                  {idx + 1}. {source.title}
                                </a>
                            ))
                        ) : (
                             <div className="text-xs text-slate-500 italic">{t.sourceGemini}</div>
                        )}
                      </div>
                   </div>
                   
                   {/* Disclaimer */}
                   <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800">
                     <p className="text-[10px] text-slate-500 leading-relaxed text-justify">
                       {t.disclaimer}
                     </p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;