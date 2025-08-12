import { SmoothingMethod,StochRSIOptions,HolderDataPoint,AnalysisResult,PlotDataByAddress,SellOffRisk,TimeSeriesOutput,HolderDerivatives,DerivativePoint,Holder,CategoryHoldings,Impression ,MACDPoint,Engagement,MetricsBin,EngagementImpression,TieredAccountCount,TimeSeriess,CompImpression,BuyActivity,TieredImpression,DetailedVImpression,FomoParams,TieredInfluence,TierMetrics} from "./app_types";
import vader from 'vader-sentiment';

/**
 * Processes holder data and categorizes them into whales, retail, and LPs.
 * @param holders List of holder objects
 * @param lpAddresses Optional set of LP addresses
 * @returns Categorized aggregated holdings by timestamp
 */
import { parseISO, formatISO, startOfMinute } from 'date-fns';
interface TweetEntry {
  tweet: string;
  params: {
    time: number[];
    views: string[];
    likes: string[];
    comment: string[];
    retweet: string[];
    plot_time: number[];
  };
  post_time: string;
  status: string;
  profile_image?: string;
  followers: number;
}
export function processHoldings(
  holders: Holder[],
  lpAddresses: Set<string> = new Set(),
  intervalMinutes: number = 5
): CategoryHoldings {
  const raw: Record<string, Record<string, number>> = {}; // roundedTime -> address -> amount

  // Normalize timestamp to nearest interval
  function roundTimeToInterval(isoTime: string): string {
    const date = parseISO(isoTime);
    const mins = date.getMinutes();
    const roundedMins = Math.floor(mins / intervalMinutes) * intervalMinutes;
    const roundedDate = startOfMinute(date);
    roundedDate.setMinutes(roundedMins);
    return formatISO(roundedDate);
  }

  // Build raw time series
  for (const holder of holders) {
    for (let i = 0; i < holder.time.length; i++) {
      const t = roundTimeToInterval(holder.time[i]);
      const amt = holder.amount[i];
      if (!raw[t]) raw[t] = {};
      raw[t][holder.address] = amt;
    }
  }

  const allTimestamps = Object.keys(raw).sort();
  const categoryHoldings: CategoryHoldings = {
    whales: {},
    retail: {},
    lps: {}
  };

  const addressMax: Record<string, number> = {};

  // Compute max balances per address to classify
  for (const t of allTimestamps) {
    for (const [addr, amt] of Object.entries(raw[t])) {
      addressMax[addr] = Math.max(addressMax[addr] ?? 0, amt);
    }
  }

  const whales = new Set(
    Object.entries(addressMax)
      .filter(([addr, maxAmt]) => maxAmt >= 10_000_000 && !lpAddresses.has(addr))
      .map(([addr]) => addr)
  );

  const retail = new Set(
    Object.entries(addressMax)
      .filter(([addr, maxAmt]) => maxAmt < 10_000_000 && !lpAddresses.has(addr))
      .map(([addr]) => addr)
  );

  const lps = new Set(
    [...lpAddresses].filter((addr) => addr in addressMax)
  );

  // Aggregate by category
  for (const t of allTimestamps) {
    const snap = raw[t];
    categoryHoldings.whales[t] = 0;
    categoryHoldings.retail[t] = 0;
    categoryHoldings.lps[t] = 0;

    for (const [addr, amt] of Object.entries(snap)) {
      if (whales.has(addr)) categoryHoldings.whales[t] += amt;
      else if (retail.has(addr)) categoryHoldings.retail[t] += amt;
      else if (lps.has(addr)) categoryHoldings.lps[t] += amt;
    }
  }

  return categoryHoldings;
}

export function processHolderCounts(
  holders: Holder[],
  lpAddresses: Set<string> = new Set(),
  intervalMinutes: number = 5
): CategoryHoldings {
  const raw: Record<string, Set<string>> = {}; // roundedTime -> Set of addresses seen at that time
  const addressTimeMap: Record<string, Record<string, number>> = {}; // address -> roundedTime -> amount

  // Normalize timestamp to nearest interval
  function roundTimeToInterval(isoTime: string): string {
    const date = parseISO(isoTime);
    const mins = date.getMinutes();
    const roundedMins = Math.floor(mins / intervalMinutes) * intervalMinutes;
    const roundedDate = startOfMinute(date);
    roundedDate.setMinutes(roundedMins);
    return formatISO(roundedDate);
  }

  // Build raw holder data grouped by rounded time
  for (const holder of holders) {
    addressTimeMap[holder.address] = {};
    for (let i = 0; i < holder.time.length; i++) {
      const t = roundTimeToInterval(holder.time[i]);
      const amt = holder.amount[i];

      if (!raw[t]) raw[t] = new Set();
      raw[t].add(holder.address);
      addressTimeMap[holder.address][t] = amt;
    }
  }

  const allTimestamps = Object.keys(raw).sort();

  const addressMax: Record<string, number> = {};

  // Compute max balances per address to classify
  for (const addr of Object.keys(addressTimeMap)) {
    const allAmts = Object.values(addressTimeMap[addr]);
    addressMax[addr] = Math.max(...allAmts);
  }

  const whales = new Set(
    Object.entries(addressMax)
      .filter(([addr, maxAmt]) => maxAmt >= 10_000_000 && !lpAddresses.has(addr))
      .map(([addr]) => addr)
  );

  const retail = new Set(
    Object.entries(addressMax)
      .filter(([addr, maxAmt]) => maxAmt < 10_000_000 && !lpAddresses.has(addr))
      .map(([addr]) => addr)
  );

  const lps = new Set(
    [...lpAddresses].filter((addr) => addr in addressMax)
  );

  const categoryHoldings: CategoryHoldings = {
    whales: {},
    retail: {},
    lps: {}
  };

  // Count active holders by category at each timestamp
  for (const t of allTimestamps) {
    const activeAddrs = raw[t];

    categoryHoldings.whales[t] = 0;
    categoryHoldings.retail[t] = 0;
    categoryHoldings.lps[t] = 0;

    for (const addr of activeAddrs) {
      if (whales.has(addr)) categoryHoldings.whales[t]++;
      else if (retail.has(addr)) categoryHoldings.retail[t]++;
      else if (lps.has(addr)) categoryHoldings.lps[t]++;
    }
  }

  return categoryHoldings;
}

  export function computeRSI(
    data: Impression[],
    period = 14,
    method: SmoothingMethod = 'ema'
  ): Impression[] {
    const rsiPoints: Impression[] = [];
    if (data.length < period + 1) return rsiPoints;
  
    // 1. compute raw gains/losses
    const gains: number[] = [0], losses: number[] = [0];
    for (let i = 1; i < data.length; i++) {
      const change = data[i].value - data[i - 1].value;
      gains[i]  = Math.max(change, 0);
      losses[i] = Math.max(-change, 0);
    }
  
    // 2. initial averages (SMA)
    let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  
    // 3. helper EMA α
    const alpha = method === 'ema' ? 2 / (period + 1) : 1 / period;
  
    // 4. first RSI value
    let rs   = avgGain / avgLoss;
    rsiPoints.push({
      name: data[period].name,
      value: 100 - (100 / (1 + rs)),
    });
  
    // 5. subsequent values with chosen smoothing
    for (let i = period + 1; i < data.length; i++) {
      if (method === 'wilder') {
        // Wilder smoothing: α = 1/period
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      } else if (method === 'ema') {
        // Standard EMA smoothing: α = 2/(period+1)
        avgGain = alpha * gains[i] + (1 - alpha) * avgGain;
        avgLoss = alpha * losses[i] + (1 - alpha) * avgLoss;
      } else { // 'sma'
        // Rolling SMA: drop old, include new
        avgGain = (avgGain * period - gains[i - period] + gains[i]) / period;
        avgLoss = (avgLoss * period - losses[i - period] + losses[i]) / period;
      }
  
      rs = avgGain / avgLoss;
      rsiPoints.push({
        name: data[i].name,
        value: 100 - (100 / (1 + rs)),
      });
    }
  
    return rsiPoints;
  }
  
    
    
   
    /**
     * Compute Wilder-smoothed RSI
     */
    export function computeRSIS(
      data: Impression[],
      period = 14
    ): number[] {
      const rsi: number[] = [];
      if (data.length < period + 1) return rsi;
    
      const gains: number[] = [0];
      const losses: number[] = [0];
      for (let i = 1; i < data.length; i++) {
        const change = data[i].value - data[i - 1].value;
        gains.push(Math.max(change, 0));
        losses.push(Math.max(-change, 0));
      }
    
      let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
      let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    
      // first RSI value at index = period
      rsi[period] = avgLoss === 0 
        ? 100 
        : avgGain === 0 
        ? 0 
        : 100 - 100 / (1 + avgGain / avgLoss);
    
      for (let i = period + 1; i < data.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        rsi[i] = avgLoss === 0 
          ? 100 
          : avgGain === 0 
          ? 0 
          : 100 - 100 / (1 + avgGain / avgLoss);
      }
    
      return rsi;
    }
    
    /**
     * Compute Stochastic RSI (%K and optional %D)
     */
    export function computeStochRSI(
      data: Impression[],
      {
        rsiPeriod   = 14,
        stochPeriod = 14,
        smoothK     = 3,
        smoothD = 4,
      }: StochRSIOptions = {}
    ): Array<{ name: string; k: number; d?: number }> {
      // 1. get base RSI series
      const rsi = computeRSIS(data, rsiPeriod);
      const result: Array<{ name: string; k: number; d?: number }> = [];
    
      if (rsi.length === 0) return result;
    
      // helper to SMA-smooth an array
      const smooth = (arr: number[], period: number): number[] => {
        const out: number[] = [];
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          sum += arr[i];
          if (i >= period) {
            sum -= arr[i - period];
          }
          if (i >= period - 1) {
            out[i] = sum / period;
          }
        }
        return out;
      };
    
      // 2. compute raw %K
      const rawK: number[] = [];
      for (let i = 0; i < rsi.length; i++) {
        if (i < stochPeriod - 1) {
          rawK[i] = NaN;
        } else {
          const window = rsi.slice(i - (stochPeriod - 1), i + 1);
          const minR = Math.min(...window);
          const maxR = Math.max(...window);
          rawK[i] = maxR === minR
            ? 50
            : ((rsi[i] - minR) / (maxR - minR)) * 100;
        }
      }
    
      // 3. smooth %K if requested
      const smoothedK = smoothK > 1 ? smooth(rawK.filter(v => !isNaN(v)), smoothK) : rawK;
    
      // 4. smooth %D if requested
      let smoothedD: number[] | undefined;
      if (typeof smoothD === 'number' && smoothD > 1) {
        smoothedD = smooth(smoothedK.slice(stochPeriod - 1), smoothD);
      }
    
      // 5. assemble output aligning with original data
      for (let i = 0; i < data.length; i++) {
        const kVal = smoothedK[i - (stochPeriod - 1)] ?? rawK[i];
        const dVal = smoothedD ? smoothedD[i - (stochPeriod - 1) - (smoothD - 1)] : undefined;
        if (!isNaN(kVal) && kVal !== undefined) {
          result.push({
            name: data[i].name,
            k: Math.min(100, Math.max(0, kVal)),
            d: dVal !== undefined ? Math.min(100, Math.max(0, dVal)) : undefined,
          });
        }
      }
    
      return result;
    }
    export function computeEMA(values: number[], period: number): number[] {
      const alpha = 2 / (period + 1);
      const out: number[] = [];
      values.forEach((v, i) => {
        if (i === 0) out[i] = v;
        else out[i] = alpha * v + (1 - alpha) * out[i - 1];
      });
      return out;
    }
    
    export function computeHolderMACD(
      data: HolderDataPoint[],
      shortP: number = 5,
      longP: number = 13,
      signalP: number = 5
    ): Array<{ name: string; macd: number; signal: number;histogram: number }> {
      const vals = data.map(pt => pt.holders);
      const emaShort = computeEMA(vals, shortP);
      const emaLong = computeEMA(vals, longP);
      const macdLine = emaShort.map((v, i) => v - emaLong[i]);
      const signal = computeEMA(macdLine, signalP);
      return data.map((pt, i) => ({
        name: pt.time,
        macd: macdLine[i],
        signal: signal[i],
        histogram: macdLine[i] - signal[i],
      }));
    }

    export function descriptiveAndTrendAnalysis(
      holderHistory: HolderDataPoint[],
      windowSize: number = 5 // Default rolling window size
    ): AnalysisResult {
      const n = holderHistory.length;
      if (n === 0) {
        return {
          summary: {
            mean: 0,
            median: 0,
            stdDev: 0,
            skewness: 0,
            kurtosis: 0
          },
          timeSeries: []
        };
      }
    
      const holders = holderHistory.map((d) => d.holders);
      const mean =
        holders.reduce((acc, val) => acc + val, 0) / holders.length;
    
      const sorted = [...holders].sort((a, b) => a - b);
      const median =
        n % 2 === 0
          ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
          : sorted[Math.floor(n / 2)];
    
      const stdDev = Math.sqrt(
        holders.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n
      );
    
      const skewness =
        (n *
          holders.reduce((acc, val) => acc + Math.pow(val - mean, 3), 0)) /
        ((n - 1) * (n - 2) * Math.pow(stdDev, 3));
    
      const kurtosis =
        (n *
          (n + 1) *
          holders.reduce((acc, val) => acc + Math.pow(val - mean, 4), 0)) /
          ((n - 1) * (n - 2) * (n - 3) * Math.pow(stdDev, 4)) -
        (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    
      const timeSeries: TimeSeriesOutput[] = holderHistory.map((point, i) => {
        const prev = holderHistory[i - 1]?.holders;
        const growthRate =
          i > 0 && prev !== 0 ? (point.holders - prev) / prev : undefined;
        const firstDifference = i > 0 ? point.holders - prev : undefined;
    
        const rollingSlice = holderHistory.slice(
          Math.max(0, i - windowSize + 1),
          i + 1
        );
        const rollingMean =
          rollingSlice.reduce((acc, val) => acc + val.holders, 0) /
          rollingSlice.length;
        const rollingStdDev = Math.sqrt(
          rollingSlice.reduce(
            (acc, val) => acc + Math.pow(val.holders - rollingMean, 2),
            0
          ) / rollingSlice.length
        );
    
        return {
          time: point.time,
          holders: point.holders,
          growthRate,
          firstDifference,
          rollingMean,
          rollingStdDev,
        };
      });
    
      return {
        summary: {
          mean,
          median,
          stdDev,
          skewness,
          kurtosis,
        },
        timeSeries,
      };
    }
    




export function computeBuyActivityScore(
  holders_: PlotDataByAddress[],
  timeWindow: number = 1,
  lpAddresses: Set<string> = new Set(),
  smallWalletThreshold: number = 9_000_000,
  whaleThreshold: number = 10_000_000,
  weights: { w1: number; w2: number; w3: number } = { w1: 0.4, w2: 0.3, w3: 0.3 }
): BuyActivity[] {
  const holders = holders_.filter(h => !lpAddresses.has(h.address));
  if (holders.length === 0) return [];

  const { w1, w2, w3 } = weights;
  const addressSet = new Set(holders.map(h => h.address));

  // Collect all timestamps
  const timestampSet = new Set<string>();
  for (const h of holders) {
    for (const d of h.data) {
      if (d?.time) timestampSet.add(d.time);
    }
  }
  const allTimestamps = Array.from(timestampSet).sort();

  // Index holder data
  const holderTimeMap: Record<string, Record<string, number>> = {};
  for (const h of holders) {
    holderTimeMap[h.address] = {};
    for (const d of h.data) {
      holderTimeMap[h.address][d.time] = d.amount;
    }
  }

  const results: BuyActivity[] = [];

  for (let t = 0; t < allTimestamps.length; t++) {
    const time = allTimestamps[t];
    const prevTime = t >= timeWindow ? allTimestamps[t - timeWindow] : null;

    let uniqueBuyers = 0;
    let netGrowth = 0;
    let smallWalletGrowth = 0;

    let retailEntrants = 0;
    let retailExits = 0;
    let whaleEntrants = 0;
    let whaleExits = 0;

    for (const address of addressSet) {
      const prevAmt = prevTime ? holderTimeMap[address][prevTime] ?? 0 : 0;
      const currAmt = holderTimeMap[address][time] ?? 0;
      const delta = currAmt - prevAmt;

      if (delta > 10000) {
        uniqueBuyers++;
        netGrowth += delta;

        if (currAmt <= smallWalletThreshold) {
          smallWalletGrowth += delta;
          retailEntrants++;
        } else if (currAmt >= whaleThreshold) {
          whaleEntrants++;
        }
      } else if (delta < 0) {
        if (prevAmt <= smallWalletThreshold) {
          retailExits++;
        } else if (prevAmt >= whaleThreshold) {
          whaleExits++;
        }
      }
    }

    const diversityScore = netGrowth > 0 ? smallWalletGrowth / netGrowth : 0.0;

    const retailChurnRatio =
      retailEntrants > 0 ? parseFloat((retailExits / retailEntrants).toFixed(2)) : 0;
    const whaleChurnRatio =
      whaleEntrants > 0 ? parseFloat((whaleExits / whaleEntrants).toFixed(2)) : 0;

    const buyScore = parseFloat(
      (w1 * uniqueBuyers + w2 * netGrowth + w3 * diversityScore).toFixed(4)
    );

    results.push({
      time,
      uniqueBuyers,
      netGrowth: parseFloat(netGrowth.toFixed(2)),
      diversityScore: parseFloat(diversityScore.toFixed(4)),
      buyScore,
      retailChurnRatio,
      whaleChurnRatio
    });
  }

  return results;
}
export interface EnhancedSellOffRisk extends SellOffRisk {
  whaleRetailRatio: number;
  sustainabilityScore: number;
}

export function computeWhaleExitRiskScore(
  holders_: PlotDataByAddress[],
  getLiquidity: (time: string) => number,
  sellWindow: number = 1,
  lpAddresses: Set<string> = new Set(),
  weights: { w1: number; w2: number; w3: number; w4: number } = { w1: 0.2, w2: 0.3, w3: 0.3, w4: 0.2 },
  whaleThreshold: number = 10_000_000,
  retailThreshold: number = 1000,
  sustainabilityThreshold: number = 1.2
): EnhancedSellOffRisk[] {
  const holders = holders_.filter(h => !lpAddresses.has(h.address));
  if (holders.length === 0) return [];

  const numHolders = holders.length;
  const lnN = Math.log(numHolders);
  const { w1, w2, w3, w4 } = weights;
  const results: EnhancedSellOffRisk[] = [];

  // Collect timestamps
  const timestampSet = new Set<string>();
  for (const h of holders) {
    for (const d of h.data) {
      if (d?.time) timestampSet.add(d.time);
    }
  }
  const allTimestamps = Array.from(timestampSet).sort();

  // Index by address/time
  const holderTimeMap: Record<string, Record<string, number>> = {};
  for (const h of holders) {
    holderTimeMap[h.address] = {};
    for (const d of h.data) {
      holderTimeMap[h.address][d.time] = d.amount;
    }
  }

  for (let t = 0; t < allTimestamps.length; t++) {
    const time = allTimestamps[t];

    // --- 1. Entropy Calculation ---
    const totalAmount = holders.reduce((sum, h) => {
      const amt = holderTimeMap[h.address][time] ?? 0;
      return sum + amt;
    }, 0);

    const pList = holders.map(h => {
      const amt = holderTimeMap[h.address][time] ?? 0;
      return totalAmount > 0 ? amt / totalAmount : 0;
    });

    const entropy = -pList.reduce((sum, p) => (p > 0 ? sum + p * Math.log(p) : sum), 0);
    const concentrationRisk = lnN > 0 ? 1 - entropy / lnN : 0;

    // --- 2. Coordinated Sell Detection ---
    let sellers = 0;
    if (t >= sellWindow) {
      const prevTime = allTimestamps[t - sellWindow];
      for (const h of holders) {
        const prevAmt = holderTimeMap[h.address][prevTime] ?? 0;
        const currAmt = holderTimeMap[h.address][time] ?? 0;
        const dropRatio = prevAmt > 0 ? (prevAmt - currAmt) / prevAmt : 0;
        if (dropRatio >= 0.05) sellers++;
      }
    }
    const sellOffRatio = numHolders > 0 ? sellers / numHolders : 0;
    const coordinatedSellFlag = sellOffRatio >= 0.3 ? 1 : 0;

    // --- 3. Whale Liquidity Risk ---
    const liq = getLiquidity(time);
    const whaleHoldings = holders.reduce((sum, h) => {
      const amt = holderTimeMap[h.address][time] ?? 0;
      return amt > whaleThreshold ? sum + amt : sum;
    }, 0);
    const liquidityRisk = liq > 0 ? Math.min(whaleHoldings / liq, 1) : 0;

    // --- 4. Whale vs Retail Flow ---
    let retailFlow = 0;
    let whaleFlow = 0;

    if (t >= sellWindow) {
      const prevTime = allTimestamps[t - sellWindow];
      for (const h of holders) {
        const prevAmt = holderTimeMap[h.address][prevTime] ?? 0;
        const currAmt = holderTimeMap[h.address][time] ?? 0;
        const delta = currAmt - prevAmt;

        if (currAmt > whaleThreshold) {
          whaleFlow += delta;
        } else if (currAmt <= retailThreshold) {
          retailFlow += delta;
        }
      }
    }

    const rawSustainability = retailFlow > 0
      ? (retailFlow - Math.abs(whaleFlow)) / retailFlow
      : 0;

    const sustainabilityScore = Math.min(Math.max(rawSustainability, 0), 1);

    const whaleRetailRatio = retailFlow !== 0
      ? Math.abs(whaleFlow) / retailFlow
      : Infinity;

    const sustainabilityFlag = whaleRetailRatio > sustainabilityThreshold ? 1 : 0;

    // --- Final Risk Score ---
    const srs = w1 * (1 / Math.max(concentrationRisk, 0.001)) +
                w2 * coordinatedSellFlag +
                w3 * liquidityRisk +
                w4 * sustainabilityFlag;

    results.push({
      time,
      entropy: parseFloat(concentrationRisk.toFixed(4)),
      plateauRatio: parseFloat(sellOffRatio.toFixed(4)),
      liquidityRisk: parseFloat(liquidityRisk.toFixed(4)),
      whaleRetailRatio: parseFloat(whaleRetailRatio.toFixed(2)),
      sustainabilityScore: parseFloat(sustainabilityScore.toFixed(2)),
      srs: parseFloat(srs.toFixed(4)),
    });
  }

  return results;
}

export function computeSellOffRiskScore(
  holders_: PlotDataByAddress[],
  getLiquidity: (time: string) => number,
  sellWindow: number = 1,
  lpAddresses: Set<string> = new Set(),
  weights: { w1: number; w2: number; w3: number } = { w1: 0.2, w2: 0.2, w3: 0.6 },
  whaleThreshold: number = 10_000_000,
  coordinatedSellThreshold: number = 0.3
): SellOffRisk[] {
  // Filter out LP addresses
  const holders = holders_.filter(h => !lpAddresses.has(h.address));
  if (holders.length === 0) return [];

  const numHolders = holders.length;
  const lnN = Math.log(numHolders);
  const { w1, w2, w3 } = weights;
  const results: SellOffRisk[] = [];

  // --- Step 1: Collect all unique timestamps
  const timestampSet = new Set<string>();
  for (const h of holders) {
    for (const d of h.data) {
      if (d?.time) timestampSet.add(d.time);
    }
  }

  const allTimestamps = Array.from(timestampSet).sort(); // ISO strings sort lexicographically

  // --- Step 2: Index holder data by time for fast lookup
  const holderTimeMap: Record<string, Record<string, number>> = {};
  for (const h of holders) {
    holderTimeMap[h.address] = {};
    for (const d of h.data) {
      holderTimeMap[h.address][d.time] = d.amount;
    }
  }

  for (let t = 0; t < allTimestamps.length; t++) {
    const time = allTimestamps[t];

    // --- Total token supply at this timestamp
    const totalAmount = holders.reduce((sum, h) => {
      const amt = holderTimeMap[h.address][time] ?? 0;
      return sum + amt;
    }, 0);

    // --- 1. Entropy-based concentration
    const pList = holders.map(h => {
      const amt = holderTimeMap[h.address][time] ?? 0;
      return totalAmount > 0 ? amt / totalAmount : 0;
    });

    const entropy = -pList.reduce((sum, p) => (p > 0 ? sum + p * Math.log(p) : sum), 0);
    const concentrationRisk = lnN > 0 ? 1 - entropy / lnN : 0;

    // --- 2. Coordinated Sell-Off Risk
    let sellers = 0;
    if (t >= sellWindow) {
      const prevTime = allTimestamps[t - sellWindow];
      for (const h of holders) {
        const prevAmt = holderTimeMap[h.address][prevTime] ?? 0;
        const currAmt = holderTimeMap[h.address][time] ?? 0;
        const dropRatio = prevAmt > 0 ? (prevAmt - currAmt) / prevAmt : 0;
        if (dropRatio >= 0.05) sellers++;
      }
    }

    const sellOffRatio = numHolders > 0 ? sellers / numHolders : 0;
    const coordinatedSellFlag = sellOffRatio >= coordinatedSellThreshold ? 1 : 0;

    // --- 3. Whale Liquidity Risk
    const liq = getLiquidity(time);
    const whaleHoldings = holders.reduce((sum, h) => {
      const amt = holderTimeMap[h.address][time] ?? 0;
      return amt > whaleThreshold ? sum + amt : sum;
    }, 0);
    const liquidityRisk = liq > 0 ? Math.min(whaleHoldings / liq, 1) : 0;

    // --- Final Score
    const srs = w1 * (concentrationRisk) + w2 * coordinatedSellFlag + w3 * liquidityRisk;

    results.push({
      time,
      entropy: parseFloat(concentrationRisk.toFixed(4)),
      plateauRatio: parseFloat(sellOffRatio.toFixed(4)),
      liquidityRisk: parseFloat(liquidityRisk.toFixed(4)),
      srs: parseFloat(srs.toFixed(4)),
    });
  }

  return results;
}


export function computeEMASRS(data: SellOffRisk[], period: number): number[] {
    const ema: number[] = [];
    const k = 2 / (period + 1);
  
    let prevEma = data[0]?.srs ?? 0;
    ema.push(prevEma);
  
    for (let i = 1; i < data.length; i++) {
      const current = data[i].srs;
      const currentEma = current * k + prevEma * (1 - k);
      ema.push(currentEma);
      prevEma = currentEma;
    }
  
    return ema;
  }
  
export function aggregateSRSByFiveMinutes(srsScores: SellOffRisk[],zWindow: number = 5): SellOffRisk[] {
    const grouped: Record<string, SellOffRisk[]> = {};
  
    for (const srs of srsScores) {
      // Convert ISO time to a 5-minute bucket key (e.g., "2025-05-08T12:15:00Z")
      const date = new Date(srs.time);
      date.setUTCSeconds(0, 0);
      const minutes = date.getUTCMinutes();
      const bucketMinutes = Math.floor(minutes / zWindow) * zWindow;
      date.setUTCMinutes(bucketMinutes);
  
      const key = date.toISOString();
  
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(srs);
    }
  
    const result: SellOffRisk[] = [];
  
    for (const time in grouped) {
      const group = grouped[time];
      const avg = (key: keyof Omit<SellOffRisk, 'time'>) =>
        group.reduce((sum, x) => sum + (x[key] ?? 0), 0) / group.length;
  
      result.push({
        time,
        entropy: parseFloat(avg("entropy").toFixed(4)),
        liquidityRisk: parseFloat(avg("liquidityRisk").toFixed(4)),
        plateauRatio: parseFloat(avg("plateauRatio").toFixed(4)),
        srs: parseFloat(avg("srs").toFixed(4))//Math.round(avg("srs"))
      });
    }
  
    // Optional: sort by time
    return result.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }

  export function computeDerivatives(
    allData: PlotDataByAddress[]
  ): HolderDerivatives[] {
    return allData.map((holder) => {
      const series: DerivativePoint[] = [];
      if (holder.data.length<2) {
        return { address: holder.address, series };
      }
      for (let i = 0; i < holder.data.length; i++) {
        const current = holder.data[i];
        const prev = holder.data[i - 1];
        const prev2 = holder.data[i - 2];
  
        const roc =
          i >= 1 && prev.amount !== 0
            ? (current.amount - prev.amount) / prev.amount
            : -1;
  
        const acceleration =
          i >= 2 && prev && prev2 && prev2.amount !== 0
            ? roc !== -1 && series[i - 1].roc !== -1
              ? roc - series[i - 1].roc!
              : -1
            : -1;
  
        series.push({
          time: current.time,
          roc,
          acceleration
        });
      }
  
      return { address: holder.address, series };
    });
  }
  export function computeSynchronizedSellSignal(
    derivatives: HolderDerivatives[],
    threshold = 100_000 // whale threshold
  ): { time: string; count: number }[] {
    const timePoints = derivatives[0]?.series.map((point) => point.time) || [];
    const signals: { time: string; count: number }[] = [];
  
    for (let i = 0; i < timePoints.length; i++) {
      let count = 0;
  
      for (const holder of derivatives) {
        const current = holder.series[i];
        // Properly type and null-check the initialAmount
        const holderWithInitial = holder as Record<string, unknown>;
        const rawInitialAmount = holderWithInitial.initialAmount;
        const fallbackAmount = holder.series[0]?.roc;
        
        // Ensure we have a valid number for comparison
        const initialAmount = typeof rawInitialAmount === 'number' 
          ? rawInitialAmount 
          : (typeof fallbackAmount === 'number' ? fallbackAmount : 0);
        
        const isWhale = holder.series[i - 1]?.roc !== null && initialAmount > threshold;
  
        if (
          isWhale &&
          current.acceleration !== null &&
          current.acceleration < 0
        ) {
          count++;
        }
      }
  
      signals.push({ time: timePoints[i], count });
    }
  
    return signals;
  }
/**
 * Computes MACD, Signal, and Histogram for a FOMO time series.
 *
 * @param data   Array of FOMOPoint sorted by time ascending
 * @param spanFast   Fast EMA period (default 12)
 * @param spanSlow   Slow EMA period (default 26)
 * @param spanSignal Signal EMA period (default 9)
 */
export function computeMACD(
  data: Impression[],
  spanFast = 9,
  spanSlow = 14,
  spanSignal = 9
): MACDPoint[] {
  const α = (n: number) => 2 / (n + 1);

  const emaFast: number[] = [];
  const emaSlow: number[] = [];
  const macdLine: number[] = [];
  const signalLine: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const price = data[i].value;

    // Fast EMA
    if (i === 0) {
      emaFast[i] = price;
      emaSlow[i] = price;
    } else {
      emaFast[i] = α(spanFast) * price + (1 - α(spanFast)) * emaFast[i - 1];
      emaSlow[i] = α(spanSlow) * price + (1 - α(spanSlow)) * emaSlow[i - 1];
    }

    // MACD line
    macdLine[i] = emaFast[i] - emaSlow[i];

    // Signal line (on MACD)
    if (i === 0) {
      signalLine[i] = macdLine[i];
    } else {
      signalLine[i] =
        α(spanSignal) * macdLine[i] + (1 - α(spanSignal)) * signalLine[i - 1];
    }
  }

  // Build the output
  return data.map((pt, i) => ({
    name: pt.name,
    macd: macdLine[i],
    signal: signalLine[i],
    histogram: macdLine[i] - signalLine[i],
  }));
}

