export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
  WAIT = 'WAIT'
}

export type Language = 'en' | 'zh';

export type Market = 'A_SHARE' | 'US_STOCK' | 'HK_STOCK';

export type AnalysisMode = 'LIVE' | 'SNAPSHOT';

export interface StructuredAnalysisData {
  signal: string;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
}

export interface AnalysisResult {
  rawText: string;
  symbol: string;
  timestamp: string;
  groundingSources?: Array<{
    uri: string;
    title: string;
  }>;
  structuredData?: StructuredAnalysisData;
}

export interface StockQuery {
  code: string;
}

export interface LoadingStep {
  id: number;
  message: string;
  active: boolean;
  completed: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}