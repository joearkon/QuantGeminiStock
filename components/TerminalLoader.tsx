import React, { useEffect, useState } from 'react';
import { LoadingStep, Language } from '../types';

const STEPS = {
  en: [
    "Connecting to Market Data Gateway...",
    "Retrieving Real-time Quotes & Volume...",
    "Calculating Moving Averages (MA5, MA20, MA60)...",
    "Analyzing MACD & KDJ Indicators...",
    "Scanning Fundamental News Stream...",
    "Synthesizing Quantitative Strategy...",
  ],
  zh: [
    "正在连接市场数据网关...",
    "检索实时行情与成交量...",
    "计算均线系统 (MA5, MA20, MA60)...",
    "分析 MACD 与 KDJ 技术指标...",
    "扫描基本面新闻资讯...",
    "合成量化交易策略...",
  ]
};

interface TerminalLoaderProps {
  lang: Language;
}

export const TerminalLoader: React.FC<TerminalLoaderProps> = ({ lang }) => {
  const currentStepsText = STEPS[lang];
  
  const [steps, setSteps] = useState<LoadingStep[]>(
    currentStepsText.map((msg, idx) => ({ id: idx, message: msg, active: idx === 0, completed: false }))
  );

  useEffect(() => {
    let currentStepIndex = 0;

    const interval = setInterval(() => {
      setSteps(prev => {
        const newSteps = [...prev];
        
        // Complete current step
        if (currentStepIndex < newSteps.length) {
          newSteps[currentStepIndex].active = false;
          newSteps[currentStepIndex].completed = true;
        }

        currentStepIndex++;

        // Activate next step
        if (currentStepIndex < newSteps.length) {
          newSteps[currentStepIndex].active = true;
        }

        return newSteps;
      });

      if (currentStepIndex >= currentStepsText.length) {
        clearInterval(interval);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [currentStepsText.length]);

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-950 border border-slate-800 rounded-lg p-6 font-mono text-sm shadow-2xl">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="text-slate-500 ml-2">quant_engine — zsh</span>
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            <span className={`w-4 text-center ${step.completed ? 'text-green-400' : 'text-slate-600'}`}>
              {step.completed ? '✔' : step.active ? '➤' : '•'}
            </span>
            <span className={`${
              step.active ? 'text-blue-400 animate-pulse' : 
              step.completed ? 'text-slate-300' : 'text-slate-600'
            }`}>
              {step.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};