interface TweetEngagementData {
  totalTweet: number;
  usernames: {
    [username: string]: {
      count: number;
      impression: number;
      views: number;
      followers: number;
    };
  };
}
function convertToUTCFormat(dateStr: string): string {
  // Handle malformed ISO format: "2025-07-14T13:09.000+00:00" -> "2025-07-14T13:09:00.000+00:00"
  if (dateStr.includes('T') && dateStr.includes('.000') && !dateStr.includes(':00.000')) {
    // Pattern: YYYY-MM-DDTHH:MM.000 (missing seconds)
    dateStr = dateStr.replace(/T(\d{2}):(\d{2})\.000/, 'T$1:$2:00.000');
  }
  
  // If already has timezone info, return as is
  if (dateStr.includes('+') || dateStr.includes('Z')) {
    return dateStr;
  }
  
  let formatted = dateStr;
  
  // Handle fractional seconds (truncate to 3 digits or add .000)
  if (!formatted.includes('.')) {
    // Add seconds if missing: "2025-07-14T13:09" -> "2025-07-14T13:09:00"
    if (formatted.match(/T\d{2}:\d{2}$/)) {
      formatted += ':00';
    }
    formatted += '.000';
  } else {
    // Truncate fractional seconds to 3 digits
    formatted = formatted.replace(/(\.\d{3})\d*/, '$1');
  }
  
  // Add UTC timezone if not present
  if (!formatted.includes('+') && !formatted.includes('Z')) {
    formatted += '+00:00';
  }
  
  return formatted;
}
export function computeAccountCountsFromTweetEngagementData(
  tweetEngagementCounts: { [timestamp: string]: TweetEngagementData }
): TieredAccountCount[] {
  const result: TieredAccountCount[] = [];

  const timestamps = Object.keys(tweetEngagementCounts).sort(); // Sort by time
  //console.log("Timestamps:", timestamps);
  for (const timestamp of timestamps) {
    //const timestamp = convertToUTCFormat(timestamp_);
    const data = tweetEngagementCounts[timestamp];
    const { usernames } = data;

    let whale = 0;
    let shark = 0;
    let retail = 0;

    for (const username in usernames) {
      const { followers } = usernames[username];

      if (followers > 10000) {
        whale += 1;
      } else if (followers > 1000) {
        shark += 1;
      } else {
        retail += 1;
      }
    }
    const timestamp_ = convertToUTCFormat(timestamp);
    result.push({
      name: new Date(timestamp_).toISOString(), // Or use timestamp as-is
      whale,
      shark,
      retail,
    });
  }

  return result;
}
export function computeRawImpressionsByTierTimeSeries(
  tweets: Engagement[],
  intervalMinutes: number = 5,
  tierThresholds = { whale: 10000, shark: 1000 }
): TieredInfluence[] {
  if (tweets.length === 0) return [];

  const sortedTweets = [...tweets].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const intervalMs = intervalMinutes * 60 * 1000;
  const startTime = new Date(sortedTweets[0].timestamp).getTime();
  const endTime = new Date(sortedTweets[sortedTweets.length - 1].timestamp).getTime();

  const result: TieredInfluence[] = [];

  for (let t = startTime; t <= endTime; t += intervalMs) {
    const intervalStart = t;
    const intervalEnd = t + intervalMs;

    const bucketTweets = sortedTweets.filter((tweet) => {
      const tweetTime = new Date(tweet.timestamp).getTime();
      return tweetTime >= intervalStart && tweetTime < intervalEnd;
    });

    // Skip intervals with no activity for a cleaner output
    if (bucketTweets.length === 0) continue;

    // Initialize a structured object to hold the metrics for this interval.
    const intervalMetrics: Record<"whale" | "shark" | "retail", TierMetrics> = {
      whale: { impressions: 0, engagement: 0, volume: 0 },
      shark: { impressions: 0, engagement: 0, volume: 0 },
      retail: { impressions: 0, engagement: 0, volume: 0 },
    };

    for (const tweet of bucketTweets) {
      const { likes, comments, retweets, impressions, followers } = tweet;

      // This is a pure engagement score. Retweets are weighted higher because they actively spread the message.
      const engagementScore = likes + 3*comments + 2 * retweets;
      
      let tier: keyof typeof intervalMetrics;

      // Classify the tweet's author into a tier based on follower count.
      if (followers > tierThresholds.whale) {
        tier = 'whale';
      } else if (followers > tierThresholds.shark) {
        tier = 'shark';
      } else {
        tier = 'retail';
      }

      // Add the tweet's metrics to the corresponding tier for this interval.
      intervalMetrics[tier].impressions += impressions;
      intervalMetrics[tier].engagement += engagementScore;
      intervalMetrics[tier].volume += 1;
    }

    result.push({
      name: new Date(intervalStart).toISOString(), // Use ISO string for consistency
      whale: intervalMetrics.whale,
      shark: intervalMetrics.shark,
      retail: intervalMetrics.retail,
    });
  }

  return result;
}
/*
export function computeRawImpressionsByTierTimeSeries(
  tweets: Engagement[],
  intervalMinutes: number = 5
): TieredImpression[] {
  if (tweets.length === 0) return [];

  const sortedTweets = [...tweets].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const intervalMs = intervalMinutes * 60 * 1000;
  const startTime = new Date(sortedTweets[0].timestamp).getTime();
  const endTime = new Date(sortedTweets[sortedTweets.length - 1].timestamp).getTime();

  const result: TieredImpression[] = [];

  for (let t = startTime; t <= endTime; t += intervalMs) {
    const intervalStart = t;
    const intervalEnd = t + intervalMs;

    const bucketTweets = sortedTweets.filter((tweet) => {
      const tweetTime = new Date(tweet.timestamp).getTime();
      return tweetTime >= intervalStart && tweetTime < intervalEnd;
    });

    let whale = 0;
    let shark = 0;
    let retail = 0;

    for (const tweet of bucketTweets) {
      const { likes, comments, retweets, impressions, followers } = tweet;
      const rawImpression = likes + comments + 2 * retweets + 0.5 * impressions;

      if (followers > 10000) {
        whale += rawImpression;
      } else if (followers > 1000) {
        shark += rawImpression;
      } else {
        retail += rawImpression;
      }
    }

    result.push({
      name: new Date(intervalStart).toLocaleString(),
      whale,
      shark,
      retail,
    });
  }

  return result;
}*/
/*
export function computeImpressionsTimeSeries(
  tweets: Engagement[],
  intervalMinutes: number = 5,
  K: number = 5000,
  N_baseline: number = 500
): Impression[] {
  if (tweets.length === 0) return [];
  //const totalvolume = tweets.length;  
  // Sort tweets by timestamp
  const sortedTweets = [...tweets].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const intervalMs = intervalMinutes * 60 * 1000;
  const startTime = new Date(sortedTweets[0].timestamp).getTime();
  const endTime = new Date(sortedTweets[sortedTweets.length - 1].timestamp).getTime();
  const intervals: Impression[] = [];

  for (let t = startTime; t <= endTime; t += intervalMs) {
    const intervalStart = t;
    const intervalEnd = t + intervalMs;

    const bucketTweets = sortedTweets.filter((tweet) => {
      const tweetTime = new Date(tweet.timestamp).getTime();
      return tweetTime >= intervalStart && tweetTime < intervalEnd;
    });

    const N = bucketTweets.length;
    if (N === 0) continue;

    let totalQAI = 0;
    for (const tweet of bucketTweets) {
      //console.log("tweet",tweet)
      const { likes, comments, retweets, impressions, followers } = tweet;

      const rawEngagement = likes + comments + 2*retweets + 0.5 * impressions;
      const engagementRatio = (likes + comments + 2*retweets+0.5 * impressions) / (followers + 1);
      const spamPenalty = Math.tanh(engagementRatio * 5)
      const influenceCap = Math.tanh(followers / K);

      const qai = rawEngagement * spamPenalty * influenceCap;
      totalQAI += qai;
    }

    const volumeScaling = Math.log(1 + (N / N_baseline));
    const adjustedQAI = totalQAI * volumeScaling; // Math.tanh(0.3*totalQAI)*(volumeScaling*Math.sqrt(totalvolume));
    //console.log("adjustedQAI",adjustedQAI)
    intervals.push({
      name: new Date(intervalStart).toLocaleString(),
      value: isNaN(adjustedQAI) ? 0 : adjustedQAI,
    });
  }

  return intervals;
}
*/


export interface DetailedImpression {
  name: string;
  value: number;
  posImpressions: number;
  negImpressions: number;
  engagementRate: number;

}
/*
export function computeImpressionsTimeSeries(
  tweets: Engagement[],
  intervalMinutes: number = 5,
  K: number = 5000,
  N_baseline: number = 150,
  growthRate: number = 0.02,
  backtrackRatio: number = 0.05 // 15% of new viewers revisit old tweets
): DetailedImpression[] {
  if (tweets.length === 0) return [];

  const sortedTweets = [...tweets].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const intervalMs = intervalMinutes * 60 * 1000;
  const startTime = new Date(sortedTweets[0].timestamp).getTime();
  const endTime = new Date(sortedTweets[sortedTweets.length - 1].timestamp).getTime();

  const intervals: DetailedImpression[] = [];
  let cumulativeUniqueViewers = 0;

  const tweetAgeMap: { [tweetId: string]: number } = {};
  //let spamPenalty = 0
  let prevnewUniqueViewersPos = 0
  let prevnewUniqueViewersNeg =0
  let prevbucketTweets = 0
  let prevadjustedQAI = 100
  for (let t = startTime; t <= endTime; t += intervalMs) {
    const intervalStart = t;
    const intervalEnd = t + intervalMs;

    const bucketTweets = sortedTweets.filter((tweet) => {
      const tweetTime = new Date(tweet.timestamp).getTime();
      return tweetTime >= intervalStart && tweetTime < intervalEnd;
    });

    if (bucketTweets.length === 0) continue;

    let totalQAI = 0;
    let rawPos: number[] = [];
    let rawNeg: number[] = [];
    let totalaudience = 0
    //console.log(bucketTweets)
   // let prevrawEng = 0
    for (const tweet of bucketTweets) {
      const { likes, comments, retweets, impressions, followers } = tweet;
      const hasEngagement = (likes + comments + retweets) > 0;

      
      totalaudience+=followers
      const rawEngagement = likes + comments + 2 * retweets;
      const engagementRatio = rawEngagement / (followers + 1);

      if (hasEngagement) {
        //rawPos += impressions;
        rawPos.push(impressions);
      } else {
        //rawNeg += impressions;
        rawNeg.push(impressions);
      }
      //const qai = rawEngagement * spamPenalty * influenceCap;
      totalQAI += rawEngagement
      //console.log("totalQAI", totalQAI,"rawEngagement",rawEngagement,"prevrawEngagement",prevrawEng)
      //prevrawEng = rawEngagement
    }

    let  N = bucketTweets.length;
    //if (prevbucketTweets != 0)
    if (((N - prevbucketTweets)/N) > 20 && prevbucketTweets!=0) {
      let avegrae= ((N+ prevbucketTweets)/2)/100;
      N = prevbucketTweets-(N*avegrae)
    }
    //const volumeScaling = Math.log(1 + N / N_baseline);
    const adjustedQAI = (totalQAI) //*volumeScaling;

    //console.log("adjustedQAI",adjustedQAI)

    // (Not tracked per tweet here — could be implemented if you want to retroactively increase impressions on older tweets.)
    let rawPosM =  Math.max(0, ...rawPos);
    let rawNegM =  Math.max(0, ...rawNeg);
    const totalImpressions = rawPosM + rawNegM;
    const crossPollinationDelta = totalImpressions - rawPosM;
    const crossPollinationNegDelta = totalImpressions - rawNegM;

    const newUniqueViewersPos = rawPosM + (backtrackRatio * crossPollinationDelta);
    const newUniqueViewersNeg = rawNegM + (backtrackRatio * crossPollinationNegDelta);
    const engagementRate = totalImpressions > 0 ? newUniqueViewersPos / totalImpressions : 0;
    //const spamPenalty = Math.tanh(totalImpressions * 5);
    intervals.push({
      name: new Date(intervalStart).toLocaleString(),
      value: isNaN(adjustedQAI) ? 0 : (adjustedQAI/(totalaudience))*100,
      posImpressions:newUniqueViewersPos,
      negImpressions:newUniqueViewersNeg,
      engagementRate,
    });
    prevnewUniqueViewersPos = newUniqueViewersPos
    prevnewUniqueViewersNeg = newUniqueViewersNeg
    prevbucketTweets = N
    prevadjustedQAI = adjustedQAI
 
  }

  return intervals;
}
*/
export function computeImpressionsTimeSeries(
  tweets: Engagement[],
  intervalMinutes: number = 5
): DetailedImpression[] {
  if (tweets.length === 0) return [];

  // 1. INITIALIZATION: Sort tweets chronologically to process them in order.
  const sortedTweets = [...tweets].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const intervalMs = intervalMinutes * 60 * 1000;
  const startTime = new Date(sortedTweets[0].timestamp).getTime();
  const endTime = new Date(sortedTweets[sortedTweets.length - 1].timestamp).getTime();
  
  const intervals: DetailedImpression[] = [];

  // 2. INTERVAL PROCESSING: Loop through time in fixed-size buckets.
  for (let t = startTime; t <= endTime; t += intervalMs) {
    const intervalStart = t;
    const intervalEnd = t + intervalMs;

    const bucketTweets = sortedTweets.filter((tweet) => {
      const tweetTime = new Date(tweet.timestamp).getTime();
      return tweetTime >= intervalStart && tweetTime < intervalEnd;
    });

    // Skip intervals with no tweet activity.
    if (bucketTweets.length === 0) continue;

    // 3. DATA AGGREGATION: Sum up metrics for all tweets within the current interval.
    let intervalPosViews = 0;
    let intervalNegViews = 0;
    let intervalRawEngagement = 0;
    let intervalFollowers = 0;

    for (const tweet of bucketTweets) {
      const { likes, comments, retweets, impressions, followers } = tweet;
      
      // A simple engagement score heuristic. Retweets are weighted higher as they amplify reach.
      const rawEngagement = likes + comments + 2 * retweets;
      
      // Classify tweet sentiment based on engagement. No engagement = neutral/negative.
      if (rawEngagement > 0) {
        intervalPosViews += impressions;
      } else {
        intervalNegViews += impressions;
      }
      
      intervalRawEngagement += rawEngagement;
      intervalFollowers += followers;
    }

    // 4. METRIC CALCULATION: Compute the final values for the interval.
    const totalIntervalViews = intervalPosViews + intervalNegViews;
    const tweetVolume = bucketTweets.length;

    // **Quality & Influence Score (value):** 
    // This score represents the "engagement quality" of the tweets in this interval.
    // It's normalized by the total views to measure engagement per impression.
    // A higher value means the content was more engaging for the reach it got.
    // We add 1 to the denominator to prevent division by zero.
    const qualityScore = totalIntervalViews > 0 
      ? (intervalRawEngagement / totalIntervalViews) * 1000 
      : 0;

    // **Positive Impression Ratio (engagementRate):**
    // This metric shows the percentage of views in the interval that came from "positive" (engaging) tweets.
    // It's a measure of the overall sentiment of the conversation during this period.
    const positiveImpressionRatio = totalIntervalViews > 0 
      ? intervalPosViews / totalIntervalViews 
      : 0;

    // 5. PUSH TO RESULTS: The `posImpressions` and `negImpressions` now represent the *change* (delta) for this specific interval.
    intervals.push({
      name: new Date(intervalStart).toISOString(), // Use ISO string for consistency
      value: isNaN(qualityScore) ? 0 : qualityScore,
      posImpressions: intervalPosViews, // This is the delta of positive views for the interval
      negImpressions: intervalNegViews, // This is the delta of negative views for the interval
      engagementRate: positiveImpressionRatio,
       // Add volume for extra context in analysis
    });
  }

  return intervals;
}
// Define the structure for a single data point from your JSON

