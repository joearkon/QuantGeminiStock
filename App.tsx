import React, { useState, useRef, useEffect } from 'react';
import { startStockChat, startBatchAnalysis, sendFollowUpMessage, discoverStocksByTheme } from './services/geminiService';
import { AnalysisResult, Language, Market, ChatMessage, AnalysisMode, BatchItem } from './types';
import { TerminalLoader } from './components/TerminalLoader';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { QuantTools } from './components/QuantTools';
import { Chat } from '@google/genai';

const TRANSLATIONS = {
  en: {
    subtitle: "Global Quant Analysis v2.5",
    heroTitlePrefix: "AI-Powered",
    heroTitleHighlight: "Quant Strategy",
    heroDesc: "Select a market and enter stock code(s). For batch analysis, separate codes with spaces or commas (e.g. 'AAPL MSFT'). Our engine generates professional trading guidance.",
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
    batchTitle: "Batch Intelligence Scanner",
    batchSubtitle: "Multi-Asset Real-time Comparison",
    backToBatch: "← Back to Batch Results",
    markets: {
      'A_SHARE': 'A-Share',
      'US_STOCK': 'US Stock',
      'HK_STOCK': 'HK Stock'
    },
    placeholders: {
      'A_SHARE': 'Enter Code(s) e.g., 600519 000001',
      'US_STOCK': 'Enter Code(s) e.g., AAPL NVDA',
      'HK_STOCK': 'Enter Code(s) e.g., 00700 03690'
    },
    discoveryPlaceholders: {
      'A_SHARE': 'Enter theme (e.g., High Dividend Banks)...',
      'US_STOCK': 'Enter theme (e.g., AI Chip Makers)...',
      'HK_STOCK': 'Enter theme (e.g., Tech Giants)...'
    },
    quickActions: {
      entry: "🔵 Triggered Entry",
      stop: "🔴 Hit Stop Loss",
      target1: "🔴 Reached Target 1",
      breakout: "🚀 Price Breakout"
    },
    modes: {
      LIVE: '🚀 Live / Intraday',
      SNAPSHOT: '📸 Close / Snapshot'
    },
    searchTabs: {
        code: "⌨️ Code Input",
        discovery: "🔍 Smart Discovery"
    },
    discovering: "Scanning market for related assets...",
    uploadImage: "Analyze Chart/Image"
  },
  zh: {
    subtitle: "全球量化分析系统 v2.5",
    heroTitlePrefix: "AI驱动",
    heroTitleHighlight: "量化交易策略",
    heroDesc: "选择市场并输入股票代码。支持批量分析（用空格或逗号分隔，如 '600519 000001'）。AI 引擎将为您提供专业的交易指导和风控策略。",
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
    batchTitle: "批量情报扫描",
    batchSubtitle: "多资产实时比对系统",
    backToBatch: "← 返回批量结果列表",
    markets: {
      'A_SHARE': 'A股',
      'US_STOCK': '美股',
      'HK_STOCK': '港股'
    },
    placeholders: {
      'A_SHARE': '输入代码 (支持多只，如 600519 000001)',
      'US_STOCK': '输入代码 (支持多只，如 AAPL MSFT)',
      'HK_STOCK': '输入代码 (支持多只，如 00700 09988)'
    },
    discoveryPlaceholders: {
      'A_SHARE': '输入行业/概念 (如: 低空经济龙头)...',
      'US_STOCK': '输入行业/概念 (如: AI 芯片龙头)...',
      'HK_STOCK': '输入行业/概念 (如: 互联网科技股)...'
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
    },
    searchTabs: {
        code: "⌨️ 输入代码",
        discovery: "🔍 智能选股"
    },
    discovering: "正在挖掘相关标的...",
    uploadImage: "分析图表/截图"
  }
};

// Define specific View States for clearer navigation logic
type ViewState = 'HOME' | 'BATCH_LIST' | 'SINGLE_REPORT';
type SearchMode = 'CODE' | 'DISCOVERY';

