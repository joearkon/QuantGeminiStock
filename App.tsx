
import React, { useState, useRef, useEffect } from 'react';
import { startStockChat, startBatchAnalysis, sendFollowUpMessage, discoverStocksByTheme, parsePortfolioScreenshot, reanalyzeStockWithUserPrice, fetchMarketOverview, fetchDeepMacroAnalysis, fetchTradeSetupByHorizon } from './services/geminiService';
import { AnalysisResult, Language, Market, ChatMessage, AnalysisMode, BatchItem, PortfolioItem, MarketOverview, DeepMacroAnalysis, TimeHorizon, TradeSetup } from './types';
import { TerminalLoader } from './components/TerminalLoader';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { QuantTools } from './components/QuantTools';
import { Chat } from '@google/genai';

const TRANSLATIONS = {
  en: {
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
    }
  },
  zh: {
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
    }
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
  
  // Market Pulse State
  const [marketPulse, setMarketPulse] = useState<MarketOverview | null>(null);
  const [isPulseLoading, setIsPulseLoading] = useState(false);
  
  // Deep Macro State
  const [deepAnalysis, setDeepAnalysis] = useState<DeepMacroAnalysis | null>(null);
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [activeProfile, setActiveProfile] = useState<'AGGRESSIVE' | 'BALANCED'>('BALANCED');

  // Trade Setup State (Horizon)
  const [activeHorizon, setActiveHorizon] = useState<TimeHorizon>('MEDIUM');
  const [tradeSetup, setTradeSetup] = useState<TradeSetup | null>(null);
  const [isSetupLoading, setIsSetupLoading] = useState(false);

  // Portfolio State
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => {
    try {
      const saved = localStorage.getItem('quant_portfolio');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      localStorage.removeItem('quant_portfolio');
      return [];
    }
  });

  // Image State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Separate results for Batch and Single to support navigation
  const [singleResult, setSingleResult] = useState<AnalysisResult | null>(null);
  const [batchCache, setBatchCache] = useState<AnalysisResult | null>(null); // Store batch data here
  
  // Batch Editing States
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [reanalyzingRows, setReanalyzingRows] = useState<Set<string>>(new Set());

  // Chat Session State
  const chatSessionRef = useRef<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  
  // Ref for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[language];

  // Persist Portfolio
  useEffect(() => {
    localStorage.setItem('quant_portfolio', JSON.stringify(portfolio));
  }, [portfolio]);

  // Load Market Pulse on Mount (Once per session or on refresh)
  useEffect(() => {
     if (viewState === 'HOME') {
         // Always reload pulse when coming home or switching market
         setMarketPulse(null); // Clear old data to prevent confusion
         setDeepAnalysis(null); // Clear deep analysis
         loadMarketPulse();
     }
  }, [viewState, market]);

  const loadMarketPulse = async () => {
      setIsPulseLoading(true);
      try {
          const data = await fetchMarketOverview(market, language);
          setMarketPulse(data);
      } catch (e) {
          console.warn("Market Pulse failed", e);
      } finally {
          setIsPulseLoading(false);
      }
  };

  const handleDeepMacroAnalysis = async () => {
      setIsDeepAnalyzing(true);
      try {
          const data = await fetchDeepMacroAnalysis(market, language);
          setDeepAnalysis(data);
          setActiveProfile('BALANCED'); // Default to Balanced
      } catch (e) {
          console.error("Deep macro failed", e);
      } finally {
          setIsDeepAnalyzing(false);
      }
  };

  // Switch Horizon Logic
  const handleHorizonChange = async (newHorizon: TimeHorizon) => {
      setActiveHorizon(newHorizon);
      if (!singleResult) return;
      
      setIsSetupLoading(true);
      try {
          // Use symbol from result (which might be the code or image name)
          // For image analysis without code, this might be tricky, but let's assume code flow for now
          const setup = await fetchTradeSetupByHorizon(singleResult.symbol, market, newHorizon, language);
          setTradeSetup(setup);
          
          // Auto-update structured data for the Calculator
          if (setup.updatedData) {
              setSingleResult(prev => prev ? { ...prev, structuredData: setup.updatedData } : null);
          }
      } catch (e) {
          console.error("Setup fetch failed", e);
      } finally {
          setIsSetupLoading(false);
      }
  };

  // Scroll to bottom when chat history updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, streamingAnalysisText]);

  // Helper: Color logic for trends based on Market
  // A-Share: Red=Up, Green=Down. Global: Green=Up, Red=Down.
  const getTrendColor = (changeStr: string, isText: boolean = true) => {
      const isNegative = changeStr.includes('-');
      const isPositive = !isNegative && (changeStr.includes('+') || parseFloat(changeStr) > 0);
      
      if (market === 'A_SHARE') {
          // Chinese Style
          if (isNegative) return isText ? 'text-emerald-400' : 'bg-emerald-500';
          return isText ? 'text-rose-400' : 'bg-rose-500';
      } else {
          // Global Style
          if (isNegative) return isText ? 'text-rose-400' : 'bg-rose-500';
          return isText ? 'text-emerald-400' : 'bg-emerald-500';
      }
  };

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
  
  // Handle Screenshot Portfolio Import
  const handleScreenshotImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64 = reader.result as string;
          setIsLoading(true);
          setLoadingText(language === 'en' ? "Scanning Portfolio Screenshot..." : "正在识别持仓截图...");
          try {
              const items = await parsePortfolioScreenshot(base64, market, language);
              if (items.length > 0) {
                  // Merge into portfolio
                  setPortfolio(prev => {
                      const combined = [...prev];
                      items.forEach(newItem => {
                          const idx = combined.findIndex(p => p.code === newItem.code);
                          if (idx !== -1) {
                              // Update existing
                              combined[idx] = { ...combined[idx], quantity: newItem.quantity, avgCost: newItem.avgCost };
                          } else {
                              // Add new
                              combined.push({
                                  code: newItem.code,
                                  name: newItem.name,
                                  market,
                                  addedAt: Date.now(),
                                  quantity: newItem.quantity,
                                  avgCost: newItem.avgCost
                              });
                          }
                      });
                      return combined;
                  });
              } else {
                  setError(language === 'en' ? "No holdings found in image. Please ensure code/name is visible." : "未识别到有效持仓。请确保截图清晰包含股票名称或代码。");
              }
          } catch (err) {
              setError("Failed to parse screenshot.");
          } finally {
              setIsLoading(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsDataURL(file);
  };

  const clearImage = () => {
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Portfolio Handlers ---
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
      setPortfolio(prev => prev.map(p => p.code === code ? { ...p, [field]: value } : p));
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
          // Merge logic: avoid duplicates
          setPortfolio(prev => {
            const combined = [...prev];
            imported.forEach((item: PortfolioItem) => {
              if (!combined.some(p => p.code === item.code)) {
                combined.push(item);
              }
            });
            return combined;
          });
          alert("Import successful!");
        }
      } catch (err) {
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const handleAnalyzePortfolio = async () => {
    // Filter items for current market
    const marketItems = portfolio.filter(p => p.market === market);
    if (marketItems.length === 0) return;
    const codes = marketItems.map(p => p.code);
    await runAnalysis(codes, false);
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
    
    // Reset Trade Setup
    setTradeSetup(null);
    setActiveHorizon('MEDIUM');

    try {
      if (isBatchRequest) {
        // --- BATCH MODE ---
        // 1. Fetch Batch Data
        const { analysis } = await startBatchAnalysis(codes, market, language);
        
        // Auto-update portfolio names if found
        if (analysis.batchData) {
            setPortfolio(prev => prev.map(p => {
                const match = analysis.batchData?.find(b => b.code === p.code);
                if (match && match.name) {
                    return { ...p, name: match.name };
                }
                return p;
            }));
        }

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

  // Generate Strategy Report
  const handleGenerateStrategyReport = async () => {
      const monthName = new Date().toLocaleString(language === 'en' ? 'en-US' : 'zh-CN', { month: 'long' });
      const query = language === 'en' 
        ? `${monthName} Investment Strategy and Sector Rotation for ${market}` 
        : `${monthName} ${market} 投资策略与板块轮动报告`;
      
      setSearchMode('DISCOVERY');
      setStockCode(query); // Set text for context
      
      // Treat as Single Analysis mode for a report
      await runAnalysis([query], false);
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
                // If discovery returns empty (maybe it was a general question), fallback to single chat
                 await runAnalysis([stockCode], false);
                 return;
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
        const splitRegex = new RegExp('[\\s,\uff0c]+');
        const codes = stockCode.split(splitRegex).filter(c => c.trim().length > 0);
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

  // Inline Batch Editing
  const startEditPrice = (code: string, currentPrice: string) => {
      setEditingRow(code);
      setEditPrice(String(currentPrice)); // Ensure string
  };
  
  const cancelEditPrice = () => {
      setEditingRow(null);
      setEditPrice('');
  };

  const saveEditPrice = async (code: string, name: string) => {
      if (!editPrice) return;
      
      setEditingRow(null);
      setReanalyzingRows(prev => new Set(prev).add(code));
      
      try {
          // Re-analyze specific row
          const updatedItem = await reanalyzeStockWithUserPrice(code, name, editPrice, market, language);
          
          // Update Cache
          setBatchCache(prev => {
              if (!prev || !prev.batchData) return prev;
              const newData = prev.batchData.map(item => item.code === code ? updatedItem : item);
              return { ...prev, batchData: newData };
          });
      } catch (e) {
          alert("Re-analysis failed.");
      } finally {
          setReanalyzingRows(prev => {
              const next = new Set(prev);
              next.delete(code);
              return next;
          });
      }
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

  // Filter portfolio for current view
  const currentMarketPortfolio = portfolio.filter(p => p.market === market);

  // Helper for Profile Rendering
  const currentProfile = deepAnalysis?.profiles ? (activeProfile === 'AGGRESSIVE' ? deepAnalysis.profiles.aggressive : deepAnalysis.profiles.balanced) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={clearAnalysis}>
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              Q
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">
              Quant<span className="text-blue-500">Gemini</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Simple Market Toggles in Header for Quick Access */}
             <div className="hidden md:flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                  {(['A_SHARE', 'US_STOCK', 'HK_STOCK'] as Market[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMarket(m)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        market === m 
                          ? 'bg-slate-800 text-white shadow-sm' 
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {t.markets[m]}
                    </button>
                  ))}
             </div>

             <button 
               onClick={toggleLanguage}
               className="px-3 py-1 rounded-full border border-slate-700 text-xs font-mono text-slate-400 hover:text-white hover:border-slate-500 transition-all"
             >
               {language === 'en' ? 'CN / EN' : '中 / 英'}
             </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className={`mx-auto px-4 py-8 ${viewState === 'BATCH_LIST' ? 'max-w-7xl' : 'max-w-6xl'}`}>
        
        {/* --- 1. HERO / DASHBOARD (Visible only on HOME) --- */}
        {viewState === 'HOME' && !isLoading && (
          <div className="animate-fade-in-up mt-2">
            
            {/* 1A. Mobile Market Selector (if needed) */}
            <div className="md:hidden flex bg-slate-900 p-1 rounded-xl border border-slate-800 mb-6">
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

            {/* 1B. COMMAND CENTER DASHBOARD */}
            <div className="max-w-5xl mx-auto mb-10">
                {isPulseLoading ? (
                    <div className="flex justify-center items-center py-20 bg-slate-900/20 rounded-2xl border border-slate-800/50">
                        <span className="animate-pulse text-slate-500 font-mono text-sm">{t.marketDashboard.loading}</span>
                    </div>
                ) : marketPulse ? (
                    <div className="space-y-4">
                        {/* Indices Ticker */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                             {marketPulse.indices?.map((idx, i) => (
                                 <div key={i} className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex justify-between items-center hover:bg-slate-800 transition-colors">
                                     <div className="font-bold text-slate-400 text-xs uppercase">{idx.name}</div>
                                     <div className="text-right">
                                         <div className="text-white font-mono font-bold text-lg">{idx.value}</div>
                                         <div className="flex items-center justify-end gap-2">
                                             <div className={`text-xs font-mono font-bold ${getTrendColor(idx.change)}`}>{idx.change}</div>
                                             {/* TIMESTAMP Display */}
                                             <div className={`text-[9px] font-mono border px-1 rounded ${
                                                 idx.timestamp?.includes('Close') || idx.timestamp?.includes('昨日') 
                                                 ? 'text-yellow-500 border-yellow-900/30 bg-yellow-900/10' 
                                                 : 'text-slate-500 border-slate-700'
                                             }`}>
                                                 {idx.timestamp}
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                        </div>

                        {/* Macro Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Sentiment */}
                            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.marketDashboard.sentiment}</h4>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className={`text-4xl font-bold ${marketPulse.sentimentScore > 75 ? 'text-rose-400' : marketPulse.sentimentScore < 25 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                        {marketPulse.sentimentScore}
                                    </span>
                                </div>
                                <div className="text-sm text-white font-medium">{marketPulse.sentimentText}</div>
                                <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${marketPulse.sentimentScore > 75 ? 'bg-rose-500' : marketPulse.sentimentScore < 25 ? 'bg-emerald-500' : 'bg-yellow-500'}`} 
                                        style={{width: `${marketPulse.sentimentScore}%`}}
                                    ></div>
                                </div>
                            </div>
                            
                            {/* Rotation Logic */}
                            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex flex-col">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t.marketDashboard.rotation}</h4>
                                <div className="space-y-3 flex-1">
                                    {typeof marketPulse.rotationAnalysis === 'object' ? (
                                        <>
                                            <div className="text-xs flex justify-between border-b border-slate-800 pb-2">
                                                <span className="text-slate-500">INFLOW</span>
                                                <span className="text-emerald-400 font-bold text-right">{marketPulse.rotationAnalysis.inflow}</span>
                                            </div>
                                            <div className="text-xs flex justify-between border-b border-slate-800 pb-2">
                                                <span className="text-slate-500">OUTFLOW</span>
                                                <span className="text-rose-400 font-bold text-right">{marketPulse.rotationAnalysis.outflow}</span>
                                            </div>
                                            <div className="pt-1">
                                                <p className="text-[10px] text-blue-200 leading-relaxed italic">
                                                    Logic: {marketPulse.rotationAnalysis.logic}
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm text-blue-200">{marketPulse.rotationAnalysis}</p>
                                    )}
                                </div>
                            </div>

                            {/* Hot Sectors & Strategy */}
                            <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.marketDashboard.hot}</h4>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {marketPulse.hotSectors.map((sec, i) => (
                                            <span key={i} className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] rounded border border-slate-700">
                                                {sec}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400 line-clamp-2">{marketPulse.monthlyStrategy}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* 1C. DEEP DIVE SECTION (New) */}
            <div className="max-w-5xl mx-auto mb-10">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-purple-400">⚡</span>
                            <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider">{t.marketDashboard.deepDive}</h3>
                        </div>
                        {!deepAnalysis && (
                            <button 
                                onClick={handleDeepMacroAnalysis}
                                disabled={isDeepAnalyzing}
                                className="px-3 py-1.5 bg-purple-900/20 hover:bg-purple-900/40 text-purple-300 text-xs font-bold rounded border border-purple-900/50 transition-colors disabled:opacity-50"
                            >
                                {isDeepAnalyzing ? t.marketDashboard.deepLoading : t.marketDashboard.analyzeDeep}
                            </button>
                        )}
                    </div>
                    
                    {deepAnalysis && (
                        <div className="p-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                {/* Left: Main Board/Value */}
                                <div className={`p-4 rounded-xl border ${deepAnalysis.strategy === 'SWITCH_TO_MAIN' || deepAnalysis.strategy === 'DEFENSIVE' ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                                    <h4 className="text-sm font-bold text-blue-400 mb-2">Main Board / Defensive</h4>
                                    <div className="text-xs text-slate-400 mb-2 font-mono uppercase">Opportunity</div>
                                    <div className="text-sm text-white font-medium mb-3">{deepAnalysis.mainBoard.opportunity}</div>
                                    <div className="text-xs text-slate-400 mb-2 font-mono uppercase">Logic</div>
                                    <p className="text-xs text-slate-300 leading-relaxed mb-4">{deepAnalysis.mainBoard.logic}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {deepAnalysis.mainBoard.recommendedSectors.map((s, i) => (
                                            <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-950 text-blue-300 rounded border border-blue-900">{s}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* Right: Tech/Growth */}
                                <div className={`p-4 rounded-xl border ${deepAnalysis.strategy === 'SWITCH_TO_TECH' ? 'bg-purple-900/20 border-purple-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                                    <h4 className="text-sm font-bold text-purple-400 mb-2">Tech / Growth</h4>
                                    <div className="text-xs text-slate-400 mb-2 font-mono uppercase">Opportunity</div>
                                    <div className="text-sm text-white font-medium mb-3">{deepAnalysis.techGrowth.opportunity}</div>
                                    <div className="text-xs text-slate-400 mb-2 font-mono uppercase">Logic</div>
                                    <p className="text-xs text-slate-300 leading-relaxed mb-4">{deepAnalysis.techGrowth.logic}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {deepAnalysis.techGrowth.recommendedSectors.map((s, i) => (
                                            <span key={i} className="text-[10px] px-2 py-0.5 bg-purple-950 text-purple-300 rounded border border-purple-900">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Verdict */}
                            <div className="bg-slate-900 p-4 rounded-xl border-l-4 border-emerald-500 mb-6">
                                <div className="text-xs font-bold text-emerald-400 uppercase mb-1">Strategist Verdict</div>
                                <p className="text-sm text-white">{deepAnalysis.summary}</p>
                            </div>

                            {/* Portfolio Allocation Model - DUAL MODE */}
                            {deepAnalysis.profiles && (
                                <div className="border-t border-slate-800 pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{language === 'en' ? 'Suggested Portfolio Models' : '建议仓位配置模型'}</h4>
                                         
                                         {/* Profile Toggles */}
                                         <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                                             <button 
                                                onClick={() => setActiveProfile('AGGRESSIVE')}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${activeProfile === 'AGGRESSIVE' ? 'bg-purple-900/50 text-purple-300 border border-purple-800' : 'text-slate-500 hover:text-purple-400'}`}
                                             >
                                                 🚀 {language === 'en' ? 'Aggressive' : '激进型'}
                                             </button>
                                             <button 
                                                onClick={() => setActiveProfile('BALANCED')}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${activeProfile === 'BALANCED' ? 'bg-blue-900/50 text-blue-300 border border-blue-800' : 'text-slate-500 hover:text-blue-400'}`}
                                             >
                                                 ⚖️ {language === 'en' ? 'Balanced' : '平衡型'}
                                             </button>
                                         </div>
                                    </div>

                                    {/* Selected Profile Description */}
                                    {currentProfile && (
                                        <div className="animate-fade-in">
                                            <p className="text-sm text-slate-300 mb-4 italic pl-2 border-l-2 border-slate-700">
                                                "{currentProfile.description}"
                                            </p>
                                            
                                            {/* Visual Bar */}
                                            <div className="h-4 w-full rounded-full overflow-hidden flex mb-4 border border-slate-800 bg-slate-900">
                                                {currentProfile.allocations.map((bucket, i) => {
                                                    const aggressiveColors = ['bg-purple-500', 'bg-rose-500', 'bg-slate-600'];
                                                    const balancedColors = ['bg-blue-500', 'bg-emerald-500', 'bg-slate-600'];
                                                    const colors = activeProfile === 'AGGRESSIVE' ? aggressiveColors : balancedColors;
                                                    return (
                                                        <div 
                                                            key={i} 
                                                            style={{ width: `${bucket.percentage}%` }} 
                                                            className={`${colors[i % colors.length]} h-full transition-all duration-500`}
                                                            title={`${bucket.category}: ${bucket.percentage}%`}
                                                        />
                                                    );
                                                })}
                                            </div>

                                            {/* Legend / Details */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {currentProfile.allocations.map((bucket, i) => {
                                                    const aggressiveText = ['text-purple-400', 'text-rose-400', 'text-slate-400'];
                                                    const balancedText = ['text-blue-400', 'text-emerald-400', 'text-slate-400'];
                                                    const textColors = activeProfile === 'AGGRESSIVE' ? aggressiveText : balancedText;
                                                    
                                                    const aggressiveBorder = ['border-purple-900', 'border-rose-900', 'border-slate-800'];
                                                    const balancedBorder = ['border-blue-900', 'border-emerald-900', 'border-slate-800'];
                                                    const borderColors = activeProfile === 'AGGRESSIVE' ? aggressiveBorder : balancedBorder;

                                                    return (
                                                        <div key={i} className={`p-3 rounded-lg border bg-slate-900/30 ${borderColors[i % borderColors.length]} transition-colors duration-300`}>
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className={`text-xs font-bold ${textColors[i % textColors.length]}`}>{bucket.category}</span>
                                                                <span className="text-sm font-mono font-bold text-white">{bucket.percentage}%</span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 mb-2 h-8 overflow-hidden">{bucket.rationale}</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {bucket.examples.map((ex, j) => (
                                                                    <span key={j} className="text-[9px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-700">{ex}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {isDeepAnalyzing && (
                         <div className="p-10 text-center text-slate-500 text-sm font-mono animate-pulse">
                             Scanning Market Style Factors...
                         </div>
                    )}
                </div>
            </div>

            {/* 1D. SEARCH BAR & WATCHLIST (Lower Section) */}
            <div className="max-w-2xl mx-auto space-y-6">
                
                {/* Search Tabs */}
                <div className="flex justify-center gap-6 mb-2">
                    <button 
                        onClick={() => setSearchMode('CODE')}
                        className={`text-sm font-bold pb-2 border-b-2 transition-colors ${searchMode === 'CODE' ? 'text-white border-blue-500' : 'text-slate-600 border-transparent hover:text-slate-400'}`}
                    >
                        {t.searchTabs.code}
                    </button>
                    <button 
                        onClick={() => setSearchMode('DISCOVERY')}
                        className={`text-sm font-bold pb-2 border-b-2 transition-colors ${searchMode === 'DISCOVERY' ? 'text-white border-purple-500' : 'text-slate-600 border-transparent hover:text-slate-400'}`}
                    >
                        {t.searchTabs.discovery}
                    </button>
                </div>

                {/* Input Container */}
                <div className={`bg-slate-900 p-2 rounded-2xl border shadow-lg transition-all flex flex-col gap-2 ${searchMode === 'DISCOVERY' ? 'border-purple-900/50' : 'border-slate-800'}`}>
                  {/* Image Preview */}
                  {selectedImage && (
                      <div className="flex items-center gap-2 p-2 bg-slate-800 rounded-lg w-fit mx-2 mt-2">
                          <img src={selectedImage} alt="Preview" className="h-10 w-10 object-cover rounded border border-slate-700" />
                          <div className="text-[10px] text-slate-300">Image attached</div>
                          <button onClick={clearImage} className="ml-2 text-slate-500 hover:text-rose-400">×</button>
                      </div>
                  )}

                  <form onSubmit={handleSearch} className="relative flex items-center">
                    <input
                      type="text"
                      value={stockCode}
                      onChange={(e) => setStockCode(e.target.value)}
                      placeholder={searchMode === 'DISCOVERY' ? t.discoveryPlaceholders[market] : t.placeholders[market]}
                      className="w-full bg-transparent text-white text-base px-6 py-3 outline-none placeholder:text-slate-600 font-mono"
                    />
                    
                    <div className="absolute right-2 flex items-center gap-2">
                        {/* Camera/Upload */}
                        <div className="relative group">
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} hidden />
                            <input type="file" accept="image/*" ref={importInputRef} onChange={handleScreenshotImport} hidden />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-slate-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={(!stockCode.trim() && !selectedImage)}
                            className={`text-white px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-lg ${
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

                {/* Watchlist */}
                <div className="pt-6 border-t border-slate-800/50">
                    <div className="flex justify-between items-center mb-4 px-1">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            {t.watchlist.title}
                        </h3>
                        <div className="flex gap-2 items-center text-[10px]">
                            <button onClick={() => importInputRef.current?.click()} className="text-slate-600 hover:text-blue-400 transition-colors">OCR Import</button>
                            <span className="text-slate-800">|</span>
                            <button onClick={handleExportPortfolio} className="text-slate-600 hover:text-blue-400 transition-colors">Backup</button>
                        </div>
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
                                         {item.quantity && item.avgCost ? (
                                             <div className="text-[10px] text-slate-400 font-mono">¥{(item.quantity * item.avgCost).toLocaleString()}</div>
                                         ) : (
                                             <button onClick={() => toggleWatchlist(item.code)} className="text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                         )}
                                     </div>
                                 </div>
                             ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 border border-dashed border-slate-800 rounded-lg text-xs text-slate-600">
                            {t.watchlist.empty}
                        </div>
                    )}
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
                 <button onClick={clearAnalysis} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors">
                    {t.newAnalysis}
                 </button>
             </div>

             {/* Batch Table */}
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
                                <th className="p-5 tracking-wider w-1/4">Next Day Action</th>
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
                                        {editingRow === item.code ? (
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    value={editPrice}
                                                    onChange={(e) => setEditPrice(e.target.value)}
                                                    className="w-20 bg-slate-950 border border-blue-500 rounded px-1 py-0.5 text-sm outline-none"
                                                    autoFocus
                                                />
                                                <button onClick={() => saveEditPrice(item.code, item.name || item.code)} className="text-emerald-400 hover:text-emerald-300">✅</button>
                                                <button onClick={cancelEditPrice} className="text-rose-400 hover:text-rose-300">❌</button>
                                            </div>
                                        ) : (
                                            <div className="relative group/edit">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-mono text-lg text-slate-200">{item.price}</div>
                                                    <button onClick={() => startEditPrice(item.code, item.price)} className="opacity-0 group-hover/edit:opacity-100 text-slate-600 hover:text-blue-400 transition-opacity">
                                                        ✎
                                                    </button>
                                                </div>
                                                <div className={`text-xs font-bold font-mono ${getTrendColor(item.change)}`}>{item.change}</div>
                                                {/* Last Updated Timestamp */}
                                                <div className={`text-[10px] mt-1 font-mono ${item.lastUpdated?.includes('Manual') ? 'text-yellow-500' : 'text-slate-600'}`}>
                                                    {item.lastUpdated || 'N/A'}
                                                    {reanalyzingRows.has(item.code) && <span className="ml-2 animate-spin inline-block">⟳</span>}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-5">
                                        <span className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 w-fit ${getBatchSignalColor(item.signal)}`}>
                                            <span className={`w-2 h-2 rounded-full ${item.signal.includes('BUY') ? 'bg-emerald-500' : item.signal.includes('SELL') ? 'bg-rose-500' : 'bg-yellow-500'}`}></span>
                                            {item.signal} | {item.confidence}%
                                        </span>
                                    </td>
                                    {/* Thresholds Column */}
                                    <td className="p-5">
                                        <div className="flex flex-col gap-1 text-xs font-mono">
                                            <div className="flex items-center gap-2 text-emerald-300">
                                                <span>🎯</span> {item.targetPrice || '-'}
                                            </div>
                                            <div className="flex items-center gap-2 text-rose-300">
                                                <span>🛡️</span> {item.stopLoss || '-'}
                                            </div>
                                        </div>
                                    </td>
                                    {/* Next Day Action Column */}
                                    <td className="p-5">
                                        <p className="text-sm text-blue-200 leading-relaxed font-medium">
                                            {item.action || item.reason}
                                        </p>
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
                     {/* Save to Portfolio Button */}
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

                   {/* --- HORIZON STRATEGY CARD (New) --- */}
                   {singleResult && (
                       <div className="bg-slate-900/50 border border-blue-900/30 rounded-2xl p-4 no-print relative overflow-hidden">
                           {/* Horizon Tabs */}
                           <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                               <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                   <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                   {language === 'en' ? 'Strategy Horizon' : '时空交易规划'}
                               </h3>
                               <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                                   {(['SHORT', 'MEDIUM', 'LONG'] as TimeHorizon[]).map(h => (
                                       <button
                                           key={h}
                                           onClick={() => handleHorizonChange(h)}
                                           className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${activeHorizon === h ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                       >
                                           {h === 'SHORT' ? (language === 'en' ? 'Short (<1M)' : '短线 (1月内)') :
                                            h === 'MEDIUM' ? (language === 'en' ? 'Mid (2-4M)' : '中线 (2-4月)') :
                                            (language === 'en' ? 'Long (6M+)' : '长线 (半年+)')}
                                       </button>
                                   ))}
                               </div>
                           </div>

                           {/* Setup Content */}
                           {isSetupLoading ? (
                               <div className="py-6 text-center text-slate-500 text-xs font-mono animate-pulse">
                                   Calculating {activeHorizon.toLowerCase()} term volatility & targets...
                               </div>
                           ) : tradeSetup ? (
                               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                                   <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                       <div className="text-[10px] text-slate-500 uppercase mb-1">Signal</div>
                                       <div className={`text-lg font-bold ${tradeSetup.recommendation === 'BUY' ? 'text-emerald-400' : tradeSetup.recommendation === 'SELL' ? 'text-rose-400' : 'text-yellow-400'}`}>
                                           {tradeSetup.recommendation}
                                       </div>
                                   </div>
                                   <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                       <div className="text-[10px] text-blue-400 uppercase mb-1">Entry Zone</div>
                                       <div className="text-lg font-bold text-white font-mono">{tradeSetup.entryZone}</div>
                                   </div>
                                   <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                        <div className="text-[10px] text-rose-400 uppercase mb-1">Invalidation (Stop)</div>
                                        <div className="text-lg font-bold text-white font-mono">{tradeSetup.invalidLevel}</div>
                                   </div>
                                   <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                        <div className="text-[10px] text-emerald-400 uppercase mb-1">Target</div>
                                        <div className="text-lg font-bold text-white font-mono">{tradeSetup.targetLevel}</div>
                                   </div>
                                   <div className="col-span-1 md:col-span-4 mt-2 px-2">
                                       <p className="text-xs text-slate-400 italic">
                                           <span className="font-bold text-blue-400">Logic: </span>
                                           {tradeSetup.technicalRationale}
                                       </p>
                                   </div>
                               </div>
                           ) : (
                               <div className="py-4 text-center text-slate-600 text-xs italic">
                                   Select a horizon to generate specific trade setup.
                               </div>
                           )}
                       </div>
                   )}
                   
                   {/* Main Analysis Card */}
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
                          {/* Watchlist Toggle for Single View - Kept for card context */}
                          {singleResult && (
                             <button 
                                onClick={() => toggleWatchlist(singleResult.symbol)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors ${isSaved(singleResult.symbol) ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}
                             >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                {isSaved(singleResult.symbol) ? t.watchlist.removed : t.watchlist.added}
                             </button>
                          )}
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
