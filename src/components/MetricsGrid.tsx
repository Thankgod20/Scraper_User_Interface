import React, { JSX, useState, useEffect } from 'react';
import LineGraph from "./LineGraph";
import LineGraphTimeS from "./LineGraphTimeS"
import DLineGraph from './DetailedLineGraph';
import { NumberFormatter } from '@/app/utils/largeNumber';
import { QRCodeCanvas } from "qrcode.react"; // Ensure you install this package: npm install qrcode.react
import Modal from "react-modal";
import ReactDOM from "react-dom";
import LineGraphTimeD from "./LineGraphTimeD"
//Modal.setAppElement("#root");

interface MetricCardProps {
  title: string;
  value: string;
  percentageChange: string;
  subText: string;
  graph: JSX.Element;
  isPositiveChange: boolean;
  onClick: () => void;
}
interface Impression {
  name: string;
  value: number;
}
interface TimeSeries {
  time: string;
  aggregatedSentiment: number;
}
interface MetricGridProps {
  address: any;
  name: any;
  twitter: any;
  tweetPerMinut: Impression[];
  impression: Impression[];
  engagement: Impression[];
  tweetViews: Impression[];
  sentimentPlot: TimeSeries[];
  tweetsWithAddress: { tweet: string; views: number; likes: number; timestamp: string }[];
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  percentageChange,
  subText,
  graph,
  isPositiveChange,
  onClick
}) => {
  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg shadow-md" onClick={onClick}>
      <h3 className="text-sm text-gray-400 mb-1">{title}</h3>
      <div className="text-2xl font-bold mb-2">{value}</div>
      <div className={`text-sm ${isPositiveChange ? "text-green-400" : "text-red-400"}`}>
        {percentageChange}
      </div>
      <p className="text-xs text-gray-500 mt-1">{subText}</p>
      <div className="mt-4">{graph}</div>
    </div>
  );
};

