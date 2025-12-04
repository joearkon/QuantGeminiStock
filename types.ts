
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

export interface BatchItem {
  code: string;
  name?: string;
  price: string;
  change: string;
  signal: string;
  confidence: number;
  reason: string;
  targetPrice?: string;
  stopLoss?: string;
  action?: string;
  lastUpdated?: string;
}

export interface MarketIndex {
  name: string;
  value: string;
  change: string; // e.g. "+1.20%" or "-0.5%"
}

export interface MarketOverview {
  sentimentScore: number; // 0-100
  sentimentText: string;
  indices: MarketIndex[]; // New: List of 3 major indices
  hotSectors: string[];
  rotationAnalysis: {
      inflow: string; // "Funds flowing INTO..."
      outflow: string; // "Funds flowing OUT of..."
      logic: string; // "Reason: ..."
  }; 
  monthlyStrategy: string;
  keyRisk: string;
}

export interface AllocationBucket {
  category: string; // e.g. "Core Defensive"
  percentage: number; // e.g. 50
  rationale: string;
  examples: string[];
}

export interface DeepMacroAnalysis {
  mainBoard: {
    opportunity: string; // e.g., "High Dividend Yields"
    recommendedSectors: string[];
    logic: string;
  };
  techGrowth: {
    opportunity: string; // e.g., "AI Hardware Rebound"
    recommendedSectors: string[];
    logic: string;
  };
  strategy: 'SWITCH_TO_MAIN' | 'SWITCH_TO_TECH' | 'BALANCE' | 'DEFENSIVE';
  summary: string; // Actionable advice like "Shift 30% position to Banks"
  suggestedAllocation?: AllocationBucket[];
}

export interface AnalysisResult {
  isBatch?: boolean;
  batchData?: BatchItem[];
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

export interface PortfolioItem {
  code: string;
  market: Market;
  addedAt: number;
  name?: string;
  quantity?: number;
  avgCost?: number;
}
