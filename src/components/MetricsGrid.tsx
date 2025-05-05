import React, { JSX, useState, useEffect,ReactNode } from 'react';
import LineGraph from "./LineGraph";
import LineGraphTimeS from "./LineGraphTimeS"
import DLineGraph from './DetailedLineGraph';
import { NumberFormatter } from '@/app/utils/largeNumber';
import { QRCodeCanvas } from "qrcode.react"; // Ensure you install this package: npm install qrcode.react
import { CandleData, RawTradeData } from '@/app/types/TradingView';
import Modal from "react-modal";
import ReactDOM from "react-dom";
import LineGraphTimeD from "./LineGraphTimeD"
import BarGraph from './BarChar';
import BarGraph_Main from './BarChar_Main';
import BarGraph_M from './BarChar_';
import MarketDepthChart from './MarketDepth';
import MACDChart from './MacD';
import RSIChart from './RSIChart';
import MACDMainChart from './MacDMain';
import { Signal as SignalIcon, Users as UsersIcon, Eye as EyeIcon } from 'lucide-react';

//import BarChartCard from './BarChartCard';
import dynamic from 'next/dynamic';

// Dynamically import BarChartCard with SSR disabled.
const BarChartCard = dynamic(() => import('./BarChartCard'), { ssr: false });
//Modal.setAppElement("#root");

interface MetricCardProps {
  title: string;
  value: string;
  percentageChange: string;
  subText: string;
  graph: JSX.Element;
  isPositiveChange: boolean;
  onClick: () => void;
  toggleControls?: React.ReactNode; 
}
interface Impression {
  name: string;
  value: number;
}
interface CompImpression {
  name: string;
  value: number;
  preval: number;
}
interface TimeSeries {
  time: string;
  aggregatedSentiment: number;
}
interface Engagement {
  timestamp: string;
  impressions: number;
  likes: number;
  retweets: number;
  comments: number;
  followers: number;
  count: number;
}
interface EngagementImpression {
  name: string;
  impression: number;
  views: number;
  volume: number;
  
}
interface MetricGridProps {
  address: any;
  name: any;
  twitter: any;
  tweetPerMinut: Impression[];
  impression: Impression[];
  engagementData: Engagement[];
  tweetEngagemnt: EngagementImpression[]
  engagement: Impression[];
  tweetViews: CompImpression[];
  sentimentPlot: TimeSeries[];
  tweetsWithAddress: { tweet: string; views: number; likes: number; timestamp: string }[];
  holders: {amount: number;price: number; time:string}[]
  live_prx: RawTradeData[]
}
interface MetricsBin {
  time: string;   // ISO timestamp of the bin, e.g. "2025-05-01T10:00:00.000Z"
  sei: number;    // Social Engagement Index at this bin
  res: number;    // Relative Engagement Spike at this bin
  views: number;  // Total views in this bin
}
interface Props {
  children?: React.ReactNode;
}

const ClientOnly: React.FC<Props> = ({ children }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <>{children}</>;
};
const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  percentageChange,
  subText,
  graph,
  isPositiveChange,
  onClick,
  toggleControls
}) => {
  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg shadow-md">
      {toggleControls && (
        <div className="mb-2">
          {toggleControls}
        </div>
      )}
      <h3 className="text-sm text-gray-400 mb-1">{title}</h3>
      <div className="text-2xl font-bold mb-2">{value}</div>
      <div className={`text-sm ${isPositiveChange ? "text-green-400" : "text-red-400"}`}>
        {percentageChange}
      </div>
      <p className="text-xs text-gray-500 mt-1">{subText}</p>
      <div className="mt-4" onClick={onClick}>{graph}</div>
    </div>
  );
};

// ----------------- New Helper Functions -----------------
interface MACDPoint {
  name: string;       // timestamp label, e.g. "10:00"
  macd: number;       // MACD line value
  signal: number;     // Signal line value
  histogram: number;  // Histogram bar value
}



/**
 * Computes MACD, Signal, and Histogram for a FOMO time series.
 *
 * @param data   Array of FOMOPoint sorted by time ascending
 * @param spanFast   Fast EMA period (default 12)
 * @param spanSlow   Slow EMA period (default 26)
 * @param spanSignal Signal EMA period (default 9)
 */
function computeMACD(
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
function computeImpressionsTimeSeries(
  tweets: Engagement[],
  intervalMinutes: number = 15,
  K: number = 10000,
  N_baseline: number = 100
): Impression[] {
  if (tweets.length === 0) return [];

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
      const { likes, comments, retweets, impressions, followers } = tweet;

      const rawEngagement = likes + comments + 2*retweets + 0.5 * impressions;
      const spamPenalty = (likes + comments + 2*retweets+0.5 * impressions) / (followers + 1);
      const influenceCap = Math.tanh(followers / K);

      const qai = rawEngagement * spamPenalty * influenceCap;
      totalQAI += qai;
    }

    const volumeScaling = Math.log(1 + (N / N_baseline));
    const adjustedQAI = totalQAI * volumeScaling;

    intervals.push({
      name: new Date(intervalStart).toLocaleString(),
      value: adjustedQAI,
    });
  }

  return intervals;
}
interface Impression { name: string; value: number; }
interface RSIPoint  { name: string; rsi: number; }