// ----------------- New Helper Functions -----------------

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
}/*
function calculateTweetViewsRatioPercentage(
  tweetPerFVmints: Impression[],
  movingAverageTweetViews: Impression[]
): Impression[] {
  const minLength = Math.min(tweetPerFVmints.length, movingAverageTweetViews.length);
  const ratioData: Impression[] = [];

  for (let i = 0; i < minLength; i++) {
    const avgViews = movingAverageTweetViews[i].value;
    const tweets = tweetPerFVmints[i].value;
    // Calculate the ratio; if avgViews is 0, set ratio to 0 to avoid division by zero.
    let ratio = avgViews !== 0 ? tweets / avgViews : 0;
    // Convert to percentage and cap at 100%
    ratio = Math.min(100, ratio * 100);

    ratioData.push({
      name: tweetPerFVmints[i].name,
      value: ratio,
    });
  }

  return ratioData;
}
*/

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
  const rawTrend: Impression[] = sortedData.map(point => {
    const currentTime = new Date(point.name).getTime();
    const windowStart = currentTime - windowMinutes * 60000;
    // Sum tweets within the window.
    const frequency = sortedData
      .filter(p => {
        const time = new Date(p.name).getTime();
        return time >= windowStart && time <= currentTime;
      })
      .reduce((sum, p) => sum + p.value, 0);
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
  const rawTrend: Impression[] = sortedData.map(point => {
    const currentTime = new Date(point.name).getTime();
    const windowStart = currentTime - windowMinutes * 60000;
    // Count tweets within the window.
    const frequency = sortedData.filter(p => {
      const time = new Date(p.name).getTime();
      return time >= windowStart && time <= currentTime;
    }).length;
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
  //console.log(" tweetFrequencyTrend ",tweetFrequencyTrend,sentimentTrend,views,numberTweet)
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
  if (impressions.length < 2) return impressions;
  const result: Impression[] = [];
  let cumulativeSum = 0;
  for (let i = 0; i < impressions.length; i++) {
    if (i === 0) {
      result.push({ name: impressions[i].name, value: 0 });
    } else {
      const prevValue = impressions[i - 1].value;
      const currValue = impressions[i].value;
      if (prevValue !== 0) {
        const percentageDiff = ((currValue - prevValue) / prevValue);
        cumulativeSum += percentageDiff;
      }
      result.push({ name: impressions[i].name, value: cumulativeSum });
    }
  }
  return result;
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
): { count: Impression[]; views: Impression[] } => {
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

  const countArray: Impression[] = Object.entries(intervalMapCount).map(
    ([name, value]) => ({ name, value })
  );
  const viewsArray: Impression[] = Object.entries(intervalMapViews).map(
    ([name, value]) => ({ name, value })
  );
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

const MetricsGrid: React.FC<MetricGridProps> = ({ address, name, twitter, tweetPerMinut, impression, engagement,tweetViews,sentimentPlot,tweetsWithAddress }) => {
  let twt = `https://x.com/search?q=${address}`;
  if (twitter != null) {
    twt = twitter;
  }
  const [selectedMetric, setSelectedMetric] = useState<{ title: string; data: Impression[] | null } | null>(null);
  const [selectedTimeMetric, setSelectedTimeMetric] = useState<{ title: string; data: TimeSeries[] | null } | null>(null);
  const totalTweets_ = tweetPerMinut.reduce((sum, tweet) => sum + tweet.value, 0);
  const totalTweets = NumberFormatter.formatNumber(totalTweets_);
  const tweetViewsPerFVmints = categorizeTweetsByInterval(tweetViews, 5);
  const movingAverageTweetViews = calculateMovingAverage(tweetViewsPerFVmints, 9);

//console.log("Impression Data",tweetViewsPerFVmints)
  // Group tweets by 5 minutes.
  const tweetPerFVmints = categorizeTweetsByInterval(tweetPerMinut, 5);
  const tweetPerTnmints = categorizeTweetsByInterval(tweetPerMinut, 10);

  const tweetViewsRatioPercentage =calculateCumulativeRatioPercentage (
    tweetPerFVmints,
    tweetViews
  );
  //calculateTweetViewsRatioPercentage(tweetPerTnmints,movingAverageTweetViews)
  // Calculate tweet growth based on the 5-minute grouping.
  const tweetGrowthPercentage = calculateTweetGrowthFromGroupedData(tweetPerFVmints, 5);
  // Calculate impression growth percentage.
  const impressionGrowthPercentage = calculateImpressionGrowth(impression);
  // Calculate the overall average views per tweet (as a number).
  const avgViewsPerTweet = calculateAverageViewsPerTweet(tweetViews, tweetPerMinut);
  // Calculate the average views per tweet over time for plotting.
  const averageViewsPlot = calculateAverageViewsPlot(tweetPerMinut, impression);

  const averagePercentageFv = calculateAveragePercentage(tweetPerFVmints);
  const cummulatedSumFv = calculateCumulativePercentage(tweetPerFVmints);
  const averagePercentage = calculateAveragePercentage(tweetPerMinut);
  const cummulatedSum = calculateCumulativePercentage(tweetPerMinut);
  const cumuImpression = calculateCumulativePercentage(impression);
  const cumuAvrage = calculateAveragePercentage(impression);
  const cumuEngage = calculateCumulativePercentage(engagement);
  const cumuAvragEngage = calculateAveragePercentage(engagement);
  const sentimentMomentum = calculateSentimentMomentum(impression);
  const sentimentMomentumPlot = calculateSentimentMomentumPlot(impression);
  const sentimentVolatility = calculateSentimentVolatility(impression);
  const weightedSentiment = calculateSentimentWeightedMetrics(impression, engagement);
  const sentimentPeaks = detectSentimentPeaks(impression);
  const tweetFrequencyTrend = calculateTweetFrequencyTrendPercentage(tweetPerMinut, 15, 9,20);
  const sentimentTrend = calculateSentimentTrend(sentimentPlot, 30);
  const currentSentimentTrend = sentimentTrend[sentimentTrend.length - 1]?.aggregatedSentiment || 0;
  const currentTweetFrequencyTrend = tweetFrequencyTrend[tweetFrequencyTrend.length - 1]?.value || 0;
  const rawViews = avgViewsPerTweet; 
  const avgLstView = calculateAverageViewsPerTweet(tweetViewsPerFVmints.slice(-15),tweetViewsPerFVmints.slice(-15))

  //console.log("AVGGGGG",avgLstView,tweetViewsPerFVmints.slice(-15),tweetViewsPerFVmints.slice(-15))
  const { count: tweetsWithAddressCount, views: tweetsWithAddressViews } = groupTweetsWithAddressByInterval(
    tweetsWithAddress,
    5
  );
  const tweetsWithAddressFrequency = calculateTweetFrequencyTrendPercentage(tweetsWithAddressCount, 15, 9, 10);
  const currentTweetWiAddFrequencyTrend = tweetsWithAddressFrequency[tweetsWithAddressFrequency.length - 1]?.value || 0;
  const tweetwithAddAvgViews = calculateAverageViewsPerTweet(tweetsWithAddressViews, tweetsWithAddressCount);
  const tweetwithAddAvgViewsS = calculateAverageViewsPerTweet(tweetsWithAddressViews.slice(-15), tweetsWithAddressCount.slice(-15));
  //console.log("Average View per Tweet",tweetsWithAddressViews)
  const openPopup = (title: string, data: Impression[]) => {
    setSelectedMetric({ title, data });
  };
  const openPopupTime = (title: string, data: TimeSeries[]) => {
    setSelectedTimeMetric({ title, data });
  };

  const closePopup = () => {
    setSelectedMetric(null);
    setSelectedTimeMetric(null);
  };

  useEffect(() => {
    Modal.setAppElement("#root");
  }, []);
  //console.log(" SSDDDD ",NumberFormatter.formatNumber(Number(((Number(parseViewsCount(totalTweets))/avgViewsPerTweet)*100).toFixed(2))),parseViewsCount(totalTweets),avgViewsPerTweet)
  return (
    <div className="bg-gray-800 text-white rounded-lg p-4 shadow-lg max-w-md ">
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
      <div className="grid grid-cols-2 gap-4 h-[50vh] overflow-y-auto">
      <MetricCard
          title="Tweet Frequency Trend (%)"
          value={tweetFrequencyTrend.length > 0 ? tweetFrequencyTrend[tweetFrequencyTrend.length - 1].value.toFixed(2) +"%": "0%"}
          percentageChange=""
          subText="Frequency of tweets over time"
          isPositiveChange={tweetFrequencyTrend.length > 0 && tweetFrequencyTrend[tweetFrequencyTrend.length - 1].value > 0}
          graph={<LineGraph data={tweetFrequencyTrend} color="#10B981" />}
          onClick={() => openPopup("Tweet Frequency Trend", tweetFrequencyTrend)}
        />
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
        />
        <MetricCard
          title="Callers/min (Avg.)"
          value={totalTweets}
          percentageChange={(averagePercentage > 0 ? "+" : "") + averagePercentage.toFixed(2) + "%"}
          subText={averagePercentage.toFixed(2) + (averagePercentage > 0 ? " Increase" : " Decrease") + " in tweets/min"}
          isPositiveChange={averagePercentage > 0}
          graph={<LineGraph data={tweetPerMinut} color="#10B981" />}
          onClick={() => openPopup("Callers/min (Avg.)", tweetPerMinut)}
        />
        <MetricCard
          title="Callers/5min (Avg.)"
          value={totalTweets}
          percentageChange={(averagePercentageFv > 0 ? "+" : "") + averagePercentageFv.toFixed(2) + "%"}
          subText={averagePercentageFv.toFixed(2) + (averagePercentageFv > 0 ? " Increase" : " Decrease") + " in tweets/5min"}
          isPositiveChange={averagePercentageFv > 0}
          graph={<LineGraph data={tweetPerFVmints} color="#10B981" />}
          onClick={() => openPopup("Callers/5min (Avg.)", tweetPerFVmints)}
        />
        <MetricCard
          title="Tweets w/ Address (5min Count)"
          value={
            tweetsWithAddressCount.length.toString()
          }
          percentageChange=""
          subText="Number of tweets with address per 5 minutes"
          isPositiveChange={
            tweetsWithAddressCount.length > 0 &&
            tweetsWithAddressCount[tweetsWithAddressCount.length - 1].value > 0
          }
          graph={<LineGraph data={tweetsWithAddressCount} color="#60A5FA" />}
          onClick={() => openPopup("Tweets w/ Address Count", tweetsWithAddressCount)}
        />
        <MetricCard
          title="Impression Growth"
          value={impressionGrowthPercentage.toFixed(2) + "%"}
          percentageChange={(impressionGrowthPercentage >= 0 ? "+" : "") + impressionGrowthPercentage.toFixed(2) + "%"}
          subText={impressionGrowthPercentage.toFixed(2) + "% change in impressions"}
          isPositiveChange={impressionGrowthPercentage >= 0}
          graph={<LineGraph data={cumuImpression} color="#10B981" />}
          onClick={() => openPopup("Impression Growth", cumuImpression)}
        />
        <MetricCard
          title="Sentiment Volatility"
          value={calculateSentimentVolatility(impression).toFixed(2)}
          percentageChange="Variability"
          subText="Variability in sentiment over time"
          isPositiveChange={sentimentVolatility < 10}
          graph={<LineGraphTimeS data={sentimentTrend} color="#F59E0B" />}
          onClick={() => openPopupTime("Sentiment Volatility", sentimentTrend)}
        />
        <MetricCard
          title="Peak Sentiments"
          value={detectSentimentPeaks(impression).length.toString()}
          percentageChange="Detected Peaks"
          subText="Number of sentiment peaks detected"
          isPositiveChange={detectSentimentPeaks(impression).length > 0}
          graph={<LineGraph data={detectSentimentPeaks(impression)} color="#EF4444" />}
          onClick={() => openPopup("Peak Sentiments", detectSentimentPeaks(impression))}
        />
        <MetricCard
          title="Avg. Views/Tweet"
          value={NumberFormatter.formatNumber(Number(avgViewsPerTweet.toFixed(2)))}
          percentageChange=""
          subText="Overall average views per tweet"
          isPositiveChange={avgViewsPerTweet >= 0}
          graph={<LineGraph data={tweetViewsPerFVmints} color="#3B82F6" />}
          onClick={() => openPopup("Average Views/Tweet", tweetViewsPerFVmints)}
        />
        <MetricCard
            title="Views for Tweets w/ Address (5min)"
            value={NumberFormatter.formatNumber(Number(tweetwithAddAvgViews.toFixed(2)))}
              
            percentageChange=""
            subText="Aggregated views per 5 minutes for tweets with address"
            isPositiveChange={
              tweetsWithAddressViews.length > 0 &&
              tweetsWithAddressViews[tweetsWithAddressViews.length - 1].value > 0
            }
            graph={<LineGraph data={tweetsWithAddressViews} color="#F87171" />}
            onClick={() => openPopup("Views for Tweets w/ Address", tweetsWithAddressViews)}
          />
          <MetricCard
          title="AvgTweetMade/AvgViews"
          value={NumberFormatter.formatNumber(Number(((Number(parseViewsCount(totalTweets))/avgViewsPerTweet)*100).toFixed(2)))}
          percentageChange=""
          subText="Overall Interest of callers"
          isPositiveChange={avgViewsPerTweet >= 0}
          graph={<LineGraph data={tweetViewsRatioPercentage} color="#3B82F6" />}
          onClick={() => openPopup("Average Views/Tweet", tweetViewsRatioPercentage)}
        />
      </div>
      <div style={{ textAlign: "center", padding: "20px" }}>
        <h1>Hype Meter</h1>
        <SentimentMeter value={Math.round(calculateSentimentScore(currentTweetFrequencyTrend, currentSentimentTrend,avgLstView,Number(totalTweets) ))} />
        <h1>Hype Meter For Address</h1>
        <SentimentMeter value={Math.round(calculateSentimentScore(currentTweetWiAddFrequencyTrend, currentSentimentTrend,tweetwithAddAvgViewsS,tweetsWithAddressCount.length ))} />
      </div>
      <Modal
        isOpen={!!selectedMetric || !!selectedTimeMetric}
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
        )}
      </Modal>
     
    </div>
  );
};

export default MetricsGrid;

interface SentimentMeterProps {
  value: number; // Value between 0 and 100
}

const SentimentMeter: React.FC<SentimentMeterProps> = ({ value }) => {
  const boundedValue = Math.min(100, Math.max(0, value));
  const rotation = (boundedValue / 100) * 180 - 90;
  const sentimentLabel =
    boundedValue < 25
      ? "Dead"
      : boundedValue < 50
      ? "Low"
      : boundedValue < 70
      ? "Neutral"
      : "Confidence";
  const labelColor =
    boundedValue < 25
      ? "red"
      : boundedValue < 50
      ? "orange"
      : boundedValue < 75
      ? "yellowgreen"
      : "green";
  const meterStyle: React.CSSProperties = {
    position: "relative",
    width: "250px",
    height: "125px",
    backgroundColor: "#2E2E2E",
    borderRadius: "250px 250px 0 0",
    overflow: "hidden",
  };
  const segmentContainerStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 20px",
  };
  const segmentStyle = (color: string): React.CSSProperties => ({
    flex: 1,
    height: "20px",
    margin: "0 5px",
    backgroundColor: color,
    borderRadius: "10px",
  });
  const dialStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "0",
    left: "50%",
    width: "2px",
    height: "100px",
    backgroundColor: "white",
    transformOrigin: "bottom",
    transform: `rotate(${rotation}deg)`,
  };
  const pointerCircleStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "-10px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "20px",
    height: "20px",
    backgroundColor: "red",
    borderRadius: "50%",
  };
  const labelStyle: React.CSSProperties = {
    textAlign: "center",
    marginTop: "20px",
    color: "white",
    fontSize: "20px",
    fontWeight: "bold",
  };
  const valueStyle: React.CSSProperties = {
    fontSize: "40px",
    color: "white",
  };
  const sentimentStyle: React.CSSProperties = {
    color: labelColor,
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={meterStyle}>
        <div style={segmentContainerStyle}>
          <div style={segmentStyle("red")} />
          <div style={segmentStyle("orange")} />
          <div style={segmentStyle("yellowgreen")} />
          <div style={segmentStyle("green")} />
        </div>
        <div style={dialStyle}>
          <div style={pointerCircleStyle} />
        </div>
      </div>
      <div style={labelStyle}>
        <div style={valueStyle}>{boundedValue}</div>
        <div style={sentimentStyle}>{sentimentLabel}</div>
      </div>
    </div>
  );
};
