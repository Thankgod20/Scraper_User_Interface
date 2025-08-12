import redisClient from '@/lib/redis';
import { analyzeCoinData } from '../../lib/pschologist';
import { BehavioralAnalysisResult } from '../../lib/analysisTypes';
import axios from "axios";
import { NextRequest } from 'next/server';

type Data = BehavioralAnalysisResult | { error: string; details?: string };

const CACHE_EXPIRATION_SECONDS = 6400; // Cache results for 1 hour
// types/api.ts
export interface ApiParams {
    address: string;
    symbol: string;
    page: number;
    limit: number;
    timeframe?: string;
    startTime?: string;
    endTime?: string;
  }
  
  export interface TimeRange {
    start: Date;
    end: Date;
  }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const symbol = searchParams.get('symbol');
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '2000';
  const timeframe = searchParams.get('timeframe') || '11:00 AM to 11:59 PM';
  const mc = searchParams.get('mc') || '70K';
  console.log("Narrator params", { address, symbol, page, limit, timeframe });

  if (!address || !symbol) {
    return Response.json({ error: 'Missing required query parameters: address and symbol.' }, { status: 400 });
  }

  const cacheKey = `sentiment:${address}:${timeframe}`;

  try {
    const cachedResult = await redisClient.get(cacheKey);
    if (cachedResult) {
      console.log(`[Cache] HIT for key: ${cacheKey}`);
      return Response.json(JSON.parse(cachedResult));
    }

    console.log(`[Cache] MISS for key: ${cacheKey}. Fetching new data.`);
    const externalApiUrl = `http://localhost:3000/api/sentiment?address=${address}&symbol=${symbol}&page=${page}&limit=${limit}`;
    console.log(`Fetching data from: ${externalApiUrl}`);

    const dataResponse = await axios.get(externalApiUrl);
    if (!dataResponse) {
      throw new Error(`Failed to fetch data from external API: 402`);
    }

    const coinData = dataResponse.data;
    console.log(`Fetched data for ${symbol} (${address})`);
    //console.dir(coinData, { depth: null, colors: true }); // 👈 most readable
    const [startTime, endTime] = timeframe.split(" to ").map(t => t.trim());

    // 1️⃣ Get added_at timestamp for the address
    const addrListUrl = `http://16.16.25.81:3300/addresses/address.json`;
    const addrResp = await axios.get(addrListUrl);
    const addrInfo = addrResp.data.find((item: any) => item.address === address);

    if (!addrInfo) {
      throw new Error(`Address ${address} not found in address list`);
    }

    const addedAtISO = addrInfo.added_at; // e.g. "2025-08-11T19:28:42.728464835Z"
    const addedAtUnix = Math.floor(new Date(addedAtISO).getTime() / 1000); // convert to seconds
    console.log(`Address ${address} added at: ${addedAtISO} (Unix: ${addedAtUnix})`);
    // 2️⃣ Fetch OHLCV data
    const ohlcvUrl = `http://16.16.25.81:3300/get-ohlcv?poolId=${address}`;
    const ohlcvResp = await axios.get(ohlcvUrl);

    const ohlcvList: [number, number, number, number, number, number][] =
      ohlcvResp.data.data.attributes.ohlcv_list;

    const endUnix = parseUTC(endTime)//Math.floor(new Date(endTime).getTime() / 1000);
    console.log(`End time in Unix seconds: ${endUnix}`);
    // 3️⃣ Filter OHLCV data where timestamp >= added_at
    const filteredOhlcv = ohlcvList.filter(([timestamp]) => timestamp >= addedAtUnix && timestamp <= endUnix );

    // 👈 most readable
    let tb = filterDataByTime(coinData, startTime, endTime);
    console.log(`Filtered data for timeframe: ${startTime} to ${endTime}`);
    console.dir(tb, { depth: null, colors: true }); // 👈 most readable

    

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("Server is missing Google API Key configuration.");
    }
    let numX = parseInt(mc) * 1000;
    let numTarget = 70000;

    let MCresult;
    if (numX < numTarget) {
      MCresult = `decreases from 70K to ${mc}`;
    } else if (numX > numTarget) {
      MCresult = `increases from 70K to ${mc}`;
    } else {
      MCresult = `did not change, and remains at ${mc}`;
    }

    const analysisResult = await analyzeCoinData({
      symbol,
      timeframe,
      mc:MCresult,
      apiKey,
      data: tb,//coinData,
      ohlcv: filteredOhlcv,
    });

    await redisClient.set(cacheKey, JSON.stringify(analysisResult), 'EX', CACHE_EXPIRATION_SECONDS);
    console.log(`[Cache] SET for key: ${cacheKey}. Expiration: ${CACHE_EXPIRATION_SECONDS}s`);

    return Response.json(analysisResult);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error(`[API Error] for ${address}:`, errorMessage);
    return Response.json({ error: 'Failed to process request.', details: errorMessage }, { status: 500 });
  }
}
function parseUTC(dateTimeStr:string): number { 
  const [datePart, timePart, ampm] = dateTimeStr.replace(",", "").split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  let [hour, minute] = timePart.split(":").map(Number);

  if (ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;

  return Date.UTC(year, month - 1, day, hour, minute) / 1000; // UNIX seconds UTC
}
// Enhanced time parsing function that handles multiple formats
function parseTimeToDate(timeStr: string): Date {
    const now = new Date();
    
    // ISO 8601 with UTC or offset (e.g., "2025-07-13T23:42:42Z" or "+00:00")
    if (/T.*(\+|-|Z)/.test(timeStr)) {
      return new Date(timeStr); // Leave this as-is; UTC strings should stay in UTC
    }
    
    // Locale string with date and time (e.g., "7/14/2025, 1:15:00 AM")
    if (timeStr.includes('/') && timeStr.includes(',')) {
      // Manual parsing to preserve exact time as UTC
      const match = timeStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)/i);
      if (match) {
        const [, month, day, year, hour, minute, second, ampm] = match;
        let hours = parseInt(hour);
        
        if (ampm.toLowerCase() === 'pm' && hours !== 12) hours += 12;
        if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
        
        return new Date(Date.UTC(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          hours,
          parseInt(minute),
          parseInt(second)
        ));
      }
      
      // Fallback: try without seconds
      const matchNoSeconds = timeStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
      if (matchNoSeconds) {
        const [, month, day, year, hour, minute, ampm] = matchNoSeconds;
        let hours = parseInt(hour);
        
        if (ampm.toLowerCase() === 'pm' && hours !== 12) hours += 12;
        if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
        
        return new Date(Date.UTC(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          hours,
          parseInt(minute),
          0
        ));
      }
    }
    
    // Simple ISO 8601 without time zone (e.g., "2025-07-13T23:42")
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timeStr)) {
      const [datePart, timePart] = timeStr.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      return new Date(Date.UTC(year, month - 1, day, hour, minute)); // Manually treat as UTC
    }
    
    // Handle 12-hour format (e.g., "12:20 pm")
    if (/\d{1,2}:\d{2}\s*(am|pm)/i.test(timeStr)) {
      const [time, modifier] = timeStr.trim().split(/\s+/);
      let [hours, minutes] = time.split(":").map(Number);
      
      if (modifier.toLowerCase() === "pm" && hours !== 12) hours += 12;
      if (modifier.toLowerCase() === "am" && hours === 12) hours = 0;
      
      // Use UTC to preserve the exact time
      const result = new Date(now);
      result.setUTCHours(hours, minutes, 0, 0);
      return result;
    }
    
    // Handle 24-hour time (e.g., "23:42")
    if (/^\d{2}:\d{2}$/.test(timeStr)) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const result = new Date(now);
      result.setUTCHours(hours, minutes, 0, 0);
      return result;
    }
    
    // Fallback
    const parsed = new Date(timeStr);
    return isNaN(parsed.getTime()) ? now : parsed;
  }
  
  
  // Enhanced helper function to normalize time input
  function normalizeTimeInput(timeStr: string): Date {
    // If it's already a full date string, use it as is
    if (timeStr.includes('/') || timeStr.includes('T') || timeStr.includes('-')) {
      return parseTimeToDate(timeStr);
    }
    
    // If it's just time (like "12:20 pm"), assume today's date
    return parseTimeToDate(timeStr);
  }
  
  // Complete TweetData interface based on your data structure
  interface TweetData {
    tweetDetail: {
      extractedUsernames: string[];
      extractedUserfollowers: string[];
      extractedTweets: string[];
      extractedTimes: string[];
      extractedView: string[];
      extractedLikes: string[];
      extractedProfile: string[];
    };
    emojiArray: Array<{
      em_time: number;
      emoji: string;
    }>;
    frequency: {
      tweetFrequencyTrend: Array<{ name: string; value: number }>;
      tweetsWithAddressFrequency: Array<{ name: string; value: number }>;
    };
    tweetperMinutes: {
      tweetsPerMinuteArray: Array<{ name: string; value: number }>;
      tweetPerFVmints: Array<{ name: string; value: number }>;
      tweetsWithAddressCount: Array<{ name: string; value: number }>;
      totalTweets: string;
      averagePercentageFv: number;
      averagePercentage: number;
      numbottweet: number;
    };
    SEI: {
      SEI_value: Array<{ name: string; value: number }>;
      SEI_Velocity: Array<{ name: string; value: number }>;
      SEI_EMA: Array<{ name: string; value: number }>;
    };
    Fomo: {
      tweetFomo: Array<{ name: string; value: number }>;
      compositFomo: Array<{ name: string; value: number }>;
      macd: Array<{ 
        name: string; 
        macd: number; 
        signal: number; 
        histogram: number; 
      }>;
      RSI: Array<{ name: string; value: number }>;
    };
    impression: {
      weighBasedImpression: Array<{ 
        name: string; 
        value: number; 
        posImpressions: number; 
        negImpressions: number; 
        engagementRate: number; 
      }>;
      sentimentTrend: Array<{ 
        name: string; 
        value: number; 
        posImpressions: number; 
        negImpressions: number; 
        engagementRate: number; 
      }>;
      EWMA_Value: Array<{ name: string; value: number }>;
      tiredImpression: Array<{
        name: string;
        whale: { impressions: number; engagement: number; volume: number };
        shark: { impressions: number; engagement: number; volume: number };
        retail: { impressions: number; engagement: number; volume: number };
      }>;
      tieredAccountCount: Array<{
        name: string;
        whale: number;
        shark: number;
        retail: number;
      }>;
      tweetvelocityImpressions: Array<{
        name: string;
        newUniqueViewers: number;
        cumulativeUniqueViewers: number;
        posImpressions: number;
        negImpressions: number;
        engagementRate: number;
      }>;
    };
    views: {
      tweetViewsPerFVmints: Array<{ name: string; value: number; preval: number }>;
      tweetsWithAddressViews: Array<{ name: string; value: number; preval: number }>;
      tweetViewsRatioPercentage: Array<{ name: string; value: number }>;
      avgViewsPerTweet: number;
      tweetwithAddAvgViews: number;
    };
    hype: {
      sentiMeter: number;
      sentiMeterAddr: number;
    };
    aiAnalysis: {
      mainNarrative: string;
      keyThemes: {
        positive: string[];
        negative: string[];
      };
      narrativeScore: number;
      scoreReasoning: string;
      summary: string;
    };
    meta: {
      currentPage: number;
      totalPages: number;
      pageSize: number;
      totalItems: number;
    };
  }
  
  // Helper function to filter arrays with time-based items (arrays are in descending order)
  function filterTimeBasedArray<T extends { name: string }>(
    array: T[], 
    startTime: Date, 
    endTime: Date
  ): T[] {
    if (!array || array.length === 0) return [];
    
    return array.filter(item => {
      const itemTime = parseTimeToDate(item.name);
      return itemTime >= startTime && itemTime <= endTime;
    });
  }
  
  // Helper function to filter emojiArray (uses em_time timestamp)
  function filterEmojiArray(
    array: Array<{ em_time: number; emoji: string }>, 
    startTime: Date, 
    endTime: Date
  ): Array<{ em_time: number; emoji: string }> {
    if (!array || array.length === 0) return [];
    
    const startTimestamp = startTime.getTime();
    const endTimestamp = endTime.getTime();
    
    return array.filter(item => {
      return item.em_time >= startTimestamp && item.em_time <= endTimestamp;
    });
  }
  
  // Helper function to filter tweetDetail arrays (uses extractedTimes for time reference)
  function filterTweetDetailArrays(
    tweetDetail: TweetData['tweetDetail'],
    startTime: Date,
    endTime: Date
  ): TweetData['tweetDetail'] {
    if (!tweetDetail.extractedTimes || tweetDetail.extractedTimes.length === 0) {
      return {
        extractedUsernames: [],
        extractedUserfollowers:[],
        extractedTweets: [],
        extractedTimes: [],
        extractedView: [],
        extractedLikes: [],
        extractedProfile: [],
      };
    }
    
    const filteredIndices: number[] = [];
    
    // Find indices where time falls within range
    tweetDetail.extractedTimes.forEach((timeStr, index) => {
      const itemTime = parseTimeToDate(timeStr);
      if (itemTime >= startTime && itemTime <= endTime) {
        filteredIndices.push(index);
      }
    });
    
    // Filter all arrays based on matching indices
    return {
      extractedUsernames: filteredIndices.map(i => tweetDetail.extractedUsernames[i] || ''),
      extractedUserfollowers: filteredIndices.map(i => tweetDetail.extractedUserfollowers[i] || ''),
      extractedTweets: filteredIndices.map(i => tweetDetail.extractedTweets[i] || ''),
      extractedTimes: filteredIndices.map(i => tweetDetail.extractedTimes[i] || ''),
      extractedView: filteredIndices.map(i => tweetDetail.extractedView[i] || ''),
      extractedLikes: filteredIndices.map(i => tweetDetail.extractedLikes[i] || ''),
      extractedProfile: filteredIndices.map(i => tweetDetail.extractedProfile[i] || ''),
    };
  }
  
  // Enhanced filtering function that filters each array individually
  function filterDataByTime(data: TweetData, startTime: string, endTime: string): TweetData {
    const start = normalizeTimeInput(startTime);
    const end = normalizeTimeInput(endTime);
    
    // Handle case where end time is before start time (crossing midnight)
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    console.log(`Filtering data from ${start.toISOString()} to ${end.toISOString()}, normal time ${startTime} to ${endTime}`);
    
    // Filter tweetDetail arrays using extractedTimes as reference
    const filteredTweetDetail = filterTweetDetailArrays(data.tweetDetail, start, end);
    
    // Filter emojiArray using em_time timestamp
    const filteredEmojiArray = filterEmojiArray(data.emojiArray, start, end);
    
    // Filter all time-based arrays individually
    const filteredFrequency = {
      tweetFrequencyTrend: filterTimeBasedArray(data.frequency.tweetFrequencyTrend, start, end),
      tweetsWithAddressFrequency: filterTimeBasedArray(data.frequency.tweetsWithAddressFrequency, start, end),
    };
    
    const filteredTweetperMinutes = {
      ...data.tweetperMinutes,
      tweetsPerMinuteArray: filterTimeBasedArray(data.tweetperMinutes.tweetsPerMinuteArray, start, end),
      tweetPerFVmints: filterTimeBasedArray(data.tweetperMinutes.tweetPerFVmints, start, end),
      tweetsWithAddressCount: filterTimeBasedArray(data.tweetperMinutes.tweetsWithAddressCount, start, end),
    };
    
    const filteredSEI = {
      SEI_value: filterTimeBasedArray(data.SEI.SEI_value, start, end),
      SEI_Velocity: filterTimeBasedArray(data.SEI.SEI_Velocity, start, end),
      SEI_EMA: filterTimeBasedArray(data.SEI.SEI_EMA, start, end),
    };
    
    const filteredFomo = {
      tweetFomo: filterTimeBasedArray(data.Fomo.tweetFomo, start, end),
      compositFomo: filterTimeBasedArray(data.Fomo.compositFomo, start, end),
      macd: filterTimeBasedArray(data.Fomo.macd, start, end),
      RSI: filterTimeBasedArray(data.Fomo.RSI, start, end),
    };
    
    const filteredImpression = {
      weighBasedImpression: filterTimeBasedArray(data.impression.weighBasedImpression, start, end),
      sentimentTrend: filterTimeBasedArray(data.impression.sentimentTrend, start, end),
      EWMA_Value: filterTimeBasedArray(data.impression.EWMA_Value, start, end),
      tiredImpression: filterTimeBasedArray(data.impression.tiredImpression, start, end),
      tieredAccountCount: filterTimeBasedArray(data.impression.tieredAccountCount, start, end),
      tweetvelocityImpressions: filterTimeBasedArray(data.impression.tweetvelocityImpressions, start, end),
    };
    
    const filteredViews = {
      ...data.views,
      tweetViewsPerFVmints: filterTimeBasedArray(data.views.tweetViewsPerFVmints, start, end),
      tweetsWithAddressViews: filterTimeBasedArray(data.views.tweetsWithAddressViews, start, end),
      tweetViewsRatioPercentage: filterTimeBasedArray(data.views.tweetViewsRatioPercentage, start, end),
    };
    
    // Calculate total filtered items across all arrays for meta information
    const totalFilteredItems = Math.max(
      filteredTweetDetail.extractedTimes.length,
      filteredFrequency.tweetFrequencyTrend.length,
      filteredImpression.weighBasedImpression.length,
      filteredViews.tweetViewsPerFVmints.length
    );
    
    return {
      ...data,
      tweetDetail: filteredTweetDetail,
      emojiArray: filteredEmojiArray,
      frequency: filteredFrequency,
      tweetperMinutes: filteredTweetperMinutes,
      SEI: filteredSEI,
      Fomo: filteredFomo,
      impression: filteredImpression,
      views: filteredViews,
      meta: {
        ...data.meta,
        totalItems: totalFilteredItems,
        totalPages: Math.ceil(totalFilteredItems / data.meta.pageSize),
      }
    };
  }
  
  // Usage examples:
  // filterDataByTime(data, "12:20 pm", "12:35 pm")
  // filterDataByTime(data, "23:42", "23:59")
  // filterDataByTime(data, "2025-07-13T23:40:00.000Z", "2025-07-14T01:15:00.000Z")
  // filterDataByTime(data, "7/14/2025, 1:05:00 AM", "7/14/2025, 1:18:00 AM")
  
  // Debug function to help analyze time distribution in arrays
  function analyzeTimeDistribution(data: TweetData): void {
    console.log('=== Time Distribution Analysis ===');
    
    const arrays = [
      { name: 'tweetDetail.extractedTimes', data: data.tweetDetail.extractedTimes },
      { name: 'weighBasedImpression', data: data.impression.weighBasedImpression.map(item => item.name) },
      { name: 'tweetFrequencyTrend', data: data.frequency.tweetFrequencyTrend.map(item => item.name) },
      { name: 'tweetsPerMinuteArray', data: data.tweetperMinutes.tweetsPerMinuteArray.map(item => item.name) },
      { name: 'SEI_value', data: data.SEI.SEI_value.map(item => item.name) },
      { name: 'tweetViewsPerFVmints', data: data.views.tweetViewsPerFVmints.map(item => item.name) },
    ];
    
    arrays.forEach(arr => {
      if (arr.data && arr.data.length > 0) {
        const firstTime = parseTimeToDate(arr.data[0]);
        const lastTime = parseTimeToDate(arr.data[arr.data.length - 1]);
        console.log(`${arr.name}: ${arr.data.length} items, from ${firstTime.toISOString()} to ${lastTime.toISOString()}`);
      } else {
        console.log(`${arr.name}: empty or undefined`);
      }
    });
    
    if (data.emojiArray && data.emojiArray.length > 0) {
      const firstEmoji = new Date(data.emojiArray[0].em_time);
      const lastEmoji = new Date(data.emojiArray[data.emojiArray.length - 1].em_time);
      console.log(`emojiArray: ${data.emojiArray.length} items, from ${firstEmoji.toISOString()} to ${lastEmoji.toISOString()}`);
    }
  }