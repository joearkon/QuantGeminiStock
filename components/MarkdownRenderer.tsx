import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Simple regex-based parsing specifically tuned for the requested prompt format
  // Supports both English and Chinese markers
  
  const sections = content.split('\n');

  return (
    <div className="space-y-4 font-sans text-slate-300">
      {sections.map((line, index) => {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('# 📊')) {
           return <h1 key={index} className="text-2xl md:text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">{trimmed.replace('#', '')}</h1>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold text-blue-400 mt-8 mb-3">{trimmed.replace('## ', '')}</h2>;
        }
        
        // Handle Signal/信号
        // Matches **Signal:** or **信号:**
        const signalMatch = trimmed.match(/^\*\*(Signal|信号)(:|：)\*\*(.*)/);
        if (signalMatch) {
             const label = signalMatch[1]; // Signal or 信号
             const signalText = signalMatch[3].trim();
             
             let colorClass = "text-slate-200";
             if (signalText.match(/BUY|买入/i)) colorClass = "text-emerald-400 font-bold";
             else if (signalText.match(/SELL|卖出/i)) colorClass = "text-rose-400 font-bold";
             else if (signalText.match(/HOLD|持有/i)) colorClass = "text-yellow-400 font-bold";
             else if (signalText.match(/WAIT|观望/i)) colorClass = "text-slate-300 font-bold";

             return (
                <div key={index} className="flex items-center gap-2 p-2 bg-slate-800/50 rounded border-l-4 border-slate-600 my-2">
                    <span className="font-bold text-white">{label}:</span>
                    <span className={`text-lg ${colorClass}`}>{signalText}</span>
                </div>
             );
        }

        // Handle generic key-value pairs bolded: **Key:** Value
        if (trimmed.startsWith('**') && (trimmed.includes(':**') || trimmed.includes('：**'))) {
             // Handle both English colon : and Chinese colon ：
             const separator = trimmed.includes(':**') ? ':**' : '：**';
             const parts = trimmed.split(separator);
             const key = parts[0].replace('**', '');
             const value = parts[1];
             
             return (
                 <div key={index} className="my-1">
                     <span className="font-bold text-slate-200">{key}:</span>
                     <span className="text-slate-400 ml-2">{value}</span>
                 </div>
             );
        }

        // Handle List Items with specific highlighting for Execution Plan
        if (trimmed.startsWith('- **')) {
             const htmlContent = trimmed.replace('- ', '').replace(/\*\*(.*?)\*\*/g, (match, p1) => {
                 let colorClass = 'text-white'; // default
                 // Color code specific keywords for the execution plan
                 if (p1.match(/Entry|Buy|建仓|买入|策略/i)) colorClass = 'text-blue-400';
                 if (p1.match(/Stop|Loss|止损/i)) colorClass = 'text-rose-400';
                 if (p1.match(/Target|Profit|止盈/i)) colorClass = 'text-emerald-400';
                 
                 return `<strong class="${colorClass}">${p1}</strong>`;
             });
             return <li key={index} className="ml-4 list-disc text-slate-300 my-1"><span dangerouslySetInnerHTML={{__html: htmlContent}} /></li>;
        }

        if (trimmed.startsWith('*Disclaimer') || trimmed.startsWith('*免责声明')) {
            return <p key={index} className="text-xs text-slate-500 mt-8 italic border-t border-slate-800 pt-4">{trimmed}</p>;
        }
        
        if (trimmed === '') return <div key={index} className="h-2"></div>;

        return <p key={index} className="leading-relaxed">{trimmed}</p>;
      })}
    </div>
  );
};