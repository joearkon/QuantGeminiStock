
import React, { useState, useRef, useEffect } from 'react';
import { startStockChat, startBatchAnalysis, sendFollowUpMessage, discoverStocksByTheme, parsePortfolioScreenshot, reanalyzeStockWithUserPrice, fetchMarketOverview, fetchDeepMacroAnalysis, fetchTradeSetupByHorizon, testProxyConnection } from './services/geminiService';
import { AnalysisResult, Language, Market, ChatMessage, AnalysisMode, BatchItem, PortfolioItem, MarketOverview, DeepMacroAnalysis, TimeHorizon, TradeSetup } from './types';
import { TerminalLoader } from './components/TerminalLoader';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { QuantTools } from './components/QuantTools';
import { Chat } from '@google/genai';

const TRANSLATIONS = {
  en: {
    // ... (Keep existing translations)
    subtitle: "Global Quant v2.6",
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
    uploadImage: "Analyze Chart/Image",
    watchlist: {
      title: "My Watchlist",
      empty: "No stocks saved. Add favorites from analysis results or import a backup.",
      analyzeAll: "Analyze All",
      import: "Import JSON",
      export: "Export JSON",
      added: "Added to Watchlist",
      removed: "Removed from Watchlist"
    },
    marketDashboard: {
        loading: "Scanning Macro Data...",
        sentiment: "Sentiment",
        rotation: "Smart Money Flow",
        hot: "Hot Sectors",
        strategy: "Monthly Strategy",
        generateReport: "📊 Generate Strategy Report",
        deepDive: "Deep Sector Analysis",
        analyzeDeep: "🔍 Analyze Opportunities",
        deepLoading: "Calculating Sector Rotation..."
    },
    testConnection: "Test Network",
    testResult: "Result",
    checkProxy: "Check your Proxy URL configuration."
  },
  zh: {
    // ... (Keep existing translations)
    subtitle: "全球量化系统 v2.6",
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
    uploadImage: "分析图表/截图",
    watchlist: {
      title: "我的自选股",
      empty: "暂无自选股。请在分析结果中收藏，或导入备份文件。",
      analyzeAll: "一键全部分析",
      import: "导入 JSON",
      export: "导出 JSON",
      added: "已加入自选",
      removed: "已移出自选"
    },
    marketDashboard: {
        loading: "正在扫描全市场宏观数据...",
        sentiment: "市场情绪",
        rotation: "深度资金轮动",
        hot: "风口题材",
        strategy: "月度策略",
        generateReport: "📊 生成本月投资指南",
        deepDive: "深度赛道推演 (Deep Dive)",
        analyzeDeep: "🔍 挖掘核心赛道",
        deepLoading: "正在推演风格切换逻辑..."
    },
    testConnection: "测试网络连接",
    testResult: "诊断结果",
    checkProxy: "请检查您的代理(Cloudflare Worker)配置或 API Key。"
  }
};

type ViewState = 'HOME' | 'BATCH_LIST' | 'SINGLE_REPORT';
type SearchMode = 'CODE' | 'DISCOVERY';

