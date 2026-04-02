// Core types for the Fractional Working Index application

export interface FWIData {
  asOf: string;
  weights: { demand: number; supply: number; culture: number };
  monthly: MonthlyData;
  today: TodayData;
  movers: Mover[];
}

export interface MonthlyData {
  months: string[];
  overall: number[];
  demand: number[];
  supply: number[];
  culture: number[];
}

export interface TodayData {
  overall: number;
  delta30d: number;
  demand: { score: number; delta30d: number };
  supply: { score: number; delta30d: number };
  culture: { score: number; delta30d: number };
}

export interface Mover {
  skill: string;
  type: 'demand' | 'supply' | 'culture';
  change_pct: number;
  note: string;
}

export interface AIInsight {
  id: string;
  type: 'summary' | 'prediction' | 'alert' | 'opportunity';
  title: string;
  body: string;
  confidence: number;
  generatedAt: string;
  relatedSignals: string[];
}

export interface DataSourceStatus {
  name: string;
  lastFetched: string | null;
  coverage: number;
  status: 'active' | 'stale' | 'error';
}

export interface AlertItem {
  label: string;
  score: number;
  delta: number;
  direction: 'up' | 'down';
}

// Composite calculator
export function calcComposite(
  data: TodayData, 
  weights: { demand: number; supply: number; culture: number }
): number {
  return Math.round(
    ((data.demand.score * weights.demand) + 
     (data.supply.score * weights.supply) + 
     (data.culture.score * weights.culture)) * 10
  ) / 10;
}