function computeRSI(
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
function computeCompositeFOMOIndex(
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
function computeMetricsBins(
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
  const engSeries = sorted.map(b => b.sei * sorted[0].count); // rebuild raw E for RES MA
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
function computeTimeBasedFOMO(
  data: Engagement[],
  intervalMinutes: number,
  alpha: number,
  K = 5000
): Impression[] {
  if (data.length === 0) return [];

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
  }

  // 2) Convert to sorted array
  const sorted = Array.from(bins.entries())
    .map(([timeMs, { weightedSEI, views, count }]) => ({
      timeMs,
      sei: weightedSEI / count,
      avgViews: views / count
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

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

    results.push({ name: new Date(timeMs).toLocaleString(), value: fomo });

    prevEWMA = vel;
    prevSEI = sei;
  }

  // 5) Normalize FOMO values to [0, 1] using min-max scaling
  const allFomoValues = results.map((r) => r.value);
  const minValue = Math.min(...allFomoValues);
  const maxValue = Math.max(...allFomoValues);
  const range = maxValue - minValue;

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
function followerFactor(followers: number, F0 = 10000, k = 0.001): number {
  return 1 / (1 + Math.exp(-k * (followers - F0)));
}
function computeTimeBasedSEI(
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
      value: ((sumWeighted / count)),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}
function computeSEIEMA(data: Impression[], period: number): Impression[] {
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

function computeOscillatingSEIVelocity(
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
function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[], mu: number): number {
  const sumSq = xs.reduce((s, x) => s + (x - mu) ** 2, 0);
  return Math.sqrt(sumSq / xs.length);
}
function computeVelocities(imps: Impression[]): Impression[] {
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

function getDynamicSpikes(
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
function calculateTweetGrowthFromGroupedData(data: Impression[], intervalMinutes: number): number {
  if (data.length === 0) return 0;
  const totalTweets = data.reduce((sum, d) => sum + d.value, 0);
  const avgTweets = totalTweets / data.length;
  const maxTweets = 5 * intervalMinutes; // For 5 tweets per minute threshold.
  return Math.min(100, (avgTweets / maxTweets) * 100);
}

/**
 * Calculate impression growth as the percentage change from the first to the last impression.
 */
function calculateImpressionGrowth(impressionData: Impression[]): number {
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
function computeTimeBasedEWMA(
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
function computeVelocity(
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

function calculateImpressionPlot(
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
function calculatePoissonTrend(
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
function calculateImpressionPlot(data: EngagementImpression[]): Impression[] {
  return data.map((point, index) => {
    let Engagement = (point.impression * Math.sqrt(point.volume)) / point.views
    const averageEng = (point.impression);
    return { name: point.name, value: Engagement };
  });
}*/
function calculateCumulativeAverage(data: Impression[]): Impression[] {
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
function calculateCumulativeSum(data: Impression[]): Impression[] {
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
function calculateCumulativeRatioPercentage(
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

function calculateMovingAverage(data: Impression[], windowSize: number): Impression[] {
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
function calculateAverageViewsPerTweet(impressionData: Impression[], tweetData: Impression[]): number {
  
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
function calculateAverageViewsPlot(tweetData: Impression[], impressionData: Impression[]): Impression[] {
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

function calculateSentimentMomentum(impressions: Impression[]): number {
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
function calculateSentimentTrend(
  data: TimeSeries[],
  windowSize: number = 5
): TimeSeries[] {
  if (!data || data.length === 0) return [];
  const trend: TimeSeries[] = [];
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

function calculateTweetFrequencyTrendPercentage(
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
function calculateSentimentVolatility(impressions: Impression[]): number {
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

function calculateSentimentWeightedMetrics(impressions: Impression[], engagements: Impression[]): number {
  if (impressions.length !== engagements.length || impressions.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < impressions.length; i++) {
    weightedSum += impressions[i].value * engagements[i].value;
    totalWeight += engagements[i].value;
  }
  return totalWeight !== 0 ? weightedSum / totalWeight : 0;
}

function detectSentimentPeaks(impressions: Impression[]): Impression[] {
  if (impressions.length < 3) return [];
  const peaks = [];
  for (let i = 1; i < impressions.length - 1; i++) {
    if (impressions[i].value > impressions[i - 1].value && impressions[i].value > impressions[i + 1].value) {
      peaks.push(impressions[i]);
    }
  }
  return peaks;
}

function calculateSentimentScore(
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

  
function calculateAveragePercentage(impressions: Impression[]): number {
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

function calculateSentimentMomentumPlot(impressions: Impression[]): Impression[] {
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
  
function calculateCumulativePercentage(impressions: Impression[]): Impression[] {
  if (impressions.length === 0) return [];
  
  const initialValue = impressions[0].value;
  return impressions.map((imp, index) => ({
    name: imp.name,
    value: index === 0 ? 0 : (imp.value - initialValue) / initialValue
  }));
}
function calculateImpressionPercentage(impressions: Impression[], windowSize: number = 3): Impression[] {
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

function categorizeTweetsByIntervalC(data: CompImpression[], minute: number): CompImpression[] {
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
function categorizeTweetsByInterval(data: Impression[], minute: number): Impression[] {
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
const groupTweetsWithAddressByInterval = (
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
const parseViewsCount = (views: string): number => {
  
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
function parseISOLocal(s:any) {
  const [year, month, day, hour, minute, second] = s.split(/\D/).map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}
interface Impression { name: string; value: number; }
// Helper: group raw Impression data into dynamic-minute intervals
function categorizeByInterval(
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

function categorizeEngagementByInterval(
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
function calculateEngagementGrowth(data: Engagement[], intervalMinutes: number, maxPerMin: number = 500): number {
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
function engagementRateSeries(data: Engagement[]): Impression[] {
  return data.map(d => {
    const score =
      ((d.impressions * 0.1 + d.likes * 0.3 + d.retweets * 0.4 + d.comments * 0.2) /
      (d.followers > 0 ? d.followers : 1));
    return { name: d.timestamp, value: score };
  });
}
interface InfoBoxProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
}

const InfoBox: React.FC<InfoBoxProps> = ({ title, value, icon }) => {
  return (
    <div className="bg-gray-700 rounded-lg p-4 shadow flex items-center">
      {icon && <div className="mr-4">{icon}</div>}
      <div>
        <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
        <p className="text-white text-xl font-bold">{value}</p>
      </div>
    </div>
  );
};

const MetricsGrid: React.FC<MetricGridProps> = ({ address, name, twitter, tweetPerMinut, impression, engagementData, tweetEngagemnt, engagement, tweetViews, sentimentPlot, tweetsWithAddress, holders, live_prx }) => {
  //console.log('tweet Enagament',tweetEngagemnt," engagementData",engagementData)
  let twt = `https://x.com/search?q=${address}`;
  if (twitter != null) {
    twt = twitter;
  }
  const [selectedMetric, setSelectedMetric] = useState<{ title: string; data: Impression[] | null } | null>(null);
  const [selectedRSIMetric, setSelectedRSIMetric] = useState<{ title: string; data: Impression[] | null } | null>(null);
  //setSelectedRSIMetric
  const [selectedTimeMetric, setSelectedTimeMetric] = useState<{ title: string; data: TimeSeries[] | null } | null>(null);
  const [selectedMacDMetric, setSelectedMacDMetric] = useState<{ title: string; data: MACDPoint[] | null } | null>(null);
  const [selectedbarMetric, setSelectedbarMetric] = useState<{ title: string; data: Impression[] | null } | null>(null);
  const [showMarketDepthModal, setShowMarketDepthModal] = useState(false);

  // New state variables for toggle functionality
  const [activeTweetMetric, setActiveTweetMetric] = useState<'frequency' | 'address'>('frequency');
  const [activeCallerMetric, setActiveCallerMetric] = useState<'min' | 'fiveMin' | 'address'>('min');
  const [activeImpressionMetric, setActiveImpressionMetric] = useState<'growth' | 'volatility' | 'peaks'>('growth');
  const [activeEngagementMetric, setActiveEngagementMetric] = useState<'growth' | 'peaks'>('growth');
  const [activeFomoMetric, setActiveFomoMetric] = useState<'growth' | 'peaks' | 'macd'>('growth');
  const [activeViewsMetric, setActiveViewsMetric] = useState<'average' | 'address' | 'ratio'>('average');
  
  const totalTweets_ = tweetPerMinut.reduce((sum, tweet) => sum + tweet.value, 0);
  const totalTweets = NumberFormatter.formatNumber(totalTweets_);
  const tweetViewsPerFVmints = categorizeTweetsByIntervalC(tweetViews, 5);
  const movingAverageTweetViews = calculateMovingAverage(tweetViewsPerFVmints, 9);

  // Group tweets by 5 minutes.
  const tweetPerFVmints = categorizeTweetsByInterval(tweetPerMinut, 5);
  const tweetPerTnmints = categorizeTweetsByInterval(tweetPerMinut, 10);

  const tweetViewsRatioPercentage = calculateCumulativeRatioPercentage(
    tweetPerFVmints,
    tweetViews
  );
  
  // Calculate tweet growth based on the 5-minute grouping.
  const tweetGrowthPercentage = calculateTweetGrowthFromGroupedData(tweetPerFVmints, 5);
  // Calculate impression growth percentage.
  const impressionGrowthPercentage = calculateImpressionGrowth(impression);
  // Calculate the overall average views per tweet (as a number).
  const avgViewsPerTweet = calculateAverageViewsPerTweet(tweetViews, tweetPerMinut);
  // Calculate the average views per tweet over time for plotting.
  const averageViewsPlot = calculateAverageViewsPlot(tweetPerMinut, impression);

  const averagePercentageFv = calculateAveragePercentage(tweetPerFVmints);
  const averagePercentage = calculateAveragePercentage(tweetPerMinut);
  const cumuImpression = calculateImpressionPercentage(impression);
  const weighBasedImpression = computeImpressionsTimeSeries(engagementData,5)//calculateImpressionPlot(tweetEngagemnt,9)
  const cumuAvrage = calculateAveragePercentage(impression);
  const cumuEngage = calculateCumulativePercentage(engagement);
  const cumuAvragEngage = calculateAveragePercentage(engagement);
  const sentimentMomentum = calculateSentimentMomentum(impression);
  const sentimentMomentumPlot = calculateSentimentMomentumPlot(impression);
  const sentimentVolatility = calculateSentimentVolatility(impression);
  const weightedSentiment = calculateSentimentWeightedMetrics(impression, engagement);
  const sentimentPeaks = detectSentimentPeaks(impression);
  const tweetFrequencyTrend = calculateTweetFrequencyTrendPercentage(tweetPerMinut, 5, 5,100);
  const sentimentTrend = calculateSentimentTrend(sentimentPlot, 30);
  const currentSentimentTrend = sentimentTrend[sentimentTrend.length - 1]?.aggregatedSentiment || 0;
  const currentTweetFrequencyTrend = tweetFrequencyTrend[tweetFrequencyTrend.length - 1]?.value || 0;
  const rawViews = avgViewsPerTweet; 
  const avgLstView = calculateAverageViewsPerTweet(tweetViewsPerFVmints.slice(-15),tweetViewsPerFVmints.slice(-15))
  
  const { count: tweetsWithAddressCount, views: tweetsWithAddressViews } = groupTweetsWithAddressByInterval(
    tweetsWithAddress,
    5
  );
  const totalTweetsWithAddress = tweetsWithAddressCount.reduce(
    (sum, { value }) => sum + value,
    0
  );
   // Determine interval based on volume
   const dynamicInterval = impression.length > 500 ? 2 : impression.length > 200 ? 5 : 2;

   // Impressions processing
   const impressionsGrouped = calculatePoissonTrend(tweetEngagemnt); // categorizeByInterval(engagement, dynamicInterval);
   const impressionGrowth = impressionsGrouped.length > 0
     ? impressionsGrouped[impressionsGrouped.length - 1].value
     : 0;
    const computVelocity = computeVelocity(tweetEngagemnt,15);
    const EWMA_Value = computeSEIEMA(weighBasedImpression,14)//computeTimeBasedEWMA(tweetEngagemnt, 14,0.3);
    const SEI_value_x = computeTimeBasedSEI(engagementData,5)
    const SEI_EMA = computeSEIEMA(SEI_value_x,14)
    const SEI_Velocity = computeOscillatingSEIVelocity(SEI_value_x,engagementData,15);
    //console.log("Engagement Data",SEI_value_x)
    const SEI_value= getDynamicSpikes(SEI_value_x)
    //console.log("Engagement Data xxx",SEI_value)
   // Engagement processing
   const engagementGrouped = categorizeEngagementByInterval(engagementData, dynamicInterval);
   const engagementGrowth = calculateEngagementGrowth(engagementGrouped, dynamicInterval);
   const engagementSeries = engagementRateSeries(engagementGrouped);
 
  const tweetsWithAddressFrequency = calculateTweetFrequencyTrendPercentage(tweetsWithAddressCount, 5, 3, 80);
  const currentTweetWiAddFrequencyTrend = tweetsWithAddressFrequency[tweetsWithAddressFrequency.length - 1]?.value || 0;
  const tweetwithAddAvgViews = calculateAverageViewsPerTweet(tweetsWithAddressViews, tweetsWithAddressCount);
  const tweetwithAddAvgViewsS = calculateAverageViewsPerTweet(tweetsWithAddressViews.slice(-15), tweetsWithAddressCount.slice(-15));
  //console.log("Engagemtnt",engagementData)
  const tweetFomo = computeTimeBasedFOMO(engagementData,2,0.2)
  
  const getMetricGrid = computeMetricsBins(engagementData,5,5)
  const compositFomo = computeCompositeFOMOIndex(getMetricGrid)
  const macd = computeMACD(tweetFomo,)
  const RSI = computeRSI(tweetFomo)
  const openPopup = (title: string, data: Impression[]) => {
    setSelectedMetric({ title, data });
  };
  const openPopupTime = (title: string, data: TimeSeries[]) => {
    setSelectedTimeMetric({ title, data });
  };
  const openPopupMacD = (title: string, data: MACDPoint[]) => {
    setSelectedMacDMetric({ title, data });
  };
  const openPopupRSI = (title: string, data: Impression[]) => {
    setSelectedRSIMetric({ title, data });
  };
  const openPopupBar = (title: string, data: Impression[]) => {
    setSelectedbarMetric({ title, data });
  };

  const closePopup = () => {
    setSelectedMetric(null);
    setSelectedTimeMetric(null);
    setSelectedbarMetric(null);
    setSelectedMacDMetric(null)
    setSelectedRSIMetric(null)
  };

  useEffect(() => {
    Modal.setAppElement("#root");
  }, []);
  
  const downloadDataAsCSV = () => {
    let csvContent = "";

    // Helper to escape CSV values (handles commas, quotes, newlines)
    const escapeCsvValue = (value: string): string => {
        if (/[",\n]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    };

    // Helper to add a dataset to the CSV string
    const addSection = (title: string, headers: string[], data: any[], rowFormatter: (item: any) => string[]) => {
        csvContent += `${escapeCsvValue(title)}\n`;
        csvContent += headers.map(escapeCsvValue).join(',') + '\n';
        data.forEach(item => {
            csvContent += rowFormatter(item).map(escapeCsvValue).join(',') + '\n';
        });
        csvContent += '\n'; // Add a blank line separator
    };

    // Add each dataset used in the plots, ensuring numbers are converted to strings
    addSection(
        "Tweet Frequency Trend (%)",
        ["Timestamp", "Value"],
        tweetFrequencyTrend,
        (item: Impression) => [item.name, String(item.value)]
    );

    addSection(
        "Tweet w/ Address Frequency (%)",
        ["Timestamp", "Value"],
        tweetsWithAddressFrequency,
        (item: Impression) => [item.name, String(item.value)]
    );

    addSection(
        "Callers/min (Raw)",
        ["Timestamp", "Value"],
        tweetPerMinut,
        (item: Impression) => [item.name, String(item.value)]
    );

    addSection(
        "Callers/5min (Grouped)",
        ["Timestamp", "Value"],
        tweetPerFVmints,
        (item: Impression) => [item.name, String(item.value)]
    );

     addSection(
        "Tweets w/ Address Count (5min Grouped)",
        ["Timestamp", "Count"],
        tweetsWithAddressCount,
        (item: Impression) => [item.name, String(item.value)]
    );

    addSection(
        "Impression Growth (Percentage Change, Smoothed)",
        ["Timestamp", "Percentage Change"],
        cumuImpression,
        (item: Impression) => [item.name, String(item.value)]
    );

     addSection(
        "Impression Growth (Grouped Avg)",
        ["Timestamp", "Average Value"],
        impressionsGrouped,
        (item: Impression) => [item.name, String(item.value)]
    );

    addSection(
        "Sentiment Trend (Smoothed)",
        ["Timestamp", "Aggregated Sentiment"],
        sentimentTrend,
        (item: TimeSeries) => [item.time, String(item.aggregatedSentiment)]
    );

    addSection(
        "Peak Sentiments (Detected on Smoothed % Change)",
        ["Timestamp", "Value"],
        sentimentPeaks,
        (item: Impression) => [item.name, String(item.value)]
    );

    addSection(
        "Average Views/Tweet (5min Grouped)",
        ["Timestamp", "Current Views", "Previous Views (Count)"],
        tweetViewsPerFVmints,
        (item: CompImpression) => [item.name, String(item.value), String(item.preval)]
    );

    addSection(
        "Views for Tweets w/ Address (5min Grouped)",
         ["Timestamp", "Aggregated Views", "Tweet Count"],
        tweetsWithAddressViews,
        (item: CompImpression) => [item.name, String(item.value), String(item.preval)]
    );

    addSection(
        "AvgTweetMade/AvgViews (Cumulative Ratio %)",
        ["Timestamp", "Ratio (%)"],
        tweetViewsRatioPercentage,
        (item: Impression) => [item.name, String(item.value)]
    );

    addSection(
        "Engagement Rate Series (Grouped)",
        ["Timestamp", "Engagement Rate Score"],
        engagementSeries,
        (item: Impression) => [item.name, String(item.value)]
    );

    // Create blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const safeAddress = address?.replace(/[^a-z0-9]/gi, '_') || 'unknown_address';
    link.setAttribute("download", `metrics_data_${safeAddress}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper component for toggle buttons
  const ToggleButton = ({ 
    active, 
    onClick, 
    children 
  }: { 
    active: boolean; 
    onClick: () => void; 
    children: React.ReactNode 
  }) => (
    <button
      className={`px-2 py-1 text-xs rounded-md transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );

  // Render metric cards based on active toggles
  const renderTweetFrequencyCard = () => {
    if (activeTweetMetric === 'frequency') {
      return (
        <MetricCard
          title="Tweet Frequency Trend (%)"
          value={tweetFrequencyTrend.length > 0 ? tweetFrequencyTrend[tweetFrequencyTrend.length - 1].value.toFixed(2) + "%" : "0%"}
          percentageChange=""
          subText="Frequency of tweets over time"
          isPositiveChange={tweetFrequencyTrend.length > 0 && tweetFrequencyTrend[tweetFrequencyTrend.length - 1].value > 0}
          graph={<LineGraph data={tweetFrequencyTrend} color="#10B981" />}
          onClick={() => openPopup("Tweet Frequency Trend", tweetFrequencyTrend)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={true} onClick={() => setActiveTweetMetric('frequency')}>
                Frequency
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveTweetMetric('address')}>
                Address
              </ToggleButton>
            </div>
          }
        />
      );
    } else {
      return (
        <MetricCard
          title="Tweet w/ Address Frequency (%)"
          value={
            tweetsWithAddressFrequency.length > 0
              ? tweetsWithAddressFrequency[tweetsWithAddressFrequency.length - 1].value.toFixed(2) + "%"
              : "0%"
          }
          percentageChange=""
          subText="Frequency trend for tweets with address"
          isPositiveChange={
            tweetsWithAddressFrequency.length > 0 &&
            tweetsWithAddressFrequency[tweetsWithAddressFrequency.length - 1].value > 0
          }
          graph={<LineGraph data={tweetsWithAddressFrequency} color="#34D399" />}
          onClick={() => openPopup("Tweet w/ Address Frequency", tweetsWithAddressFrequency)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveTweetMetric('frequency')}>
                Frequency
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveTweetMetric('address')}>
                Address
              </ToggleButton>
            </div>
          }
        />
      );
    }
  };

  const renderCallersCard = () => {
    if (activeCallerMetric === 'min') {
      return (
        <MetricCard
          title="Callers/min (Avg.)"
          value={totalTweets}
          percentageChange={(averagePercentage > 0 ? "+" : "") + averagePercentage.toFixed(2) + "%"}
          subText={averagePercentage.toFixed(2) + (averagePercentage > 0 ? " Increase" : " Decrease") + " in tweets/min"}
          isPositiveChange={averagePercentage > 0}
          graph={<LineGraph data={tweetPerMinut} color="#10B981" />}
          onClick={() => openPopup("Callers/min (Avg.)", tweetPerMinut)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={true} onClick={() => setActiveCallerMetric('min')}>
                Per Min
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('fiveMin')}>
                Per 5 Min
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('address')}>
                With Address
              </ToggleButton>
            </div>
          }
        />
      );
    } else if (activeCallerMetric === 'fiveMin') {
      return (
        <MetricCard
          title="Callers/5min (Avg.)"
          value={totalTweets}
          percentageChange={(averagePercentageFv > 0 ? "+" : "") + averagePercentageFv.toFixed(2) + "%"}
          subText={averagePercentageFv.toFixed(2) + (averagePercentageFv > 0 ? " Increase" : " Decrease") + " in tweets/5min"}
          isPositiveChange={averagePercentageFv > 0}
          graph={<LineGraph data={tweetPerFVmints} color="#10B981" />}
          onClick={() => openPopup("Callers/5min (Avg.)", tweetPerFVmints)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('min')}>
                Per Min
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveCallerMetric('fiveMin')}>
                Per 5 Min
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('address')}>
                With Address
              </ToggleButton>
            </div>
          }
        />
      );
    } else {
      return (
        <MetricCard
          title="Tweets w/ Address (5min Count)"
          value={totalTweetsWithAddress.toString()}
          percentageChange=""
          subText="Number of tweets with address per 5 minutes"
          isPositiveChange={
            tweetsWithAddressCount.length > 0 &&
            tweetsWithAddressCount[tweetsWithAddressCount.length - 1].value > 0
          }
          graph={<LineGraph data={tweetsWithAddressCount} color="#60A5FA" />}
          onClick={() => openPopup("Tweets w/ Address Count", tweetsWithAddressCount)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('min')}>
                Per Min
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('fiveMin')}>
                Per 5 Min
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveCallerMetric('address')}>
                With Address
              </ToggleButton>
            </div>
          }
        />
      );
    }
  };
  const renderEngagementCard = () => {
    if (activeEngagementMetric === 'growth') {
      //const latestSEI = Array.isArray(SEI_value) && SEI_value.length > 0 ? SEI_value[SEI_value.length - 1] : null;
      //  const latestValue = latestSEI && typeof latestSEI.value === 'number' ? latestSEI.value : null;
      if (SEI_value.length > 0) {
        const latestValue = SEI_value[SEI_value.length - 1].value;
      return (
        <MetricCard
          title="Social Engagement Index"
          value={latestValue !== null ? `${latestValue.toFixed(2)}%` : 'N/A'}
          percentageChange={
            latestValue !== null
              ? `${latestValue >= 0 ? '+' : ''}${latestValue.toFixed(2)}%`
              : 'N/A'
          }
          subText={`Avg. impressions per ${dynamicInterval}-minute interval`}
          isPositiveChange={latestValue !== null ? latestValue >= 0 : false}
          graph={<BarGraph_Main data={SEI_value || []}  />}
          onClick={() => openPopupBar("Engagement Rate", SEI_value)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={true} onClick={() => setActiveEngagementMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveEngagementMetric('peaks')}>
                Velocity
              </ToggleButton>
            </div>
          }
        />

      );}
    } else {
      return(
        <MetricCard
          title="Velocity Rate"
          value={engagementGrowth.toFixed(2) + "%"}
          percentageChange={(engagementGrowth >= 0 ? "+" : "") + engagementGrowth.toFixed(2) + "%"}
          subText="Velocityy rate analysis"
          isPositiveChange={engagementGrowth > 0}
          graph={<LineGraph data={SEI_Velocity} color="#8B5CF6" />}
          onClick={() => openPopup("Engagement Rate", SEI_Velocity)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveEngagementMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveEngagementMetric('peaks')}>
                Velocity
              </ToggleButton>
              
            </div>
          }
        />
      );
    }
  }
  const renderFomoCard = () => {
    if (activeFomoMetric === 'growth') {
      return (
        <MetricCard
          title="Fomo Growth"
          value={impressionGrowth.toFixed(2) + "%"}
          percentageChange={(impressionGrowth >= 0 ? "+" : "") + impressionGrowth.toFixed(2) + "%"}
          subText={`Avg. impressions per ${dynamicInterval}-minute interval`}
          isPositiveChange={impressionGrowthPercentage >= 0}
          graph={<LineGraph data={tweetFomo} color="#8B5CF6"/>}
          onClick={() => openPopup("Fomo Growth", tweetFomo)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={true} onClick={() => setActiveFomoMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('macd')}>
                MacD
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('peaks')}>
              Velocity
              </ToggleButton>
              
            </div>
          }
        />
      );
    } else if (activeFomoMetric === 'macd') {
      return (
        <MetricCard
          title="MACD Growth"
          value={impressionGrowth.toFixed(2) + "%"}
          percentageChange={(impressionGrowth >= 0 ? "+" : "") + impressionGrowth.toFixed(2) + "%"}
          subText={`Avg. impressions per ${dynamicInterval}-minute interval`}
          isPositiveChange={impressionGrowthPercentage >= 0}
          graph={<MACDChart data={macd} />}
          onClick={() => openPopupMacD("MACD Growth", macd)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveFomoMetric('macd')}>
                MacD
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('peaks')}>
              Velocity
              </ToggleButton>
              
            </div>
          }
        />
      );
    } else {
      return(
        <MetricCard
          title="FOMO Index"
          value={compositFomo?.[compositFomo.length-1].value.toFixed(2) + "%"}
          percentageChange={(compositFomo?.[compositFomo.length-1].value >= 0 ? "+" : "") + compositFomo?.[compositFomo.length-1].value.toFixed(2) + "%"}
          subText="Fomo analysis"
          isPositiveChange={compositFomo?.[compositFomo.length-1].value > 0}
          graph={<RSIChart rsiData={RSI} color="#8B5CF6" />}
          onClick={() => openPopupRSI("Engagement Rate", RSI)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('macd')}>
                MacD
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveFomoMetric('peaks')}>
                Velocity
              </ToggleButton>
              
            </div>
          }
        />
      );
    }
  }
  const renderImpressionCard = () => {
    if (activeImpressionMetric === 'growth') {
      // Determine which impression growth card to show
      if (weighBasedImpression.length > 0) {
        return (
          <MetricCard
            title="Impression Growth"
            value={isNaN(weighBasedImpression[weighBasedImpression.length-1].value) ? "0%" : weighBasedImpression[weighBasedImpression.length-1].value.toFixed(2) + "%"}
            percentageChange={(weighBasedImpression[weighBasedImpression.length-1].value >= 0 ? "+" : "") + (isNaN(weighBasedImpression[weighBasedImpression.length-1].value) ? "0%" : weighBasedImpression[weighBasedImpression.length-1].value.toFixed(2) + "%")}
            subText={isNaN(weighBasedImpression[weighBasedImpression.length-1].value) ? "0% change in impressions" : weighBasedImpression[weighBasedImpression.length-1].value.toFixed(2) + "% change in impressions"}
            isPositiveChange={weighBasedImpression[weighBasedImpression.length-1].value >= 0}
            graph={<LineGraph data={weighBasedImpression} color="#10B981" />}
            onClick={() => openPopup("Impression Growth", weighBasedImpression)}
            toggleControls={
              <div className="flex space-x-2 mb-2">
                <ToggleButton active={true} onClick={() => setActiveImpressionMetric('growth')}>
                  Growth
                </ToggleButton>
                <ToggleButton active={false} onClick={() => setActiveImpressionMetric('volatility')}>
                  Volatility
                </ToggleButton>
                <ToggleButton active={false} onClick={() => setActiveImpressionMetric('peaks')}>
                  Peaks
                </ToggleButton>
              </div>
            }
          />
        );
      } //else {
        
      //}
    } else if (activeImpressionMetric === 'volatility') {
      return (
        <MetricCard
          title="Sentiment Volatility"
          value={calculateSentimentVolatility(impression).toFixed(2)}
          percentageChange="Variability"
          subText="Variability in sentiment over time"
          isPositiveChange={sentimentVolatility < 10}
          graph={<LineGraphTimeS data={sentimentTrend} color="#F59E0B" />}
          onClick={() => openPopupTime("Sentiment Volatility", sentimentTrend)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveImpressionMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveImpressionMetric('volatility')}>
                Volatility
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveImpressionMetric('peaks')}>
                Peaks
              </ToggleButton>
            </div>
          }
        />
      );
    } else {
      return (
        <MetricCard
          title="Peak Sentiments"
          value={detectSentimentPeaks(weighBasedImpression).length.toString()}
          percentageChange="Detected Peaks"
          subText="Number of sentiment peaks detected"
          isPositiveChange={detectSentimentPeaks(weighBasedImpression).length > 0}
          graph={<LineGraph data={EWMA_Value} color="#EF4444" />}
          onClick={() => openPopup("Peak Sentiments",EWMA_Value)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveImpressionMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveImpressionMetric('volatility')}>
                Volatility
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveImpressionMetric('peaks')}>
                Peaks
              </ToggleButton>
            </div>
          }
        />
      );
    }
  };

  const renderViewsCard = () => {
    if (activeViewsMetric === 'average') {
      return (
        <MetricCard
          title="Avg. Views/Tweet"
          value={NumberFormatter.formatNumber(Number(avgViewsPerTweet.toFixed(2)))}
          percentageChange=""
          subText="Overall average views per tweet"
          isPositiveChange={avgViewsPerTweet >= 0}
          graph={<BarGraph data={tweetViewsPerFVmints}/>}
          onClick={() => openPopupBar("Average Views/Tweet", tweetViewsPerFVmints)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={true} onClick={() => setActiveViewsMetric('average')}>
                Average
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('address')}>
                With Address
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('ratio')}>
                Ratio
              </ToggleButton>
            </div>
          }
        />
      );
    } else if (activeViewsMetric === 'address') {
      return (
        <MetricCard
          title="Views for Tweets w/ Address (5min)"
          value={NumberFormatter.formatNumber(Number(tweetwithAddAvgViews.toFixed(2)))}
          percentageChange=""
          subText="Aggregated views per 5 minutes for tweets with address"
          isPositiveChange={
            tweetsWithAddressViews.length > 0 &&
            tweetsWithAddressViews[tweetsWithAddressViews.length - 1].value > 0
          }
          graph={<BarGraph data={tweetsWithAddressViews}  />}
          onClick={() => openPopupBar("Views for Tweets w/ Address", tweetsWithAddressViews)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('average')}>
                Average
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveViewsMetric('address')}>
                With Address
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('ratio')}>
                Ratio
              </ToggleButton>
            </div>
          }
        />
      );
    } else {
      return (
        <MetricCard
          title="AvgTweetMade/AvgViews"
          value={NumberFormatter.formatNumber(Number(((Number(parseViewsCount(totalTweets))/avgViewsPerTweet)*100).toFixed(2)))}
          percentageChange=""
          subText="Overall Interest of callers"
          isPositiveChange={avgViewsPerTweet >= 0}
          graph={<LineGraph data={tweetViewsRatioPercentage} color="#3B82F6" />}
          onClick={() => openPopup("Average Views/Tweet", tweetViewsRatioPercentage)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('average')}>
                Average
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('address')}>
                With Address
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveViewsMetric('ratio')}>
                Ratio
              </ToggleButton>
            </div>
          }
        />
      );
    }
  };

  return (
    <div className="bg-gray-800 text-white rounded-lg p-4 shadow-lg w-full">
      <div id="root"></div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-grow border-100 border-black rounded-[5px] p-2">
          <img
            src={name}
            alt="Top Display"
            className="rounded-[5px] w-full h-full object-cover"
            style={{ width: "150px" }}
          />
        </div>
        <div className="flex-grow"></div>
        <div className="flex-shrink-0 mr-4 border-10 border-black rounded-[5px] p-2">
          <QRCodeCanvas value={address} size={150} className="rounded-[5px]" />
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-6 text-center">
        Address: <span className="text-white font-mono bg-gray-500 p-1 rounded-[5px]">{address}</span>
      </p>
      <div className="flex space-x-2 mb-4">
        <a
          href={twt}
          target="_blank"
          rel="noopener noreferrer"
          className="w-1/2 bg-green-500 text-white py-2 rounded-lg font-bold text-center"
        >
          X/Twitter
        </a>
        <a
          href={`https://dexscreener.com/search?q=${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-1/2 bg-gray-700 text-gray-300 py-2 rounded-lg font-bold text-center"
        >
          DexScreener
        </a>
      </div>
      
      <div className="mb-4">
        <button
          onClick={downloadDataAsCSV}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-bold text-center transition duration-150 ease-in-out"
        >
          Download Plot Data (CSV)
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {renderTweetFrequencyCard()}
        {renderCallersCard()}
        {renderImpressionCard()}
        {renderViewsCard()}
        {renderEngagementCard()}
        {renderFomoCard()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        
        
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoBox 
          title="Holders" 
          value={NumberFormatter.formatNumber(holders.length)} 
          icon={<UsersIcon className="h-6 w-6 text-blue-400" />} 
        />
        <InfoBox 
          title="Tweet Views" 
          value={NumberFormatter.formatNumber(rawViews)} 
          icon={<EyeIcon className="h-6 w-6 text-green-400" />} 
        />
        <InfoBox 
          title="Live PRX" 
          value={NumberFormatter.formatNumber(live_prx.length)} 
          icon={<SignalIcon className="h-6 w-6 text-purple-400" />} 
        />
      </div>
      <div className="flex flex-col justify-center items-center h-screen">
        <h1>Hype Meter</h1>
        <SentimentMeter score={Math.round(calculateSentimentScore(currentTweetFrequencyTrend, currentSentimentTrend,avgLstView,Number(totalTweets) ))} />
        <h1>Hype Meter For Address</h1>
        <SentimentMeter score={Math.round(calculateSentimentScore(currentTweetWiAddFrequencyTrend, currentSentimentTrend,tweetwithAddAvgViewsS,totalTweetsWithAddress ))} />
      </div>
      {/* Modal for Market Depth Chart Popup */}
      <Modal
        isOpen={showMarketDepthModal}
        onRequestClose={() => setShowMarketDepthModal(false)}
        contentLabel="Market Depth Popup"
        style={{
          content: {
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            padding: '1rem',
            background: '#1F2937', // Tailwind gray-800 color
            border: 'none'
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 1000
          }
        }}
      >
        <div className="h-full flex flex-col">
          <h2 className="text-2xl text-white mb-4">Market Depth</h2>
          <div className="flex-grow">
            <MarketDepthChart
              orderBookData={holders}
              livePriceData={live_prx}
            />
          </div>
          <button
            onClick={() => setShowMarketDepthModal(false)}
            className="mt-4 bg-gray-700 text-white py-2 px-4 rounded self-end"
          >
            Close
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={!!selectedMetric || !!selectedTimeMetric || !!selectedbarMetric || !!selectedMacDMetric || !!selectedRSIMetric}
        onRequestClose={closePopup}
        contentLabel="Metric Details"
        className="bg-gray-900 text-white w-[90vw] max-w-[1400px] h-[85vh] mx-auto rounded-lg p-6 shadow-lg"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
      >
        {selectedMetric && (
          <>
            <h3 className="text-xl font-bold mb-4">{selectedMetric.title}</h3>
            <DLineGraph data={selectedMetric.data || []} color="#3B82F6" detailed />
            <button
              className="mt-6 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
              onClick={closePopup}
            >
              Close
            </button>
          </>
        ) || selectedTimeMetric && (
          <>
            <h3 className="text-xl font-bold mb-4">{selectedTimeMetric.title}</h3>
            <LineGraphTimeD data={selectedTimeMetric.data || []} color="#3B82F6" />
            <button
              className="mt-6 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
              onClick={closePopup}
            >
              Close
            </button>
          </>
        ) || selectedbarMetric && (
          <>
            <h3 className="text-xl font-bold mb-4">{selectedbarMetric.title}</h3>
            <BarGraph_Main data={selectedbarMetric.data || []}/>
            <button
              className="mt-6 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
              onClick={closePopup}
            >
              Close
            </button>
          </>
        ) || selectedMacDMetric && (
          <>
            <h3 className="text-xl font-bold mb-4">{selectedMacDMetric.title}</h3>
            <MACDMainChart data={selectedMacDMetric.data || []}/>
            <button
              className="mt-6 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
              onClick={closePopup}
            >
              Close
            </button>
          </>
        ) || selectedRSIMetric && (
          <>
            <h3 className="text-xl font-bold mb-4">{selectedRSIMetric.title}</h3>
            <RSIChart rsiData={selectedRSIMetric.data || []}/>
            <button
              className="mt-6 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
              onClick={closePopup}
            >
              Close
            </button>
          </>
        )
        
        }
      </Modal>
     
    </div>
  );
};

export default MetricsGrid;

interface SentimentMeterProps {
  score: number; // Value between 0 and 100
}
const SentimentMeter: React.FC<SentimentMeterProps> = ({ score }) => {
  // Determine color based on score
  const getColor = (score: number) => {
    if (score < 25) return "#FF4136"; // Fear - Red
    if (score < 50) return "#FF851B"; // Caution - Orange
    if (score < 75) return "#FFDC00"; // Neutral - Yellow
    return "#2ECC40"; // Greed - Green
  };

  // Calculate rotation angle for the needle (0-180 degrees)
  // For a semicircular dial, we need to rotate from -90 to 90 degrees
  // where -90 is 0% and 90 is 100%
  const needleRotation = -90 + (score / 100) * 180;
  
  return (
    <div className="relative w-60 h-60">
      <svg viewBox="0 0 100 60" className="w-full h-full">
        {/* Gradient background for the dial */}
        <defs>
          <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF4136" />
            <stop offset="33%" stopColor="#FF851B" />
            <stop offset="66%" stopColor="#FFDC00" />
            <stop offset="100%" stopColor="#2ECC40" />
          </linearGradient>
        </defs>
        
        {/* Dial background - semi-circle */}
        <path 
          d="M 10,50 A 40,40 0 0,1 90,50" 
          stroke="url(#dialGradient)" 
          strokeWidth="10" 
          fill="none" 
        />
        
        {/* Needle with correct rotation */}
        <g transform={`rotate(${needleRotation}, 50, 50)`}>
          <line 
            x1="50" 
            y1="50" 
            x2="50" 
            y2="15" 
            stroke={getColor(score)} 
            strokeWidth="2" 
          />
          <circle cx="50" cy="50" r="3" fill={getColor(score)} />
        </g>

        {/* Tick marks and labels */}
        <text x="10" y="58" fontSize="6" textAnchor="middle" fill="white">0</text>
        <text x="30" y="58" fontSize="6" textAnchor="middle" fill="white">25</text>
        <text x="50" y="58" fontSize="6" textAnchor="middle" fill="white">50</text>
        <text x="70" y="58" fontSize="6" textAnchor="middle" fill="white">75</text>
        <text x="90" y="58" fontSize="6" textAnchor="middle" fill="white">100</text>
      </svg>
      
      {/* Score display */}
      <div className="absolute bottom-0 left-0 right-0 text-center text-sm font-bold">
        {score < 25 ? "Extreme Fear" : 
         score < 50 ? "Fear" : 
         score < 75 ? "Greed" : "Extreme Greed"}
        <div className="text-sm font-bold">{score.toFixed(0)}</div>
      </div>
    </div>
  );
};
