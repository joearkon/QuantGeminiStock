import React, { useState, useEffect } from 'react';
import { StructuredAnalysisData, Language } from '../types';

interface QuantToolsProps {
  data: StructuredAnalysisData;
  lang: Language;
}

type Tab = 'RISK' | 'PROFIT' | 'KELLY' | 'AVG';

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

  // Kelly Tab States
  const [winRate, setWinRate] = useState<number>(data.confidence || 60);
  const [kellyOdds, setKellyOdds] = useState<number>(2.0); // Reward to Risk Ratio
  const [kellyMode, setKellyMode] = useState<'FULL' | 'HALF'>('HALF');

  // Avg Cost Tab States
  const [currentShares, setCurrentShares] = useState<number>(1000);
  const [currentAvg, setCurrentAvg] = useState<number>(data.entryPrice ? data.entryPrice * 1.1 : 0); // Simulate being trapped 10% high
  const [addShares, setAddShares] = useState<number>(1000);
  const [addPrice, setAddPrice] = useState<number>(data.entryPrice || 0);

  useEffect(() => {
    setEntryPrice(data.entryPrice || 0);
    setStopLoss(data.stopLoss || 0);
    setWinRate(data.confidence || 60);
    setAddPrice(data.entryPrice || 0);
    
    // Auto-calculate implied odds from AI's target and stop loss if available
    if (data.targetPrice && data.entryPrice && data.stopLoss) {
        const potentialReward = Math.abs(data.targetPrice - data.entryPrice);
        const potentialRisk = Math.abs(data.entryPrice - data.stopLoss);
        if (potentialRisk > 0) {
            setKellyOdds(parseFloat((potentialReward / potentialRisk).toFixed(2)));
        }
    }
  }, [data]);

  // --- Calculations ---

  // 1. Risk Calc
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

  // 2. Profit Calc
  const sellPrice = entryPrice * (1 + targetProfitPercent / 100);
  const totalProfit = recommendedShares * (sellPrice - entryPrice); // Using recommended shares from Risk tab as base

  // 3. Kelly Calc
  // Formula: f* = p - (q / b)
  // p = win probability, q = loss probability (1-p), b = odds
  const p = winRate / 100;
  const q = 1 - p;
  const b = kellyOdds;
  let rawKelly = 0;
  if (b > 0) {
      rawKelly = p - (q / b);
  }
  // Clamp negative results to 0
  const effectiveKelly = Math.max(0, rawKelly);
  const kellyMultiplier = kellyMode === 'HALF' ? 0.5 : 1.0;
  const finalKellyPct = effectiveKelly * kellyMultiplier * 100;
  const kellyCapital = capital * (finalKellyPct / 100);

  // 4. Avg Cost Calc
  const costOld = currentShares * currentAvg;
  const costNew = addShares * addPrice;
  const totalShares = currentShares + addShares;
  const newAvg = totalShares > 0 ? (costOld + costNew) / totalShares : 0;
  const breakevenRise = addPrice > 0 ? ((newAvg - addPrice) / addPrice) * 100 : 0;
  const dropToBreakEven = currentAvg > 0 ? ((newAvg - currentAvg) / currentAvg) * 100 : 0;

  // Gauge logic
  const rotation = (data.confidence / 100) * 180 - 90; 

  const t = {
    en: {
      sentiment: "Sentiment Gauge",
      tabs: { risk: "Risk", profit: "Profit", kelly: "Kelly", avg: "Avg Cost" },
      capital: "Total Capital",
      entry: "Entry Price",
      stop: "Stop Loss",
      riskPct: "Risk %",
      recPos: "Rec. Position",
      shares: "Shares",
      posVal: "Value",
      riskAmt: "Risk Amt",
      targetPct: "Target %",
      sellPrice: "Sell Price",
      estProfit: "Est. Profit",
      kelly: {
          winRate: "Win Rate %",
          odds: "Odds (R:R)",
          mode: "Mode",
          allocation: "Optimal Allocation",
          half: "Half Kelly",
          full: "Full Kelly",
          note: "Kelly Criterion maximizes log-utility of wealth."
      },
      avg: {
          currShares: "Held Shares",
          currCost: "Avg Cost",
          addShares: "Add Shares",
          addPrice: "Buy Price",
          newAvg: "New Avg Cost",
          breakeven: "Rise to Breakeven",
          diff: "Cost Reduction"
      }
    },
    zh: {
      sentiment: "情绪仪表盘",
      tabs: { risk: "智能风控", profit: "止盈推演", kelly: "凯利公式", avg: "补仓做T" },
      capital: "总本金",
      entry: "买入价格",
      stop: "止损价格",
      riskPct: "单笔风控 %",
      recPos: "建议仓位",
      shares: "股/手",
      posVal: "持仓市值",
      riskAmt: "预计亏损",
      targetPct: "期望收益 %",
      sellPrice: "目标卖出价",
      estProfit: "预计盈利",
      kelly: {
          winRate: "胜率 (Win%)",
          odds: "盈亏比 (赔率)",
          mode: "模式",
          allocation: "理论最优仓位",
          half: "半凯利 (稳健)",
          full: "全凯利 (激进)",
          note: "凯利公式用于计算理论上能使资产增长最快的注码。"
      },
      avg: {
          currShares: "当前持仓",
          currCost: "当前成本",
          addShares: "补仓数量",
          addPrice: "补仓价格",
          newAvg: "最新均价",
          breakeven: "回本需涨幅",
          diff: "成本降低"
      }
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
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
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

      {/* 2. Advanced Calculator Suite */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-800">
            {(['RISK', 'PROFIT', 'KELLY', 'AVG'] as Tab[]).map(tab => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                        activeTab === tab 
                        ? 'bg-slate-800 text-blue-400 border-blue-400' 
                        : 'bg-slate-900 text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                >
                    {t.tabs[tab.toLowerCase() as keyof typeof t.tabs]}
                </button>
            ))}
        </div>

        <div className="p-5">
            {/* Common Capital Input (Only for Risk/Kelly) */}
            {(activeTab === 'RISK' || activeTab === 'KELLY') && (
                <div className="mb-4">
                     <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.capital}</label>
                     <input 
                        type="number" 
                        value={capital}
                        onChange={(e) => setCapital(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none mt-1"
                     />
                </div>
            )}

            {/* --- TAB: RISK (Smart Risk) --- */}
            {activeTab === 'RISK' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.entry}</label>
                            <input type="number" value={entryPrice} onChange={(e) => setEntryPrice(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-blue-300 focus:border-blue-500 outline-none mt-1 font-mono" />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.stop}</label>
                            <input type="number" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-rose-300 focus:border-blue-500 outline-none mt-1 font-mono" />
                        </div>
                    </div>
                    <div>
                         <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.riskPct}</label>
                         <div className="relative mt-1">
                            <input type="number" value={riskPercent} onChange={(e) => setRiskPercent(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none" />
                            <span className="absolute right-3 top-2 text-xs text-slate-500 font-bold">%</span>
                         </div>
                    </div>

                    <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                        <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800">
                            <span className="text-xs text-slate-400">{t.recPos}</span>
                            <span className="text-xl font-bold text-white font-mono">{recommendedShares.toLocaleString()} <span className="text-xs font-normal text-slate-500">{t.shares}</span></span>
                        </div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-slate-500">{t.posVal}</span>
                            <span className="text-sm font-mono text-slate-300">{positionValue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-500">{t.riskAmt}</span>
                            <span className="text-sm font-mono text-rose-400">-{riskAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB: PROFIT (Targeter) --- */}
            {activeTab === 'PROFIT' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.entry}</label>
                            <input type="number" value={entryPrice} onChange={(e) => setEntryPrice(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-blue-300 font-mono mt-1" />
                        </div>
                        <div>
                             <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.targetPct}</label>
                             <div className="relative mt-1">
                                <input type="number" value={targetProfitPercent} onChange={(e) => setTargetProfitPercent(Number(e.target.value))} className="w-full bg-slate-950 border border-emerald-900/50 rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono" />
                                <span className="absolute right-3 top-2 text-xs text-emerald-600 font-bold">%</span>
                             </div>
                        </div>
                    </div>
                    
                    <div>
                         <input type="range" min="1" max="50" step="1" value={targetProfitPercent} onChange={(e) => setTargetProfitPercent(Number(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                    </div>

                    <div className="bg-slate-950 rounded-xl p-4 border border-emerald-900/30">
                         <div className="flex justify-between items-center mb-3">
                            <span className="text-xs text-emerald-100/70">{t.sellPrice}</span>
                            <span className="text-2xl font-bold text-emerald-400 font-mono">{sellPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                             <span className="text-xs text-slate-500">{t.estProfit} ({recommendedShares} {t.shares})</span>
                             <span className="text-sm font-mono text-emerald-300">+{totalProfit.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB: KELLY (Kelly Criterion) --- */}
            {activeTab === 'KELLY' && (
                <div className="space-y-4 animate-fade-in">
                     <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.kelly.winRate}</label>
                            <input type="number" value={winRate} onChange={(e) => setWinRate(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono mt-1" />
                        </div>
                        <div>
                             <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.kelly.odds}</label>
                             <input type="number" step="0.1" value={kellyOdds} onChange={(e) => setKellyOdds(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-blue-300 font-mono mt-1" />
                        </div>
                    </div>

                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button onClick={() => setKellyMode('HALF')} className={`flex-1 py-1.5 text-xs font-medium rounded ${kellyMode === 'HALF' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>{t.kelly.half}</button>
                        <button onClick={() => setKellyMode('FULL')} className={`flex-1 py-1.5 text-xs font-medium rounded ${kellyMode === 'FULL' ? 'bg-purple-900/40 text-purple-300' : 'text-slate-500'}`}>{t.kelly.full}</button>
                    </div>

                    <div className="bg-slate-950 rounded-xl p-4 border border-purple-900/30">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs text-purple-200/70">{t.kelly.allocation} ({kellyMode})</span>
                            <span className="text-2xl font-bold text-purple-400 font-mono">{finalKellyPct.toFixed(1)}%</span>
                        </div>
                         <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                             <span className="text-xs text-slate-500">{t.posVal}</span>
                             <span className="text-sm font-mono text-purple-300">{kellyCapital.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                        </div>
                    </div>
                     <p className="text-[10px] text-slate-600 italic text-center">{t.kelly.note}</p>
                </div>
            )}

            {/* --- TAB: AVG (Average Cost) --- */}
            {activeTab === 'AVG' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.avg.currShares}</label>
                            <input type="number" value={currentShares} onChange={(e) => setCurrentShares(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 font-mono mt-1" />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">{t.avg.currCost}</label>
                            <input type="number" value={currentAvg} onChange={(e) => setCurrentAvg(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 font-mono mt-1" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 relative">
                         <div className="absolute left-1/2 -ml-3 top-6 text-slate-600 bg-slate-900 rounded-full p-0.5 z-10">+</div>
                         <div>
                            <label className="text-[10px] uppercase text-blue-400/80 font-bold tracking-wider">{t.avg.addShares}</label>
                            <input type="number" value={addShares} onChange={(e) => setAddShares(Number(e.target.value))} className="w-full bg-slate-950 border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-blue-300 font-mono mt-1" />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase text-blue-400/80 font-bold tracking-wider">{t.avg.addPrice}</label>
                            <input type="number" value={addPrice} onChange={(e) => setAddPrice(Number(e.target.value))} className="w-full bg-slate-950 border border-blue-900/50 rounded-lg px-3 py-2 text-sm text-blue-300 font-mono mt-1" />
                        </div>
                    </div>

                    <div className="bg-slate-950 rounded-xl p-4 border border-blue-900/30">
                         <div className="flex justify-between items-center mb-3">
                            <span className="text-xs text-blue-200/70">{t.avg.newAvg}</span>
                            <span className="text-2xl font-bold text-blue-400 font-mono">{newAvg.toFixed(2)}</span>
                        </div>
                         <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                             <span className="text-xs text-slate-500">{t.avg.diff}</span>
                             <span className={`text-sm font-mono ${newAvg < currentAvg ? 'text-emerald-400' : 'text-rose-400'}`}>
                                 {((newAvg - currentAvg) / currentAvg * 100).toFixed(2)}%
                             </span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                             <span className="text-xs text-slate-500">{t.avg.breakeven}</span>
                             <span className="text-sm font-mono text-yellow-400">
                                 {breakevenRise.toFixed(2)}%
                             </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};