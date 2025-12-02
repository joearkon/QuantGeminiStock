import React, { useState, useEffect } from 'react';
import { StructuredAnalysisData, Language } from '../types';

interface QuantToolsProps {
  data: StructuredAnalysisData;
  lang: Language;
}

type Tab = 'RISK' | 'PROFIT';

export const QuantTools: React.FC<QuantToolsProps> = ({ data, lang }) => {
  const [activeTab, setActiveTab] = useState<Tab>('RISK');
  
  // Shared States
  const [capital, setCapital] = useState<number>(100000);
  const [entryPrice, setEntryPrice] = useState<number>(data.entryPrice || 0);

  // Risk Tab States
  const [riskPercent, setRiskPercent] = useState<number>(2);
  const [stopLoss, setStopLoss] = useState<number>(data.stopLoss || 0);

  // Profit Tab States
  const [targetProfitPercent, setTargetProfitPercent] = useState<number>(10);
  const [targetProfitAmount, setTargetProfitAmount] = useState<number>(0);

  useEffect(() => {
    setEntryPrice(data.entryPrice || 0);
    setStopLoss(data.stopLoss || 0);
  }, [data]);

  // --- Calculations ---

  // Risk Calc
  const riskAmount = capital * (riskPercent / 100);
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  let maxShares = 0;
  if (entryPrice > 0) {
      maxShares = Math.floor(capital / entryPrice);
  }
  let recommendedShares = 0;
  if (riskPerShare > 0) {
      recommendedShares = Math.floor(riskAmount / riskPerShare);
      // Cap at max affordability
      if (recommendedShares > maxShares) recommendedShares = maxShares;
  }
  const positionValue = recommendedShares * entryPrice;

  // Profit Calc
  // If user changes %, update amount. If user changes amount, update %.
  // Here we assume driving by Percentage primarily for simplicity in render, 
  // but let's calc "Sell Price" based on the percent.
  const sellPrice = entryPrice * (1 + targetProfitPercent / 100);
  const totalProfit = maxShares * (sellPrice - entryPrice); // Profit if full position (10000 capital used)

  // Gauge logic: Map confidence (0-100) to rotation (-90 to 90 degrees)
  const rotation = (data.confidence / 100) * 180 - 90; 

  const t = {
    en: {
      toolsTitle: "QUANT TOOLS",
      sentiment: "Sentiment Gauge",
      riskCalc: "Risk",
      profitCalc: "Profit Target",
      capital: "Total Capital",
      risk: "Risk %",
      entry: "Entry Price",
      stop: "Stop Loss",
      result: "Position Size",
      shares: "Shares",
      posValue: "Pos Value",
      riskAmt: "Risk Amt",
      calcNote: "Based on Fixed Risk % model",
      targetPct: "Target Profit %",
      sellPrice: "Required Sell Price",
      estProfit: "Est. Profit",
      aiTarget: "AI Target",
      diff: "Gap"
    },
    zh: {
      toolsTitle: "量化工具箱",
      sentiment: "情绪仪表盘",
      riskCalc: "智能风控",
      profitCalc: "止盈推演",
      capital: "总本金",
      risk: "单笔风控 %",
      entry: "买入价格",
      stop: "止损价格",
      result: "建议仓位",
      shares: "股/手",
      posValue: "持仓市值",
      riskAmt: "预计亏损",
      calcNote: "基于固定百分比风险模型",
      targetPct: "期望收益率 %",
      sellPrice: "目标卖出价",
      estProfit: "预计盈利",
      aiTarget: "AI 预测目标",
      diff: "差距"
    }
  }[lang];
  
  const getSignalColor = (sig: string) => {
     if (!sig) return 'text-slate-400';
     const s = sig.toUpperCase();
     if (s.includes('BUY') || s.includes('买')) return 'text-emerald-400';
     if (s.includes('SELL') || s.includes('卖')) return 'text-rose-400';
     return 'text-yellow-400';
  }

  return (
    <div className="space-y-6 animate-fade-in-up no-print">
      
      {/* 1. Sentiment Gauge */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        </div>
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            {t.sentiment}
        </h3>
        
        <div className="flex flex-col items-center">
            {/* Gauge Graphic */}
            <div className="relative w-48 h-24 mb-4">
                {/* Background Arc Mask */}
                <div className="absolute top-0 left-0 w-48 h-48 rounded-full box-border bg-slate-800/50" style={{clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)'}}></div>
                
                {/* Gradient Arc */}
                <div className="absolute top-0 left-0 w-48 h-48 rounded-full box-border"
                     style={{
                         background: `conic-gradient(from 270deg, #f43f5e 0deg, #eab308 90deg, #10b981 180deg)`,
                         maskImage: 'radial-gradient(closest-side, transparent 78%, black 80%)',
                         WebkitMaskImage: 'radial-gradient(closest-side, transparent 78%, black 80%)',
                         clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)'
                     }}
                ></div>

                {/* Needle */}
                <div 
                   className="absolute bottom-0 left-1/2 w-1 h-24 bg-slate-200 origin-bottom transition-transform duration-1000 ease-out z-10 rounded-full"
                   style={{ 
                       transform: `translateX(-50%) rotate(${rotation}deg)`,
                       boxShadow: '0 0 10px rgba(0,0,0,0.5)'
                    }}
                ></div>
                {/* Needle Pivot */}
                <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-slate-200 rounded-full -translate-x-1/2 translate-y-1/2 z-20 border-2 border-slate-900"></div>
            </div>

            <div className="text-center z-10 mt-2">
                <div className={`text-2xl font-black tracking-tight ${getSignalColor(data.signal)}`}>
                    {data.signal}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1">
                    Confidence: <span className="text-slate-300 font-bold">{data.confidence}%</span>
                </div>
            </div>
        </div>
      </div>

      {/* 2. Calculator Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {/* Tabs */}
        <div className="flex border-b border-slate-800">
            <button 
                onClick={() => setActiveTab('RISK')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'RISK' ? 'bg-slate-800 text-white' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
            >
                {t.riskCalc}
            </button>
            <button 
                onClick={() => setActiveTab('PROFIT')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'PROFIT' ? 'bg-slate-800 text-emerald-400' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
            >
                {t.profitCalc}
            </button>
        </div>

        <div className="p-6">
            {/* Common Inputs */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.capital}</label>
                    <input 
                    type="number" 
                    value={capital}
                    onChange={(e) => setCapital(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none transition-colors"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.entry}</label>
                    <input 
                    type="number" 
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-blue-300 focus:border-blue-500 outline-none transition-colors font-mono"
                    />
                </div>
            </div>

            {/* TAB: RISK */}
            {activeTab === 'RISK' && (
                <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.risk}</label>
                            <div className="relative">
                                <input 
                                type="number" 
                                value={riskPercent}
                                onChange={(e) => setRiskPercent(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none transition-colors"
                                />
                                <span className="absolute right-3 top-2 text-xs text-slate-500 font-bold">%</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.stop}</label>
                            <input 
                            type="number" 
                            value={stopLoss}
                            onChange={(e) => setStopLoss(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-rose-300 focus:border-blue-500 outline-none transition-colors font-mono"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                        <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800">
                            <span className="text-xs text-slate-400">{t.result}</span>
                            <span className="text-xl font-bold text-white tracking-tight">{recommendedShares.toLocaleString()} <span className="text-xs font-normal text-slate-500">{t.shares}</span></span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-slate-500">{t.posValue}</span>
                            <span className="text-sm font-mono text-slate-300">{positionValue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500">{t.riskAmt}</span>
                            <span className="text-sm font-mono text-rose-400">-{riskAmount.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="mt-3 text-[10px] text-slate-600 text-center italic">
                        {t.calcNote}
                    </div>
                </>
            )}

            {/* TAB: PROFIT TARGET */}
            {activeTab === 'PROFIT' && (
                <>
                   <div className="mb-6">
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.targetPct}</label>
                            <span className="text-lg font-bold text-emerald-400">{targetProfitPercent}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="1" 
                            max="50" 
                            step="1"
                            value={targetProfitPercent}
                            onChange={(e) => setTargetProfitPercent(Number(e.target.value))}
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                   </div>

                   <div className="bg-slate-950 rounded-xl p-4 border border-emerald-900/30 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                           <svg className="w-16 h-16 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
                        </div>
                        
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs text-emerald-100/70">{t.sellPrice}</span>
                            <span className="text-2xl font-bold text-emerald-400 tracking-tight font-mono">{sellPrice.toFixed(2)}</span>
                        </div>

                        <div className="space-y-2 border-t border-slate-800 pt-3">
                             <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500">{t.estProfit} (All In)</span>
                                <span className="text-sm font-mono text-emerald-300">+{totalProfit.toLocaleString()}</span>
                            </div>
                            {data.targetPrice > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{t.aiTarget}</span>
                                    <span className="text-xs font-mono text-slate-400">{data.targetPrice}</span>
                                </div>
                            )}
                            {data.targetPrice > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">{t.diff}</span>
                                    <span className={`text-xs font-mono ${sellPrice > data.targetPrice ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {((sellPrice - data.targetPrice) / data.targetPrice * 100).toFixed(1)}% {sellPrice > data.targetPrice ? 'Above AI' : 'Below AI'}
                                    </span>
                                </div>
                            )}
                        </div>
                   </div>
                   <div className="mt-3 text-[10px] text-slate-600 text-center italic">
                       Calculated based on full position: {maxShares} shares
                   </div>
                </>
            )}

        </div>
      </div>
    </div>
  );
};