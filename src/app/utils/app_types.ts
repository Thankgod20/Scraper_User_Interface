import  { ReactNode } from 'react';
export type DerivativePoint = {
    time: string;
    roc: number | null;
    acceleration: number | null;
  };
  export type SellOffRisk = {
    time: string;
    entropy: number;
    plateauRatio: number;
    liquidityRisk: number;
    srs: number;
  };
  export interface EnhancedSellOffRiskK {
    time: string;
    concentrationRisk: number;
    whaleRisk: number;
    liquidityRisk: number;
    priceImpact: number;
    sellPressure: number;
    combinedScore: number;
  }
  export interface BuyActivity {
    time: string;
    uniqueBuyers: number;
    netGrowth: number;
    diversityScore: number;
    buyScore: number;
    retailChurnRatio: number;
    whaleChurnRatio: number;
  }
  export type SellOffRiskK = {
    time: string;
    entropy: number;
    plateauRatio: number;
    liquidityRisk: number;
    whaleSellPressure: number;
    liquidityTrend: number;
    volumeSoldRatio: number;
    srs: number;
  };
  export interface StochRSIOptions {
    rsiPeriod?: number;      // look-back for base RSI (default 14)
    stochPeriod?: number;    // look-back for stochastic window (default 14)
    smoothK?: number;        // smoothing for %K (default 3)
    smoothD?: number;        // smoothing for %D (default 3), if undefined no %D
  }
  
  export type HolderDerivatives = {
    address: string;
    series: DerivativePoint[];
  };

  export interface OrderData {
    amount: number;
    time: string;
    price: number;
  }
  
export interface Impression {
  name:  string;
  value: number;
}
export type HistoryEntry = { 
  amount: number;
  time: string;
};
 export type PlotDataByAddress = {
  address: string;
  data: { time: string; amount: number }[];
};



export interface TimeSeriesOutput {
  time: string;
  holders: number;
  growthRate?: number;
  firstDifference?: number;
  rollingMean?: number;
  rollingStdDev?: number;
}
export interface HolderDataPoint {
  holders: number;
  time: string;
}
export interface AnalysisResult {
  summary: {
    mean: number;
    median: number;
    stdDev: number;
    skewness: number;
    kurtosis: number;
  };
  timeSeries: TimeSeriesOutput[];
}
export type Holder = {
  address: string;
  amount: number[];
  time: string[];
};

export type TimeSeries = Record<string, number>;

export interface CategoryHoldings {
  whales: TimeSeries;
  retail: TimeSeries;
  lps: TimeSeries;
}

export interface ChartData {
  timestamps: string[];
  prices: {
    timestamps: string[]; // OHLCV-native timestamps
    values: number[];
  };
  inflow: Record<string, number[]>;
  outflow: Record<string, number[]>;
  netflow: Record<string, number[]>;
  activeHolders: Record<string, number[]>;
}
export interface CompImpression {
  name: string;
  value: number;
  preval: number;
}
export interface TimeSeriess {
  time: string;
  aggregatedSentiment: number;
}
export interface Engagement {
  timestamp: string;
  impressions: number;
  likes: number;
  retweets: number;
  comments: number;
  followers: number;
  count: number;
}
export interface EngagementImpression {
  name: string;
  impression: number;
  views: number;
  volume: number;
  
}

export interface MetricsBin {
  time: string;   // ISO timestamp of the bin, e.g. "2025-05-01T10:00:00.000Z"
  sei: number;    // Social Engagement Index at this bin
  res: number;    // Relative Engagement Spike at this bin
  views: number;  // Total views in this bin
}

// ----------------- New Helper Functions -----------------
export interface MACDPoint {
  name: string;       // timestamp label, e.g. "10:00"
  macd: number;       // MACD line value
  signal: number;     // Signal line value
  histogram: number;  // Histogram bar value
}

export interface InfoBoxProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
}
export interface RSIPoint  { name: string; rsi: number; }
export type SmoothingMethod = 'wilder' | 'ema' | 'sma';