interface TweetEntry {
  tweet: string;
  params: {
    time: number[];
    views: string[];
    likes: string[];
    comment: string[];
    retweet: string[];
    plot_time: number[];
  };
  post_time: string;
  status: string;
  profile_image?: string;
  followers: number;
}
// A flattened structure for easier processing
interface EngagementEvent {
  tweetId: string;
  post_time: string;
  timestamp: string;
  views: number;
  likes: number;
  retweets: number;
  comments: number;
}



/**
 * Estimates unique viewer growth using the View-Velocity Overlap Model and
 * classifies them based on engagement quality.
 *
 * @param rawTweets - The raw array of tweet data from text.json.
 * @param beta - The Cross-Viewing Coefficient (0 to 1). Represents the fraction of
 *               non-driver view growth attributed to new unique viewers.
 *               A value of 0.15 is a realistic default.
 * @returns An array of DetailedImpression objects for each time interval.
 */
/*
export function computeViewVelocityImpressions(
  rawTweets: TweetEntry[],
  beta: number = 0.05
): DetailedVImpression[] {
  if (!rawTweets || rawTweets.length === 0) return [];

  // Step 1: Unroll the raw data into a flat list of chronological events
  const unrolledEvents: EngagementEvent[] = [];
  rawTweets.forEach(tweet => {
    // A unique identifier for each tweet is its status URL
    const tweetId = tweet.status;
    for (let i = 0; i < tweet.params.plot_time.length; i++) {
      unrolledEvents.push({
        tweetId: tweetId,
        post_time: tweet.post_time,
        timestamp: tweet.params.plot_time[i].toString(),
        views: parseInt(tweet.params.views[i], 10),
        likes: parseInt(tweet.params.likes[i], 10),
        retweets: parseInt(tweet.params.retweet[i], 10),
        comments: parseInt(tweet.params.comment[i], 10),
      });
    }
  });

  // Sort all events by timestamp to process chronologically
  unrolledEvents.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Step 2: Define the discrete time intervals for analysis
  const uniqueTimestamps = [...new Set(unrolledEvents.map(e => e.timestamp))].sort();
  if (uniqueTimestamps.length < 2) return [];

  // Step 3: Iterate through each interval to apply the model
  const results: DetailedVImpression[] = [];
  let cumulativeUniqueViewers = 0;

  for (let j = 0; j < uniqueTimestamps.length - 1; j++) {
    const t_start = uniqueTimestamps[j];
    const t_end = uniqueTimestamps[j + 1];

    // Get all events that happened exactly at the start and end of the interval
    const startEvents = unrolledEvents.filter(e => e.timestamp === t_start);
    const endEvents = unrolledEvents.filter(e => e.timestamp === t_end);

    const tweetStateAtStart = new Map(startEvents.map(e => [e.tweetId, e]));
    const tweetStateAtEnd = new Map(endEvents.map(e => [e.tweetId, e]));
    
    const intervalViewDeltas: number[] = [];
    const contributingEvents: { tweetId: string, startEvent: EngagementEvent, endEvent: EngagementEvent, viewDelta: number }[] = [];

    let totalViewDelta = 0;
    
    // For classifying impressions
    let viewDeltaFromEngagingTweets = 0;
    let totalNewRawEngagement = 0;

    // Analyze each tweet that exists at both the start and end of the interval
    for (const [tweetId, endState] of tweetStateAtEnd.entries()) {
      if (tweetStateAtStart.has(tweetId)) {
        const startState = tweetStateAtStart.get(tweetId)!;

        // Calculate deltas for views and engagement
        const viewDelta = endState.views - startState.views;
        const likesDelta = endState.likes - startState.likes;
        const retweetsDelta = endState.retweets - startState.retweets;
        const commentsDelta = endState.comments - startState.comments;

        //if (viewDelta > 0) {
          intervalViewDeltas.push(viewDelta);
          totalViewDelta += viewDelta;

          const engagementDelta = likesDelta + retweetsDelta + commentsDelta;
          totalNewRawEngagement += (likesDelta + commentsDelta + 2 * retweetsDelta);
          
          // If the tweet gained engagement in this interval, its view growth is "positive"
          if (engagementDelta > 0) {
            viewDeltaFromEngagingTweets += viewDelta;
          }
          contributingEvents.push({
            tweetId,
            startEvent: startState,
            endEvent: endState,
            viewDelta
          });
        //}
      }
    }
    
    if (intervalViewDeltas.length === 0) continue;

    // Step 4: Apply the View-Velocity Overlap formula
    
    const driverDelta = Math.max(0, ...intervalViewDeltas);
   
    const crossPollinationDelta = totalViewDelta - driverDelta;
    
    const newUniqueViewers = driverDelta + (beta * crossPollinationDelta);

   
    let posImpressions = 0;
    let negImpressions = 0;
    
    if (totalViewDelta > 0) {
        // The positivity ratio is the proportion of view growth that came from engaging tweets
        const positivityRatio = viewDeltaFromEngagingTweets / totalViewDelta;
        posImpressions = Math.round(newUniqueViewers * positivityRatio);
        
        negImpressions = Math.round(newUniqueViewers * (1 - positivityRatio));
    } else {
        // If there's no view growth, there are no new impressions
        negImpressions = Math.round(newUniqueViewers);
    }

    cumulativeUniqueViewers += newUniqueViewers;
    
    const engagementRate = newUniqueViewers > 0 
        ? totalNewRawEngagement / newUniqueViewers 
        : 0;

    results.push({
      name: new Date(t_start).toLocaleString(),
      newUniqueViewers: Math.round(newUniqueViewers),
      cumulativeUniqueViewers: Math.round(cumulativeUniqueViewers),
      posImpressions,
      negImpressions,
      engagementRate: parseFloat(engagementRate.toFixed(4)),
    });
  }

  return results;
}*/
//interface Impression { name: string; value: number; }

export function computeViewVelocityImpressions(
  rawTweets: TweetEntry[],
  beta: number = 0.2 // A beta of 0.2-0.3 is a good starting point for Twitter's algorithm
): DetailedVImpression[] {
  if (!rawTweets || rawTweets.length === 0) return [];

  // Step 1: Unroll and sort events chronologically (unchanged)
  const unrolledEvents: EngagementEvent[] = [];
  rawTweets.forEach(tweet => {
    const tweetId = tweet.status;
    for (let i = 0; i < tweet.params.plot_time.length; i++) {
      unrolledEvents.push({
        tweetId: tweetId,
        post_time: tweet.post_time,
        timestamp: tweet.params.plot_time[i].toString(),
        views: parseInt(tweet.params.views[i], 10) || 0,
        likes: parseInt(tweet.params.likes[i], 10) || 0,
        retweets: parseInt(tweet.params.retweet[i], 10) || 0,
        comments: parseInt(tweet.params.comment[i], 10) || 0,
      });
    }
  });

  unrolledEvents.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const uniqueTimestamps = [...new Set(unrolledEvents.map(e => e.timestamp))].sort();
  if (uniqueTimestamps.length < 2) return [];

  const results: DetailedVImpression[] = [];
  let cumulativeUniqueViewers = 0;

  for (let j = 0; j < uniqueTimestamps.length - 1; j++) {
    const t_start = uniqueTimestamps[j];
    const t_end = uniqueTimestamps[j + 1];

    const startEvents = unrolledEvents.filter(e => e.timestamp === t_start);
    const endEvents = unrolledEvents.filter(e => e.timestamp === t_end);

    const tweetStateAtStart = new Map(startEvents.map(e => [e.tweetId, e]));
    const tweetStateAtEnd = new Map(endEvents.map(e => [e.tweetId, e]));

    let intervalViewDeltas: number[] = [];
    let viewDeltaFromEngagingTweets = 0;
    let totalViewDeltaInInterval = 0;
    let totalNewRawEngagement = 0;

    for (const [tweetId, endState] of tweetStateAtEnd.entries()) {
      if (tweetStateAtStart.has(tweetId)) {
        const startState = tweetStateAtStart.get(tweetId)!;
        const viewDelta = endState.views - startState.views;
        
        if (viewDelta > 0) {
          intervalViewDeltas.push(viewDelta);
          totalViewDeltaInInterval += viewDelta;

          const likesDelta = endState.likes - startState.likes;
          const retweetsDelta = endState.retweets - startState.retweets;
          const commentsDelta = endState.comments - startState.comments;
          const engagementDelta = likesDelta + retweetsDelta + commentsDelta;
          
          totalNewRawEngagement += (likesDelta + commentsDelta + 2 * retweetsDelta);

          if (engagementDelta > 0) {
            viewDeltaFromEngagingTweets += viewDelta;
          }
        }
      }
    }

    if (intervalViewDeltas.length === 0) continue;

    // ======================================================================
    // CORRECTED LOGIC: Geometric Decay Model for Unique Viewer Estimation
    // ======================================================================
    
    // 1. Sort the view deltas in descending order.
    intervalViewDeltas.sort((a, b) => b - a);
    
    // 2. Apply the geometric decay formula to estimate unique viewers.
    let newUniqueViewers = 0;
    for (let i = 0; i < intervalViewDeltas.length; i++) {
        newUniqueViewers += intervalViewDeltas[i] * (beta ** i);
    }

    // ======================================================================
    
    let posImpressions = 0;
    let negImpressions = 0;

    if (totalViewDeltaInInterval > 0) {
      const positivityRatio = viewDeltaFromEngagingTweets / totalViewDeltaInInterval;
      posImpressions = Math.round(newUniqueViewers * positivityRatio);
      negImpressions = Math.round(newUniqueViewers * (1 - positivityRatio));
    } else {
      // If there's no view delta, there are no new impressions.
      posImpressions = 0;
      negImpressions = 0;
    }

    cumulativeUniqueViewers += newUniqueViewers;

    const engagementRate = newUniqueViewers > 0
      ? totalNewRawEngagement / newUniqueViewers
      : 0;
    const t_time = convertToUTCFormat(t_start)
    results.push({
      name: new Date(t_time).toISOString(),
      newUniqueViewers: Math.round(newUniqueViewers),
      cumulativeUniqueViewers: Math.round(cumulativeUniqueViewers),
      // FIX: Report the impressions calculated for THIS interval directly.
      posImpressions: posImpressions,
      negImpressions: negImpressions,
      engagementRate: parseFloat(engagementRate.toFixed(4)),
    });
  }

  return results;
}
/*
export function computeViewVelocityImpressions(
  rawTweets: TweetEntry[],
  beta: number = 0.05
): DetailedVImpression[] {
  if (!rawTweets || rawTweets.length === 0) return [];

  // Step 1: Unroll the raw data into a flat list of chronological events
  const unrolledEvents: EngagementEvent[] = [];
  rawTweets.forEach(tweet => {
    const tweetId = tweet.status;
    for (let i = 0; i < tweet.params.plot_time.length; i++) {
      unrolledEvents.push({
        tweetId: tweetId,
        post_time: tweet.post_time,
        timestamp: tweet.params.plot_time[i].toString(),
        views: parseInt(tweet.params.views[i], 10),
        likes: parseInt(tweet.params.likes[i], 10),
        retweets: parseInt(tweet.params.retweet[i], 10),
        comments: parseInt(tweet.params.comment[i], 10),
      });
    }
  });

  // Sort all events by timestamp to process chronologically
  unrolledEvents.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const uniqueTimestamps = [...new Set(unrolledEvents.map(e => e.timestamp))].sort();
  if (uniqueTimestamps.length < 2) return [];

  const results: DetailedVImpression[] = [];
  let cumulativeUniqueViewers = 0;
  let prevposImpressions = 0
  let  prevnegImpressions = 0
  for (let j = 0; j < uniqueTimestamps.length - 1; j++) {
    const t_start = uniqueTimestamps[j];
    const t_end = uniqueTimestamps[j + 1];

    const startEvents = unrolledEvents.filter(e => e.timestamp === t_start);
    const endEvents = unrolledEvents.filter(e => e.timestamp === t_end);

    const tweetStateAtStart = new Map(startEvents.map(e => [e.tweetId, e]));
    const tweetStateAtEnd = new Map(endEvents.map(e => [e.tweetId, e]));

    const intervalViewDeltas: number[] = [];
    const contributingEvents: {
      tweetId: string,
      startEvent: EngagementEvent,
      endEvent: EngagementEvent,
      viewDelta: number
    }[] = [];

    let totalViewDelta = 0;
    let viewDeltaFromEngagingTweets = 0;
    let totalNewRawEngagement = 0;

    for (const [tweetId, endState] of tweetStateAtEnd.entries()) {
      if (tweetStateAtStart.has(tweetId)) {
        const startState = tweetStateAtStart.get(tweetId)!;
        const viewDelta = endState.views - startState.views;
        const likesDelta = endState.likes - startState.likes;
        const retweetsDelta = endState.retweets - startState.retweets;
        const commentsDelta = endState.comments - startState.comments;
        if (viewDelta > 0) {
          intervalViewDeltas.push(viewDelta);
          totalViewDelta += viewDelta;

          const engagementDelta = likesDelta + retweetsDelta + commentsDelta;
          totalNewRawEngagement += (likesDelta + commentsDelta + 2 * retweetsDelta);

          if (engagementDelta > 0) {
            viewDeltaFromEngagingTweets += viewDelta;
          }

          contributingEvents.push({
            tweetId,
            startEvent: startState,
            endEvent: endState,
            viewDelta
          });
        }
      }
    }

    if (contributingEvents.length === 0) continue;

    // 🔁 NEW: Select the tweet with the highest absolute view count at t_end
    let driverTweet = contributingEvents[0];
    for (const e of contributingEvents) {
      if (e.endEvent.views > driverTweet.endEvent.views) {
        driverTweet = e;
      }
    }
   // console.log("intervalViewDeltas",intervalViewDeltas,"time",new Date(t_start).toLocaleString())
    const driverDelta = Math.max(0, ...intervalViewDeltas); //driverTweet.viewDelta;
    const crossPollinationDelta = totalViewDelta - driverDelta;
    const newUniqueViewers = driverDelta + (beta * crossPollinationDelta);

    let posImpressions = 0;
    let negImpressions = 0;

    if (totalViewDelta > 0) {
      const positivityRatio = viewDeltaFromEngagingTweets / totalViewDelta;
      posImpressions = Math.round(newUniqueViewers * positivityRatio);
      negImpressions = Math.round(newUniqueViewers * (1 - positivityRatio));
    } else {
      negImpressions = Math.round(newUniqueViewers);
    }

    cumulativeUniqueViewers += newUniqueViewers;

    const engagementRate = newUniqueViewers > 0
      ? totalNewRawEngagement / newUniqueViewers
      : 0;
    
    results.push({
      name: new Date(t_start).toLocaleString(),
      newUniqueViewers: Math.round(newUniqueViewers),
      cumulativeUniqueViewers: Math.round(cumulativeUniqueViewers),
      posImpressions:Math.max(0,posImpressions-prevposImpressions),
      negImpressions:Math.max(0,negImpressions-prevnegImpressions),
      engagementRate: parseFloat(engagementRate.toFixed(4)),
    });
    prevposImpressions = posImpressions;
    prevnegImpressions = negImpressions;
  }

  return results;
}
*/

export function computeRSIX(
  data: Impression[],
  period = 14
): Impression[] {
  const rsiPoints: Impression[] = [];
  if (data.length < period + 1) return rsiPoints;

  // Arrays to hold U and D values
  const gains: number[] = [];
  const losses: number[] = [];

  // 1. Compute raw gains and losses for each period
  for (let i = 1; i < data.length; i++) {
    const change = data[i].value - data[i - 1].value;
    gains[i]  = Math.max(change,  0);
    losses[i] = Math.max(-change, 0);
  }

  // 2. Initialize first smoothed averages (simple mean)
  let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;

  // 3. Compute first RSI value at index = period
  let rs = avgGain / avgLoss;
  rsiPoints.push({
    name: data[period].name,
    value: 100 - (100 / (1 + rs)),
  });

  // 4. Wilder’s smoothing for subsequent values
  for (let i = period + 1; i < data.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rs      = avgGain / avgLoss;

    rsiPoints.push({
      name: data[i].name,
      value: 100 - (100 / (1 + rs)),
    });
  }

  return rsiPoints;
}

/**
 * Computes the Composite FOMO Index for each time bin:
 *   FOMO_Index(t) = (Z_SEI + Z_RES + Z_Views) / 3
 *
 * where Z_metric = (metric - μ) / σ.
 *
 * @param bins  Array of MetricsBin, sorted by time.
 * @returns     Array of FOMOIndexResult with the same time ordering.
 */
export function computeCompositeFOMOIndex(
  bins: MetricsBin[]
): Impression[] {
  const n = bins.length;
  if (n === 0) return [];

  // Helper to compute mean and std
  const mean = (arr: number[]) => arr.reduce((s, x) => s + x, 0) / arr.length;
  const std = (arr: number[], mu: number) =>
    Math.sqrt(arr.reduce((s, x) => s + (x - mu) ** 2, 0) / arr.length);

  // Extract arrays
  const seis   = bins.map(b => b.sei);
  const ress   = bins.map(b => b.res);
  const viewsA = bins.map(b => b.views);

  // Compute statistics
  const μ_sei   = mean(seis);
  const σ_sei   = std(seis, μ_sei)   || 1;  // avoid div0
  const μ_res   = mean(ress);
  const σ_res   = std(ress, μ_res)   || 1;
  const μ_views = mean(viewsA);
  const σ_views = std(viewsA, μ_views) || 1;

  // Build the composite index series
  return bins.map(({ time, sei, res, views }) => {
    const zSei   = (sei   - μ_sei)   / σ_sei;
    const zRes   = (res   - μ_res)   / σ_res;
    const zViews = (views - μ_views) / σ_views;

    return {
      name: time,
      value: (zSei + zRes + zViews) / 3
    };
  });
}
/**
 * 1) Buckets raw tweets into fixed-interval bins.
 * 2) Computes SEI, views.
 * 3) Computes RES over a rolling window of `resWindow` bins.
 */
