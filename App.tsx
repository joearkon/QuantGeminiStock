import React, { useState, useRef, useEffect } from 'react';
import { startStockChat, startBatchAnalysis, sendFollowUpMessage, discoverStocksByTheme, parsePortfolioScreenshot } from './services/geminiService';
import { AnalysisResult, Language, Market, ChatMessage, AnalysisMode, BatchItem, PortfolioItem } from './types';
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
    uploadImage: "Analyze Chart/Image",
    watchlist: {
      title: "My Watchlist",
      empty: "No stocks saved. Add favorites from analysis results or import a backup.",
      analyzeAll: "Analyze All",
      import: "Import JSON",
      export: "Export JSON",
      added: "Added to Watchlist",
      removed: "Removed from Watchlist"
    }
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
    uploadImage: "分析图表/截图",
    watchlist: {
      title: "我的自选股",
      empty: "暂无自选股。请在分析结果中收藏，或导入备份文件。",
      analyzeAll: "一键全部分析",
      import: "导入 JSON",
      export: "导出 JSON",
      added: "已加入自选",
      removed: "已移出自选"
    }
  }
};

type ViewState = 'HOME' | 'BATCH_LIST' | 'SINGLE_REPORT';
type SearchMode = 'CODE' | 'DISCOVERY';

const App: React.FC = () => {
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

  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => {
    try {
      const saved = localStorage.getItem('quant_portfolio');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [singleResult, setSingleResult] = useState<AnalysisResult | null>(null);
  const [batchCache, setBatchCache] = useState<AnalysisResult | null>(null);

  const chatSessionRef = useRef<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[language];

  useEffect(() => {
    try {
        localStorage.setItem('quant_portfolio', JSON.stringify(portfolio));
    } catch (e) {
        // ignore
    }
  }, [portfolio]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, streamingAnalysisText]);

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

  const toggleWatchlist = (code: string, name?: string) => {
    setPortfolio(prev => {
      const exists = prev.find(p => p.code === code);
      if (exists) {
        return prev.filter(p => p.code !== code);
      } else {
        return [...prev, { code, market, addedAt: Date.now(), name }];
      }
    });
  };

  const updatePortfolioItem = (code: string, field: 'quantity' | 'avgCost', value: number) => {
      setPortfolio(prev => prev.map(p => {
          if (p.code === code) {
              return { ...p, [field]: value };
          }
          return p;
      }));
  };

  const isSaved = (code: string) => {
    return portfolio.some(p => p.code === code);
  };

  const handleExportPortfolio = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(portfolio));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `quant_watchlist_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportPortfolio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setPortfolio(prev => {
            const combined = [...prev];
            imported.forEach((item: PortfolioItem) => {
              if (!combined.some(p => p.code === item.code)) {
                combined.push(item);
              }
            });
            return combined;
          });
          // alert("Import successful!");
        }
      } catch (err) {
        // alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleScreenshotImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64 = reader.result as string;
          setIsLoading(true);
          setLoadingText(language === 'en' ? 'Analyzing Screenshot...' : '正在解析持仓截图...');
          try {
              const items = await parsePortfolioScreenshot(base64, market, language);
              if (items.length > 0) {
                  setPortfolio(prev => {
                      const combined = [...prev];
                      items.forEach(newItem => {
                          const existingIdx = combined.findIndex(p => p.code === newItem.code);
                          if (existingIdx >= 0) {
                              combined[existingIdx] = { 
                                  ...combined[existingIdx], 
                                  quantity: newItem.quantity,
                                  avgCost: newItem.avgCost 
                              };
                          } else {
                              combined.push(newItem);
                          }
                      });
                      return combined;
                  });
              } else {
                  setError(language === 'en' ? "No stocks identified in screenshot." : "未识别到有效持仓，请检查截图是否清晰");
              }
          } catch (err) {
              setError(language === 'en' ? "Screenshot parsing failed." : "截图解析失败");
          } finally {
              setIsLoading(false);
              setLoadingText('');
          }
      };
      reader.readAsDataURL(file);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleAnalyzePortfolio = async () => {
    const marketItems = portfolio.filter(p => p.market === market);
    if (marketItems.length === 0) return;
    const codes = marketItems.map(p => p.code);
    await runAnalysis(codes, false);
  };

  const runAnalysis = async (codes: string[], fromBatchClick: boolean = false, imageBase64?: string) => {
    const isBatchRequest = codes.length > 1 && !imageBase64;
    
    setIsLoading(true);
    setLoadingText(''); 
    setError(null);
    setStreamingAnalysisText(''); 
    setChatHistory([]);
    chatSessionRef.current = null;

    try {
      if (isBatchRequest) {
        const { analysis } = await startBatchAnalysis(codes, market, language);
        
        if (analysis.batchData) {
            setPortfolio(prev => prev.map(p => {
                const match = analysis.batchData?.find(b => b.code === p.code);
                if (match && match.name) {
                    return { ...p, name: match.name };
                }
                return p;
            }));
        }

        setBatchCache(analysis);
        setViewState('BATCH_LIST');
        setIsLoading(false);
      } else {
        if (!fromBatchClick) {
            setBatchCache(null);
        }
        
        const { analysis, chat } = await startStockChat(
          codes[0] || (language === 'zh' ? '图片分析' : 'Image Analysis'), 
          market, 
          language, 
          analysisMode,
          (textChunk) => {
            setIsLoading(false);
            setViewState('SINGLE_REPORT');
            setStreamingAnalysisText(textChunk);
          },
          imageBase64
        );
        
        setSingleResult(analysis);
        if (chat) chatSessionRef.current = chat;
        setStreamingAnalysisText(''); 
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockCode.trim() && !selectedImage) return;

    if (selectedImage) {
        await runAnalysis([stockCode], false, selectedImage);
        return;
    }

    if (searchMode === 'DISCOVERY') {
        setIsLoading(true);
        setLoadingText(t.discovering);
        try {
            const discoveredCodes = await discoverStocksByTheme(stockCode, market, language);
            if (discoveredCodes.length === 0) {
                throw new Error("No stocks found for this theme.");
            }
            await runAnalysis(discoveredCodes, false);
        } catch (err: any) {
            setError(err.message || "Discovery failed.");
            setIsLoading(false);
        }
    } else {
        const codes = stockCode.split(new RegExp("[\x20\x2C\uFF0C]+")).filter(c => c.trim().length > 0);
        if (codes.length === 0) return;
        await runAnalysis(codes, false);
    }
  };

  const handleDeepDive = async (code: string) => {
      setStockCode(code);
      await runAnalysis([code], true);
  };

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

    const userMsg: ChatMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString()
    };
    setChatHistory(prev => [...prev, userMsg]);
    setFollowUpInput('');
    setIsFollowUpLoading(true);

    const placeholderAiMsg: ChatMessage = {
      role: 'model',
      content: '', 
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
    setSelectedImage(null);
    setError(null);
    setChatHistory([]);
    setViewState('HOME');
    setSearchMode('CODE');
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

  const displayContent = singleResult ? singleResult.rawText : streamingAnalysisText;

  const getBatchSignalColor = (sig: string) => {
    if (!sig) return 'text-slate-400 bg-slate-800 border-slate-700';
    const s = sig.toUpperCase();
    if (s.includes('BUY')) return 'text-emerald-400 bg-emerald-900/20 border-emerald-900/50';
    if (s.includes('SELL')) return 'text-rose-400 bg-rose-900/20 border-rose-900/50';
    if (s.includes('HOLD')) return 'text-yellow-400 bg-yellow-900/20 border-yellow-900/50';
    return 'text-slate-400 bg-slate-800 border-slate-700';
  };

  const currentMarketPortfolio = portfolio.filter(p => p.market === market);

  // Helper to safely render portfolio map
  const renderPortfolioItems = () => {
      if (!currentMarketPortfolio || !Array.isArray(currentMarketPortfolio)) return null;
      return currentMarketPortfolio.map(item => (
            <div key={item.code} className="bg-slate-900 border border-slate-800 rounded-lg p-3 relative group hover:border-slate-700 transition-colors">
                <div className="flex justify-between items-start">
                    <div onClick={() => runAnalysis([item.code])} className="cursor-pointer">
                        <div className="font-bold text-white font-mono">{item.code}</div>
                        {item.name && <div className="text-[10px] text-slate-500 truncate max-w-[80px]">{item.name}</div>}
                    </div>
                    
                    {/* Manual Edit Inputs */}
                    <div className="flex flex-col gap-1 ml-4 mr-6">
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-600 w-6">Qty</span>
                            <input 
                                type="number" 
                                value={item.quantity || ''} 
                                onChange={(e) => updatePortfolioItem(item.code, 'quantity', Number(e.target.value))}
                                className="w-16 bg-slate-950 border border-slate-800 text-[10px] text-slate-300 rounded px-1 py-0.5 outline-none focus:border-blue-500"
                                placeholder="0"
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-600 w-6">Avg</span>
                            <input 
                                type="number" 
                                value={item.avgCost || ''} 
                                onChange={(e) => updatePortfolioItem(item.code, 'avgCost', Number(e.target.value))}
                                className="w-16 bg-slate-950 border border-slate-800 text-[10px] text-slate-300 rounded px-1 py-0.5 outline-none focus:border-blue-500"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <button onClick={() => toggleWatchlist(item.code)} className="absolute top-2 right-2 text-slate-600 hover:text-rose-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                </div>
                {(item.quantity && item.avgCost) ? (
                    <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Amt</span>
                        <span className="text-xs font-mono text-blue-300">{(item.quantity * item.avgCost).toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                    </div>
                ) : null}
            </div>
        ));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
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
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 py-8 ${viewState === 'BATCH_LIST' ? 'max-w-7xl' : 'max-w-6xl'}`}>
        
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

                <div className={`bg-slate-900/50 p-2 rounded-2xl border shadow-xl backdrop-blur-sm transition-all hover:shadow-2xl flex flex-col gap-2 ${searchMode === 'DISCOVERY' ? 'border-purple-500/30 hover:border-purple-500/50' : 'border-slate-800 hover:border-slate-700'}`}>
                  
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
                    
                    <div className="absolute right-2 flex items-center gap-2">
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
                
                <div className="flex justify-center pt-2">
                   <div className="inline-flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                     <button onClick={() => setAnalysisMode('LIVE')} className={`px-4 py-1.5 text-xs font-mono rounded-md transition-all flex items-center gap-2 ${analysisMode === 'LIVE' ? 'bg-blue-900/40 text-blue-300 border border-blue-800/50' : 'text-slate-500 hover:text-slate-400'}`}>{t.modes.LIVE}</button>
                     <button onClick={() => setAnalysisMode('SNAPSHOT')} className={`px-4 py-1.5 text-xs font-mono rounded-md transition-all flex items-center gap-2 ${analysisMode === 'SNAPSHOT' ? 'bg-purple-900/40 text-purple-300 border border-purple-800/50' : 'text-slate-500 hover:text-slate-400'}`}>{t.modes.SNAPSHOT}</button>
                   </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-900">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            {t.watchlist.title} ({t.markets[market]})
                        </h3>
                        <div className="flex gap-2 items-center">
                            <input type="file" ref={cameraInputRef} accept="image/*" onChange={handleScreenshotImport} hidden />
                            <button onClick={() => cameraInputRef.current?.click()} className="text-[10px] text-slate-600 hover:text-blue-400 transition-colors flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                Screenshot Import
                            </button>
                            <span className="text-slate-800">|</span>
                            <input type="file" ref={importInputRef} accept=".json" onChange={handleImportPortfolio} hidden />
                            <button onClick={() => importInputRef.current?.click()} className="text-[10px] text-slate-600 hover:text-blue-400 transition-colors">{t.watchlist.import}</button>
                            <span className="text-slate-800">|</span>
                            <button onClick={handleExportPortfolio} className="text-[10px] text-slate-600 hover:text-blue-400 transition-colors">{t.watchlist.export}</button>
                        </div>
                    </div>
                    
                    {currentMarketPortfolio.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                             {renderPortfolioItems()}
                             <div className="col-span-2 md:col-span-4 mt-2 text-center">
                                 <button onClick={handleAnalyzePortfolio} className="w-full py-2 bg-slate-900/50 hover:bg-blue-900/20 text-blue-400 border border-blue-900/30 border-dashed rounded-lg text-sm font-medium transition-colors">
                                    {t.watchlist.analyzeAll} ({currentMarketPortfolio.length})
                                 </button>
                             </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 border border-dashed border-slate-900 rounded-xl">
                            <div className="text-slate-600 text-sm">{t.watchlist.empty}</div>
                        </div>
                    )}
                </div>

            </div>
          </div>
        )}

        {isLoading && (
          <div className="mt-8">
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

        {viewState === 'BATCH_LIST' && batchCache && batchCache.batchData && (
          <div className="animate-fade-in-up mt-4">
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

             <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-950/50 text-xs uppercase text-slate-500 font-bold border-b border-slate-800">
                                <th className="p-5 tracking-wider w-12"></th>
                                <th className="p-5 tracking-wider">Symbol</th>
                                <th className="p-5 tracking-wider">Price Info</th>
                                <th className="p-5 tracking-wider">AI Signal</th>
                                <th className="p-5 tracking-wider">Thresholds</th>
                                <th className="p-5 tracking-wider">Next Day Action</th>
                                <th className="p-5 text-right tracking-wider">Analysis</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {batchCache.batchData.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/40 transition-colors group">
                                    <td className="p-5 text-center">
                                        <button 
                                            onClick={() => toggleWatchlist(item.code, item.name)}
                                            className={`hover:scale-110 transition-transform ${isSaved(item.code) ? 'text-yellow-400' : 'text-slate-700 hover:text-yellow-400'}`}
                                            title={isSaved(item.code) ? t.watchlist.removed : t.watchlist.added}
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                        </button>
                                    </td>
                                    <td className="p-5">
                                        <div className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">{item.code}</div>
                                        <div className="text-xs text-slate-500">{item.name}</div>
                                    </td>
                                    <td className="p-5">
                                        <div className="font-mono text-lg text-slate-200">{item.price}</div>
                                        <div className={`text-xs font-bold font-mono ${item.change.includes('-') ? 'text-rose-400' : 'text-emerald-400'}`}>{item.change}</div>
                                        {item.lastUpdated && (
                                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                                <span>🕒</span> {item.lastUpdated}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-5">
                                        <span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 w-fit ${getBatchSignalColor(item.signal)}`}>
                                            <span className={`w-2 h-2 rounded-full ${item.signal.includes('BUY') ? 'bg-emerald-500' : item.signal.includes('SELL') ? 'bg-rose-500' : 'bg-yellow-500'}`}></span>
                                            {item.signal} | {item.confidence}%
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex flex-col gap-1 text-xs font-mono">
                                            {item.targetPrice ? (
                                                <div className="flex items-center gap-1 text-emerald-400" title="Target Price">
                                                    <span>🎯</span> {item.targetPrice}
                                                </div>
                                            ) : <span className="text-slate-600">-</span>}
                                            {item.stopLoss ? (
                                                <div className="flex items-center gap-1 text-rose-400" title="Stop Loss">
                                                    <span>🛡️</span> {item.stopLoss}
                                                </div>
                                            ) : <span className="text-slate-600">-</span>}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="text-sm font-medium text-blue-200 leading-snug max-w-[200px]">
                                            {item.action || item.reason}
                                        </div>
                                    </td>
                                    <td className="p-5 text-right">
                                        <button 
                                            onClick={() => handleDeepDive(item.code)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20 hover:shadow-blue-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            Details &rarr;
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

        {viewState === 'SINGLE_REPORT' && (
          <div className="animate-fade-in-up mt-4">
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 no-print">
                <div className="flex items-center gap-4">
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
                       onClick={() => toggleWatchlist(singleResult.symbol)}
                       className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-2 ${
                           isSaved(singleResult.symbol) 
                           ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50 hover:bg-yellow-900/30' 
                           : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                       }`}
                     >
                       <svg className="w-3.5 h-3.5" fill={isSaved(singleResult.symbol) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                       </svg>
                       {isSaved(singleResult.symbol) ? (language === 'en' ? 'Saved' : '已收藏') : (language === 'en' ? 'Save' : '收藏')}
                     </button>
                     <button 
                         onClick={() => {
                             if(singleResult.structuredData) {
                                 // Simple auto-add to portfolio logic if needed
                                 if(!isSaved(singleResult.symbol)) toggleWatchlist(singleResult.symbol);
                             }
                         }}
                         className="px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-900/50 bg-blue-900/20 text-blue-300 hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                     >
                        <span>📥</span> Save to Portfolio
                     </button>

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
                <div id="printable-report" className="lg:col-span-8 flex flex-col gap-6">
                   
                   <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none no-print">
                          <svg className="w-32 h-32 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                          </svg>
                      </div>
                      <div className="mb-4 text-xs text-slate-500 font-mono no-print flex justify-between items-center">
                          <div className="flex gap-2 items-center">
                              <span>{market} | {singleResult ? singleResult.timestamp : 'Streaming...'}</span>
                              {!singleResult && <span className="animate-spin">⟳</span>}
                          </div>
                      </div>
                      <MarkdownRenderer content={displayContent} />
                   </div>

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

                   {isFollowUpLoading && chatHistory[chatHistory.length-1]?.role !== 'model' && (
                     <div className="flex items-center gap-3 text-slate-500 p-4 animate-pulse">
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        <span className="text-sm font-mono">{t.thinking}</span>
                     </div>
                   )}
                   
                   {singleResult && (
                     <div className="no-print sticky bottom-6 z-40">
                       <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">{t.followUpTitle}</label>
                            </div>
                            
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

                <div className="lg:col-span-4 space-y-6 no-print">
                  
                  {singleResult?.structuredData ? (
                      <QuantTools data={singleResult.structuredData} lang={language} />
                  ) : (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 opacity-50 animate-pulse">
                          <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
                          <div className="h-32 bg-slate-800 rounded mb-4"></div>
                          <div className="text-center text-xs text-slate-500">Processing Quant Data...</div>
                      </div>
                  )}

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