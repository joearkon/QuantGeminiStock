
export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
  WAIT = 'WAIT'
}

export type Language = 'en' | 'zh';

export type Market = 'A_SHARE' | 'US_STOCK' | 'HK_STOCK';

export type AnalysisMode = 'LIVE' | 'SNAPSHOT';

export type TimeHorizon = 'SHORT' | 'MEDIUM' | 'LONG';

export interface StructuredAnalysisData {
  signal: string;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
}

export interface TradeSetup {
  horizon: TimeHorizon;
  recommendation: 'BUY' | 'SELL' | 'WAIT';
  entryZone: string; // e.g. "20.50 - 20.80"
  invalidLevel: string; // Stop loss context
  targetLevel: string; // Take profit context
  technicalRationale: string; // e.g. "Rebound off 20-day MA"
  updatedData: StructuredAnalysisData; // For updating the calculator
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
  timestamp: string; // New: Explicit data time (e.g. "14:30" or "12-02 Close")
}

export interface MarketOverview {
  sentimentScore: number; // 0-100
  sentimentText: string;
  indices: MarketIndex[]; // List of 3 major indices
  hotSectors: string[];
  rotationAnalysis: {
      inflow: string; 
      outflow: string; 
      logic: string; 
  }; 
  monthlyStrategy: string;
  keyRisk: string;
}

export interface AllocationBucket {
  category: string; 
  percentage: number; 
  rationale: string;
  examples: string[];
}

export interface PortfolioProfile {
  description: string; 
  allocations: AllocationBucket[];
}

export interface DeepMacroAnalysis {
  mainBoard: {
    opportunity: string; 
    recommendedSectors: string[];
    logic: string;
  };
  techGrowth: {
    opportunity: string; 
    recommendedSectors: string[];
    logic: string;
  };
  strategy: 'SWITCH_TO_MAIN' | 'SWITCH_TO_TECH' | 'BALANCE' | 'DEFENSIVE';
  summary: string; 
  profiles: {
      aggressive: PortfolioProfile;
      balanced: PortfolioProfile;
  };
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