export function computeMetricsBins(
  tweets: Engagement[],
  intervalMinutes: number,
  resWindow: number
): MetricsBin[] {
  if (tweets.length === 0) return [];

  const bucketMs = intervalMinutes * 60 * 1000;

  // Step 1: aggregate into bins
  type BinAgg = { sumEng: number; sumViews: number; count: number };
  const bins = new Map<number, BinAgg>();

  for (const { timestamp, likes, retweets, comments, followers, impressions } of tweets) {
    const tMs = new Date(timestamp).getTime();
    const floored = Math.floor(tMs / bucketMs) * bucketMs;

    // engagement E = likes + 2*retweets + comments
    const eng = (likes + 2 * retweets + comments) * Math.log(followers + 1);

    const agg = bins.get(floored) ?? { sumEng: 0, sumViews: 0, count: 0 };
    agg.sumEng   += eng;
    agg.sumViews += impressions;
    agg.count    += 1;
    bins.set(floored, agg);
  }

  // step 2: sort and compute SEI & views per bin
  const sorted = Array.from(bins.entries())
    .map(([timeMs, { sumEng, sumViews, count }]) => ({
      timeMs,
      sei: sumEng / count,
      views: sumViews,
      count
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

  // step 3: compute RES = (E - MA)/MA over the last resWindow bins
  const results: MetricsBin[] = [];
  //const engSeries = sorted.map(b => b.sei * sorted[0].count); // rebuild raw E for RES MA
  // actually, for RES we want raw engagement sum: use sumEng directly, so reconstruct array:
  const rawEng = Array.from(bins.entries())
    .map(([timeMs, agg]) => ({ timeMs, eng: agg.sumEng }))
    .sort((a, b) => a.timeMs - b.timeMs)
    .map(x => x.eng);

  for (let i = 0; i < sorted.length; i++) {
    const { timeMs, sei, views } = sorted[i];
    let res = 0;
    if (i >= resWindow) {
      // moving average over previous resWindow bins
      const window = rawEng.slice(i - resWindow, i);
      const ma = window.reduce((sum, x) => sum + x, 0) / window.length;
      res = ma > 0 ? (rawEng[i] - ma) / ma : 0;
    }
    results.push({
      time: new Date(timeMs).toISOString(),
      sei,
      res,
      views
    });
  }

  return results;
}



/**
 * Represents a calculated FOMO point with its raw score.
 */
interface FomoPoint {
  name: string; // The timestamp for the chart
  value: number; // The raw, unscaled FOMO score
}

type AccountTier = 'Retail' | 'Shark' | 'Whale';

type SentimentType = 'Positive' | 'Negative' | 'Neutral';
interface SentimentAnalysis {
  type: 'Positive' | 'Negative' | 'Neutral';
  score: number;
  multiplier: number;
}

// --- Helper Functions (Unchanged) ---

function getAccountTier(followers: number): AccountTier {
  if (followers > 10000) return 'Whale';
  if (followers > 1000) return 'Shark';
  return 'Retail';
}

// --- Interfaces (Unchanged) ---

//type AccountTier = 'Retail' | 'Shark' | 'Whale';

// --- Improved Sentiment Function (As developed before) ---
/*
function detectSentimentV2(text: string): SentimentAnalysis {
  // ... [Using the full detectSentimentV2 implementation from the previous response]
  const positiveTerms: { [key: string]: number } = { 'lfg': 2, 'send it': 2.5, 'bullish': 2, 'gem': 2.5, 'alpha': 2, 'moon': 3, 'mooning': 3.5, 'soar': 2, 'fly harder': 2.5, 'pump': 1.5, 'printing': 2, 'cooking': 1.5, 'rocket': 2, 'ath': 3, 'all time high': 3, 'undervalued': 2.5, 'breakout': 2, 'massive': 1.5, 'insane': 1.5, 'believe': 1.5, 'diamond hands': 3, 'hodl': 1.5, 'giga': 2.5, '10x': 2, '20x': 2.5, '50x': 3, '100x': 4, '1000x': 5 };
  const negativeTerms: { [key: string]: number } = { 'scam': -4, 'rug': -5, 'danger': -3, 'dump': -3, 'jeeted': -3, 'heavy bags': -2, 'insiders': -2.5, 'red flag': -3, 'warning': -2.5, 'cooked': -4, 'scammer': -5, 'avoid': -2, 'be careful': -2, 'fud': -2, 'rugging': -5, 'dumping': -4, 'crashed': -3, 'ruggers':-5, 'bundles':-2.5 };
  const emojis: { [key: string]: number } = {
    "🚀": 3, "🌕": 2.5, "💎": 2, "🔥": 1.5, "📈": 1.5, "💰": 1, "💸": 1.5,
    "🤑": 1.5, "🚨": -2, "🚩": -4, "📉": -2, "🤡": -2, "☠️": -3, "💩": -3,
    "🛑": -2, "⚠️": -1.5, "✅": 1, "❌": -1, "🐳": 2, "🐐": 2, "💊": 1,
    "☢️": -2, "💵": 1, "🏆": 1.5, "🥇": 1, "🤝": 0.5, "💥": 2, "🤯": 1.5
  };

  let score = 0;
  const lowerText = text.toLowerCase();
  
  for (const term in positiveTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'g');
    const matches = lowerText.match(regex);
    if (matches) score += positiveTerms[term] * matches.length;
  }
  for (const term in negativeTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'g');
    const matches = lowerText.match(regex);
    if (matches) score += negativeTerms[term] * matches.length;
  }
  for (const emoji in emojis) {
    const matches = text.match(new RegExp(emoji, 'g'));
    if (matches) score += emojis[emoji] * matches.length;
  }

  const negationRegex = /\b(not|no|don't|isnt|isn't|never|avoid|ain't|without)\s+(bullish|gem|good|rocket|moon|pump|great)\b/g;
  const negatedMatches = lowerText.match(negationRegex);
  if (negatedMatches) score -= 5 * negatedMatches.length;

  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 1) score *= (1 + Math.min(exclamationCount, 5) * 0.1);

  const upperCaseWords = text.match(/\b[A-Z]{4,}\b/g);
  if (upperCaseWords) score += (score > 0 ? 1 : -1) * upperCaseWords.length * 0.5;
  
  const clampedScore = Math.max(-15, Math.min(15, score));
  let type: 'Positive' | 'Negative' | 'Neutral' = 'Neutral';
  let multiplier = 1.0;

  if (clampedScore > 1.5) {
    type = 'Positive';
    multiplier = 1 + Math.log1p(clampedScore);
  } else if (clampedScore < -1.5) {
    type = 'Negative';
    multiplier = -1 - Math.log1p(Math.abs(clampedScore)) * 1.5;
  }

  return { type, score: parseFloat(score.toFixed(2)), multiplier: parseFloat(Math.max(-10, Math.min(10, multiplier)).toFixed(2)) };
}

*/

// --- Configuration Data (Detailed Dictionaries) ---

const POSITIVE_TERMS: { [key: string]: number } = {
  // High-Impact FOMO & Urgency
  'lfg': 2, 'send it': 3, 'sending': 3, 'sends': 3, 'moon': 3.5, 'mooning': 4,
  'moonbound': 4, 'nuke': 3.5, 'nuclear': 4, 'blast': 2.5, 'up only': 3,
  'megasender': 4, 'ath': 3.5, 'all time high': 3.5, 'breakout': 2.5,
  'gonna send': 2.5, 'fly harder': 2.5, 'rocket': 2.5, 'soar': 2,
  
  // Quality & Value Perception
  'gem': 2.5, 'alpha': 2, 'giga': 2.5, 'solid': 2, 'strong': 2, 'clean': 2,
  'undervalued': 3, 'promising': 2, 'huge potential': 2.5, 'prophecy': 2,
  'legend': 2.5, 'gud tek': 3,
  
  // Action & Community Slang
  'aped': 2.5, 'hodl': 1.5, 'diamond hands': 3, 'printing': 2.5, 'cooking': 1.5,
  'eat': 2, 'eaten': 2, 'believe': 1.5, 'primed': 2.5, 'ceremony': 1.5,
  
  // Gains & Success
  'profits': 2, 'gained': 1.5, 'secured': 2, 'wins': 1.5, 'winner': 1.5,
  '10x': 2.5, '20x': 3, '50x': 3.5, '100x': 4, '1000x': 5,
  
  // General Hype
  'massive': 2, 'insane': 1.5, 'hot': 2, 'trending': 2, 'boost': 1.5,
  'hot pick': 2, 'whale': 2.5, 'smart money': 3, 'smart traders': 3
};

const NEGATIVE_TERMS: { [key: string]: number } = {
  // Direct Accusations (High Impact)
  'rug': -5, 'rugging': -5, 'rug pull': -5, 'ruggers': -5, 'scam': -4,
  'scammer': -5, 'trap': -4,
  
  // Warnings & Risk
  'danger': -3, 'warning': -2.5, 'avoid': -2, 'risk': -1.5, 'risky': -2,
  'red flag': -3, 'red flags': -3,
  
  // Negative Outcomes
  'dump': -3, 'dumping': -4, 'jeeted': -3, 'cooked': -4, 'crashed': -3,
  'vanish': -3, 'claw your wallet': -3.5, 'panic': -2,
  
  // Technical Red Flags
  'bundles': -3, 'bundlers': -3, 'insiders': -2.5, 'heavy bags': -2,
  'heavily bundled': -3.5, 'paper hands': -2,
  
  // Marketing / Top Signals (Cautionary Negative)
  'vip group': -1, 'join my tg': -1, 'dm for vip': -1, 'private tg': -1
};

const CAUTIONARY_TERMS: { [key: string]: number } = {
  'be careful': -1.5, 'watch your entry': -1, 'gamble': -0.5, 'dyor': -0.5
};

const EMOJIS: { [key: string]: number } = {
  '🚀': 3, '🌕': 2.5, '💎': 2, '🔥': 1.5, '📈': 1.5, '💰': 1, '💸': 1.5,
  '🤑': 1.5, '🚨': -2, '🚩': -4, '📉': -2, '🤡': -2, '☠️': -3, '💩': -3,
  '🛑': -2, '⚠️': -1.5, '✅': 1, '❌': -1, '🐳': 2, '🐐': 2, '💊': 1,
  '☢️': -2, '💵': 1, '🥇': 1, '🤝': 0.5, '💥': 2, '🤯': 1.5, '🏆': 2
};

const NEGATION_TERMS = new Set(["not", "don't", "no", "without", "never", "ain't", "isn't", "wasn't"]);

function getMultiplierScore(value: number): number {
  if (value >= 1000) return 5.0; // Life-changing gains
  if (value >= 100)  return 4.0; // "100x" is a major milestone
  if (value >= 50)   return 3.5; // Significant wealth creation
  if (value >= 20)   return 3.0; // Massive success
  if (value >= 10)   return 2.5; // The classic "10x gem"
  if (value >= 5)    return 2.0; // A very strong return
  if (value >= 2)    return 1.5; // The baseline for a successful trade
  return 0; // Multipliers below 2x are not significant FOMO drivers
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Analyzes the sentiment of a given text based on crypto terminology.
 * This version handles multi-word phrases, decimal multipliers, and negation.
 * @param text The input string (e.g., a tweet).
 * @returns A SentimentAnalysis object with type, score, and multiplier.
 */
function detectSentimentV2(text: string): SentimentAnalysis {
  let score = 0;
  let lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);

  // 1. Process Multipliers
  const multiplierRegex = /(\d{1,4}(?:\.\d{1,2})?)x\b/gi;
  let match;
  while ((match = multiplierRegex.exec(lowerText)) !== null) {
    const value = parseFloat(match[1]);
    score += getMultiplierScore(value);
  }
  lowerText = lowerText.replace(multiplierRegex, ' ');

  // 2. Process Term Dictionaries
  const processTermDictionary = (terms: { [key: string]: number }, isPositive: boolean) => {
    const sortedTerms = Object.keys(terms).sort((a, b) => b.length - a.length);
    for (const term of sortedTerms) {
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'g');
      const matches = lowerText.match(regex);
      if (matches) {
        let termScore = terms[term];
        if (isPositive) {
          const termIndex = lowerText.indexOf(term);
          const precedingText = lowerText.substring(Math.max(0, termIndex - 12), termIndex);
          if (Array.from(NEGATION_TERMS).some(neg => precedingText.includes(neg))) {
            termScore = -termScore;
          }
        }
        score += termScore * matches.length;
        lowerText = lowerText.replace(regex, ' ');
      }
    }
  };

  processTermDictionary(POSITIVE_TERMS, true);
  processTermDictionary(NEGATIVE_TERMS, false);
  processTermDictionary(CAUTIONARY_TERMS, false);

  // 3. Process Emojis
  for (const emoji in EMOJIS) {
    const emojiRegex = new RegExp(emoji, 'g');
    const matches = text.match(emojiRegex);
    if (matches) {
      score += EMOJIS[emoji] * matches.length;
    }
  }

  // 4. Amplifiers
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 2) {
    const ampFactor = 1 + (Math.min(exclamationCount, 10) * 0.05);
    if (score > 0) score *= ampFactor;
  }

  const upperCaseWords = text.match(/\b[A-Z]{4,}\b/g);
  if (upperCaseWords) {
    score += (score > 0 ? 1 : -1) * upperCaseWords.length * 0.25;
  }
  
  // 5. Determine Type and Multiplier
  const clampedScore = Math.max(-15, Math.min(15, score));
  let type: 'Positive' | 'Negative' | 'Neutral' = 'Neutral';
  let multiplier = 1.0;

  if (clampedScore > 1.5) {
    type = 'Positive';
    multiplier = 1 + Math.log1p(clampedScore); 
  } else if (clampedScore < -1.5) {
    type = 'Negative';
    multiplier = -(1 + Math.log1p(Math.abs(clampedScore)) * 1.5); 
  }

  return {
    type,
    score: parseFloat(score.toFixed(2)),
    multiplier: parseFloat(Math.max(-10, Math.min(10, multiplier)).toFixed(2))
  };
}

// --- New Helper Function: Calculate FOMO Components ---

interface FomoComponents {
  rawImpact: number;
  hypeMultiplier: number;
  viralityScore: number;
}

/**
 * Calculates the raw social impact and a separate hype multiplier for a tweet.
 */
function calculateFomoComponents(e: Engagement): FomoComponents {
  // 1. Raw Social Impact (A neutral measure of reach and interaction)
  const baseEngagement = e.likes + e.retweets * 2 + e.comments * 3+(e.impressions * 0.01 ); // Comments are valuable
  const viralityScore =  Math.log1p(baseEngagement / (e.followers + 10)); // Log scale for stability
  
  const rawImpact = ((e.impressions * 0.01 )+ baseEngagement) * viralityScore;

  // 2. Hype Multiplier (How much this tweet amplifies FOMO)
  let hypeMultiplier = 1.0;

  const sentiment = detectSentimentV2(e.tweet);
  const tier = getAccountTier(e.followers);

  // Apply sentiment multiplier ONLY if positive
  if (sentiment.type === 'Positive') {
    hypeMultiplier *= sentiment.multiplier;
  }
  // Negative sentiment acts as a suppressor/dampener
  if (sentiment.type === 'Negative') {
    // We dampen the score later, not here. We can assign a negative multiplier for suppression.
    // For simplicity in this model, we'll let it reduce the total bucket score.
    hypeMultiplier *= sentiment.multiplier; // e.g., -2.5
  }

  // Apply tier-based hype amplification for POSITIVE tweets only
  if (sentiment.type === 'Positive') {
    if (tier === 'Whale') hypeMultiplier *= 5.0;
    else if (tier === 'Shark') hypeMultiplier *= 2.5;
  }

  // Special bonus for retail tweets that go viral (a sign of organic grassroots movement)
  if (tier === 'Retail' && e.impressions > 5000 && sentiment.type === 'Positive') {
    hypeMultiplier *= 3.0;
  }

  return { rawImpact, hypeMultiplier,viralityScore };
}


// --- Main Function (REVISED) ---
/**
 * Analyzes engagement data to detect points of social FOMO.
 */
export function detectFomoPoints(
  data: Engagement[],
  intervalMinutes: number,
  alpha: number
): FomoPoint[] {
  if (data.length === 0) return [];

  const bucketMs = intervalMinutes * 60 * 1000;
  const buckets = new Map<number, { fomoScore: number }>();

  // 1. Bucket Data & Calculate Final Fomo Score for each tweet
   
  for (const tweet of data) {
    const tMs = new Date(tweet.timestamp).getTime();
    const bucketKey = Math.floor(tMs / bucketMs) * bucketMs;

    const { rawImpact, hypeMultiplier,viralityScore } = calculateFomoComponents(tweet);
    
    // The key change: Final score is impact amplified by hype.
    // Negative hype will subtract from the total bucket score.
    const fomoScore =  hypeMultiplier * viralityScore;

    const bucket = buckets.get(bucketKey) ?? { fomoScore: 0 };
    bucket.fomoScore += fomoScore;
    buckets.set(bucketKey, bucket);
  }

  // 2. Convert to a sorted array.
  const sortedBuckets = Array.from(buckets.entries())
    .map(([timeMs, { fomoScore }]) => ({
      timeMs,
      // Ensure we don't have negative FOMO scores in the final calculation,
      // as they represent suppression, not "anti-FOMO". The damping has already occurred.
      finalFomo: Math.max(0, fomoScore), 
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

  // 3. Compute Velocity (EWMA) of the final FOMO scores
  const results: FomoPoint[] = [];
  let prevEwmaVelocity = 0;
  let prevFinalFomo = 0;

  for (const bucket of sortedBuckets) {
    const rawVelocity = bucket.finalFomo - prevFinalFomo;
    const ewmaVelocity = alpha * rawVelocity + (1 - alpha) * prevEwmaVelocity;
    
    // The FINAL FOMO point value is a product of the current FOMO and its velocity
    const fomoPointValue = bucket.finalFomo * Math.max(0, ewmaVelocity); // Don't amplify with negative velocity

    results.push({
      name: new Date(bucket.timeMs).toISOString(),
      value: isNaN(fomoPointValue) ? 0 : fomoPointValue,
    });

    prevEwmaVelocity = ewmaVelocity;
    prevFinalFomo = bucket.finalFomo;
  }

  return results;
}


/**
 * Buckets impressions into fixed intervals, computes SEI, Velocity, and FOMO.
 *
 * @param data             Array of raw EngagementImpression
 * @param intervalMinutes  Bin size in minutes (e.g. 5)
 * @param alpha            EWMA smoothing factor for Velocity (0<alpha<=1)
 * @returns                Array of { time, fomo } sorted by time
 */
export function computeTimeBasedFOMO(
  data: Engagement[],
  intervalMinutes: number,
  alpha: number,
  K = 5000
): Impression[] {
  if (data.length === 0) return [];
  //console.log("computeTimeBasedFOMO",JSON.stringify(data, null, 2))
  const bucketMs = intervalMinutes * 60 * 1000;
  type Bin = {
    weightedSEI: number;
    views: number;
    count: number;
  };
  const bins = new Map<number, Bin>();

  // 1) Bucket raw data using SEI logic
  for (const { timestamp, likes, retweets, comments, impressions, followers } of data) {
    const tMs = new Date(timestamp).getTime();
    const floored = Math.floor(tMs / bucketMs) * bucketMs;
    const bin = bins.get(floored) ?? { weightedSEI: 0, views: 0, count: 0 };

    const rawEngagement = likes + 2 * retweets + comments + impressions;
    const weightedEngagement =
      rawEngagement * (rawEngagement / (followers + 1)) * Math.tanh(followers / K);

    bin.weightedSEI += weightedEngagement;
    bin.views += impressions;
    bin.count += 1;
    bins.set(floored, bin);
    //console.log("weightedSEI/count",timestamp, likes, retweets, comments, impressions, followers,bin.count)
  }

  // 2) Convert to sorted array
  const sorted = Array.from(bins.entries())
    .map(([timeMs, { weightedSEI, views, count }]) => ({
      timeMs,
      sei: weightedSEI / count,
      avgViews: views / count
    }))
    .sort((a, b) => a.timeMs - b.timeMs);
   // console.log("sorted",sorted)
  // 3) Normalize views
  const maxViews = Math.max(...sorted.map((b) => b.avgViews), 1);

  // 4) Compute Velocity (EWMA) and FOMO
  const results: Impression[] = [];
  let prevEWMA = 0;
  let prevSEI = 0;

  for (let i = 0; i < sorted.length; i++) {
    const { timeMs, sei, avgViews } = sorted[i];

    const rawVel = i === 0 ? 0 : (sei - prevSEI) / intervalMinutes;
    const vel = i === 0 ? rawVel : alpha * rawVel + (1 - alpha) * prevEWMA;

    const fomo = sei * vel * (1 + (avgViews / maxViews));
    //console.log("sei", sei, "vel", vel, "fomo", fomo, "avgViews", avgViews, "maxViews", maxViews);
    results.push({ name: new Date(timeMs).toLocaleString(), value: isNaN(fomo)? 0 : fomo });

    prevEWMA = vel;
    prevSEI = sei;
  }
  
  // 5) Normalize FOMO values to [0, 1] using min-max scaling
  const allFomoValues = results.map((r) => r.value);
  const minValue = Math.min(...allFomoValues);
  const maxValue =Math.max(...allFomoValues);
  const range = maxValue - minValue;
  //console.log("results",allFomoValues)
  const normalizedResults = results.map((r) => {
    const normalizedValue = range === 0 ? 0 : (r.value - minValue) / range;
    return {
      name: r.name,
      value: normalizedValue
    };
  });

  return normalizedResults;
}

export function calculateFomoFromTweetEntries(
  tweetData: TweetEntry[],
  intervalMinutes: number,
  params: FomoParams
): Impression[] {
  if (!tweetData || tweetData.length === 0) {
    return [];
  }

  const {
    likeWeight,
    retweetWeight,
    commentWeight,
    viewWeight,
    followerDampening,
    velocityAlpha
  } = params;

  // --- Step 1: Flatten the nested data into a single chronological list of engagement snapshots ---
  const allSnapshots = tweetData.flatMap(entry =>
    entry.params.plot_time.map((timestamp, i) => {
      // Ensure we don't access out-of-bounds indices
      const safeGet = (arr: string[]) => Number(arr[i]) || 0;

      return {
        timeMs: new Date(timestamp).getTime(),
        likes: safeGet(entry.params.likes),
        retweets: safeGet(entry.params.retweet),
        comments: safeGet(entry.params.comment),
        impressions: safeGet(entry.params.views),
        followers: entry.followers,
      };
    })
  );

  if (allSnapshots.length === 0) return [];
  
  // Sort all snapshots chronologically to process them in order
  allSnapshots.sort((a, b) => a.timeMs - b.timeMs);

  // --- Step 2: Calculate a weighted engagement score for each snapshot ---
  const scoredData = allSnapshots.map(snapshot => {
    const rawEngagement =
      snapshot.likes * likeWeight +
      snapshot.retweets * retweetWeight +
      snapshot.comments * commentWeight +
      snapshot.impressions * viewWeight;

    // Normalize by follower count to amplify engagement from smaller, dedicated accounts.
    // The logarithm provides a good balance, preventing massive accounts from dominating entirely.
    const followerFactor = Math.log(snapshot.followers + followerDampening);
    const score = rawEngagement / (followerFactor > 1 ? followerFactor : 1);

    return {
      timeMs: snapshot.timeMs,
      score,
    };
  });

  // --- Step 3: Bucket the scores into fixed time intervals, handling gaps ---
  const bucketMs = intervalMinutes * 60 * 1000;
  const firstTime = allSnapshots[0].timeMs;
  const lastTime = allSnapshots[allSnapshots.length - 1].timeMs;

  const startBucket = Math.floor(firstTime / bucketMs) * bucketMs;
  const endBucket = Math.floor(lastTime / bucketMs) * bucketMs;

  const bins = new Map<number, number>();

  // Initialize all possible time buckets with 0 to ensure a continuous timeline
  for (let t = startBucket; t <= endBucket; t += bucketMs) {
    bins.set(t, 0);
  }

  // Populate buckets by summing the scores of all snapshots that fall within them.
  // This captures the total volume of engagement in that interval.
  for (const { timeMs, score } of scoredData) {
    const floored = Math.floor(timeMs / bucketMs) * bucketMs;
    bins.set(floored, (bins.get(floored) || 0) + score);
  }

  const sortedBins = Array.from(bins.entries())
    .map(([timeMs, totalScore]) => ({ timeMs, sei: totalScore }))
    .sort((a, b) => a.timeMs - b.timeMs);

  // --- Step 4: Compute Velocity (rate of change) and the final FOMO score ---
  const fomoResults: Impression[] = [];
  let prevEWMA = 0;
  let prevSEI = 0;

  for (let i = 0; i < sortedBins.length; i++) {
    const { timeMs, sei } = sortedBins[i];

    // Calculate the rate of change of the Social Engagement Index (SEI)
    const deltaTimeMinutes = i === 0 ? intervalMinutes : (timeMs - sortedBins[i-1].timeMs) / (60 * 1000);
    const rawVel = deltaTimeMinutes > 0 ? (sei - prevSEI) / deltaTimeMinutes : 0;
    
    // Smooth the velocity using an Exponentially Weighted Moving Average (EWMA)
    const vel = velocityAlpha * rawVel + (1 - velocityAlpha) * prevEWMA;

    // FOMO is the product of the current engagement level and its *positive* velocity.
    // This ensures that FOMO is only generated during periods of increasing buzz.
    const fomo = sei * Math.max(0, vel);

    fomoResults.push({
      name: new Date(timeMs).toLocaleString(),
      value: isNaN(fomo) ? 0 : fomo,
    });

    prevEWMA = vel;
    prevSEI = sei;
  }

  // --- Step 5: Normalize FOMO values to a [0, 1] range for visualization ---
  const maxFomoValue = Math.max(...fomoResults.map(r => r.value));
  
  if (maxFomoValue === 0) {
      return fomoResults.map(r => ({ name: r.name, value: 0 }));
  }

  const normalizedResults = fomoResults.map(r => ({
    name: r.name,
    // Normalize against the peak FOMO value for a clean 0-1 scale.
    value: r.value / maxFomoValue,
  }));

  return normalizedResults;
}

/**
 * Buckets tweets into fixed-interval bins and computes SEI per bin.
 *
 * @param tweets           Array of Tweet objects
 * @param intervalMinutes  Bin size in minutes (e.g. 5)
 * @returns                Array of { time, sei } sorted by time
 */
export function followerFactor(followers: number, F0 = 10000, k = 0.001): number {
  return 1 / (1 + Math.exp(-k * (followers - F0)));
}
export function computeTimeBasedSEI(
  tweets: Engagement[],
  intervalMinutes: number
): Impression[] {
  if (tweets.length === 0) return [];
    
  const bucketMs = intervalMinutes * 60 * 1000;
  // Map<bucketTimestampMs, { sumWeighted: number, count: number }>
  const bins = new Map<number, { sumWeighted: number; count: number }>();

  for (const { timestamp, likes, retweets, comments, impressions,followers } of tweets) {
    
    const tMs = new Date(timestamp).getTime();
    //console.log("Tweet tiimeStamp",timestamp,"tMs",tMs)
    const floored = Math.floor(tMs / bucketMs) * bucketMs;
    const weight = ((likes + 2 * retweets + comments *3)) *Math.log1p(((likes + 2 * retweets + comments *3 +(0.01*impressions)))/(followers+10))//((likes+2*retweets+comments+0.01*impressions)/(followers+1)) * Math.tanh(followers/10000);
    const normalised = weight/(followers+1)
    const prev = bins.get(floored);
    if (prev) {
      prev.sumWeighted += weight;
      prev.count += 1;
    } else {
      bins.set(floored, { sumWeighted: weight, count: 1 });
    }
  }
 
  
  // Convert to sorted array and compute SEI = sumWeighted / count
  return Array.from(bins.entries())
    .map(([timeMs, { sumWeighted, count }]) => ({
      name: new Date(timeMs).toISOString(),
      value: isNaN((sumWeighted / count)) ? 0 : (sumWeighted / count),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}
export function computeSEIEMA(data: Impression[], period: number): Impression[] {
  if (data.length === 0 || period <= 0) return [];

  const k = 2 / (period + 1);
  const emaArray: Impression[] = [];

  let emaPrev = data[0].value;
  emaArray.push({ name: data[0].name, value: emaPrev });

  for (let i = 1; i < data.length; i++) {
    const currentValue = data[i].value;
    const emaCurrent = currentValue * k + emaPrev * (1 - k);
    emaArray.push({ name: data[i].name, value: emaCurrent });
    emaPrev = emaCurrent;
  }

  return emaArray;
}

export function computeOscillatingSEIVelocity(
  seiData: Impression[],
  tweets: Engagement[],
  intervalMinutes: number,
  tau: number = 15, // EMA period in minutes
  lambda: number = 2.5, // Whale booster amplification factor
  engagementBase: number = 100, // Normalization constant
  epsilon: number = 0.01 // Small constant to prevent division by zero
): Impression[] {
  const n = seiData.length;
  if (n < 3) return [];

  // Helper functions
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const mad = (arr: number[], med: number) =>
    median(arr.map((v) => Math.abs(v - med)));

  // Compute EMA of SEI
  const alpha = 2 / (tau + 1);
  const emaSEI: number[] = [];
  seiData.forEach((d, i) => {
    if (i === 0) {
      emaSEI.push(d.value);
    } else {
      emaSEI.push(alpha * d.value + (1 - alpha) * emaSEI[i - 1]);
    }
  });

  // Compute median and MAD of SEI
  const seiValues = seiData.map((d) => d.value);
  const seiMedian = median(seiValues);
  const seiMAD = mad(seiValues, seiMedian) + epsilon;

  // Compute Whale Engagement per interval
  const bucketMs = intervalMinutes * 60 * 1000;
  const whaleEngagementMap = new Map<number, number>();

  tweets.forEach(({ timestamp, likes, retweets, followers,tweet }) => {
    
    const tMs = new Date(timestamp).getTime();
    //console.log("Tweet tiimeStamp",timestamp,"tMs",tMs,"tweet",tweet)
    const floored = Math.floor(tMs / bucketMs) * bucketMs;
    if (followers > 10000) {
      const engagement = likes + retweets;
      whaleEngagementMap.set(
        floored,
        (whaleEngagementMap.get(floored) || 0) + engagement
      );
    }
  });

  // Compute Enhanced SEI Velocity
  const velocityData: Impression[] = [];

  for (let i = 2; i < n; i++) {
    const tMs = new Date(seiData[i].name).getTime();
    const currentSEI = seiData[i].value;
    const ema = emaSEI[i];

    // Robust Z-Score
    const zRobust = (currentSEI - ema) / seiMAD;

    // Acceleration Gate
    const accel =
      seiData[i].value - 2 * seiData[i - 1].value + seiData[i - 2].value;
    const gate = Math.max(0, accel);

    // Whale Booster
    const whaleEngagement = whaleEngagementMap.get(tMs) || 0;
    const whaleBoost = lambda * Math.tanh(whaleEngagement / engagementBase);

    // Enhanced SEI Velocity
    const velocity = zRobust * gate * (1 + whaleBoost);

    velocityData.push({
      name: seiData[i].name,
      value: velocity,
    });
  }

  // Apply Fisher Transform to enhance oscillations
  const fisherTransformedData: Impression[] = [];
  for (let i = 0; i < velocityData.length; i++) {
    const v = velocityData[i].value;

    // Normalize velocity to range (-0.99, 0.99) to avoid infinity in Fisher Transform
    const scaled = Math.max(-0.99, Math.min(0.99, v / (Math.abs(v) + 1)));

    // Fisher Transform
    const fisher = 0.5 * Math.log((1 + scaled) / (1 - scaled));

    fisherTransformedData.push({
      name: velocityData[i].name,
      value: fisher,
    });
  }

  return fisherTransformedData;
}
export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stddev(xs: number[], mu: number): number {
  const sumSq = xs.reduce((s, x) => s + (x - mu) ** 2, 0);
  return Math.sqrt(sumSq / xs.length);
}
export function computeVelocities(imps: Impression[]): Impression[] {
  const vels: { name: string; value: number }[] = [];

  for (let i = 1; i < imps.length; i++) {
    const prev = imps[i - 1];
    const curr = imps[i];

    const tPrev = new Date(prev.name).getTime();
    const tCurr = new Date(curr.name).getTime();
    const dtMinutes = (tCurr - tPrev) / 1000 / 60;      // Δtime in minutes

    // ΔSEI
    const dSEI = curr.value - prev.value;

    // velocity: change per minute
    const velocity = dSEI / dtMinutes;

    vels.push({ name: curr.name, value:velocity });
  }

  return vels;
}

export function getDynamicSpikes(
  imps: Impression[],
  sigmaThreshold = 0.3
): Impression[] {
  const velocities = computeVelocities(imps);
  const vals = velocities.map(v => v.value);
  const μ = mean(vals);
  const σ = stddev(vals, μ);
  const cutoff = μ + sigmaThreshold * σ;

  return velocities.filter(v => v.value >= cutoff);
}
/**
 * Calculate tweet growth based on grouped data.
 * Computes the average tweet count per interval and normalizes it
 * against a maximum threshold (max tweets = 5 tweets/min * intervalMinutes).
 */
export function calculateTweetGrowthFromGroupedData(data: Impression[], intervalMinutes: number): number {
  if (data.length === 0) return 0;
  const totalTweets = data.reduce((sum, d) => sum + d.value, 0);
  const avgTweets = totalTweets / data.length;
  const maxTweets = 5 * intervalMinutes; // For 5 tweets per minute threshold.
  return Math.min(100, (avgTweets / maxTweets) * 100);
}

/**
 * Calculate impression growth as the percentage change from the first to the last impression.
 */
export function calculateImpressionGrowth(impressionData: Impression[]): number {
  if (impressionData.length < 2) return 0;
  
  let totalPercentChange = 0;
  let validPairs = 0;
  
  for (let i = 1; i < impressionData.length; i++) {
    const previousValue = impressionData[i - 1].value;
    const currentValue = impressionData[i].value;
    
    // Skip pairs where the previous value is 0 to avoid division by zero.
    if (previousValue === 0) continue;
    
    // Calculate percentage change from the previous to the current impression.
    const percentChange = ((currentValue - previousValue) / previousValue) * 100;
    totalPercentChange += percentChange;
    validPairs++;
  }
  
  // If no valid pairs were found, return 0.
  return validPairs === 0 ? 0 : totalPercentChange / validPairs;
}
/**
 * Aggregates raw engagement into fixed-interval bins and computes EWMA.
 *
 * @param data            Array of EngagementImpression
 * @param intervalMinutes Bin size in minutes (e.g. 5)
 * @param alpha           Smoothing factor in (0,1]
 * @returns               Array of {time, ewma} sorted by time
 */
export function computeTimeBasedEWMA(
  data: EngagementImpression[],
  intervalMinutes: number,
  alpha: number
): Impression[] {
  if (data.length === 0) return [];

  const bucketMs = intervalMinutes * 60 * 1000;
  const bins = new Map<number, number>();

  // 1) Bucket into Map<bucketTimestampMs, sumImpressions>
  for (const { name, impression } of data) {
    const tMs = new Date(name).getTime();
    const floored = Math.floor(tMs / bucketMs) * bucketMs;
    bins.set(floored, (bins.get(floored) ?? 0) + impression);
  }

  // 2) Sort buckets by time
  const sorted = Array.from(bins.entries())
    .map(([timeMs, sum]) => ({ timeMs, sum }))
    .sort((a, b) => a.timeMs - b.timeMs);

  // 3) Compute EWMA in one pass, outputting ISO strings
  const result: Impression[] = [];
  let prevEWMA = sorted[0].sum;
  result.push({
    name: new Date(sorted[0].timeMs).toLocaleString(),
    value: prevEWMA,
  });

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i].sum;
    const ewma = alpha * curr + (1 - alpha) * prevEWMA;
    result.push({
      name: new Date(sorted[i].timeMs).toLocaleString(),
      value: ewma,
    });
    prevEWMA = ewma;
  }

  return result;
}
// 3. Compute engagement velocity
//    V(t_i) = (E(t_i) - E(t_{i-1})) / Δt
// Here Δt is implied as one interval between successive array elements.
export function computeVelocity(
  arr: EngagementImpression[],
  windowSize: number
): Impression[] {
  const velocities: Impression[] = [];
  if (arr.length <= windowSize) return velocities;

  for (let i = windowSize; i < arr.length; i++) {
    // parse the two timestamps
    const tCurr = new Date(arr[i].name).getTime();
    const tPrev = new Date(arr[i - windowSize].name).getTime();

    // compute ΔE
    const deltaE = arr[i].impression - arr[i - windowSize].impression;

    // Δt in minutes
    const deltaT = (tCurr - tPrev) / 1000 / 60;
    if (deltaT === 0) continue; // avoid divide-by-zero

    // velocity in impressions per minute
    const v = deltaE / deltaT;

    velocities.push({
      name: arr[i].name,
      value: v,
    });
  }

  return velocities;
}

export function calculateImpressionPlot(
  data: EngagementImpression[],
  period: number
): Impression[] {
  if (!data.length) return [];

  // 1. Compute smoothing factor k = 2 / (N + 1)
  const k = 2 / (period + 1);                          // :contentReference[oaicite:10]{index=10}

  // 2. Initialize EMA with the first raw engagement value
  const first = data[0];
  let emaPrev = (first.impression / first.views)      // :contentReference[oaicite:11]{index=11}
    * Math.sqrt(first.volume);

  // 3. Map through data applying EMA
  return data.map((point, index) => {
    const engagement = point.impression * Math.sqrt( point.views);
    const rawValue = engagement * Math.sqrt(point.volume);

    if (index === 0) {
      return { name: point.name, value: emaPrev };
    }

    // EMA formula: rawValue * k + previous EMA * (1 - k)
    emaPrev = rawValue * k + emaPrev * (1 - k);        // :contentReference[oaicite:12]{index=12}
    return { name: point.name, value: (emaPrev/25000)*100 };
  });
}
/**
 * Performs Poisson-based trend detection on engagement impression data
 * @param data Array of engagement impression data points
 * @param eta Sensitivity factor for trend detection (e.g., 2 = quite sensitive, 3 = very strict)
 * @returns Array of normalized trend values between -1 and 1
 */
export function calculatePoissonTrend(
  data: EngagementImpression[],
  eta: number = 2
): { name: string; value: number }[] {
  if (!data.length) return [];

  // Precompute rates and exposures
  const points = data.map(pt => ({
    name: pt.name,
    rate: pt.impression / pt.views,      // engagement rate
    exposure: pt.volume                  // Poisson exposure
  }));

  return points.map((pt, i) => {
    if (i === 0) {
      // First point has no previous comparison
      return { name: pt.name, value: 0 };
    }

    const prev = points[i - 1];
    // Expected counts under previous rate
    const k1 = prev.rate * prev.exposure;
    // Observed (expected) counts under current rate
    const k2 = pt.rate * pt.exposure;

    // Poisson standard deviation = sqrt(mean)
    const std = Math.sqrt(k1);
    // z-score of observed change
    const z = (k2 - k1) / std;

    // Normalize using tanh to bound within [-1, 1]
    let trend = Math.tanh(z / eta);

    // Dampen if below significance threshold |z| < eta
    if (Math.abs(z) < eta) trend *= 0.5;

    return { name: pt.name, value: trend };
  });
}
/*
export function calculateImpressionPlot(data: EngagementImpression[]): Impression[] {
  return data.map((point, index) => {
    let Engagement = (point.impression * Math.sqrt(point.volume)) / point.views
    const averageEng = (point.impression);
    return { name: point.name, value: Engagement };
  });
}*/
export function calculateCumulativeAverage(data: Impression[]): Impression[] {
  let cumulativeSum = 0;
  return data.map((point, index) => {
    cumulativeSum += point.value;
    const average = cumulativeSum / (index + 1);
    return { name: point.name, value: average };
  });
}

/**
 * Calculates the cumulative sum of tweet counts.
 * For each data point, it computes the sum of all tweet counts up to that point.
 */
export function calculateCumulativeSum(data: Impression[]): Impression[] {
  let cumulativeSum = 0;
  return data.map((point) => {
    cumulativeSum += point.value;
    return { name: point.name, value: cumulativeSum };
  });
}


/**
 * Calculates the ratio (as a percentage, capped at 100) of cumulative tweet counts
 * to the cumulative average of tweet views.
 */
export function calculateCumulativeRatioPercentage(
  tweetCounts: Impression[],
  tweetViews: Impression[]
): Impression[] {
  const cumulativeAvgViews = calculateCumulativeAverage(tweetViews);
  const cumulativeTweetCounts = calculateCumulativeSum(tweetCounts);
  const minLength = Math.min(cumulativeAvgViews.length, cumulativeTweetCounts.length);
  const ratioData: Impression[] = [];

  for (let i = 0; i < minLength; i++) {
    const avgViews = cumulativeAvgViews[i].value;
    const totalTweets = cumulativeTweetCounts[i].value;
    // Compute ratio (ensure no division by zero) and convert to percentage.
    let ratio = avgViews !== 0 ? (totalTweets / avgViews) * 100 : 0;
    ratio = Math.min(100, ratio); // Cap at 100%
    ratioData.push({ name: cumulativeAvgViews[i].name, value: ratio });
  }
  return ratioData;
}

export function calculateMovingAverage(data: Impression[], windowSize: number): Impression[] {
  if (data.length === 0) return [];
  
  return data.map((point, index, arr) => {
    // Determine the start index of the window
    const startIndex = Math.max(0, index - windowSize + 1);
    // Get the slice of data within the current window
    const windowSlice = arr.slice(startIndex, index + 1);
    // Calculate the sum of values in the window
    const sum = windowSlice.reduce((acc, item) => acc + item.value, 0);
    // Compute the average for the current window
    const average = sum / windowSlice.length;
    // Return a new Impression with the same timestamp and computed average
    return { name: point.name, value: average };
  });
}

/**
 * Calculate the average current views per tweet overall.
 */
export function calculateAverageViewsPerTweet(impressionData: Impression[], tweetData: Impression[]): number {
  
  const totalImpressions = impressionData.reduce((sum, imp) => {
    const value = Number(imp.value);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);
  const totalTweets = tweetData.reduce((sum, tweet) => sum + tweet.value, 0);
  //console.log("Views Per Tweet",impressionData)
  return totalTweets > 0 ? totalImpressions / impressionData.length : 0;
}

/**
 * Calculate the average views per tweet at each time point.
 * Assumes tweetData and impressionData are aligned by time.
 */
export function calculateAverageViewsPlot(tweetData: Impression[], impressionData: Impression[]): Impression[] {
  const minLength = Math.min(tweetData.length, impressionData.length);
  const result: Impression[] = [];
  for (let i = 0; i < minLength; i++) {
    const tweets = tweetData[i].value;
    const impressions = impressionData[i].value;
    const avgView = tweets > 0 ? impressions / tweets : 0;
    result.push({ name: tweetData[i].name, value: avgView });
  }
  return result;
}

// -------------- Other Existing Helper Functions --------------

export function calculateSentimentMomentum(impressions: Impression[]): number {
  if (impressions.length < 2) return 0;
  let totalPercentChange = 0;
  let count = 0;
  for (let i = 0; i < impressions.length - 1; i++) {
    const previous = impressions[i].value;
    const current = impressions[i + 1].value;
    if (previous === 0) continue;
    const percentChange = ((current - previous) / previous) * 100;
    totalPercentChange += percentChange;
    count++;
  }
  const averagePercentChange = count > 0 ? totalPercentChange / count : 0;
  return Math.min(100, Math.max(0, averagePercentChange));
}/*
export function calculateSentimentTrend(
  data: DetailedImpression[],
  windowSize: number = 5
): DetailedImpression[] {
  if (!data || data.length === 0) return [];
  const trend: DetailedImpression[] = [];
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    // Average over the window (handle boundaries)
    for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
      sum += data[j].value;
      count++;
    }
    trend.push({ time: data[i].time, aggregatedSentiment: sum / count });
  }
  return trend;
}*/


export function calculateSentimentTrend(
  data: DetailedImpression[],
  windowSize: number = 5
): DetailedImpression[] {
  if (!data || data.length === 0) return [];
  
  const trend: DetailedImpression[] = [];
  
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let possum = 0
    let negsum= 0
    let engrt = 0
    let count = 0;
    
    // Average over the window (handle boundaries)
    for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
      sum += data[j].value;
      possum +=data[j].posImpressions;
      negsum +=data[j].negImpressions;
      engrt += data[j].engagementRate
      count++;
    }
    
    const avgSentiment = sum /// count;
    
    // Create a new DetailedImpression object with all required properties
    trend.push({
      name: data[i].name, // name represents the time
      value: avgSentiment, // Use the calculated average as the new value
      posImpressions: possum,//data[i].posImpressions,
      negImpressions: negsum,//data[i].negImpressions,
      engagementRate: engrt//data[i].engagementRate
    });
  }
  
  return trend;
}
/**
 * Calculate a trend data series for tweet growth.
 * For each adjacent pair of tweet records, compute the growth rate (tweet difference divided by time gap in minutes).
 * Optionally, apply a moving average to smooth the curve.
 */
/**
 * Calculate a tweet frequency trend over time.
 * For each tweet timestamp, count the total tweet occurrences in the previous `windowMinutes`.
 * Optionally, a moving average (smoothWindow) is applied to smooth the curve.
 */
/**
 * Calculate a tweet frequency trend as a percentage over time.
 * For each tweet record, count the number of tweets in the previous `windowMinutes`.
 * Then apply a moving average (smoothWindow) and normalize the result against a total tweets threshold.
 *
 * @param data - Array of tweet counts with timestamps.
 * @param windowMinutes - The time window (in minutes) over which to sum tweets.
 * @param smoothWindow - Number of points to use for smoothing the trend.
 * @param totalTweetsThreshold - The tweet count threshold considered as maximum hype (100%).
 * @returns An array of objects with the timestamp and normalized tweet frequency percentage.
 
*/

export function calculateTweetFrequencyTrendPercentage(
  data: Impression[],
  windowMinutes: number = 5,
  smoothWindow: number = 3,
  totalTweetsThreshold: number = 20
): Impression[] {
  if (data.length === 0) return [];

  // Sort data by timestamp ascending.
  const sortedData = [...data].sort(
    (a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()
  );

  // Compute raw frequency values using a sliding window.
  const rawTrend: Impression[] = sortedData.map((point, index) => {
    
    const currentTime = new Date(point.name).getTime();
    const windowStart = currentTime - windowMinutes * 60000;

    // Sum tweet counts within the window.
    let frequency = 0;
    for (let i = index; i >= 0; i--) {
      const time = new Date(sortedData[i].name).getTime();
      if (time >= windowStart) {
        frequency += sortedData[i].value;
      } else {
        break;
      }
    }

    return { name: point.name, value: frequency };
  });

  // Apply a simple moving average to smooth the raw frequency data.
  function movingAverage(values: Impression[], windowSize: number): Impression[] {
    return values.map((point, i, arr) => {
      const start = Math.max(0, i - windowSize + 1);
      const windowSlice = arr.slice(start, i + 1);
      const avg = windowSlice.reduce((sum, p) => sum + p.value, 0) / windowSlice.length;
      return { name: point.name, value: avg };
    });
  }

  const smoothedTrend = movingAverage(rawTrend, smoothWindow);

  // Normalize each smoothed frequency value to a percentage.
  // The maximum expected tweets in the window is defined by totalTweetsThreshold.
  const normalizedTrend = smoothedTrend.map(point => ({
    name: point.name,
    value: Math.min((point.value / totalTweetsThreshold) * 100, 100)
  }));

  return normalizedTrend;
}
export function calculateSentimentVolatility(impressions: Impression[]): number {
  if (impressions.length < 2) return 0;
  const maxImpression = Math.max(...impressions.map(imp => imp.value));
  const weightedChanges: number[] = [];
  for (let i = 1; i < impressions.length; i++) {
    const previous = impressions[i - 1].value;
    const current = impressions[i].value;
    if (previous === 0) continue;
    const percentageChange = ((current - previous) / previous) * 100;
    const weight = maxImpression > 0 ? current / maxImpression : 1;
    const weightedChange = percentageChange * weight;
    weightedChanges.push(weightedChange);
  }
  const averageChange = weightedChanges.reduce((sum, val) => sum + val, 0) / weightedChanges.length;
  const variance = weightedChanges.reduce((sum, val) => sum + Math.pow(val - averageChange, 2), 0) / weightedChanges.length;
  const volatility = Math.sqrt(variance);
  return Math.min(100, Math.max(0, volatility));
}

export function calculateSentimentWeightedMetrics(impressions: Impression[], engagements: Impression[]): number {
  if (impressions.length !== engagements.length || impressions.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < impressions.length; i++) {
    weightedSum += impressions[i].value * engagements[i].value;
    totalWeight += engagements[i].value;
  }
  return totalWeight !== 0 ? weightedSum / totalWeight : 0;
}

export function detectSentimentPeaks(impressions: Impression[]): Impression[] {
  if (impressions.length < 3) return [];
  const peaks = [];
  for (let i = 1; i < impressions.length - 1; i++) {
    if (impressions[i].value > impressions[i - 1].value && impressions[i].value > impressions[i + 1].value) {
      peaks.push(impressions[i]);
    }
  }
  return peaks;
}

export function calculateSentimentScore(
  tweetFrequencyTrend: number, // expected as percentage (0-100)
  sentimentTrend: number,      // expected as percentage (0-100)
  views: number ,               // raw view count
  numberTweet: number
): number {
  ////console.log(" tweetFrequencyTrend ",tweetFrequencyTrend,sentimentTrend,views,numberTweet)
  // Normalize tweet frequency and sentiment trend to a maximum of 100.
  const normalizedTweetFrequency = Math.min(tweetFrequencyTrend, 100);
  const normalizedSentimentTrend = sentimentTrend*20 >= 100 ? 100 : sentimentTrend*20;//Math.min(sentimentTrend*10, 100);
  
  // Normalize views: if views >= 1000, treat as 100; otherwise, scale linearly.
  const normalizedViews = views >= 1000 ? 100 : (views / 1000) * 100;
  const normalizedTweetsNum = numberTweet >= 500 ? 100 : (numberTweet / 500) * 100;
  
  // Define weights for each metric (adjust these as needed)
  const weightTweetFrequency = 0.35;
  const weightSentimentTrend = 0.15;
  const weightViews = 0.25;
  const tweetWeigh = 0.25;
  
  const sentimentScore =
    normalizedTweetFrequency * weightTweetFrequency +
    normalizedSentimentTrend * weightSentimentTrend +
    normalizedViews * weightViews +
    normalizedTweetsNum * tweetWeigh;
    
  // Ensure the final score does not exceed 100.
  return Math.min(sentimentScore, 100);
}

  
export function calculateAveragePercentage(impressions: Impression[]): number {
  if (impressions.length < 2) return 0;
  const percentageDifferences: number[] = [];
  for (let i = 0; i < impressions.length - 1; i++) {
    const currentValue = impressions[i].value;
    const nextValue = impressions[i + 1].value;
    const percentageDiff = ((nextValue - currentValue) / currentValue) * 100;
    percentageDifferences.push(percentageDiff);
  }
  const total = percentageDifferences.reduce((sum, diff) => sum + diff, 0);
  return total / percentageDifferences.length;
}

export function calculateSentimentMomentumPlot(impressions: Impression[]): Impression[] {
  if (impressions.length < 2) {
    return impressions.map(impression => ({ name: impression.name, value: 0 }));
  }
  const maxImpression = Math.max(...impressions.map(imp => imp.value));
  const plot: Impression[] = [];
  let cumulativeMomentum = 0;
  plot.push({ name: impressions[0].name, value: 0 });
  for (let i = 1; i < impressions.length; i++) {
    const previous = impressions[i - 1].value;
    const current = impressions[i].value;
    let percentageChange = 0;
    if (previous !== 0) {
      percentageChange = ((current - previous) / previous) * 100;
    }
    const weight = maxImpression > 0 ? current / maxImpression : 1;
    const weightedChange = percentageChange * weight;
    cumulativeMomentum += weightedChange;
    plot.push({ name: impressions[i].name, value: cumulativeMomentum });
  }
  return plot;
}
  
export function calculateCumulativePercentage(impressions: Impression[]): Impression[] {
  if (impressions.length === 0) return [];
  
  const initialValue = impressions[0].value;
  return impressions.map((imp, index) => ({
    name: imp.name,
    value: index === 0 ? 0 : (imp.value - initialValue) / initialValue
  }));
}
export function calculateImpressionPercentage(impressions: Impression[], windowSize: number = 3): Impression[] {
  if (impressions.length === 0) return [];

  const percentageChanges: number[] = impressions.map((imp, index) => {
    if (index === 0) return 0;
    const prevValue = impressions[index - 1].value;
    return prevValue === 0 ? 0 : ((imp.value - prevValue) / prevValue)*100;
  });

  const smoothedChanges: number[] = percentageChanges.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = percentageChanges.slice(start, index + 1);
    const average = window.reduce((sum, val) => sum + val, 0) / window.length;
    return average;
  });

  return impressions.map((imp, index) => ({
    name: imp.name,
    value: smoothedChanges[index],
  }));
}

export function categorizeTweetsByIntervalC(data: CompImpression[], minute: number): CompImpression[] {
  // Helper function to round a date down to the nearest interval (in minutes)
  function roundToNearestMinutes(date: Date): Date {
    const msInMinutes = minute * 60 * 1000;
    return new Date(Math.floor(date.getTime() / msInMinutes) * msInMinutes);
  }
  // Use an object map to group tweets by their rounded date interval.
  const intervalMap: Record<string, { value: number; preval: number }> = {};

  data.forEach(({ name, value, preval }) => {
    const date = new Date(name);
    const roundedDate = roundToNearestMinutes(date);
    
    // Format the rounded date to an ISO-like string including milliseconds.
    const year = roundedDate.getUTCFullYear();
    const month = String(roundedDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(roundedDate.getUTCDate()).padStart(2, '0');
    const hours = String(roundedDate.getUTCHours()).padStart(2, '0');
    const minutes = String(roundedDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(roundedDate.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(roundedDate.getUTCMilliseconds()).padStart(3, '0');
    const intervalKey = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
    if (!intervalMap[intervalKey]) {
      intervalMap[intervalKey] = { value: 0, preval: 0 };
    }
    
    // Add the current tweet's values into the correct interval.
    intervalMap[intervalKey].value += value;
    intervalMap[intervalKey].preval += preval;
  });

  // Convert the grouped intervals into an array of CompImpression objects.
  const aggregatedData: CompImpression[] = Object.entries(intervalMap).map(
    ([name, { value, preval }]) => ({ name, value, preval })
  );
  
  // Sort the results in chronological order.
  aggregatedData.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  
  return aggregatedData;
}
export function categorizeTweetsByInterval(data: Impression[], minute: number): Impression[] {
  function roundToNearestMinutes(date: Date): Date {
    const msInMinutes = minute * 60 * 1000;
    return new Date(Math.floor(date.getTime() / msInMinutes) * msInMinutes);
  }
  
  const intervalMap: Record<string, number> = {};
  
  data.forEach(({ name, value }) => {
    const date = new Date(name);
    const roundedDate = roundToNearestMinutes(date);
   
    // Use UTC methods instead of local time methods
    const year = roundedDate.getUTCFullYear();
    const month = String(roundedDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(roundedDate.getUTCDate()).padStart(2, '0');
    const hours = String(roundedDate.getUTCHours()).padStart(2, '0');
    const minutes = String(roundedDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(roundedDate.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(roundedDate.getUTCMilliseconds()).padStart(3, '0');
    
    // Add 'Z' suffix to indicate UTC timezone
    const intervalKey = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
    //console.log("TIme",name,"new Date",date,"roundedDate",roundedDate,"intervalKey",intervalKey);
    if (!intervalMap[intervalKey]) {
      intervalMap[intervalKey] = 0;
    }
    intervalMap[intervalKey] += value;
  });
  
  const aggregatedData: Impression[] = Object.entries(intervalMap).map(
    ([name, value]) => ({ name, value })
  );
  
  aggregatedData.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  
  return aggregatedData;
}
export const groupTweetsWithAddressByInterval = (
  data: { timestamp: string; views: number }[],
  intervalMinutes: number
): { count: Impression[]; views: CompImpression[] } => {
  const intervalMapCount: Record<string, number> = {};
  const intervalMapViews: Record<string, number> = {};

  data.forEach((item) => {
    const time = new Date(item.timestamp);
    const msInInterval = intervalMinutes * 60 * 1000;
    const roundedTime = new Date(Math.floor(time.getTime() / msInInterval) * msInInterval);
    const key = roundedTime.toISOString();

    if (!intervalMapCount[key]) {
      intervalMapCount[key] = 0;
      intervalMapViews[key] = 0;
    }
    intervalMapCount[key] += 1;
    intervalMapViews[key] += item.views;
  });

  // Build count array as before.
  const countArray: Impression[] = Object.entries(intervalMapCount).map(
    ([name, value]) => ({ name, value })
  );

  // Build views array where each entry is a CompImpression.
  // Here, "value" contains the aggregated views, and "preval" carries the tweet count.
  const viewsArray: CompImpression[] = Object.entries(intervalMapViews).map(
    ([name, aggregatedViews]) => ({
      name,
      value: aggregatedViews,
      preval: intervalMapCount[name]
    })
  );

  // Sort both arrays in chronological order.
  countArray.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  viewsArray.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

  return { count: countArray, views: viewsArray };
};
export const parseViewsCount = (views: string): number => {
  
  if (views.endsWith('K')) {
    return parseFloat(views) * 1000; // Convert "2K" to 2000
  } else if (views.endsWith('M')) {
    return parseFloat(views) * 1000000; // Convert "1M" to 1000000
  } else if (views.endsWith('k')) {
    return parseFloat(views) * 1000; // Convert "2K" to 2000
  } else if (views.endsWith('m')) {
    return parseFloat(views) * 1000000; // Convert "1M" to 1000000
  }
  return parseFloat(views); // For plain numbers
};
export function parseISOLocal(s: string) {
  const [year, month, day, hour, minute, second] = s.split(/\D/).map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

// Helper: group raw Impression data into dynamic-minute intervals
export function categorizeByInterval(
  data: Impression[],
  minutes: number
): Impression[] {
  const ms = minutes * 60_000;
  const map: Record<string, number> = {};

  // 1) Bucket into intervals
  data.forEach(({ name, value }) => {
    const ts = new Date(name).getTime();
    const bucketTs = Math.floor(ts / ms) * ms;
    const d = new Date(bucketTs);

    // Build a local-time ISO-style string: YYYY-MM-DDThh:mm:ss
    const localIso = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-')
      + 'T'
      + [
        String(d.getHours()).padStart(2, '0'),
        String(d.getMinutes()).padStart(2, '0'),
        String(d.getSeconds()).padStart(2, '0'),
      ].join(':');

    map[localIso] = (map[localIso] || 0) + value;
  });

  // 2) Turn the map into a sorted array
  const grouped = Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort(
      (a, b) =>
        new Date(a.name).getTime() - new Date(b.name).getTime()
    );
  console.log('Grouped Data', grouped);

  // 3) Apply a 5-point (±2) rolling mean smoothing
  return grouped.map((point, idx, arr) => {
    const window = arr.slice(Math.max(0, idx - 2), idx + 3);
    const avg =
      window.reduce((sum, p) => sum + p.value, 0) / window.length;
    return { name: point.name, value: avg };
  });
}


// Group Engagement data into interval buckets

export function categorizeEngagementByInterval(
  data: Engagement[],
  minutes: number
): Engagement[] {
  const ms = minutes * 60_000;
  const map: Record<string, Engagement> = {};

  data.forEach(d => {
    const ts = new Date(d.timestamp).getTime();
    const ts_ = new Date(d.post_time).getTime();
    const bucketTs = Math.floor(ts / ms) * ms;
    const b = new Date(bucketTs);
    const bucketTs_ = Math.floor(ts_ / ms) * ms;
    const b_ = new Date(bucketTs_);
    // Build a local-time ISO-style string: YYYY-MM-DDThh:mm:ss
    const localIso = [
      b.getFullYear(),
      String(b.getMonth() + 1).padStart(2, '0'),
      String(b.getDate()).padStart(2, '0'),
    ].join('-')
      + 'T'
      + [
        String(b.getHours()).padStart(2, '0'),
        String(b.getMinutes()).padStart(2, '0'),
        String(b.getSeconds()).padStart(2, '0'),
      ].join(':');

      const localIso_ = [
        b_.getFullYear(),
        String(b_.getMonth() + 1).padStart(2, '0'),
        String(b_.getDate()).padStart(2, '0'),
      ].join('-')
        + 'T'
        + [
          String(b_.getHours()).padStart(2, '0'),
          String(b_.getMinutes()).padStart(2, '0'),
          String(b_.getSeconds()).padStart(2, '0'),
        ].join(':');

    if (!map[localIso]) {
      map[localIso] = {
        timestamp: localIso,
        impressions: 0,
        likes: 0,
        retweets: 0,
        comments: 0,
        followers: d.followers,
        count: d.count,
        post_time:localIso_,
        tweet:""
      };
    }

    const bucket = map[localIso];
    bucket.impressions += d.impressions;
    bucket.likes       += d.likes;
    bucket.retweets    += d.retweets;
    bucket.comments    += d.comments;
    // overwrite followers so it's always the most recent in that bucket
    bucket.followers    = d.followers;
    bucket.count       += d.count;
  });

  return Object.values(map)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
}

// Calculate weighted engagement growth across all buckets
export function calculateEngagementGrowth(data: Engagement[]/*, intervalMinutes: number, maxPerMin: number = 500*/): number {
  if (data.length === 0) return 0;

  const weights = { impressions: 0.1, likes: 0.3, retweets: 0.4, comments: 0.2 };

  // compute normalized score per bucket
  const scores = data.map(d => {
    const sum =
      d.impressions * weights.impressions +
      d.likes * weights.likes +
      d.retweets * weights.retweets +
      d.comments * weights.comments;
    return d.followers > 0 ? sum / d.followers : sum;
  });

  // growth relative to first bucket
  const first = scores[0];
  const last = scores[scores.length - 1];
  const rawGrowth = first > 0 ? ((last - first) / first) * 100 : 0;
  return rawGrowth;
}

// Prepare time-series of engagement rate per bucket
export function engagementRateSeries(data: Engagement[]): Impression[] {
  return data.map(d => {
    const score =
      ((d.impressions * 0.1 + d.likes * 0.3 + d.retweets * 0.4 + d.comments * 0.2) /
      (d.followers > 0 ? d.followers : 1));
    return { name: d.timestamp, value: score };
  });
}
/*
const preprocessText = (text:string) => {
  const phrases = [
    { phrase: "doesn't look", token: "doesn\'t_look" },
    { phrase: "not safe", token: "not_safe" },
    { phrase: "poor quality", token: "poor_quality" },
    { phrase: "high risk", token: "high_risk" },
    { phrase: "low confidence", token: "low_confidence" },
    // add additional phrases as needed
  ];
  let processedText = text;
  phrases.forEach(({ phrase, token }) => {
    const regex = new RegExp(phrase, "gi");
    processedText = processedText.replace(regex, token);
  });
  return processedText;
};

  export const computeSentimentTimeSeries = (tweetData: TweetEntry[]) => {
    const sentimentByTime: { [time: string]: { totalSentiment: number, weight: number } } = {};
    tweetData.forEach((entry) => {
      const text = entry.tweet;
      if (!text) return;
      
      const processedText = preprocessText(text);
      const result = vader.SentimentIntensityAnalyzer.polarity_scores(processedText);
      //console.log("Sentiment Text",processedText,result)
      // Custom rule for "Rug probability:"
      const rugMatch = processedText.match(/Rug probability:\s*(\d+)%/i);
      if (rugMatch) {
        const prob = parseFloat(rugMatch[1]);
        if (prob > 40) {
          result.compound = -5;
        }
      }
      
      let weight = 1;
      if (entry.params?.views && entry.params.views.length > 0) {
        weight = parseFloat(entry.params.views[0]) || 1;
      }
      // Group by minute using post_time
      const timestamp = entry.post_time;
      const timeKey = new Date(timestamp).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
      if (!sentimentByTime[timeKey]) {
        sentimentByTime[timeKey] = { totalSentiment: 0, weight: 0 };
      }
      sentimentByTime[timeKey].totalSentiment += result.compound * weight;
      sentimentByTime[timeKey].weight += weight;
    });
    const timeSeries = Object.entries(sentimentByTime).map(([time, obj]) => ({
      time,
      aggregatedSentiment: obj.weight > 0 ? obj.totalSentiment / obj.weight : 0,
    }));
    // Sort time series by time
    timeSeries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    //console.log("timeSeries", timeSeries);
    return (timeSeries);
  };*/

  const preprocessText = (text: string) => {
    // Enhanced fear-related phrases for memecoins
    const phrases = [
      // Existing phrases
      { phrase: "doesn't look", token: "doesn\'t_look" },
      { phrase: "not safe", token: "not_safe" },
      { phrase: "poor quality", token: "poor_quality" },
      { phrase: "high risk", token: "high_risk" },
      { phrase: "low confidence", token: "low_confidence" },
      
      // Enhanced fear-related phrases
      { phrase: "rug pull", token: "rug_pull" },
      { phrase: "rugpull", token: "rug_pull" },
      { phrase: "getting rugged", token: "getting_rugged" },
      { phrase: "about to rug", token: "about_to_rug" },
      { phrase: "looks like a rug", token: "looks_like_rug" },
      { phrase: "smells like a rug", token: "smells_like_rug" },
      { phrase: "exit scam", token: "exit_scam" },
      { phrase: "honey pot", token: "honey_pot" },
      { phrase: "honeypot", token: "honey_pot" },
      { phrase: "can't sell", token: "cant_sell" },
      { phrase: "cannot sell", token: "cant_sell" },
      { phrase: "unable to sell", token: "cant_sell" },
      { phrase: "liquidity locked", token: "liquidity_locked" },
      { phrase: "no liquidity", token: "no_liquidity" },
      { phrase: "low liquidity", token: "low_liquidity" },
      { phrase: "dev dumped", token: "dev_dumped" },
      { phrase: "dev dumping", token: "dev_dumping" },
      { phrase: "dev sold", token: "dev_sold" },
      { phrase: "team dumped", token: "team_dumped" },
      { phrase: "team dumping", token: "team_dumping" },
      { phrase: "going to zero", token: "going_to_zero" },
      { phrase: "heading to zero", token: "going_to_zero" },
      { phrase: "dead coin", token: "dead_coin" },
      { phrase: "worthless", token: "worthless" },
      { phrase: "total scam", token: "total_scam" },
      { phrase: "obvious scam", token: "obvious_scam" },
      { phrase: "clear scam", token: "clear_scam" },
      { phrase: "avoid at all costs", token: "avoid_completely" },
      { phrase: "stay away", token: "stay_away" },
      { phrase: "don't buy", token: "dont_buy" },
      { phrase: "do not buy", token: "dont_buy" },
      { phrase: "don't invest", token: "dont_invest" },
      { phrase: "do not invest", token: "dont_invest" },
      { phrase: "red flags", token: "red_flags" },
      { phrase: "major red flag", token: "major_red_flag" },
      { phrase: "warning signs", token: "warning_signs" },
      { phrase: "suspicious activity", token: "suspicious_activity" },
      { phrase: "whale dumping", token: "whale_dumping" },
      { phrase: "massive dump", token: "massive_dump" },
      { phrase: "panic selling", token: "panic_selling" },
      { phrase: "mass exodus", token: "mass_exodus" },
      { phrase: "everyone selling", token: "everyone_selling" },
      { phrase: "holders fleeing", token: "holders_fleeing" },
      { phrase: "dump incoming", token: "dump_incoming" },
      { phrase: "about to crash", token: "about_to_crash" },
      { phrase: "crashing hard", token: "crashing_hard" },
      { phrase: "free fall", token: "free_fall" },
      { phrase: "freefall", token: "free_fall" },
      { phrase: "bleeding out", token: "bleeding_out" },
      { phrase: "bag holder", token: "bag_holder" },
      { phrase: "bagholder", token: "bag_holder" },
      { phrase: "holding bags", token: "holding_bags" },
      { phrase: "heavy bags", token: "heavy_bags" },
      { phrase: "trapped holders", token: "trapped_holders" },
      { phrase: "rekt", token: "rekt" },
      { phrase: "getting rekt", token: "getting_rekt" },
      { phrase: "totally rekt", token: "totally_rekt" },
      { phrase: "lost everything", token: "lost_everything" },
      { phrase: "life savings gone", token: "life_savings_gone" },
      { phrase: "down 90%", token: "down_ninety_percent" },
      { phrase: "down 95%", token: "down_ninetyfive_percent" },
      { phrase: "down 99%", token: "down_ninetynine_percent" },
      { phrase: "never recover", token: "never_recover" },
      { phrase: "won't recover", token: "wont_recover" },
      { phrase: "no recovery", token: "no_recovery" },
      { phrase: "hopeless", token: "hopeless" },
      { phrase: "disaster", token: "disaster" },
      { phrase: "nightmare", token: "nightmare" },
      { phrase: "catastrophe", token: "catastrophe" },
      { phrase: "bloodbath", token: "bloodbath" },
      { phrase: "massacre", token: "massacre" },
      { phrase: "slaughter", token: "slaughter" },
      { phrase: "zero utility", token: "zero_utility" },
      { phrase: "no utility", token: "no_utility" },
      { phrase: "useless token", token: "useless_token" },
      { phrase: "pump and dump", token: "pump_and_dump" },
      { phrase: "p&d", token: "pump_and_dump" },
      { phrase: "coordinated dump", token: "coordinated_dump" },
      { phrase: "fake project", token: "fake_project" },
      { phrase: "ghost team", token: "ghost_team" },
      { phrase: "anonymous team", token: "anonymous_team" },
      { phrase: "doxxed yet", token: "doxxed_yet" },
      { phrase: "not doxxed", token: "not_doxxed" },
      { phrase: "sketchy", token: "sketchy" },
      { phrase: "shady", token: "shady" },
      { phrase: "fishy", token: "fishy" },
      { phrase: "sus", token: "sus" },
      { phrase: "suspicious", token: "suspicious" },
      { phrase: "too good to be true", token: "too_good_true" },
      { phrase: "unrealistic gains", token: "unrealistic_gains" },
      { phrase: "unrealistic returns", token: "unrealistic_returns" },
      { phrase: "ponzi", token: "ponzi" },
      { phrase: "pyramid scheme", token: "pyramid_scheme" },
      { phrase: "mlm", token: "mlm" },
      { phrase: "multi level marketing", token: "mlm" },
      { phrase: "get rich quick", token: "get_rich_quick" },
      { phrase: "guaranteed returns", token: "guaranteed_returns" },
      { phrase: "no risk", token: "no_risk" },
      { phrase: "risk free", token: "risk_free" },
      { phrase: "100% safe", token: "hundred_percent_safe" },
      { phrase: "can't lose", token: "cant_lose" },
      { phrase: "cannot lose", token: "cant_lose" },
      { phrase: "fomo", token: "fomo" },
      { phrase: "fear of missing out", token: "fomo" },
      { phrase: "buy now or never", token: "buy_now_never" },
      { phrase: "last chance", token: "last_chance" },
      { phrase: "limited time", token: "limited_time" },
      { phrase: "act fast", token: "act_fast" },
      { phrase: "urgent", token: "urgent" },
      { phrase: "hurry", token: "hurry" },
      { phrase: "don't wait", token: "dont_wait" },
      { phrase: "do not wait", token: "dont_wait" },
      { phrase: "sell immediately", token: "sell_immediately" },
      { phrase: "sell now", token: "sell_now" },
      { phrase: "get out now", token: "get_out_now" },
      { phrase: "exit now", token: "exit_now" },
      { phrase: "cut losses", token: "cut_losses" },
      { phrase: "stop loss", token: "stop_loss" },
      { phrase: "damage control", token: "damage_control" },
      { phrase: "minimize losses", token: "minimize_losses" },
      { phrase: "salvage what you can", token: "salvage_what_can" },
      
      // New bundling and insider trading fears
      { phrase: "heavily bundled", token: "heavily_bundled" },
      { phrase: "bundled tokens", token: "bundled_tokens" },
      { phrase: "tokens bundled", token: "tokens_bundled" },
      { phrase: "bundle detected", token: "bundle_detected" },
      { phrase: "bundling detected", token: "bundling_detected" },
      { phrase: "insider trading", token: "insider_trading" },
      { phrase: "insider allocation", token: "insider_allocation" },
      { phrase: "insider distribution", token: "insider_distribution" },
      { phrase: "take note", token: "take_note" },
      { phrase: "be careful", token: "be_careful" },
      { phrase: "be cautious", token: "be_cautious" },
      { phrase: "stay cautious", token: "stay_cautious" },
      { phrase: "monitor closely", token: "monitor_closely" },
      { phrase: "monitor for", token: "monitor_for" },
      { phrase: "watch out", token: "watch_out" },
      { phrase: "watch for", token: "watch_for" },
      { phrase: "beware", token: "beware" },
      { phrase: "warning", token: "warning" },
      { phrase: "alert", token: "alert" },
      { phrase: "caution", token: "caution" },
      { phrase: "high risk", token: "high_risk" },
      { phrase: "safety: 0", token: "safety_zero" },
      { phrase: "safety 0", token: "safety_zero" },
      { phrase: "safety score 0", token: "safety_zero" },
      { phrase: "safety score: 0", token: "safety_zero" },
      { phrase: "low safety", token: "low_safety" },
      { phrase: "unsafe", token: "unsafe" },
      { phrase: "dangerous", token: "dangerous" },
      { phrase: "risky", token: "risky" },
      { phrase: "exit liquidity", token: "exit_liquidity" },
      { phrase: "become exit liquidity", token: "become_exit_liquidity" },
      { phrase: "you are exit liquidity", token: "you_are_exit_liquidity" },
      { phrase: "providing exit liquidity", token: "providing_exit_liquidity" },
      { phrase: "shitty meme coin", token: "shitty_meme_coin" },
      { phrase: "shitcoin", token: "shitcoin" },
      { phrase: "shit coin", token: "shitcoin" },
      { phrase: "zero value accrual", token: "zero_value_accrual" },
      { phrase: "no value accrual", token: "no_value_accrual" },
      { phrase: "psyop", token: "psyop" },
      { phrase: "psychological operation", token: "psyop" },
      { phrase: "manipulation", token: "manipulation" },
      { phrase: "market manipulation", token: "market_manipulation" },
      { phrase: "price manipulation", token: "price_manipulation" },
      { phrase: "sniper wallets", token: "sniper_wallets" },
      { phrase: "sniping", token: "sniping" },
      { phrase: "sniper bots", token: "sniper_bots" },
      { phrase: "bot activity", token: "bot_activity" },
      { phrase: "suspicious wallets", token: "suspicious_wallets" },
      { phrase: "new wallets", token: "new_wallets" },
      { phrase: "fresh wallets", token: "fresh_wallets" },
      { phrase: "coordinated wallets", token: "coordinated_wallets" },
      { phrase: "whale concentration", token: "whale_concentration" },
      { phrase: "concentrated holdings", token: "concentrated_holdings" },
      { phrase: "top holder concentration", token: "top_holder_concentration" },
      { phrase: "distribution concerns", token: "distribution_concerns" },
      { phrase: "poor distribution", token: "poor_distribution" },
      { phrase: "unfair distribution", token: "unfair_distribution" },
      { phrase: "uneven distribution", token: "uneven_distribution" },
      { phrase: "low lp providers", token: "low_lp_providers" },
      { phrase: "low liquidity providers", token: "low_lp_providers" },
      { phrase: "few lp providers", token: "few_lp_providers" },
      { phrase: "insufficient liquidity", token: "insufficient_liquidity" },
      { phrase: "thin liquidity", token: "thin_liquidity" },
      { phrase: "illiquid", token: "illiquid" },
      { phrase: "liquidity risk", token: "liquidity_risk" },
      { phrase: "liquidity concerns", token: "liquidity_concerns" },
      { phrase: "kol promoting", token: "kol_promoting" },
      { phrase: "kols promoting", token: "kols_promoting" },
      { phrase: "influencer promoting", token: "influencer_promoting" },
  
      { phrase: "sponsored content", token: "sponsored_content" },
      { phrase: "shill", token: "shill" },
      { phrase: "shilling", token: "shilling" },
      { phrase: "being shilled", token: "being_shilled" },
      { phrase: "coordinated shilling", token: "coordinated_shilling" },
      { phrase: "artificial hype", token: "artificial_hype" },
      { phrase: "fake hype", token: "fake_hype" },
      { phrase: "manufactured hype", token: "manufactured_hype" },
      { phrase: "pump group", token: "pump_group" },
      { phrase: "pump channel", token: "pump_channel" },
      { phrase: "coordinated pump", token: "coordinated_pump" },
      { phrase: "artificial pump", token: "artificial_pump" },
      { phrase: "fake pump", token: "fake_pump" },
      { phrase: "pre-pump", token: "pre_pump" },
      { phrase: "post-pump", token: "post_pump" },
      { phrase: "pump incoming", token: "pump_incoming" },
      { phrase: "about to dump", token: "about_to_dump" },
      { phrase: "dump alert", token: "dump_alert" },
      { phrase: "dump warning", token: "dump_warning" },
      { phrase: "red flag", token: "red_flag" },
      { phrase: "major red flag", token: "major_red_flag" },
      { phrase: "multiple red flags", token: "multiple_red_flags" },
      { phrase: "concerning", token: "concerning" },
      { phrase: "concerns", token: "concerns" },
      { phrase: "worrying", token: "worrying" },
      { phrase: "worried", token: "worried" },
      { phrase: "troubling", token: "troubling" },
      { phrase: "problematic", token: "problematic" },
      { phrase: "issues", token: "issues" },
      { phrase: "problems", token: "problems" },
      { phrase: "flags", token: "flags" },
      { phrase: "warning signs", token: "warning_signs" },
      { phrase: "danger signs", token: "danger_signs" },

      // Bullish & Hype Phrases
    { phrase: "to the moon", token: "to_the_moon" },
    { phrase: "sending it", token: "sending_it" },
    { phrase: "send it", token: "sending_it" },
    { phrase: "LFG", token: "lfg_hype" }, // Let's F***ing Go
    { phrase: "wen lambo", token: "wen_lambo" },
    { phrase: "diamond hands", token: "diamond_hands" },
    { phrase: "ATH soon", token: "ath_soon" }, // All-Time High
    { phrase: "new ATH", token: "new_ath" },
    { phrase: "face melting", token: "face_melting" },
    { phrase: "face melter", token: "face_melting" },
    { phrase: "will fly", token: "will_fly" },
    { phrase: "about to fly", token: "will_fly" },
    { phrase: "gonna fly", token: "will_fly" },
    { phrase: "going to fly", token: "will_fly" },
    { phrase: "parabolic", token: "parabolic_move" },
    { phrase: "10x", token: "ten_x_gain" },
    { phrase: "100x", token: "hundred_x_gain" },
    { phrase: "1000x", token: "thousand_x_gain" },
    { phrase: "easy 10x", token: "easy_ten_x" },
    { phrase: "easy 100x", token: "easy_hundred_x" },
    { phrase: "top call", token: "top_call" },
    { phrase: "gem", token: "gem_token" },
    { phrase: "hidden gem", token: "hidden_gem" },
    { phrase: "eating good", token: "eating_good" }, // From your sample data
    { phrase: "smart money", token: "smart_money" },
    { phrase: "smart traders", token: "smart_traders" }, // From your sample data
    { phrase: "early entry", token: "early_entry" },
    { phrase: "get in early", token: "early_entry" },
    { phrase: "alpha", token: "alpha_call" },
    { phrase: "next big thing", token: "next_big_thing" },
    { phrase: "life changing", token: "life_changing" },
    { phrase: "rocket", token: "rocket_emoji" },
    { phrase: "fire", token: "fire_emoji" },
    { phrase: "money bags", token: "money_bags_emoji" }
    ];
  
    let processedText = text.toLowerCase();
    
    // Apply phrase replacements
    phrases.forEach(({ phrase, token }) => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
      processedText = processedText.replace(regex, token);
    });
    
    return processedText;
  };
  const detectHypeIntensity = (text: string): number => {
    const hypeIndicators = {
        // Phrases that indicate extreme, almost certain positive sentiment in this context
        extreme: [
            'hundred_x_gain', 'thousand_x_gain', 'face_melting', 'easy_hundred_x',
            'life_changing', 'parabolic_move', 'top_call', 'alpha_call'
        ],
        // Strong hype indicators
        high: [
            'to_the_moon', 'sending_it', 'lfg_hype', 'new_ath', 'ath_soon', 
            'ten_x_gain', 'easy_ten_x', 'hidden_gem', 'eating_good', 'smart_money',
            'smart_traders' // this implies authority
        ],
        // Standard hype indicators
        medium: [
            'diamond_hands', 'will_fly', 'early_entry', 'next_big_thing', 'gem_token',
            'rocket_emoji', 'fire_emoji' // You'd need to pre-process emojis to text
        ]
    };

    let hypeMultiplier = 1.0;
    let hypeCount = 0;

    hypeIndicators.extreme.forEach(indicator => {
        if (text.includes(indicator)) {
            hypeMultiplier *= 3.0;
            hypeCount++;
        }
    });
    
    hypeIndicators.high.forEach(indicator => {
        if (text.includes(indicator)) {
            hypeMultiplier *= 2.0;
            hypeCount++;
        }
    });

    hypeIndicators.medium.forEach(indicator => {
        if (text.includes(indicator)) {
            hypeMultiplier *= 1.5;
            hypeCount++;
        }
    });

    if (hypeCount > 1) {
      hypeMultiplier *= (1 + (hypeCount - 1) * 0.3);
    }
    
    return Math.min(hypeMultiplier, 10.0); // Cap multiplier
};

// Also, create a hype-focused percentage detector
const detectPercentageHype = (text: string): number => {
    // Looks for patterns like "+1021.3%" or "pump 10.7x"
    const gainPatterns = [
        /\+\$(\d{1,3}(?:,\d{3})*|\d+)\.?\d*K?\s*\(\+?(\d+\.?\d*)%\)/gi, // e.g., +$23.2K(+30.83%)
        /(\d+\.?\d*)\s*x\s*(?:pump|gain|profit)/gi, // e.g., 10.7x pump
        /pump\s*\w*\s*(\d+\.?\d*)\s*x/gi, // e.g., pump from my call on 10.7x
    ];

    let maxHypeScore = 0;
    
    gainPatterns.forEach(pattern => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            // Extract the percentage or multiplier
            const gain = parseFloat(match[2] || match[1]);
            if (gain > 1000) maxHypeScore = Math.max(maxHypeScore, 5.0);
            else if (gain > 500) maxHypeScore = Math.max(maxHypeScore, 4.0);
            else if (gain > 100) maxHypeScore = Math.max(maxHypeScore, 3.0);
            else if (gain >= 10) maxHypeScore = Math.max(maxHypeScore, 2.0); // Covers 10x or 30%
        }
    });

    return maxHypeScore;
};
  // Enhanced fear detection with custom scoring
  const detectFearIntensity = (text: string): number => {
    const fearIndicators = {
      // Extreme fear indicators (multiply by 3)
      extreme: [
        'rug_pull', 'rugpull', 'exit_scam', 'honey_pot', 'cant_sell', 'lost_everything',
        'life_savings_gone', 'totally_rekt', 'going_to_zero', 'dead_coin', 'worthless',
        'total_scam', 'obvious_scam', 'bloodbath', 'massacre', 'catastrophe', 'disaster',
        'down_ninety_percent', 'down_ninetyfive_percent', 'down_ninetynine_percent',
        'safety_zero', 'exit_liquidity', 'become_exit_liquidity', 'zero_value_accrual',
        'shitty_meme_coin', 'shitcoin', 'heavily_bundled', 'market_manipulation'
      ],
      
      // High fear indicators (multiply by 2)
      high: [
        'getting_rugged', 'about_to_rug', 'looks_like_rug', 'smells_like_rug', 'dev_dumped',
        'team_dumped', 'no_liquidity', 'low_liquidity', 'avoid_completely', 'stay_away',
        'dont_buy', 'dont_invest', 'red_flags', 'major_red_flag', 'warning_signs',
        'suspicious_activity', 'whale_dumping', 'massive_dump', 'panic_selling',
        'about_to_crash', 'crashing_hard', 'free_fall', 'bleeding_out', 'getting_rekt',
        'never_recover', 'wont_recover', 'hopeless', 'pump_and_dump', 'fake_project',
        'bundled_tokens', 'tokens_bundled', 'insider_trading', 'sniper_wallets',
        'coordinated_pump', 'artificial_pump', 'fake_pump', 'about_to_dump',
        'multiple_red_flags', 'unsafe', 'dangerous', 'psyop', 'manipulation',
        'low_lp_providers', 'insufficient_liquidity', 'illiquid', 'coordinated_shilling'
      ],
      
      // Medium fear indicators (multiply by 1.5)
      medium: [
        'high_risk', 'not_safe', 'poor_quality', 'low_confidence', 'liquidity_locked',
        'dev_dumping', 'team_dumping', 'mass_exodus', 'everyone_selling', 'holders_fleeing',
        'dump_incoming', 'bag_holder', 'holding_bags', 'heavy_bags', 'trapped_holders',
        'rekt', 'no_recovery', 'nightmare', 'slaughter', 'zero_utility', 'no_utility',
        'useless_token', 'coordinated_dump', 'sketchy', 'shady', 'fishy', 'sus',
        'suspicious', 'too_good_true', 'unrealistic_gains', 'ponzi', 'pyramid_scheme',
        'bundle_detected', 'bundling_detected', 'stay_cautious', 'monitor_closely',
        'monitor_for', 'watch_out', 'beware', 'warning', 'alert', 'caution',
        'low_safety', 'risky', 'no_value_accrual', 'suspicious_wallets', 'new_wallets',
        'whale_concentration', 'poor_distribution', 'thin_liquidity', 'liquidity_risk',
        'kols_promoting', 'paid_promotion', 'shill', 'shilling', 'artificial_hype',
        'pump_group', 'dump_alert', 'concerning', 'worrying', 'troubling', 'problematic'
      ],
      
      // Low fear indicators (multiply by 1.2)
      low: [
        'doesnt_look', 'ghost_team', 'anonymous_team', 'not_doxxed', 'fomo',
        'buy_now_never', 'last_chance', 'limited_time', 'act_fast', 'urgent',
        'hurry', 'dont_wait', 'sell_now', 'get_out_now', 'exit_now', 'cut_losses',
        'stop_loss', 'damage_control', 'minimize_losses', 'take_note', 'be_careful',
        'be_cautious', 'watch_for', 'insider_allocation', 'coordinated_wallets',
        'concentrated_holdings', 'distribution_concerns', 'few_lp_providers',
        'liquidity_concerns', 'influencer_promoting', 'sponsored_content',
        'being_shilled', 'fake_hype', 'pump_channel', 'red_flag', 'concerns',
        'worried', 'issues', 'problems', 'flags', 'danger_signs'
      ]
    };
    
    let fearMultiplier = 1.0;
    let fearCount = 0;
    
    // Check for extreme fear indicators
    fearIndicators.extreme.forEach(indicator => {
      if (text.includes(indicator)) {
        fearMultiplier *= 3.0;
        fearCount++;
      }
    });
    
    // Check for high fear indicators
    fearIndicators.high.forEach(indicator => {
      if (text.includes(indicator)) {
        fearMultiplier *= 2.0;
        fearCount++;
      }
    });
    
    // Check for medium fear indicators
    fearIndicators.medium.forEach(indicator => {
      if (text.includes(indicator)) {
        fearMultiplier *= 1.5;
        fearCount++;
      }
    });
    
    // Check for low fear indicators
    fearIndicators.low.forEach(indicator => {
      if (text.includes(indicator)) {
        fearMultiplier *= 1.2;
        fearCount++;
      }
    });
    
    // Additional multiplier for multiple fear indicators
    if (fearCount > 1) {
      fearMultiplier *= (1 + (fearCount - 1) * 0.3);
    }
    
    return Math.min(fearMultiplier, 10.0); // Cap at 10x multiplier
  };
  
  // Enhanced percentage-based fear detection
  const detectPercentageFear = (text: string): number => {
    const percentagePatterns = [
      /(?:down|lost|dropped|fell|decreased|crashed)\s*(?:by\s*)?(\d+)%/gi,
      /(\d+)%\s*(?:down|loss|drop|decline|crash|decrease)/gi,
      /(?:negative|red|minus)\s*(\d+)%/gi,
      /(\d+)%\s*(?:negative|red|in the red)/gi,
      /rug\s*probability[:\s]*(\d+)%/gi,
      /risk[:\s]*(\d+)%/gi,
      /chance\s*of\s*(?:rug|scam|failure)[:\s]*(\d+)%/gi,
      /bundle[:\s]*(\d+(?:\.\d+)?)%/gi,
      /bundled[:\s]*(\d+(?:\.\d+)?)%/gi,
      /(?:tokens?\s*)?bundled[:\s]*(\d+(?:\.\d+)?)%/gi,
      /top\s*(?:\d+\s*)?holder[:\s]*(\d+(?:\.\d+)?)%/gi,
      /insider[:\s]*(\d+(?:\.\d+)?)%/gi,
      /concentration[:\s]*(\d+(?:\.\d+)?)%/gi,
      /safety[:\s]*(\d+)\/100/gi,
      /safety\s*score[:\s]*(\d+)\/100/gi,
      /safety[:\s]*(\d+)%/gi,
    ];
    
    let maxFearScore = 0;
    
    percentagePatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const percentage = parseFloat(match[1]);
        
        // Bundle percentage fear scoring
        if (pattern.source.includes('bundle')) {
          if (percentage >= 50) {
            maxFearScore = Math.max(maxFearScore, 4.0);
          } else if (percentage >= 35) {
            maxFearScore = Math.max(maxFearScore, 3.0);
          } else if (percentage >= 25) {
            maxFearScore = Math.max(maxFearScore, 2.0);
          } else if (percentage >= 15) {
            maxFearScore = Math.max(maxFearScore, 1.5);
          }
        }
        
        // Top holder concentration fear scoring
        else if (pattern.source.includes('holder')) {
          if (percentage >= 40) {
            maxFearScore = Math.max(maxFearScore, 3.0);
          } else if (percentage >= 25) {
            maxFearScore = Math.max(maxFearScore, 2.0);
          } else if (percentage >= 15) {
            maxFearScore = Math.max(maxFearScore, 1.5);
          }
        }
        
        // Insider percentage fear scoring
        else if (pattern.source.includes('insider')) {
          if (percentage >= 10) {
            maxFearScore = Math.max(maxFearScore, 4.0);
          } else if (percentage >= 5) {
            maxFearScore = Math.max(maxFearScore, 2.5);
          } else if (percentage >= 1) {
            maxFearScore = Math.max(maxFearScore, 1.5);
          }
        }
        
        // Safety score fear (inverted - lower is worse)
        else if (pattern.source.includes('safety')) {
          if (percentage <= 10) {
            maxFearScore = Math.max(maxFearScore, 5.0);
          } else if (percentage <= 25) {
            maxFearScore = Math.max(maxFearScore, 3.0);
          } else if (percentage <= 40) {
            maxFearScore = Math.max(maxFearScore, 2.0);
          } else if (percentage <= 60) {
            maxFearScore = Math.max(maxFearScore, 1.5);
          }
        }
        
        // General percentage-based fears (price drops, losses, etc.)
        else {
          if (percentage >= 90) {
            maxFearScore = Math.max(maxFearScore, 5.0);
          } else if (percentage >= 70) {
            maxFearScore = Math.max(maxFearScore, 3.0);
          } else if (percentage >= 50) {
            maxFearScore = Math.max(maxFearScore, 2.0);
          } else if (percentage >= 30) {
            maxFearScore = Math.max(maxFearScore, 1.5);
          }
        }
      }
    });
    
    return maxFearScore;
  };
  
  // Main computation function with enhanced fear sensitivity
  /*
  export const computeSentimentTimeSeries = (tweetData: TweetEntry[]) => {
    const sentimentByTime: { [time: string]: { totalSentiment: number, weight: number } } = {};
    
    tweetData.forEach((entry) => {
      const text = entry.tweet;
      if (!text) return;
      
      let isBotTweet = false;
      const botPatterns = [
        // 1. Starts with "CA" or "Ca:" etc., followed by an address. (Your original, improved)
        // Catches: "CA: 3aG7S...", "ca > 3aG7S..."
        /^ca\s*[:>)]*\s*[1-9A-HJ-NP-Za-km-z]{32,44}/i,
    
        // 2. Starts with a ticker symbol, followed by a CA somewhere in the post. (Generalizes your $GMTRUMP rule)
        // Catches: "$DID\nCA: 3aG7S...", "$DID some text 3aG7S..."
        /^\$[a-zA-Z0-9_]+\b.*[1-9A-HJ-NP-Za-km-z]{32,44}/i,
    
        // 3. Catches common bot/alert keywords and emojis. This is highly effective.
        // Catches: "🤖 FDV Alert 🤖", "📣 Alert 👉", "🔥 FDV Surge Alert 🔥", "💎 DEX paid for..."
        /(🤖|🚨|📣|🔥|⚡|💎| Alert | Trending | Signal | DEX paid | TOP CALL|QUICK TRADE|FDV Surge|AI Alpha)/i,
    
        // 4. Catches wallet tracker bots that post buy/sell activity.
        // Catches: "Cupseyy just sold $1587.22 of $did...", "Assasin (@assasin_eth) just bought..."
        /\b(just sold|just bought|sold|bought)\b\s*\$[0-9,.]+\s*of\s*\$[a-zA-Z0-9_]+/i,
    
        // 5. Catches the common bot format of reporting percentage gains with dollar values.
        // Catches: "📈 - 10MIN 🆙 +$39.8K(+31.19%)"
        /\s\+\$?[\d,.]+[kK]?\s*\(\+?\d+\.?\d*%\)/,
    
        // 6. Catches "X gain" or "X profit" call-out posts, which are often from shill accounts.
        // Catches: "Over 4x done on $DID", "3x profit from my call on $did"
        /\b\d+\.?\d*\s?x\s*(up|pump|gain|profit|done on)/i,
        
        // 7. Catches generic posts that are just the address and nothing else of substance.
        // Catches a tweet containing ONLY a Solana address and optional whitespace.
        /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    ];

      if (botPatterns.some(pattern => pattern.test(text))) {
          console.log("======Bot Tweets",text)
          isBotTweet = true;
      }

      
      const processedText = preprocessText(text);
      const result = vader.SentimentIntensityAnalyzer.polarity_scores(processedText);
      
      const hypeMultiplier = detectHypeIntensity(processedText);
      const percentageHype = detectPercentageHype(processedText);
      if (isBotTweet) {
        // Option A: Assign a fixed, low-positive "shill" score
        result.compound = -0.5; // Represents low-quality, artificial hype
        
        // Option B: Down-weight it significantly
        // weight *= 0.1; 

        // Option C: Exclude it entirely if you only want human sentiment
        // return; 
    }
      // Apply hype multipliers to positive sentiment
      if (result.compound > 0) {
          result.compound *= Math.max(hypeMultiplier, percentageHype);
          result.compound = Math.min(result.compound, 1.0); // Ensure it doesn't go above 1
      }
      // Enhanced fear detection
      const fearMultiplier = detectFearIntensity(processedText);
      const percentageFear = detectPercentageFear(processedText);
      
      // Apply fear multipliers to negative sentiment
      if (result.compound < 0) {
        result.compound *= Math.max(fearMultiplier, percentageFear);
        result.compound = Math.max(result.compound, -1.0); // Ensure it doesn't go below -1
      }
      
      // Custom rule for "Rug probability:" - enhanced
      const rugMatch = processedText.match(/rug\s*probability[:\s]*(\d+)%/i);
      if (rugMatch) {
        const prob = parseFloat(rugMatch[1]);
        if (prob > 80) {
          result.compound = -0.95;
        } else if (prob > 60) {
          result.compound = -0.8;
        } else if (prob > 40) {
          result.compound = -0.6;
        } else if (prob > 20) {
          result.compound = -0.4;
        }
      }
      
      // Enhanced risk percentage detection
      const riskMatch = processedText.match(/risk[:\s]*(\d+)%/i);
      if (riskMatch) {
        const risk = parseFloat(riskMatch[1]);
        if (risk > 70) {
          result.compound = Math.min(result.compound, -0.7);
        } else if (risk > 50) {
          result.compound = Math.min(result.compound, -0.5);
        }
      }
      
      // Detect extreme fear phrases and set maximum negative sentiment
      const extremeFearPhrases = [
        'exit scam', 'honey pot', 'cant sell', 'lost everything', 'life savings gone',
        'totally rekt', 'going to zero', 'dead coin', 'total scam', 'obvious scam',
        'heavily bundled', 'safety zero', 'exit liquidity', 'zero value accrual',
        'shitty meme coin', 'market manipulation', 'heavily bundled'
      ];
      
      if (extremeFearPhrases.some(phrase => processedText.includes(phrase.replace(/\s/g, '_')))) {
        result.compound = -0.9;
      }
      
      // Additional fear scoring for bundling patterns
      const bundleMatch = processedText.match(/bundle[:\s]*(\d+(?:\.\d+)?)%/i);
      if (bundleMatch) {
        const bundlePercentage = parseFloat(bundleMatch[1]);
        if (bundlePercentage >= 40) {
          result.compound = Math.min(result.compound, -0.7);
        } else if (bundlePercentage >= 25) {
          result.compound = Math.min(result.compound, -0.5);
        } else if (bundlePercentage >= 15) {
          result.compound = Math.min(result.compound, -0.3);
        }
      }
      
      // Safety score detection (0/100 or low percentages)
      const safetyScoreMatch = processedText.match(/safety[:\s]*(\d+)(?:\/100|%)/i);
      if (safetyScoreMatch) {
        const safetyScore = parseFloat(safetyScoreMatch[1]);
        if (safetyScore <= 10) {
          result.compound = -0.85;
        } else if (safetyScore <= 25) {
          result.compound = Math.min(result.compound, -0.6);
        } else if (safetyScore <= 40) {
          result.compound = Math.min(result.compound, -0.4);
        }
      }
      
      let weight = 1;
      if (entry.params?.views && entry.params.views.length > 0) {
        weight = parseFloat(entry.params.views[0]) || 1;
      }
      
      // Group by minute using post_time
      const timestamp = entry.post_time;
      const timeKey = new Date(timestamp).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
      
      if (!sentimentByTime[timeKey]) {
        sentimentByTime[timeKey] = { totalSentiment: 0, weight: 0 };
      }
      
      sentimentByTime[timeKey].totalSentiment += result.compound * weight;
      sentimentByTime[timeKey].weight += weight;
    });
    
    const timeSeries = Object.entries(sentimentByTime).map(([time, obj]) => ({
      time,
      aggregatedSentiment: obj.weight > 0 ? obj.totalSentiment / obj.weight : 0,
    }));
    
    // Sort time series by time
    timeSeries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    
    return timeSeries;
  };*/
  // Main computation function with enhanced fear sensitivity

  /*
export const computeSentimentTimeSeries = (tweetData: TweetEntry[]) => {
  const sentimentByTime: { [time: string]: { 
    totalSentiment: number, 
    weight: number,
    posCount: number,
    negCount: number,
    totalEngagement: number
  } } = {};
  
  tweetData.forEach((entry) => {
    const text = entry.tweet;
    if (!text) return;
    
    let isBotTweet = false;
    const botPatterns = [
      // 1. Starts with "CA" or "Ca:" etc., followed by an address. (Your original, improved)
      // Catches: "CA: 3aG7S...", "ca > 3aG7S..."
      /^ca\s*[:>)]*\s*[1-9A-HJ-NP-Za-km-z]{32,44}/i,

      // 2. Starts with a ticker symbol, followed by a CA somewhere in the post. (Generalizes your $GMTRUMP rule)
      // Catches: "$DID\nCA: 3aG7S...", "$DID some text 3aG7S..."
      /^\$[a-zA-Z0-9_]+\b.*[1-9A-HJ-NP-Za-km-z]{32,44}/i,

      // 3. Catches common bot/alert keywords and emojis. This is highly effective.
      // Catches: "🤖 FDV Alert 🤖", "📣 Alert 👉", "🔥 FDV Surge Alert 🔥", "💎 DEX paid for..."
      /(🤖|🚨|📣|🔥|⚡|💎| Alert | Trending | Signal | DEX paid | TOP CALL|QUICK TRADE|FDV Surge|AI Alpha)/i,

      // 4. Catches wallet tracker bots that post buy/sell activity.
      // Catches: "Cupseyy just sold $1587.22 of $did...", "Assasin (@assasin_eth) just bought..."
      /\b(just sold|just bought|sold|bought)\b\s*\$[0-9,.]+\s*of\s*\$[a-zA-Z0-9_]+/i,

      // 5. Catches the common bot format of reporting percentage gains with dollar values.
      // Catches: "📈 - 10MIN 🆙 +$39.8K(+31.19%)"
      /\s\+\$?[\d,.]+[kK]?\s*\(\+?\d+\.?\d*%\)/,

      // 6. Catches "X gain" or "X profit" call-out posts, which are often from shill accounts.
      // Catches: "Over 4x done on $DID", "3x profit from my call on $did"
      /\b\d+\.?\d*\s?x\s*(up|pump|gain|profit|done on)/i,
      
      // 7. Catches generic posts that are just the address and nothing else of substance.
      // Catches a tweet containing ONLY a Solana address and optional whitespace.
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    ];

    if (botPatterns.some(pattern => pattern.test(text))) {
        //console.log("======Bot Tweets======", text)
        isBotTweet = true;
    }

    const processedText = preprocessText(text);
    const result = vader.SentimentIntensityAnalyzer.polarity_scores(processedText);
    
    const hypeMultiplier = detectHypeIntensity(processedText);
    const percentageHype = detectPercentageHype(processedText);
    
    if (isBotTweet) {
      // Option A: Assign a fixed, low-positive "shill" score
     result.compound = -0.05; // Represents low-quality, artificial hype
      
      // Option B: Down-weight it significantly
      // weight *= 0.1; 

      // Option C: Exclude it entirely if you only want human sentiment
     //return; 
    }
    
    // Apply hype multipliers to positive sentiment
    if (result.compound > 0) {
        result.compound *= Math.max(hypeMultiplier, percentageHype);
        result.compound = Math.min(result.compound, 1.0); // Ensure it doesn't go above 1
    }
    
    // Enhanced fear detection
    const fearMultiplier = detectFearIntensity(processedText);
    const percentageFear = detectPercentageFear(processedText);
    
    // Apply fear multipliers to negative sentiment
    if (result.compound < 0) {
      result.compound *= Math.max(fearMultiplier, percentageFear);
      result.compound = Math.max(result.compound, -1.0); // Ensure it doesn't go below -1
    }
    
    // Custom rule for "Rug probability:" - enhanced
    const rugMatch = processedText.match(/rug\s*probability[:\s]*(\d+)%/i);
    if (rugMatch) {
      const prob = parseFloat(rugMatch[1]);
      if (prob > 80) {
        result.compound = -0.95;
      } else if (prob > 60) {
        result.compound = -0.8;
      } else if (prob > 40) {
        result.compound = -0.6;
      } else if (prob > 20) {
        result.compound = -0.4;
      }
    }
    
    // Enhanced risk percentage detection
    const riskMatch = processedText.match(/risk[:\s]*(\d+)%/i);
    if (riskMatch) {
      const risk = parseFloat(riskMatch[1]);
      if (risk > 70) {
        result.compound = Math.min(result.compound, -0.7);
      } else if (risk > 50) {
        result.compound = Math.min(result.compound, -0.5);
      }
    }
    
    // Detect extreme fear phrases and set maximum negative sentiment
    const extremeFearPhrases = [
      'exit scam', 'honey pot', 'cant sell', 'lost everything', 'life savings gone',
      'totally rekt', 'going to zero', 'dead coin', 'total scam', 'obvious scam',
      'heavily bundled', 'safety zero', 'exit liquidity', 'zero value accrual',
      'shitty meme coin', 'market manipulation', 'heavily bundled'
    ];
    
    if (extremeFearPhrases.some(phrase => processedText.includes(phrase.replace(/\s/g, '_')))) {
      result.compound = -0.9;
    }
    
    // Additional fear scoring for bundling patterns
    const bundleMatch = processedText.match(/bundle[:\s]*(\d+(?:\.\d+)?)%/i);
    if (bundleMatch) {
      const bundlePercentage = parseFloat(bundleMatch[1]);
      if (bundlePercentage >= 40) {
        result.compound = Math.min(result.compound, -0.7);
      } else if (bundlePercentage >= 25) {
        result.compound = Math.min(result.compound, -0.5);
      } else if (bundlePercentage >= 15) {
        result.compound = Math.min(result.compound, -0.3);
      }
    }
    
    // Safety score detection (0/100 or low percentages)
    const safetyScoreMatch = processedText.match(/safety[:\s]*(\d+)(?:\/100|%)/i);
    if (safetyScoreMatch) {
      const safetyScore = parseFloat(safetyScoreMatch[1]);
      if (safetyScore <= 10) {
        result.compound = -0.85;
      } else if (safetyScore <= 25) {
        result.compound = Math.min(result.compound, -0.6);
      } else if (safetyScore <= 40) {
        result.compound = Math.min(result.compound, -0.4);
      }
    }
    
    let weight = 1;
    if (entry.params?.views && entry.params.views.length > 0) {
      weight = parseFloat(entry.params.views[0]) || 1;
    }
    
    // Calculate engagement (views as proxy for engagement)
    const engagement = weight;
    
    // Group by minute using post_time
    const timestamp = entry.post_time;
    const timeKey = new Date(timestamp).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
    
    if (!sentimentByTime[timeKey]) {
      sentimentByTime[timeKey] = { 
        totalSentiment: 0, 
        weight: 0,
        posCount: 0,
        negCount: 0,
        totalEngagement: 0
      };
    }
    
    sentimentByTime[timeKey].totalSentiment += result.compound * weight;
    sentimentByTime[timeKey].weight += weight;
    sentimentByTime[timeKey].totalEngagement += engagement;
    
    // Count positive and negative impressions
    if (result.compound > 0.1) { // Threshold for positive sentiment
      sentimentByTime[timeKey].posCount++;
    } else if (result.compound < -0.1) { // Threshold for negative sentiment
      sentimentByTime[timeKey].negCount++;
    }
  });
  
  // Convert to DetailedImpression format
  const detailedImpressions: DetailedImpression[] = Object.entries(sentimentByTime).map(([time, obj]) => {
    const totalImpressions = obj.posCount + obj.negCount;
    const engagementRate = totalImpressions > 0 ? obj.totalEngagement / totalImpressions : 0;
    
    return {
      name: time, // time as the name
      value: obj.weight > 0 ? obj.totalSentiment / obj.weight : 0, // aggregated sentiment as value
      posImpressions: obj.posCount,
      negImpressions: obj.negCount,
      engagementRate: engagementRate
    };
  });
  
  // Sort by time
  detailedImpressions.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  
  return detailedImpressions;
};*/

// ===================================================================
// STEP 1: Define the Shill Detection Patterns & Scoring Logic
// ===================================================================

// A helper object containing categorized regex patterns for shill/bot detection.
const shillPatterns = {
  // SCORE +3: High-confidence bot, automated alert, or direct funnel.
  highSeverity: [
    /(🤖|🚨|📣|🔥|⚡|💎|🐳).*\b(Alert|Signal|Whale|Buy|Sell)\b/i,
    /\b(DEX paid|TOP CALL|FDV Surge|AI Alpha|just sold|just bought)\b/i,
    /\s\+\$?[\d,.]+[kKmM]?\s*\(\+?\d+(\.\d+)?%\)/,
    /^\s*\/pnl\s+[1-9A-Za-z]{32,44}/i,
    /\b(dm for|dm me|dm to join|join my t\.g|telegram in bio|link in bio)\b/i,
  ],
  // SCORE +2: Strong indicators of a coordinated or templated shill campaign.
  mediumSeverity: [
    /\b(i gave you|we got in early at|called it at|saw \$[a-z0-9_]+ at|missed the first liftoff)\b/i,
    /\b\d+(\.\d+)?\s?x\s+(on|up|pump|gain|profit|done|made|secured|return)\b/i,
    /\$\d+[kK]?\s*(mc|mcap)?\s*->\s*\$\d+[kKmM]+/i,
    /\b(ape|buy|get in|gamble|don't fade|watch your entry)\b.*?[1-9A-Za-z]{32,44}/i, // Call-to-action with CA
  ],
  // SCORE +1: Low-effort, often-spammed formats.
  lowSeverity: [
    // Catches tweets that are ONLY an address and hype emojis/words. Extremely low substance.
    /^[\s🚀🔥💎🌕💰🤑📈]*(LFG|SEND IT)?[\s🚀🔥💎🌕💰🤑📈]*\$?[a-zA-Z0-9_]+\b[\s🚀🔥💎🌕💰🤑📈]*[1-9A-Za-z]{32,44}[\s🚀🔥💎🌕💰🤑📈]*$/i,
    // Catches "CA: [address]" as the primary content, often with nothing else.
    /^\s*(ca|contract|address)\s*[:#>\s]+[1-9A-HJ-NP-Za-km-z]{32,44}/i,
  ],
};

/**
 * Calculates a shill score for a given tweet text.
 * @param {string} text - The tweet content.
 * @returns {{score: number, reasons: string[]}} - An object with the total score and the reasons for it.
 */
const getShillScore = (text: string) => {
  let score = 0;
  const reasons: string[] = [];

  // High severity patterns are worth more
  shillPatterns.highSeverity.forEach(pattern => {
    if (pattern.test(text)) {
      score += 3;
      reasons.push('High Severity Bot/Alert');
    }
  });

  // Medium severity patterns
  shillPatterns.mediumSeverity.forEach(pattern => {
    if (pattern.test(text)) {
      score += 2;
      reasons.push('Medium Severity Shill');
    }
  });

  // Low severity patterns
  shillPatterns.lowSeverity.forEach(pattern => {
    if (pattern.test(text)) {
      score += 1;
      reasons.push('Low Severity Hype/CA Spam');
    }
  });

  // Unique reasons to avoid duplicates if multiple patterns from one category match
  return { score, reasons: [...new Set(reasons)] };
};


// ===================================================================
// STEP 2: Integrate the Scoring System into Your Main Function
// ===================================================================

export const computeSentimentTimeSeries = (tweetData: TweetEntry[]) => {
  const sentimentByTime: { [time: string]: { 
    totalSentiment: number, 
    weight: number,
    posCount: number,
    negCount: number,
    totalEngagement: number
  } } = {};

  // Define a threshold for what constitutes a high-confidence shill/bot tweet.
  const SHILL_SCORE_THRESHOLD = 3;

  tweetData.forEach((entry) => {
    const text = entry.tweet;
    if (!text) return;

    const processedText = preprocessText(text);

    // === NEW: Shill Scoring System ===
    const shillAnalysis = getShillScore(processedText);
    const shillScore = shillAnalysis.score;
    
    const result = vader.SentimentIntensityAnalyzer.polarity_scores(processedText);
    let weight = 1;
    if (entry.params?.views && entry.params.views.length > 0) {
      weight = parseFloat(entry.params.views[0]) || 1;
    }

    // === NEW: Apply Penalties Based on Shill Score ===
    if (shillScore >= SHILL_SCORE_THRESHOLD) {
      // High-confidence bot/shill. Override sentiment to be slightly negative and heavily penalize weight.
      result.compound = -0.2; // Represents negative value content (noise)
      weight *= 0.1; // Reduce its influence by 90%
    } else if (shillScore > 0) {
      // Medium/Low-confidence shill. Don't override sentiment but reduce its weight.
      // A score of 1 reduces weight by 30%, a score of 2 by 60%.
      weight *= (1 - (shillScore * 0.3));
    }
    
    // Continue with your existing hype and fear multiplier logic...
    // This logic now operates on a sentiment score that has already been vetted for shilling.

    const hypeMultiplier = detectHypeIntensity(processedText);
    const percentageHype = detectPercentageHype(processedText);
    if (result.compound > 0) {
        result.compound *= Math.max(hypeMultiplier, percentageHype);
        result.compound = Math.min(result.compound, 1.0);
    }
    
    const fearMultiplier = detectFearIntensity(processedText);
    const percentageFear = detectPercentageFear(processedText);
    if (result.compound < 0) {
      result.compound *= Math.max(fearMultiplier, percentageFear);
      result.compound = Math.max(result.compound, -1.0);
    }

    // Your custom rule checks remain effective
    const rugMatch = processedText.match(/rug\s*probability[:\s]*(\d+)%/i);
    //const rugMatch = processedText.match(/rug\s*probability[:\s]*(\d+)%/i);
    if (rugMatch) {
      const prob = parseFloat(rugMatch[1]);
      if (prob > 80) {
        result.compound = -0.95;
      } else if (prob > 60) {
        result.compound = -0.8;
      } else if (prob > 40) {
        result.compound = -0.6;
      } else if (prob > 20) {
        result.compound = -0.4;
      }
    }
    
    // Enhanced risk percentage detection
    const riskMatch = processedText.match(/risk[:\s]*(\d+)%/i);
    if (riskMatch) {
      const risk = parseFloat(riskMatch[1]);
      if (risk > 70) {
        result.compound = Math.min(result.compound, -0.7);
      } else if (risk > 50) {
        result.compound = Math.min(result.compound, -0.5);
      }
    }
    
    // Detect extreme fear phrases and set maximum negative sentiment
    const extremeFearPhrases = [
      'exit scam', 'honey pot', 'cant sell', 'lost everything', 'life savings gone',
      'totally rekt', 'going to zero', 'dead coin', 'total scam', 'obvious scam',
      'heavily bundled', 'safety zero', 'exit liquidity', 'zero value accrual',
      'shitty meme coin', 'market manipulation', 'heavily bundled'
    ];
    
    if (extremeFearPhrases.some(phrase => processedText.includes(phrase.replace(/\s/g, '_')))) {
      result.compound = -0.9;
    }
    
    // Additional fear scoring for bundling patterns
    const bundleMatch = processedText.match(/bundle[:\s]*(\d+(?:\.\d+)?)%/i);
    if (bundleMatch) {
      const bundlePercentage = parseFloat(bundleMatch[1]);
      if (bundlePercentage >= 40) {
        result.compound = Math.min(result.compound, -0.7);
      } else if (bundlePercentage >= 25) {
        result.compound = Math.min(result.compound, -0.5);
      } else if (bundlePercentage >= 15) {
        result.compound = Math.min(result.compound, -0.3);
      }
    }
    
    // Safety score detection (0/100 or low percentages)
    const safetyScoreMatch = processedText.match(/safety[:\s]*(\d+)(?:\/100|%)/i);
    if (safetyScoreMatch) {
      const safetyScore = parseFloat(safetyScoreMatch[1]);
      if (safetyScore <= 10) {
        result.compound = -0.85;
      } else if (safetyScore <= 25) {
        result.compound = Math.min(result.compound, -0.6);
      } else if (safetyScore <= 40) {
        result.compound = Math.min(result.compound, -0.4);
      }
    }
    
     //weight = 1;
    if (entry.params?.views && entry.params.views.length > 0) {
      weight = parseFloat(entry.params.views[0]) || 1;
    }
    
    
    // --- The rest of your function from this point is unchanged ---
    const engagement = weight;
    const timestamp = entry.post_time;
    const timeKey = new Date(timestamp).toISOString();

    if (!sentimentByTime[timeKey]) {
      sentimentByTime[timeKey] = { 
        totalSentiment: 0, 
        weight: 0,
        posCount: 0,
        negCount: 0,
        totalEngagement: 0
      };
    }

    sentimentByTime[timeKey].totalSentiment += result.compound * weight;
    sentimentByTime[timeKey].weight += weight;
    sentimentByTime[timeKey].totalEngagement += engagement;

    if (result.compound > 0.1) {
      sentimentByTime[timeKey].posCount++;
    } else if (result.compound < -0.1) {
      sentimentByTime[timeKey].negCount++;
    }
  });

  const detailedImpressions: DetailedImpression[] = Object.entries(sentimentByTime).map(([time, obj]) => {
    const totalImpressions = obj.posCount + obj.negCount;
    const engagementRate = totalImpressions > 0 ? obj.totalEngagement / totalImpressions : 0;
    
    return {
      name: time,
      value: obj.weight > 0 ? obj.totalSentiment / obj.weight : 0,
      posImpressions: obj.posCount,
      negImpressions: obj.negCount,
      engagementRate: engagementRate
    };
  });
  
  detailedImpressions.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  
  return detailedImpressions;
};