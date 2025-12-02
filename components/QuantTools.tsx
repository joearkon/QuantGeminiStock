import React, { useState, useEffect } from 'react';
import { StructuredAnalysisData, Language } from '../types';

interface QuantToolsProps {
  data: StructuredAnalysisData;
  lang: Language;
}

export const QuantTools: React.FC<QuantToolsProps> = ({ data, lang }) => {
  const [capital, setCapital] = useState<number>(100000);
  const [riskPercent, setRiskPercent] = useState<number>(2);
  
  // Editable fields initialized from AI data
  const [entryPrice, setEntryPrice] = useState<number>(data.entryPrice);
  const [stopLoss, setStopLoss] = useState<number>(data.stopLoss);

  useEffect(() => {
    setEntryPrice(data.entryPrice);
    setStopLoss(data.stopLoss);
  }, [data]);

  const riskAmount = capital * (riskPercent / 100);
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  
  // Calculate shares. 
  // If Stop Loss is invalid (>= Entry for Long), show 0.
  // Assumption: Long trade. If Signal is SELL, maybe Short? 
  // For simplicity in this version, we assume Long logic or Absolute Difference.
  let shares = 0;
  if (riskPerShare > 0) {
    shares = Math.floor(riskAmount / riskPerShare);
  }
  
  const positionValue = shares * entryPrice;

  // Gauge Color
  const getGaugeColor = (conf: number, sig: string) => {
    if (sig.includes('SELL')) return 'bg-rose-500';
    if (sig.includes('BUY')) return 'bg-emerald-500';
    return 'bg-yellow-500';
  };

  const t = {
    en: {
      toolsTitle: "QUANT TOOLS",
      sentiment: "Sentiment Gauge",
      riskCalc: "Smart Position Sizing",
      capital: "Total Capital",
      risk: "Risk %",
      entry: "Entry Price",
      stop: "Stop Loss",
      result: "Position Size",
      shares: "Shares",
      posValue: "Pos Value",
      riskAmt: "Risk Amt",
      calcNote: "Based on Fixed Risk % model"
    },
    zh: {
      toolsTitle: "量化工具箱",
      sentiment: "情绪仪表盘",
      riskCalc: "智能风控计算器",
      capital: "总本金",
      risk: "单笔风控 %",
      entry: "建仓价格",
      stop: "止损价格",
      result: "建议仓位",
      shares: "股/手",
      posValue: "持仓市值",
      riskAmt: "预计亏损",
      calcNote: "基于固定百分比风险模型"
    }
  }[lang];

  return (
    <div className="space-y-6 animate-fade-in-up">
      
      {/* 1. Sentiment Gauge */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">{t.sentiment}</h3>
        
        <div className="relative flex flex-col items-center justify-center py-2">
           {/* Semi Circle Background */}
           <div className="w-48 h-24 overflow-hidden relative">
              <div className="w-48 h-48 rounded-full bg-slate-800 border-8 border-slate-700 box-border"></div>
           </div>
           
           {/* Needle / Value */}
           <div 
             className={`absolute top-0 w-48 h-48 rounded-full border-8 border-transparent transition-all duration-1000 ease-out`}
             style={{
               borderTopColor: data.signal.includes('BUY') ? '#10b981' : data.signal.includes('SELL') ? '#f43f5e' : '#eab308',
               transform: `rotate(${(data.confidence / 100) * 