const App: React.FC = () => {
  // ... (State setup - same as before)
  const [stockCode, setStockCode] = useState('');
  const [market, setMarket] = useState<Market>('A_SHARE');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('LIVE');
  const [language, setLanguage] = useState<Language>('zh');
  const [searchMode, setSearchMode] = useState<SearchMode>('CODE');
  
  const [viewState, setViewState] = useState<ViewState>('HOME');
  const [isLoading, setIsLoading] = useState(false); 
  const [loadingText, setLoadingText] = useState<string>('');
  const [streamingAnalysisText, setStreamingAnalysisText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  const [marketPulse, setMarketPulse] = useState<MarketOverview | null>(null);
  const [isPulseLoading, setIsPulseLoading] = useState(false);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepMacroAnalysis | null>(null);
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [activeProfile, setActiveProfile] = useState<'AGGRESSIVE' | 'BALANCED'>('BALANCED');
  const [activeHorizon, setActiveHorizon] = useState<TimeHorizon>('MEDIUM');
  const [tradeSetup, setTradeSetup] = useState<TradeSetup | null>(null);
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  
  // Diagnostic State
  const [connectionStatus, setConnectionStatus] = useState<{status: number, message: string, url: string} | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => {
    try {
      const saved = localStorage.getItem('quant_portfolio');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      localStorage.removeItem('quant_portfolio');
      return [];
    }
  });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [singleResult, setSingleResult] = useState<AnalysisResult | null>(null);
  const [batchCache, setBatchCache] = useState<AnalysisResult | null>(null);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [reanalyzingRows, setReanalyzingRows] = useState<Set<string>>(new Set());
  const chatSessionRef = useRef<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[language];

  useEffect(() => { localStorage.setItem('quant_portfolio', JSON.stringify(portfolio)); }, [portfolio]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, streamingAnalysisText]);

  useEffect(() => {
     if (viewState === 'HOME') {
         setMarketPulse(null);
         setDeepAnalysis(null);
         loadMarketPulse();
     }
  }, [viewState, market]);

  const loadMarketPulse = async () => {
      setIsPulseLoading(true);
      setError(null);
      try {
          const data = await fetchMarketOverview(market, language);
          setMarketPulse(data);
      } catch (e) {
          console.warn("Market Pulse failed", e);
          // Don't set main Error state here to avoid blocking the whole app, just log it.
          // Or set a small warning
      } finally {
          setIsPulseLoading(false);
      }
  };

  const handleTestProxy = async () => {
      setIsTestingConnection(true);
      const result = await testProxyConnection();
      setConnectionStatus(result);
      setIsTestingConnection(false);
  };

  const getTrendColor = (changeStr: string = "", isText: boolean = true) => {
      if (!changeStr) return isText ? 'text-slate-500' : 'bg-slate-700';
      const isNegative = changeStr.includes('-');
      if (market === 'A_SHARE') {
          if (isNegative) return isText ? 'text-emerald-400' : 'bg-emerald-500';
          return isText ? 'text-rose-400' : 'bg-rose-500';
      } else {
          if (isNegative) return isText ? 'text-rose-400' : 'bg-rose-500';
          return isText ? 'text-emerald-400' : 'bg-emerald-500';
      }
  };

  // ... (Keep existing handlers: handleDeepMacroAnalysis, handleHorizonChange, handleImageSelect, handleScreenshotImport, toggleWatchlist, etc.)
  const handleDeepMacroAnalysis = async () => {
      setIsDeepAnalyzing(true);
      try {
          const data = await fetchDeepMacroAnalysis(market, language);
          setDeepAnalysis(data);
          setActiveProfile('BALANCED');
      } catch (e) { console.error(e); } finally { setIsDeepAnalyzing(false); }
  };
  const handleHorizonChange = async (newHorizon: TimeHorizon) => {
      setActiveHorizon(newHorizon);
      if (!singleResult) return;
      setIsSetupLoading(true);
      try {
          const setup = await fetchTradeSetupByHorizon(singleResult.symbol, market, newHorizon, language);
          setTradeSetup(setup);
          if (setup.updatedData) setSingleResult(prev => prev ? { ...prev, structuredData: setup.updatedData } : null);
      } catch (e) { console.error(e); } finally { setIsSetupLoading(false); }
  };
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  const clearImage = () => { setSelectedImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; };
  
  const handleScreenshotImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64 = reader.result as string;
          setIsLoading(true);
          setLoadingText(language === 'en' ? "Scanning..." : "正在识别...");
          try {
              const items = await parsePortfolioScreenshot(base64, market, language);
              if (items.length > 0) {
                  setPortfolio(prev => {
                      const combined = [...prev];
                      items.forEach(newItem => {
                          const idx = combined.findIndex(p => p.code === newItem.code);
                          if (idx !== -1) combined[idx] = { ...combined[idx], quantity: newItem.quantity, avgCost: newItem.avgCost };
                          else combined.push({ code: newItem.code, name: newItem.name, market, addedAt: Date.now(), quantity: newItem.quantity, avgCost: newItem.avgCost });
                      });
                      return combined;
                  });
              } else setError(language === 'en' ? "No holdings found." : "未识别到有效持仓。");
          } catch (err) { setError("Failed to parse."); } finally { setIsLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
      };
      reader.readAsDataURL(file);
  };
  const toggleWatchlist = (code: string, name?: string) => {
    setPortfolio(prev => {
      const exists = prev.find(p => p.code === code);
      return exists ? prev.filter(p => p.code !== code) : [...prev, { code, market, addedAt: Date.now(), name }];
    });
  };
  const isSaved = (code: string) => portfolio.some(p => p.code === code);
  const handleExportPortfolio = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(portfolio));
    const a = document.createElement('a'); a.href = dataStr; a.download = `watchlist.json`; document.body.appendChild(a); a.click(); a.remove();
  };
  const handleImportPortfolio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setPortfolio(prev => {
            const combined = [...prev];
            imported.forEach((item: PortfolioItem) => { if (!combined.some(p => p.code === item.code)) combined.push(item); });
            return combined;
          });
          alert("Import successful!");
        }
      } catch (err) { alert("Invalid JSON file."); }
    };
    reader.readAsText(file); if (importInputRef.current) importInputRef.current.value = '';
  };
  const handleAnalyzePortfolio = async () => {
    const marketItems = portfolio.filter(p => p.market === market);
    if (marketItems.length === 0) return;
    await runAnalysis(marketItems.map(p => p.code), false);
  };

  const runAnalysis = async (codes: string[], fromBatchClick: boolean = false, imageBase64?: string) => {
    const isBatchRequest = codes.length > 1 && !imageBase64;
    setIsLoading(true); setLoadingText(''); setError(null); setStreamingAnalysisText(''); setChatHistory([]); chatSessionRef.current = null; setTradeSetup(null); setActiveHorizon('MEDIUM'); setConnectionStatus(null);

    try {
      if (isBatchRequest) {
        const { analysis } = await startBatchAnalysis(codes, market, language);
        if (analysis.batchData) {
            setPortfolio(prev => prev.map(p => {
                const match = analysis.batchData?.find(b => b.code === p.code);
                return (match && match.name) ? { ...p, name: match.name } : p;
            }));
        }
        setBatchCache(analysis); setViewState('BATCH_LIST'); setIsLoading(false);
      } else {
        if (!fromBatchClick) setBatchCache(null);
        const { analysis, chat } = await startStockChat(codes[0] || (language === 'zh' ? '图片' : 'Image'), market, language, analysisMode, (textChunk) => {
            setIsLoading(false); setViewState('SINGLE_REPORT'); setStreamingAnalysisText(textChunk);
        }, imageBase64);
        setSingleResult(analysis); if (chat) chatSessionRef.current = chat; setStreamingAnalysisText('');
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  const handleGenerateStrategyReport = async () => {
      const monthName = new Date().toLocaleString(language === 'en' ? 'en-US' : 'zh-CN', { month: 'long' });
      const query = language === 'en' ? `${monthName} Strategy ${market}` : `${monthName} ${market} 投资策略`;
      setSearchMode('DISCOVERY'); setStockCode(query); await runAnalysis([query], false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockCode.trim() && !selectedImage) return;
    if (selectedImage) { await runAnalysis([stockCode], false, selectedImage); return; }
    if (searchMode === 'DISCOVERY') {
        setIsLoading(true); setLoadingText(t.discovering);
        try {
            const discoveredCodes = await discoverStocksByTheme(stockCode, market, language);
            if (discoveredCodes.length === 0) { await runAnalysis([stockCode], false); return; }
            await runAnalysis(discoveredCodes, false);
        } catch (err: any) { setError(err.message); setIsLoading(false); }
    } else {
        const codes = stockCode.split(new RegExp('[\\s,\uff0c]+')).filter(c => c.trim().length > 0);
        if (codes.length === 0) return;
        await runAnalysis(codes, false);
    }
  };

  // ... (Keep existing helpers: handleDeepDive, handleBackToBatch, startEditPrice, etc.)
  const handleDeepDive = async (code: string) => { setStockCode(code); await runAnalysis([code], true); };
  const handleBackToBatch = () => { setSingleResult(null); setStreamingAnalysisText(''); setChatHistory([]); setViewState('BATCH_LIST'); };
  const startEditPrice = (code: string, currentPrice: string) => { setEditingRow(code); setEditPrice(String(currentPrice)); };
  const cancelEditPrice = () => { setEditingRow(null); setEditPrice(''); };
  const saveEditPrice = async (code: string, name: string) => {
      if (!editPrice) return;
      setEditingRow(null); setReanalyzingRows(prev => new Set(prev).add(code));
      try {
          const updatedItem = await reanalyzeStockWithUserPrice(code, name, editPrice, market, language);
          setBatchCache(prev => { if (!prev || !prev.batchData) return prev; return { ...prev, batchData: prev.batchData.map(item => item.code === code ? updatedItem : item) }; });
      } catch (e) { alert("Re-analysis failed."); } finally { setReanalyzingRows(prev => { const next = new Set(prev); next.delete(code); return next; }); }
  };
  const handleFollowUpSubmit = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || followUpInput;
    if (!textToSend.trim() || !chatSessionRef.current) return;
    setChatHistory(prev => [...prev, { role: 'user', content: textToSend, timestamp: new Date().toLocaleTimeString() }, { role: 'model', content: '', timestamp: new Date().toLocaleTimeString() }]);
    setFollowUpInput(''); setIsFollowUpLoading(true);
    try {
      await sendFollowUpMessage(chatSessionRef.current, textToSend, (streamedText) => {
           setChatHistory(prev => { const n = [...prev]; if (n.length && n[n.length-1].role === 'model') n[n.length-1].content = streamedText; return n; });
      });
    } catch (err) { setChatHistory(prev => prev.filter(m => m.content !== '')); } finally { setIsFollowUpLoading(false); }
  };
  const clearAnalysis = () => { setSingleResult(null); setBatchCache(null); setStreamingAnalysisText(''); setStockCode(''); setSelectedImage(null); setError(null); setChatHistory([]); setViewState('HOME'); setSearchMode('CODE'); chatSessionRef.current = null; };
  const toggleLanguage = () => setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  const handleDownloadMD = () => {
    if (!singleResult) return;
    let content = singleResult.rawText; chatHistory.forEach(m => content += `\n\n## ${m.role} (${m.timestamp})\n${m.content}`);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: 'text/markdown' })); a.download = 'report.md'; a.click(); a.remove();
  };
  const handlePrintPDF = () => window.print();
  const getBatchSignalColor = (sig: string) => { if (!sig) return 'text-slate-400 border-slate-700'; const s = sig.toUpperCase(); if (s.includes('BUY')) return 'text-emerald-400 bg-emerald-900/20'; if (s.includes('SELL')) return 'text-rose-400 bg-rose-900/20'; return 'text-yellow-400 bg-yellow-900/20'; };
  const currentMarketPortfolio = portfolio.filter(p => p.market === market);
  const currentProfile = deepAnalysis?.profiles ? (activeProfile === 'AGGRESSIVE' ? deepAnalysis.profiles.aggressive : deepAnalysis.profiles.balanced) : null;
  const displayContent = singleResult ? singleResult.rawText : streamingAnalysisText;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={clearAnalysis}>
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">Q</div>
            <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">Quant<span className="text-blue-500">Gemini</span></h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                  {(['A_SHARE', 'US_STOCK', 'HK_STOCK'] as Market[]).map((m) => (
                    <button key={m} onClick={() => setMarket(m)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${market === m ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>{t.markets[m]}</button>
                  ))}
             </div>
             <button onClick={toggleLanguage} className="px-3 py-1 rounded-full border border-slate-700 text-xs font-mono text-slate-400 hover:text-white hover:border-slate-500 transition-all">{language === 'en' ? 'CN / EN' : '中 / 英'}</button>
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 py-8 ${viewState === 'BATCH_LIST' ? 'max-w-7xl' : 'max-w-6xl'}`}>
        
        {viewState === 'HOME' && !isLoading && (
          <div className="animate-fade-in-up mt-2">
            <div className="md:hidden flex bg-slate-900 p-1 rounded-xl border border-slate-800 mb-6">
                {(['A_SHARE', 'US_STOCK', 'HK_STOCK'] as Market[]).map((m) => (
                <button key={m} onClick={() => setMarket(m)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${market === m ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>{t.markets[m]}</button>
                ))}
            </div>

            {/* DASHBOARD */}
            <div className="max-w-5xl mx-auto mb-10">
                {isPulseLoading ? (
                    <div className="flex justify-center items-center py-20 bg-slate-900/20 rounded-2xl border border-slate-800/50">
                        <span className="animate-pulse text-slate-500 font-mono text-sm">{t.marketDashboard.loading}</span>
                    </div>
                ) : marketPulse ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                             {marketPulse.indices?.map((idx, i) => (
                                 <div key={i} className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
                                     <div className="font-bold text-slate-400 text-xs uppercase">{idx?.name}</div>
                                     <div className="text-right">
                                         <div className="text-white font-mono font-bold text-lg">{idx?.value}</div>
                                         <div className="flex items-center justify-end gap-2">
                                             <div className={`text-xs font-mono font-bold ${getTrendColor(idx?.change)}`}>{idx?.change}</div>
                                             <div className={`text-[9px] font-mono border px-1 rounded ${idx?.timestamp?.includes('Close') || idx?.timestamp?.includes('昨日') ? 'text-yellow-500 border-yellow-900/30' : 'text-slate-500 border-slate-700'}`}>{idx?.timestamp}</div>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.marketDashboard.sentiment}</h4>
                                <span className={`text-4xl font-bold ${marketPulse.sentimentScore > 75 ? 'text-rose-400' : marketPulse.sentimentScore < 25 ? 'text-emerald-400' : 'text-yellow-400'}`}>{marketPulse.sentimentScore}</span>
                                <div className="text-sm text-white font-medium mt-1">{marketPulse.sentimentText}</div>
                                <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden"><div className={`h-full rounded-full ${marketPulse.sentimentScore > 75 ? 'bg-rose-500' : marketPulse.sentimentScore < 25 ? 'bg-emerald-500' : 'bg-yellow-500'}`} style={{width: `${marketPulse.sentimentScore}%`}}></div></div>
                            </div>
                            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex flex-col">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t.marketDashboard.rotation}</h4>
                                <div className="space-y-3 flex-1">
                                    {typeof marketPulse.rotationAnalysis === 'object' ? (
                                        <>
                                            <div className="text-xs flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-500">INFLOW</span><span className="text-emerald-400 font-bold text-right">{marketPulse.rotationAnalysis.inflow}</span></div>
                                            <div className="text-xs flex justify-between border-b border-slate-800 pb-2"><span className="text-slate-500">OUTFLOW</span><span className="text-rose-400 font-bold text-right">{marketPulse.rotationAnalysis.outflow}</span></div>
                                            <p className="text-[10px] text-blue-200 italic mt-1">{marketPulse.rotationAnalysis.logic}</p>
                                        </>
                                    ) : <p className="text-sm text-blue-200">{marketPulse.rotationAnalysis}</p>}
                                </div>
                            </div>
                            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.marketDashboard.hot}</h4>
                                <div className="flex flex-wrap gap-2 mb-4">{marketPulse.hotSectors.map((sec, i) => <span key={i} className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] rounded border border-slate-700">{sec}</span>)}</div>
                                <p className="text-xs text-slate-400 line-clamp-2">{marketPulse.monthlyStrategy}</p>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* DEEP DIVE */}
            <div className="max-w-5xl mx-auto mb-10">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center">
                        <div className="flex items-center gap-2"><span className="text-purple-400">⚡</span><h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider">{t.marketDashboard.deepDive}</h3></div>
                        {!deepAnalysis && <button onClick={handleDeepMacroAnalysis} disabled={isDeepAnalyzing} className="px-3 py-1.5 bg-purple-900/20 hover:bg-purple-900/40 text-purple-300 text-xs font-bold rounded border border-purple-900/50 transition-colors disabled:opacity-50">{isDeepAnalyzing ? t.marketDashboard.deepLoading : t.marketDashboard.analyzeDeep}</button>}
                    </div>
                    {deepAnalysis && (
                        <div className="p-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                <div className={`p-4 rounded-xl border ${deepAnalysis.strategy.includes('MAIN') ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                                    <h4 className="text-sm font-bold text-blue-400 mb-2">Main Board</h4>
                                    <div className="text-sm text-white font-medium mb-3">{deepAnalysis.mainBoard.opportunity}</div>
                                    <p className="text-xs text-slate-300 mb-4">{deepAnalysis.mainBoard.logic}</p>
                                    <div className="flex flex-wrap gap-2">{deepAnalysis.mainBoard.recommendedSectors.map((s, i) => <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-950 text-blue-300 rounded border border-blue-900">{s}</span>)}</div>
                                </div>
                                <div className={`p-4 rounded-xl border ${deepAnalysis.strategy.includes('TECH') ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                                    <h4 className="text-sm font-bold text-purple-400 mb-2">Tech / Growth</h4>
                                    <div className="text-sm text-white font-medium mb-3">{deepAnalysis.techGrowth.opportunity}</div>
                                    <p className="text-xs text-slate-300 mb-4">{deepAnalysis.techGrowth.logic}</p>
                                    <div className="flex flex-wrap gap-2">{deepAnalysis.techGrowth.recommendedSectors.map((s, i) => <span key={i} className="text-[10px] px-2 py-0.5 bg-purple-950 text-purple-300 rounded border border-purple-900">{s}</span>)}</div>
                                </div>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-xl border-l-4 border-emerald-500 mb-6">
                                <div className="text-xs font-bold text-emerald-400 uppercase mb-1">Strategist Verdict</div>
                                <p className="text-sm text-white">{deepAnalysis.summary}</p>
                            </div>
                            {deepAnalysis.profiles && (
                                <div className="border-t border-slate-800 pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{language === 'en' ? 'Suggested Portfolio Models' : '建议仓位配置模型'}</h4>
                                         <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                                             <button onClick={() => setActiveProfile('AGGRESSIVE')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeProfile === 'AGGRESSIVE' ? 'bg-purple-900/50 text-purple-300 border border-purple-800' : 'text-slate-500'}`}>🚀 Aggressive</button>
                                             <button onClick={() => setActiveProfile('BALANCED')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeProfile === 'BALANCED' ? 'bg-blue-900/50 text-blue-300 border border-blue-800' : 'text-slate-500'}`}>⚖️ Balanced</button>
                                         </div>
                                    </div>
                                    {currentProfile && (
                                        <div className="animate-fade-in">
                                            <p className="text-sm text-slate-300 mb-4 italic pl-2 border-l-2 border-slate-700">"{currentProfile.description}"</p>
                                            <div className="h-4 w-full rounded-full overflow-hidden flex mb-4 border border-slate-800 bg-slate-900">
                                                {currentProfile.allocations.map((bucket, i) => {
                                                    const colors = activeProfile === 'AGGRESSIVE' ? ['bg-purple-500', 'bg-rose-500', 'bg-slate-600'] : ['bg-blue-500', 'bg-emerald-500', 'bg-slate-600'];
                                                    return <div key={i} style={{ width: `${bucket.percentage}%` }} className={`${colors[i % 3]} h-full transition-all duration-500`} title={`${bucket.category}: ${bucket.percentage}%`} />
                                                })}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {currentProfile.allocations.map((bucket, i) => (
                                                    <div key={i} className="p-3 rounded-lg border bg-slate-900/30 border-slate-800">
                                                        <div className="flex justify-between items-center mb-1"><span className="text-xs font-bold text-slate-300">{bucket.category}</span><span className="text-sm font-mono font-bold text-white">{bucket.percentage}%</span></div>
                                                        <p className="text-[10px] text-slate-400 mb-2 h-8 overflow-hidden">{bucket.rationale}</p>
                                                        <div className="flex flex-wrap gap-1">{bucket.examples.map((ex, j) => <span key={j} className="text-[9px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-700">{ex}</span>)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* SEARCH */}
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex justify-center gap-6 mb-2">
                    <button onClick={() => setSearchMode('CODE')} className={`text-sm font-bold pb-2 border-b-2 transition-colors ${searchMode === 'CODE' ? 'text-white border-blue-500' : 'text-slate-600 border-transparent hover:text-slate-400'}`}>{t.searchTabs.code}</button>
                    <button onClick={() => setSearchMode('DISCOVERY')} className={`text-sm font-bold pb-2 border-b-2 transition-colors ${searchMode === 'DISCOVERY' ? 'text-white border-purple-500' : 'text-slate-600 border-transparent hover:text-slate-400'}`}>{t.searchTabs.discovery}</button>
                </div>
                <div className={`bg-slate-900 p-2 rounded-2xl border shadow-lg transition-all flex flex-col gap-2 ${searchMode === 'DISCOVERY' ? 'border-purple-900/50' : 'border-slate-800'}`}>
                  {selectedImage && (
                      <div className="flex items-center gap-2 p-2 bg-slate-800 rounded-lg w-fit mx-2 mt-2">
                          <img src={selectedImage} alt="Preview" className="h-10 w-10 object-cover rounded border border-slate-700" />
                          <button onClick={clearImage} className="ml-2 text-slate-500 hover:text-rose-400">×</button>
                      </div>
                  )}
                  <form onSubmit={handleSearch} className="relative flex items-center">
                    <input type="text" value={stockCode} onChange={(e) => setStockCode(e.target.value)} placeholder={searchMode === 'DISCOVERY' ? t.discoveryPlaceholders[market] : t.placeholders[market]} className="w-full bg-transparent text-white text-base px-6 py-3 outline-none placeholder:text-slate-600 font-mono" />
                    <div className="absolute right-2 flex items-center gap-2">
                        <div className="relative group">
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} hidden />
                            <input type="file" accept="image/*" ref={importInputRef} onChange={handleScreenshotImport} hidden />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                        </div>
                        <button type="submit" disabled={(!stockCode.trim() && !selectedImage)} className={`text-white px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-lg ${searchMode === 'DISCOVERY' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'}`}>{t.analyzeBtn}</button>
                    </div>
                  </form>
                </div>

                <div className="pt-6 border-t border-slate-800/50">
                    <div className="flex justify-between items-center mb-4 px-1">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">{t.watchlist.title}</h3>
                        <div className="flex gap-2 items-center text-[10px]"><button onClick={() => importInputRef.current?.click()} className="text-slate-600 hover:text-blue-400 transition-colors">OCR Import</button><span className="text-slate-800">|</span><button onClick={handleExportPortfolio} className="text-slate-600 hover:text-blue-400 transition-colors">Backup</button></div>
                    </div>
                    {currentMarketPortfolio.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                             {currentMarketPortfolio.map(item => (
                                 <div key={item.code} className="bg-slate-900 border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-colors flex justify-between items-center group">
                                     <div onClick={() => runAnalysis([item.code])} className="cursor-pointer">
                                         <div className="font-bold text-white text-sm font-mono">{item.code}</div>
                                         {item.name && <div className="text-[10px] text-slate-500 truncate w-20">{item.name}</div>}
                                     </div>
                                     <div className="text-right">
                                         {item.quantity && item.avgCost ? <div className="text-[10px] text-slate-400 font-mono">¥{(item.quantity * item.avgCost).toLocaleString()}</div> : <button onClick={() => toggleWatchlist(item.code)} className="text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">×</button>}
                                     </div>
                                 </div>
                             ))}
                        </div>
                    ) : <div className="text-center py-4 border border-dashed border-slate-800 rounded-lg text-xs text-slate-600">{t.watchlist.empty}</div>}
                </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="mt-8">
            {loadingText ? (
                <div className="max-w-2xl mx-auto bg-slate-950 border border-purple-500/30 rounded-lg p-8 text-center animate-pulse">
                     <h3 className="text-xl font-bold text-white mb-2">{loadingText}</h3>
                     <p className="text-slate-500 text-sm font-mono">QuantGemini AI is searching...</p>
                </div>
            ) : <TerminalLoader lang={language} key={language} />}
          </div>
        )}

        {/* ERROR STATE with DIAGNOSTIC TOOL */}
        {error && (
          <div className="mt-8 max-w-2xl mx-auto p-6 bg-rose-950/30 border border-rose-900/50 rounded-xl text-center">
             <div className="text-rose-500 text-lg font-semibold mb-2">{t.errorTitle}</div>
             <p className="text-rose-300/80 mb-4">{error}</p>
             
             {/* Diagnostic Controls */}
             <div className="flex flex-col items-center gap-3">
                 <button onClick={() => setError(null)} className="text-sm text-rose-400 hover:text-white underline underline-offset-4">{t.tryAgain}</button>
                 
                 <div className="mt-4 pt-4 border-t border-rose-900/30 w-full">
                     {!connectionStatus && (
                        <button 
                            onClick={handleTestProxy} 
                            disabled={isTestingConnection}
                            className="px-4 py-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs rounded-lg transition-colors flex items-center gap-2 mx-auto"
                        >
                            {isTestingConnection ? <span className="animate-spin">⟳</span> : <span>🔧</span>}
                            {t.testConnection}
                        </button>
                     )}
                     
                     {connectionStatus && (
                         <div className="bg-slate-950 p-3 rounded-lg text-left text-xs font-mono mt-2 border border-slate-800">
                             <div className="flex justify-between mb-1">
                                 <span className="text-slate-500">Status Code:</span>
                                 <span className={connectionStatus.status === 200 ? 'text-emerald-400' : 'text-rose-400'}>{connectionStatus.status}</span>
                             </div>
                             <div className="flex justify-between mb-1">
                                 <span className="text-slate-500">Message:</span>
                                 <span className="text-slate-300">{connectionStatus.message}</span>
                             </div>
                             <div className="text-[10px] text-slate-600 truncate mt-2 border-t border-slate-800 pt-1">{connectionStatus.url}</div>
                             {connectionStatus.status !== 200 && (
                                 <div className="mt-2 text-yellow-500 font-bold">{t.checkProxy}</div>
                             )}
                             <button onClick={() => setConnectionStatus(null)} className="mt-2 text-blue-400 hover:underline w-full text-center">Close</button>
                         </div>
                     )}
                 </div>
             </div>
          </div>
        )}

        {/* --- BATCH LIST VIEW --- */}
        {viewState === 'BATCH_LIST' && batchCache && batchCache.batchData && (
          <div className="animate-fade-in-up mt-4">
             <div className="flex justify-between items-center mb-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                 <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg"><svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg></div>
                      {t.batchTitle}
                    </h2>
                    <p className="text-slate-400 mt-1 ml-11">{t.batchSubtitle}</p>
                 </div>
                 <button onClick={clearAnalysis} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors">{t.newAnalysis}</button>
             </div>
             <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50 text-xs uppercase text-slate-500 font-bold border-b border-slate-800">
                                <th className="p-5 w-12"></th><th className="p-5">Symbol</th><th className="p-5">Price</th><th className="p-5">Signal</th><th className="p-5">Thresholds</th><th className="p-5 w-1/4">Action</th><th className="p-5 text-right">Analysis</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {batchCache.batchData.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/40 transition-colors group">
                                    <td className="p-5 text-center"><button onClick={() => toggleWatchlist(item.code, item.name)} className={`hover:scale-110 transition-transform ${isSaved(item.code) ? 'text-yellow-400' : 'text-slate-700 hover:text-yellow-400'}`}>★</button></td>
                                    <td className="p-5"><div className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">{item.code}</div><div className="text-xs text-slate-500">{item.name}</div></td>
                                    <td className="p-5">
                                        {editingRow === item.code ? (
                                            <div className="flex items-center gap-2"><input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-20 bg-slate-950 border border-blue-500 rounded px-1 py-0.5 text-sm outline-none" autoFocus /><button onClick={() => saveEditPrice(item.code, item.name || item.code)} className="text-emerald-400">✅</button><button onClick={cancelEditPrice} className="text-rose-400">❌</button></div>
                                        ) : (
                                            <div className="relative group/edit">
                                                <div className="flex items-center gap-2"><div className="font-mono text-lg text-slate-200">{item.price}</div><button onClick={() => startEditPrice(item.code, item.price)} className="opacity-0 group-hover/edit:opacity-100 text-slate-600 hover:text-blue-400 transition-opacity">✎</button></div>
                                                <div className={`text-xs font-bold font-mono ${getTrendColor(item.change)}`}>{item.change}</div>
                                                <div className={`text-[10px] mt-1 font-mono ${item.lastUpdated?.includes('Manual') ? 'text-yellow-500' : 'text-slate-600'}`}>{item.lastUpdated || 'N/A'}{reanalyzingRows.has(item.code) && <span className="ml-2 animate-spin inline-block">⟳</span>}</div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-5"><span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 w-fit ${getBatchSignalColor(item.signal)}`}>{item.signal} | {item.confidence}%</span></td>
                                    <td className="p-5"><div className="flex flex-col gap-1 text-xs font-mono"><div className="flex items-center gap-2 text-emerald-300"><span>🎯</span> {item.targetPrice || '-'}</div><div className="flex items-center gap-2 text-rose-300"><span>🛡️</span> {item.stopLoss || '-'}</div></div></td>
                                    <td className="p-5"><p className="text-sm text-blue-200 leading-relaxed font-medium">{item.action || item.reason}</p></td>
                                    <td className="p-5 text-right"><button onClick={() => handleDeepDive(item.code)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20">Details &rarr;</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
             </div>
          </div>
        )}

        {/* --- SINGLE REPORT VIEW --- */}
        {viewState === 'SINGLE_REPORT' && (
          <div className="animate-fade-in-up mt-4">
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 no-print">
                <div className="flex items-center gap-4">
                  {batchCache ? <button onClick={handleBackToBatch} className="flex items-center gap-2 text-blue-400 hover:text-white transition-colors text-sm font-bold bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-900/50">{t.backToBatch}</button> : <button onClick={clearAnalysis} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">{t.newAnalysis}</button>}
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${analysisMode === 'LIVE' ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' : 'bg-purple-900/20 text-purple-400 border-purple-900/50'}`}>{analysisMode === 'LIVE' ? 'LIVE' : 'SNAPSHOT'}</span>
                </div>
                {singleResult && (
                  <div className="flex items-center gap-2">
                     <button onClick={() => toggleWatchlist(singleResult.symbol)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-2 ${isSaved(singleResult.symbol) ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>{isSaved(singleResult.symbol) ? (language === 'en' ? 'Saved' : '已收藏') : (language === 'en' ? 'Save' : '收藏')}</button>
                     <button onClick={handleDownloadMD} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors">{t.exportMD}</button>
                     <button onClick={handlePrintPDF} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors">{t.exportPDF}</button>
                  </div>
                )}
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div id="printable-report" className="lg:col-span-8 flex flex-col gap-6">
                   {/* STRATEGY HORIZON CARD */}
                   {singleResult && (
                       <div className="bg-slate-900/50 border border-blue-900/30 rounded-2xl p-4 no-print relative overflow-hidden">
                           <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                               <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{language === 'en' ? 'Strategy Horizon' : '时空交易规划'}</h3>
                               <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                                   {(['SHORT', 'MEDIUM', 'LONG'] as TimeHorizon[]).map(h => (
                                       <button key={h} onClick={() => handleHorizonChange(h)} className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${activeHorizon === h ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{h}</button>
                                   ))}
                               </div>
                           </div>
                           {isSetupLoading ? (
                               <div className="py-6 text-center text-slate-500 text-xs font-mono animate-pulse">Calculating...</div>
                           ) : tradeSetup ? (
                               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                                   <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"><div className="text-[10px] text-slate-500 uppercase mb-1">Signal</div><div className={`text-lg font-bold ${tradeSetup.recommendation === 'BUY' ? 'text-emerald-400' : tradeSetup.recommendation === 'SELL' ? 'text-rose-400' : 'text-yellow-400'}`}>{tradeSetup.recommendation}</div></div>
                                   <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"><div className="text-[10px] text-blue-400 uppercase mb-1">Entry Zone</div><div className="text-lg font-bold text-white font-mono">{tradeSetup.entryZone}</div></div>
                                   <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"><div className="text-[10px] text-rose-400 uppercase mb-1">Invalidation</div><div className="text-lg font-bold text-white font-mono">{tradeSetup.invalidLevel}</div></div>
                                   <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"><div className="text-[10px] text-emerald-400 uppercase mb-1">Target</div><div className="text-lg font-bold text-white font-mono">{tradeSetup.targetLevel}</div></div>
                                   <div className="col-span-1 md:col-span-4 mt-2 px-2"><p className="text-xs text-slate-400 italic"><span className="font-bold text-blue-400">Logic: </span>{tradeSetup.technicalRationale}</p></div>
                               </div>
                           ) : <div className="py-4 text-center text-slate-600 text-xs italic">Select a horizon to generate specific trade setup.</div>}
                       </div>
                   )}
                   
                   <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                      <div className="mb-4 text-xs text-slate-500 font-mono no-print flex justify-between items-center">
                          <div className="flex gap-2 items-center"><span>{market} | {singleResult ? singleResult.timestamp : 'Streaming...'}</span>{!singleResult && <span className="animate-spin">⟳</span>}</div>
                      </div>
                      <MarkdownRenderer content={displayContent} />
                   </div>

                   {chatHistory.map((msg, index) => (
                     <div key={index} className={`rounded-2xl p-6 border ${msg.role === 'user' ? 'bg-slate-800/50 border-slate-700 ml-8' : 'bg-slate-900 border-slate-800 mr-8 shadow-xl'}`}>
                       <div className="flex items-center gap-2 mb-2"><div className={`w-2 h-2 rounded-full ${msg.role === 'user' ? 'bg-blue-400' : 'bg-emerald-400'}`}></div><span className="text-xs font-mono text-slate-500 uppercase">{msg.role} • {msg.timestamp}</span></div>
                       {msg.role === 'user' ? <p className="text-slate-200">{msg.content}</p> : <MarkdownRenderer content={msg.content || '...'} />}
                     </div>
                   ))}
                   <div ref={messagesEndRef} />
                   
                   {singleResult && (
                     <div className="no-print sticky bottom-6 z-40">
                       <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl">
                          <div className="flex flex-col gap-3">
                            <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">{t.followUpTitle}</label>
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => handleFollowUpSubmit(undefined, t.quickActions.entry)} className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-blue-900/40 border border-slate-700 rounded-md transition-colors">{t.quickActions.entry}</button>
                              <button onClick={() => handleFollowUpSubmit(undefined, t.quickActions.stop)} className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-rose-900/40 border border-slate-700 rounded-md transition-colors">{t.quickActions.stop}</button>
                              <button onClick={() => handleFollowUpSubmit(undefined, t.quickActions.target1)} className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-emerald-900/40 border border-slate-700 rounded-md transition-colors">{t.quickActions.target1}</button>
                            </div>
                            <form onSubmit={(e) => handleFollowUpSubmit(e)} className="relative">
                              <input type="text" value={followUpInput} onChange={(e) => setFollowUpInput(e.target.value)} placeholder={t.followUpPlaceholder} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-4 pr-12 text-sm focus:border-blue-500 outline-none text-slate-200" />
                              <button type="submit" disabled={!followUpInput.trim() || isFollowUpLoading} className="absolute right-1 top-1 bottom-1 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50">{t.send}</button>
                            </form>
                          </div>
                       </div>
                     </div>
                   )}
                </div>

                <div className="lg:col-span-4 space-y-6 no-print">
                  {singleResult?.structuredData ? <QuantTools data={singleResult.structuredData} lang={language} /> : <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 opacity-50 animate-pulse"><div className="h-32 bg-slate-800 rounded"></div></div>}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">{t.strategyKey}</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-emerald-400"></span><div><div className="text-emerald-400 font-bold text-sm">{t.buy}</div><div className="text-slate-500 text-xs">{t.buyDesc}</div></div></div>
                        <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-rose-400"></span><div><div className="text-rose-400 font-bold text-sm">{t.sell}</div><div className="text-slate-500 text-xs">{t.sellDesc}</div></div></div>
                        <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-yellow-400"></span><div><div className="text-yellow-400 font-bold text-sm">{t.hold}</div><div className="text-slate-500 text-xs">{t.holdDesc}</div></div></div>
                      </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800"><p className="text-[10px] text-slate-500 leading-relaxed text-justify">{t.disclaimer}</p></div>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