const App: React.FC = () => {
  const [stockCode, setStockCode] = useState('');
  const [market, setMarket] = useState<Market>('A_SHARE');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('LIVE');
  const [language, setLanguage] = useState<Language>('zh');
  const [searchMode, setSearchMode] = useState<SearchMode>('CODE');
  
  // Navigation State
  const [viewState, setViewState] = useState<ViewState>('HOME');
  
  // Data States
  const [isLoading, setIsLoading] = useState(false); 
  const [loadingText, setLoadingText] = useState<string>(''); // Custom loading text
  const [streamingAnalysisText, setStreamingAnalysisText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Image State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Separate results for Batch and Single to support navigation
  const [singleResult, setSingleResult] = useState<AnalysisResult | null>(null);
  const [batchCache, setBatchCache] = useState<AnalysisResult | null>(null); // Store batch data here

  // Chat Session State
  const chatSessionRef = useRef<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  
  // Ref for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[language];

  // Scroll to bottom when chat history updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, streamingAnalysisText]);

  // Handle Image Upload
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Main Entry Point for Analysis
  const runAnalysis = async (codes: string[], fromBatchClick: boolean = false, imageBase64?: string) => {
    // Force Single Mode if Image is present
    const isBatchRequest = codes.length > 1 && !imageBase64;
    
    setIsLoading(true);
    setLoadingText(''); // Reset custom text
    setError(null);
    setStreamingAnalysisText(''); 
    setChatHistory([]); // Clear chat for new single analysis
    chatSessionRef.current = null;

    try {
      if (isBatchRequest) {
        // --- BATCH MODE ---
        // 1. Fetch Batch Data
        const { analysis } = await startBatchAnalysis(codes, market, language);
        // 2. Update State
        setBatchCache(analysis);
        setViewState('BATCH_LIST');
        setIsLoading(false);
      } else {
        // --- SINGLE MODE ---
        // If triggered from home search, clear batch cache. 
        // If triggered from batch click, keep batch cache.
        if (!fromBatchClick) {
            setBatchCache(null);
        }
        
        // 1. Start Stream
        const { analysis, chat } = await startStockChat(
          codes[0] || (language === 'zh' ? '图片分析' : 'Image Analysis'), 
          market, 
          language, 
          analysisMode,
          (textChunk) => {
            // Callback: Update UI with streaming text
            setIsLoading(false); // Stop loader animation
            setViewState('SINGLE_REPORT'); // Switch view immediately to show stream
            setStreamingAnalysisText(textChunk);
          },
          imageBase64 // Pass image if available
        );
        
        // 2. Finalize
        setSingleResult(analysis);
        if (chat) chatSessionRef.current = chat;
        setStreamingAnalysisText(''); // Clear stream buffer, rely on singleResult.rawText
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockCode.trim() && !selectedImage) return;

    // Prioritize Image Analysis (Single Mode)
    if (selectedImage) {
        // If image is selected, we treat it as a single chat session, potentially with the text input as context
        await runAnalysis([stockCode], false, selectedImage);
        return;
    }

    if (searchMode === 'DISCOVERY') {
        // --- DISCOVERY FLOW ---
        setIsLoading(true);
        setLoadingText(t.discovering);
        try {
            const discoveredCodes = await discoverStocksByTheme(stockCode, market, language);
            if (discoveredCodes.length === 0) {
                throw new Error("No stocks found for this theme.");
            }
            // Auto-trigger batch analysis with discovered codes
            await runAnalysis(discoveredCodes, false);
        } catch (err: any) {
            setError(err.message || "Discovery failed.");
            setIsLoading(false);
        }
    } else {
        // --- STANDARD CODE FLOW ---
        // Split by comma (English and Chinese) or space
        const codes = stockCode.split(/[\s,\uff0c]+/).filter(c => c.trim().length > 0);
        if (codes.length === 0) return;
        await runAnalysis(codes, false);
    }
  };

  // Called when clicking "Deep Dive" in Batch Table
  const handleDeepDive = async (code: string) => {
      setStockCode(code); // Update input field for consistency
      await runAnalysis([code], true); // true = keep batch cache
  };

  // Called when clicking "Back to Batch Results"
  const handleBackToBatch = () => {
      setSingleResult(null);
      setStreamingAnalysisText('');
      setChatHistory([]);
      setViewState('BATCH_LIST');
  };

  const handleFollowUpSubmit = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || followUpInput;
    
    if (!textToSend.trim() || !chatSessionRef.current) return;

    // Add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString()
    };
    setChatHistory(prev => [...prev, userMsg]);
    setFollowUpInput('');
    setIsFollowUpLoading(true);

    // Create a placeholder model message for streaming
    const placeholderAiMsg: ChatMessage = {
      role: 'model',
      content: '', // Start empty
      timestamp: new Date().toLocaleTimeString()
    };
    setChatHistory(prev => [...prev, placeholderAiMsg]);

    try {
      const fullResponse = await sendFollowUpMessage(
        chatSessionRef.current, 
        textToSend,
        (streamedText) => {
           setChatHistory(prev => {
             const newHistory = [...prev];
             const lastIdx = newHistory.length - 1;
             if (lastIdx >= 0 && newHistory[lastIdx].role === 'model') {
               newHistory[lastIdx] = {
                 ...newHistory[lastIdx],
                 content: streamedText
               };
             }
             return newHistory;
           });
        }
      );
    } catch (err) {
      console.error(err);
      setChatHistory(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  const clearAnalysis = () => {
    setSingleResult(null);
    setBatchCache(null);
    setStreamingAnalysisText('');
    setStockCode('');
    setSelectedImage(null); // Clear image
    setError(null);
    setChatHistory([]);
    setViewState('HOME');
    setSearchMode('CODE'); // Reset to default
    chatSessionRef.current = null;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  const handleDownloadMD = () => {
    if (!singleResult) return;
    let fullContent = singleResult.rawText;
    chatHistory.forEach(msg => {
      fullContent += `\n\n## ${msg.role === 'user' ? 'User Update' : 'Analyst Follow-up'} (${msg.timestamp})\n${msg.content}`;
    });

    const blob = new Blob([fullContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QuantReport_${singleResult.symbol}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // Determine Content for Single View
  const displayContent = singleResult ? singleResult.rawText : streamingAnalysisText;

  // Helper to color signals in batch table
  const getBatchSignalColor = (sig: string) => {
    if (!sig) return 'text-slate-400 bg-slate-800 border-slate-700';
    const s = sig.toUpperCase();
    if (s.includes('BUY')) return 'text-emerald-400 bg-emerald-900/20 border-emerald-900/50';
    if (s.includes('SELL')) return 'text-rose-400 bg-rose-900/20 border-rose-900/50';
    if (s.includes('HOLD')) return 'text-yellow-400 bg-yellow-900/20 border-yellow-900/50';
    return 'text-slate-400 bg-slate-800 border-slate-700';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={clearAnalysis}>
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

      {/* Main Container - Width adjusts based on view */}
      <main className={`mx-auto px-4 py-8 ${viewState === 'BATCH_LIST' ? 'max-w-7xl' : 'max-w-6xl'}`}>
        
        {/* --- 1. HERO & INPUT (Visible only on HOME) --- */}
        {viewState === 'HOME' && !isLoading && (
          <div className="animate-fade-in-up mt-12">
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

            <div className="max-w-xl mx-auto space-y-4">
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

                {/* Search Mode Tabs */}
                <div className="flex justify-between items-end px-2">
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setSearchMode('CODE')}
                            className={`text-sm font-bold pb-2 border-b-2 transition-colors ${searchMode === 'CODE' ? 'text-white border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            {t.searchTabs.code}
                        </button>
                        <button 
                            onClick={() => setSearchMode('DISCOVERY')}
                            className={`text-sm font-bold pb-2 border-b-2 transition-colors ${searchMode === 'DISCOVERY' ? 'text-white border-purple-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            {t.searchTabs.discovery}
                        </button>
                    </div>
                </div>

                {/* Search Bar Container */}
                <div className={`bg-slate-900/50 p-2 rounded-2xl border shadow-xl backdrop-blur-sm transition-all hover:shadow-2xl flex flex-col gap-2 ${searchMode === 'DISCOVERY' ? 'border-purple-500/30 hover:border-purple-500/50' : 'border-slate-800 hover:border-slate-700'}`}>
                  
                  {/* Image Preview */}
                  {selectedImage && (
                      <div className="flex items-center gap-2 p-2 bg-slate-800 rounded-lg w-fit">
                          <img src={selectedImage} alt="Preview" className="h-12 w-12 object-cover rounded border border-slate-700" />
                          <div className="text-xs text-slate-300">Image attached</div>
                          <button onClick={clearImage} className="ml-2 text-slate-500 hover:text-rose-400">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                      </div>
                  )}

                  <form onSubmit={handleSearch} className="relative flex items-center">
                    <input
                      type="text"
                      value={stockCode}
                      onChange={(e) => setStockCode(e.target.value)}
                      placeholder={searchMode === 'DISCOVERY' ? t.discoveryPlaceholders[market] : t.placeholders[market]}
                      className="w-full bg-transparent text-white text-lg px-6 py-4 outline-none placeholder:text-slate-600 font-mono"
                    />
                    
                    {/* Action Buttons Right */}
                    <div className="absolute right-2 flex items-center gap-2">
                        {/* Image Upload Button */}
                        <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            onChange={handleImageSelect} 
                            hidden 
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            title={t.uploadImage}
                            className="p-2 text-slate-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800"
                        >
                             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                             </svg>
                        </button>

                        <button
                        type="submit"
                        disabled={(!stockCode.trim() && !selectedImage)}
                        className={`text-white px-6 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                            searchMode === 'DISCOVERY' 
                            ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20'
                            : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
                        }`}
                        >
                        {t.analyzeBtn}
                        </button>
                    </div>
                  </form>
                </div>
                
                {/* Mode Toggle (Live/Snapshot) - Keep below or integrate nicely */}
                <div className="flex justify-center pt-2">
                   <div className="inline-flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                     <button onClick={() => setAnalysisMode('LIVE')} className={`px-4 py-1.5 text-xs font-mono rounded-md transition-all flex items-center gap-2 ${analysisMode === 'LIVE' ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50' : 'text-slate-500 hover:text-slate-400'}`}>{t.modes.LIVE}</button>
                     <button onClick={() => setAnalysisMode('SNAPSHOT')} className={`px-4 py-1.5 text-xs font-mono rounded-md transition-all flex items-center gap-2 ${analysisMode === 'SNAPSHOT' ? 'bg-purple-900/40 text-purple-300 border border-purple-800/50' : 'text-slate-500 hover:text-slate-400'}`}>{t.modes.SNAPSHOT}</button>
                   </div>
                </div>

            </div>
          </div>
        )}

        {/* --- 2. LOADING STATE --- */}
        {isLoading && (
          <div className="mt-8">
            {/* Show custom text if available (e.g. Discovery mode), otherwise standard loader */}
            {loadingText ? (
                <div className="max-w-2xl mx-auto bg-slate-950 border border-purple-500/30 rounded-lg p-8 text-center animate-pulse">
                     <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                     </div>
                     <h3 className="text-xl font-bold text-white mb-2">{loadingText}</h3>
                     <p className="text-slate-500 text-sm font-mono">QuantGemini AI is searching the knowledge base...</p>
                </div>
            ) : (
                <TerminalLoader lang={language} key={language} />
            )}
          </div>
        )}

        {/* --- 3. ERROR STATE --- */}
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

        {/* --- 4. BATCH LIST VIEW (Full Width) --- */}
        {viewState === 'BATCH_LIST' && batchCache && batchCache.batchData && (
          <div className="animate-fade-in-up mt-4">
             {/* Batch Header */}
             <div className="flex justify-between items-center mb-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                 <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                      </div>
                      {t.batchTitle}
                    </h2>
                    <p className="text-slate-400 mt-1 ml-11">{t.batchSubtitle}</p>
                 </div>
                 <button onClick={clearAnalysis} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium border border-slate-700 transition-colors">
                    {t.newAnalysis}
                 </button>
             </div>

             {/* Batch Table */}
             <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50 text-xs uppercase text-slate-500 font-bold border-b border-slate-800">
                                <th className="p-5 tracking-wider">Symbol</th>
                                <th className="p-5 tracking-wider">Price Info</th>
                                <th className="p-5 tracking-wider">AI Signal</th>
                                <th className="p-5 tracking-wider w-1/3">Key Logic</th>
                                <th className="p-5 text-right tracking-wider">Analysis</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {batchCache.batchData.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/40 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">{item.code}</div>
                                        <div className="text-xs text-slate-500">{item.name}</div>
                                    </td>
                                    <td className="p-5">
                                        <div className="font-mono text-lg text-slate-200">{item.price}</div>
                                        <div className={`text-xs font-bold font-mono ${item.change.includes('-') ? 'text-rose-400' : 'text-emerald-400'}`}>{item.change}</div>
                                    </td>
                                    <td className="p-5">
                                        <span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 w-fit ${getBatchSignalColor(item.signal)}`}>
                                            <span className={`w-2 h-2 rounded-full ${item.signal.includes('BUY') ? 'bg-emerald-500' : item.signal.includes('SELL') ? 'bg-rose-500' : 'bg-yellow-500'}`}></span>
                                            {item.signal} | {item.confidence}%
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <p className="text-sm text-slate-400 leading-relaxed">{item.reason}</p>
                                    </td>
                                    <td className="p-5 text-right">
                                        <button 
                                            onClick={() => handleDeepDive(item.code)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20 hover:shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            Deep Dive &rarr;
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
             </div>
          </div>
        )}

        {/* --- 5. SINGLE REPORT VIEW (Split Layout) --- */}
        {viewState === 'SINGLE_REPORT' && (
          <div className="animate-fade-in-up mt-4">
             {/* Toolbar */}
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 no-print">
                <div className="flex items-center gap-4">
                  {/* Logic: If we have batchCache, back button goes to batch list. Else, it acts as "New" */}
                  {batchCache ? (
                      <button 
                        onClick={handleBackToBatch}
                        className="flex items-center gap-2 text-blue-400 hover:text-white transition-colors text-sm font-bold bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-900/50"
                      >
                        {t.backToBatch}
                      </button>
                  ) : (
                      <button 
                        onClick={clearAnalysis}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        {t.newAnalysis}
                      </button>
                  )}

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    analysisMode === 'LIVE' 
                      ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' 
                      : 'bg-purple-900/20 text-purple-400 border-purple-900/50'
                  }`}>
                    {analysisMode === 'LIVE' ? 'LIVE MODE' : 'SNAPSHOT MODE'}
                  </span>
                  
                  {/* Streaming Indicator */}
                  {!singleResult && (
                      <span className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          RECEIVING LIVE DATA...
                      </span>
                  )}
                </div>
                
                {singleResult && (
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
                )}
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
                      <div className="mb-4 text-xs text-slate-500 font-mono no-print flex justify-between">
                          <span>{market} | {singleResult ? singleResult.timestamp : 'Streaming...'}</span>
                          {!singleResult && <span className="animate-spin">⟳</span>}
                      </div>
                      <MarkdownRenderer content={displayContent} />
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
                         <MarkdownRenderer content={msg.content || '...'} />
                       )}
                     </div>
                   ))}
                   
                   <div ref={messagesEndRef} />

                   {/* Follow-up Loading - only if initializing connection, not during stream */}
                   {isFollowUpLoading && chatHistory[chatHistory.length-1]?.role !== 'model' && (
                     <div className="flex items-center gap-3 text-slate-500 p-4 animate-pulse">
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        <span className="text-sm font-mono">{t.thinking}</span>
                     </div>
                   )}
                   
                   {/* Tactical Command Input - Hidden when printing, only active after result */}
                   {singleResult && (
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
                   )}
                </div>

                {/* Sidebar - Quant Tools, Strategy Key & Sources - VISIBLE IN SINGLE REPORT VIEW */}
                <div className="lg:col-span-4 space-y-6 no-print">
                  
                  {/* QUANT TOOLS INJECTION - Only show when structured data is ready */}
                  {singleResult?.structuredData ? (
                      <QuantTools data={singleResult.structuredData} lang={language} />
                  ) : (
                      /* Skeleton / Placeholder for tools while streaming */
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 opacity-50 animate-pulse">
                          <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
                          <div className="h-32 bg-slate-800 rounded mb-4"></div>
                          <div className="text-center text-xs text-slate-500">Processing Quant Data...</div>
                      </div>
                  )}

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
                        {singleResult?.groundingSources && singleResult.groundingSources.length > 0 ? (
                            singleResult.groundingSources.map((source, idx) => (
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
                            <div className="text-xs text-slate-500 italic">
                              {singleResult ? t.sourceGemini : 'Waiting for search results...'}
                            </div>
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