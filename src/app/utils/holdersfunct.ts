import { SmoothingMethod,StochRSIOptions,HolderDataPoint,AnalysisResult,PlotDataByAddress,SellOffRisk,TimeSeriesOutput,HolderDerivatives,DerivativePoint,Holder,CategoryHoldings,Impression ,MACDPoint,Engagement,MetricsBin,EngagementImpression,TimeSeriess,CompImpression,BuyActivity} from "./app_types";
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
    

/*
    export function computeSellOffRiskScore(
      holders_: PlotDataByAddress[],
      getLiquidity: (time: string) => number,
      plateauWindowSize: number = 3,
      lpAddresses: Set<string> = new Set(),
      weights: { w1: number; w2: number; w3: number } = { w1: 0.3, w2: 0.3, w3: 0.4 }
    ): SellOffRisk[] {
      // 1) Filter out LPs
      const holders = holders_.filter(h => !lpAddresses.has(h.address));
      if (holders.length === 0 || holders[0].data.length === 0) return [];
    
      const numPoints = holders[0].data.length;
      const numHolders = holders.length;
      const { w1, w2, w3 } = weights;
      const srsByTime: SellOffRisk[] = [];
    
      for (let t = 0; t < numPoints; t++) {
        const time = holders[0].data[t].time;
    
        // --- Total amount at t
        const totalAmount = holders.reduce(
          (sum, h) => sum + (h.data[t]?.amount ?? 0),
          0
        );
    
        // --- 1. Normalized HHI concentration
        const pList = holders.map(h => (totalAmount > 0 ? (h.data[t]?.amount ?? 0) / totalAmount : 0));
        // HHI = sum of squares
        const hhi = pList.reduce((sum, p) => sum + p * p, 0);
        // normalize so that evenly split => 0, single-holder => 1
        const hhiMin = 1 / numHolders;
        const hhiNorm = numHolders > 1
          ? (hhi - hhiMin) / (1 - hhiMin)
          : 0;
    
        // --- 2. Plateau Detection
        let plateauCount = 0;
        if (t >= plateauWindowSize - 1) {
          for (const h of holders) {
            const base = h.data[t]?.amount;
            const isPlateau = Array.from({ length: plateauWindowSize }).every((_, k) =>
              h.data[t - k]?.amount === base
            );
            if (isPlateau) plateauCount++;
          }
        }
        const plateauRatio = plateauCount / numHolders;
    
        // --- 3. Liquidity Risk
        const liq = getLiquidity(time);
        const maxLiquidityRisk = liq > 0
          ? Math.max(...holders.map(h => (h.data[t]?.amount ?? 0) / liq))
          : 0;
    
        // --- Final SRS
        const srs = w1 * (1/hhiNorm) + w2 * plateauRatio + w3 * maxLiquidityRisk;
    
        srsByTime.push({
          time,
          entropy: parseFloat(hhiNorm.toFixed(4)),
          plateauRatio: parseFloat(plateauRatio.toFixed(4)),
          liquidityRisk: parseFloat(maxLiquidityRisk.toFixed(4)),
          srs: parseFloat(srs.toFixed(4)),
        });
      }
    
      return srsByTime;
    }
    
*/


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
/*
export function computeSellOffRiskScore(
  holders_: PlotDataByAddress[],
  getLiquidity: (time: string) => number,
  sellWindow: number = 1,
  lpAddresses: Set<string> = new Set(),
  weights: { w1: number; w2: number; w3: number } = { w1: 0.2, w2: 0.3, w3: 0.5 },
  whaleThreshold: number = 10_000_000,
  coordinatedSellThreshold: number = 0.2
): SellOffRisk[] {
  // --- Utility Functions ---
  const calculateDuplicationScore = (amounts: number[], totalHolders: number): number => {
    const amountCounts = new Map<number, number>();
    amounts.forEach(amt =>
      amountCounts.set(amt, (amountCounts.get(amt) || 0) + 1)
    );

    let collisionProbability = 0;
    amountCounts.forEach(count => {
      if (count > 1) {
        collisionProbability += (count * (count - 1)) / (totalHolders * (totalHolders - 1));
      }
    });
    return collisionProbability;
  };

  const getFirstTxTimes = (holders: PlotDataByAddress[]): Record<string, string> => {
    const firstTxMap: Record<string, string> = {};
    holders.forEach(h => {
      firstTxMap[h.address] = h.data.reduce(
        (minTime, d) => (d.time < minTime ? d.time : minTime),
        h.data[0].time
      );
    });
    return firstTxMap;
  };

  // --- Filter and Setup ---
  const holders = holders_.filter(h => !lpAddresses.has(h.address));
  if (holders.length === 0) return [];

  const numHolders = holders.length;
  const lnN = Math.log(numHolders);
  const { w1, w2, w3 } = weights;
  const results: SellOffRisk[] = [];

  // --- Timestamps ---
  const timestampSet = new Set<string>();
  for (const h of holders) {
    for (const d of h.data) {
      if (d?.time) timestampSet.add(d.time);
    }
  }
  const allTimestamps = Array.from(timestampSet).sort(); // ISO strings sort

  // --- Holder-Time Mapping ---
  const holderTimeMap: Record<string, Record<string, number>> = {};
  for (const h of holders) {
    holderTimeMap[h.address] = {};
    for (const d of h.data) {
      holderTimeMap[h.address][d.time] = d.amount;
    }
  }

  // --- First TX Times (for Sybil detection) ---
  const firstTxTimes = getFirstTxTimes(holders);

  // --- Loop per timestamp ---
  for (let t = 0; t < allTimestamps.length; t++) {
    const time = allTimestamps[t];

    // --- Total token supply at this timestamp
    const totalAmount = holders.reduce((sum, h) => {
      const amt = holderTimeMap[h.address][time] ?? 0;
      return sum + amt;
    }, 0);

    // --- 1. Entropy + Sybil Resistance ---
    const amounts = holders.map(h => holderTimeMap[h.address][time] ?? 0);
    const pList = amounts.map(amt => (totalAmount > 0 ? amt / totalAmount : 0));

    const entropy = -pList.reduce((sum, p) => (p > 0 ? sum + p * Math.log(p) : sum), 0);

    const duplicationScore = calculateDuplicationScore(amounts, holders.length);

    const newWallets24h = Object.values(firstTxTimes).filter(firstSeen =>
      new Date(firstSeen) > new Date(new Date(time).getTime() - 86400000)
    ).length;

    const newWalletFlood = Math.min(newWallets24h / (holders.length * 0.05), 1); // 5% cap

    const sybilAdjustedEntropy = entropy * (1 - 0.6 * duplicationScore) * (1 - 0.4 * newWalletFlood);
    const concentrationRisk = lnN > 0 ? 1 - sybilAdjustedEntropy / lnN : 0;

    // --- 2. Coordinated Sell-Off Risk ---
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

    // --- 3. Whale Liquidity Risk ---
    const liq = getLiquidity(time);
    const whaleHoldings = holders.reduce((sum, h) => {
      const amt = holderTimeMap[h.address][time] ?? 0;
      return amt > whaleThreshold ? sum + amt : sum;
    }, 0);
    const liquidityRisk = liq > 0 ? Math.min(whaleHoldings / liq, 1) : 0;

    // --- Final Score ---
    const srs = w1 * (1 / Math.max(concentrationRisk, 0.001)) +
                w2 * coordinatedSellFlag +
                w3 * liquidityRisk;

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
*/

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
/*
export function computeSellOffRiskScore(
    holders: PlotDataByAddress[],
    getLiquidity: (time: string) => number,
    zWindow: number = 5,
    weights: { w1: number; w2: number; w3: number } = { w1: 0.4, w2: 0.3, w3: 0.3 }
  ): SellOffRisk[] {
    if (!holders || holders.length === 0 || !holders[0].data || holders[0].data.length === 0) {
      return [];
    }
  
    const numPoints = holders[0].data.length;
    const numHolders = holders.length;
    const rawScores: SellOffRisk[] = [];
  
    const entropySeries: number[] = [];
    const liquidityRiskSeries: number[] = [];
  
    for (let t = 0; t < numPoints; t++) {
      const time = holders[0].data[t].time;
      const totalAmount = holders.reduce((sum, h) => sum + (h.data[t]?.amount ?? 0), 0);
  
      // 1. Entropy
      const pList = holders.map(h => {
        const amt = h.data[t]?.amount ?? 0;
        return totalAmount > 0 ? amt / totalAmount : 0;
      });
  
      const entropy = -pList.reduce((sum, p) => (p > 0 ? sum + p * Math.log(p) : sum), 0);
      const maxEntropy = Math.log(numHolders);
      const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;
  
      // 2. Holder Concentration (Top N holder %)
      const amounts = holders.map(h => h.data[t]?.amount ?? 0).sort((a, b) => b - a);
      const topNShare = totalAmount > 0
        ? amounts.slice(0, Math.min(3, amounts.length)).reduce((a, b) => a + b, 0) / totalAmount
        : 0;
  
      // 3. Liquidity Risk
      const liquidity = getLiquidity(time);
      const maxLiquidityRisk = liquidity > 0
        ? Math.max(...holders.map(h => (h.data[t]?.amount ?? 0) / liquidity))
        : 0;
  
      entropySeries.push(normalizedEntropy);
      liquidityRiskSeries.push(maxLiquidityRisk);
  
      // Placeholder, real score computed after
      rawScores.push({
        time,
        entropy: 0,
        plateauRatio: 0,
        liquidityRisk: 0,
        srs: 0
      });
    }
  
    // Helper: Z-Score
    function zScore(series: number[], index: number, window: number): number {
      const start = Math.max(0, index - window + 1);
      const slice = series.slice(start, index + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
      return std ? (series[index] - mean) / std : 0;
    }
  
    // Final normalized score computation
    const scoreRawValues: number[] = [];
  
    for (let t = 0; t < numPoints; t++) {
      const entropy = entropySeries[t];
      const liquidityRisk = liquidityRiskSeries[t];
  
      const entropyZ = zScore(entropySeries, t, zWindow);
      const liquidityZ = zScore(liquidityRiskSeries, t, zWindow);
  
      const concentrationScore = deltaTopNShare(holders, t);
  
      const { w1, w2, w3 } = weights;
      const raw = w1 * entropyZ + w2 * liquidityZ + w3 * concentrationScore;
  
      scoreRawValues.push(raw);
  
      rawScores[t].entropy = parseFloat(entropy.toFixed(4));
      rawScores[t].liquidityRisk = parseFloat(liquidityRisk.toFixed(4));
      rawScores[t].plateauRatio = parseFloat(concentrationScore.toFixed(4)); // repurposed
      rawScores[t].srs = raw; // temp, will normalize
    }
  
    // Normalize to 0–100
    const minSRS = Math.min(...scoreRawValues);
    const maxSRS = Math.max(...scoreRawValues);
    const range = maxSRS - minSRS || 1;
  
    return rawScores.map((r, i) => ({
      ...r,
      srs: Math.round(((scoreRawValues[i] - minSRS) / range) * 100)
    }));
  
    // Helper: concentration score from top N holders
    function topNShareAt(holders: PlotDataByAddress[], t: number, N = 3): number {
      const amounts = holders.map(h => h.data[t]?.amount ?? 0).sort((a, b) => b - a);
      const total = amounts.reduce((a, b) => a + b, 0);
      const top = amounts.slice(0, N).reduce((a, b) => a + b, 0);
      return total > 0 ? top / total : 0;
    }
    function deltaTopNShare(holders: PlotDataByAddress[], t: number, N = 3): number {
        if (t === 0) return 0;
        const current = topNShareAt(holders, t, N);
        const previous = topNShareAt(holders, t - 1, N);
        return current - previous;
      }
  }
  */
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
      const spamPenalty = (likes + comments + 2*retweets+0.5 * impressions) / (followers + 1);
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
//interface Impression { name: string; value: number; }


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
      time: new Date(timeMs).toLocaleString(),
      sei,
      res,
      views
    });
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

    const rawEngagement = likes + 2 * retweets + comments + 0.5 * impressions;
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

    const fomo = sei * vel * (1 + avgViews / maxViews);
    //console.log("sei", sei, "vel", vel, "fomo", fomo, "avgViews", avgViews, "maxViews", maxViews);
    results.push({ name: new Date(timeMs).toLocaleString(), value: isNaN(fomo)? 0 : fomo });

    prevEWMA = vel;
    prevSEI = sei;
  }
  
  // 5) Normalize FOMO values to [0, 1] using min-max scaling
  const allFomoValues = results.map((r) => r.value);
  const minValue = Math.min(...allFomoValues);
  const maxValue = Math.max(...allFomoValues);
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
    const floored = Math.floor(tMs / bucketMs) * bucketMs;
    const weight = ((likes + 2 * retweets + comments+0.5*impressions)) *((likes+2*retweets+comments+0.5*impressions)/(followers+1)) * Math.tanh(followers/10000);

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
      name: new Date(timeMs).toLocaleString(),
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

  tweets.forEach(({ timestamp, likes, retweets, followers }) => {
    const tMs = new Date(timestamp).getTime();
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
}
export function calculateSentimentTrend(
  data: TimeSeriess[],
  windowSize: number = 5
): TimeSeriess[] {
  if (!data || data.length === 0) return [];
  const trend: TimeSeriess[] = [];
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    // Average over the window (handle boundaries)
    for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
      sum += data[j].aggregatedSentiment;
      count++;
    }
    trend.push({ time: data[i].time, aggregatedSentiment: sum / count });
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
    const year = roundedDate.getFullYear();
    const month = String(roundedDate.getMonth() + 1).padStart(2, '0');
    const day = String(roundedDate.getDate()).padStart(2, '0');
    const hours = String(roundedDate.getHours()).padStart(2, '0');
    const minutesStr = String(roundedDate.getMinutes()).padStart(2, '0');
    const seconds = String(roundedDate.getSeconds()).padStart(2, '0');
    const milliseconds = String(roundedDate.getMilliseconds()).padStart(3, '0');
    const intervalKey = `${year}-${month}-${day}T${hours}:${minutesStr}:${seconds}.${milliseconds}`;

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
    const year = roundedDate.getFullYear();
    const month = String(roundedDate.getMonth() + 1).padStart(2, '0');
    const day = String(roundedDate.getDate()).padStart(2, '0');
    const hours = String(roundedDate.getHours()).padStart(2, '0');
    const minutes = String(roundedDate.getMinutes()).padStart(2, '0');
    const seconds = String(roundedDate.getSeconds()).padStart(2, '0');
    const milliseconds = String(roundedDate.getMilliseconds()).padStart(3, '0');
    const intervalKey = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
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
    const key = roundedTime.toLocaleString();

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
    const bucketTs = Math.floor(ts / ms) * ms;
    const b = new Date(bucketTs);

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

    if (!map[localIso]) {
      map[localIso] = {
        timestamp: localIso,
        impressions: 0,
        likes: 0,
        retweets: 0,
        comments: 0,
        followers: d.followers,
        count: d.count,
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
  };