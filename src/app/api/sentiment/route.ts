import { NextRequest, NextResponse } from 'next/server';
import { 
  computeSellOffRiskScore, parseViewsCount, groupTweetsWithAddressByInterval,
  calculateTweetFrequencyTrendPercentage, categorizeTweetsByInterval,
  calculateCumulativeRatioPercentage, calculateAverageViewsPerTweet,
  computeImpressionsTimeSeries, computeSEIEMA, computeTimeBasedSEI,
  computeOscillatingSEIVelocity, getDynamicSpikes, computeTimeBasedFOMO,
  computeMetricsBins, computeCompositeFOMOIndex, computeMACD, computeRSI,
  categorizeTweetsByIntervalC, calculateSentimentTrend, computeSentimentTimeSeries,
  calculateAveragePercentage, calculateSentimentScore
} from '@/app/utils/holdersfunct';
import { Engagement, Impression, CompImpression, TimeSeriess, MACDPoint } from '@/app/utils/app_types';
import { NumberFormatter } from '@/app/utils/largeNumber';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache lifetime
const cache: Record<string, { 
  timestamp: number; 
  data: any;
  params: {
    address: string;
    symbol?: string;
    funtype?: string;
  };
}> = {};
const refreshing: Record<string, boolean> = {};

export async function GET(req: NextRequest) {
  try {
    // Extract params
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const symbol = searchParams.get('symbol');
    const funtype = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    // Generate cache key based on all parameters
    const cacheKey = `${address}-${symbol || ''}-${funtype || ''}`;
    const cacheEntry = cache[cacheKey];
    const isFresh = cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_TTL);

    let data;

    // Handle cache scenarios
    if (isFresh) {
      // If cache is fresh, trigger background refresh (optional) and use cached data
      triggerBackgroundRefresh(cacheKey, address, symbol, funtype);
      data = cacheEntry.data;
    } else if (cacheEntry) {
      // If cache exists but stale, trigger background refresh and use stale data
      triggerBackgroundRefresh(cacheKey, address, symbol, funtype);
      data = cacheEntry.data;
    } else {
      // No cache - compute data and cache it
      data = await fetchAndProcessData(address, symbol, funtype);
      cache[cacheKey] = { 
        timestamp: Date.now(), 
        data,
        params: { 
          address, 
          symbol: symbol ?? undefined, 
          funtype: funtype ?? undefined 
        }
      };
    }

    // Apply pagination to the data - use our custom function that handles nested objects
    const paginatedData = applyPagination(data, page, limit);
    
    return NextResponse.json(paginatedData);
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Helper function to trigger background refresh
function triggerBackgroundRefresh(cacheKey: string, address: string | null, symbol: string | null, funtype: string | null) {
  if (refreshing[cacheKey]) return;
  
  console.log(`Triggering background refresh for ${cacheKey}`);
  refreshing[cacheKey] = true;
  
  fetchAndProcessData(address, symbol, funtype)
    .then(data => {
      cache[cacheKey] = {
        timestamp: Date.now(),
        data,
        params: {
          address: address || '',
          symbol: symbol ?? undefined,
          funtype: funtype ?? undefined,
        }
      };
      console.log(`Cache refreshed for ${cacheKey}`);
    })
    .catch(err => {
      console.error(`Background refresh failed for ${cacheKey}:`, err);
    })
    .finally(() => {
      refreshing[cacheKey] = false;
    });
}

function applyPagination(data: any, page: number, limit: number) {
  const result: any = {};
  
  // Helper function to paginate arrays
  const paginateArray = (array: any[]) => {
    if (!array || !Array.isArray(array)) return array;
    
    // Sort in reverse chronological order if the array has time-related properties
    const sortedArray = [...array].sort((a, b) => {
      if (a.name && b.name) {
        return new Date(b.name).getTime() - new Date(a.name).getTime();
      } else if (a.timestamp && b.timestamp) {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      } else if (a.time && b.time) {
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      } else if (a.em_time && b.em_time) {
        return b.em_time - a.em_time;
      }
      return 0;
    });
    
    const start = (page - 1) * limit;
    const end = start + limit;
    return sortedArray.slice(start, end);
  };
  
  // Custom pagination for tweet details which require special handling
  const paginateTweetDetails = (details: any) => {
    if (!details) return details;
    
    const times = details.extractedTimes;
    if (!times || !Array.isArray(times)) return details;
    
    // Sort indices by time in reverse chronological order
    const sortedIndices = times
      .map((time, idx) => ({ time: new Date(time).getTime(), idx }))
      .sort((a, b) => b.time - a.time)
      .map(item => item.idx);
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedIndices = sortedIndices.slice(start, end);
    
    // Create a new object with paginated arrays
    return {
      extractedUsernames: paginatedIndices.map(i => details.extractedUsernames[i]),
      extractedTweets: paginatedIndices.map(i => details.extractedTweets[i]),
      extractedView: paginatedIndices.map(i => details.extractedView[i]),
      extractedLikes: paginatedIndices.map(i => details.extractedLikes[i]),
      extractedTimes: paginatedIndices.map(i => details.extractedTimes[i]),
      extractedProfile: paginatedIndices.map(i => details.extractedProfile[i]),
    };
  };
  
  // Special handling for tweetDetail
  if (data.tweetDetail) {
    result.tweetDetail = paginateTweetDetails(data.tweetDetail);
  }
  
  // Handle emojiArray directly since it's at the top level
  if (data.emojiArray) {
    result.emojiArray = paginateArray(data.emojiArray);
  }
  
  // Process nested objects that contain arrays
  for (const key in data) {
    if (key === 'tweetDetail' || key === 'emojiArray') {
      // Already handled
      continue;
    }
    
    const value = data[key];
    
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        // Directly paginate top-level arrays
        result[key] = paginateArray(value);
      } else {
        // Handle nested objects
        result[key] = {};
        
        for (const subKey in value) {
          const subValue = value[subKey];
          
          if (Array.isArray(subValue)) {
            // Paginate arrays inside nested objects
            result[key][subKey] = paginateArray(subValue);
          } else {
            // Copy non-array values
            result[key][subKey] = subValue;
          }
        }
      }
    } else {
      // Copy primitive values
      result[key] = value;
    }
  }
  
  // Calculate total pages based on the largest array size
  let maxArraySize = 0;
  
  // Helper to find the largest array size in the data
  const findMaxArraySize = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      maxArraySize = Math.max(maxArraySize, obj.length);
    } else {
      for (const key in obj) {
        findMaxArraySize(obj[key]);
      }
    }
  };
  
  findMaxArraySize(data);
  
  // Add pagination metadata
  result.meta = {
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(maxArraySize / limit)),
    pageSize: limit,
    totalItems: maxArraySize
  };
  
  return result;
}

// Main data processing function
async function fetchAndProcessData(address: string | null, symbol: string | null, funtype: string | null) {
  if (!address) {
    throw new Error('Missing address');
  }

  // Fetch data from backend API
  const hostname = process.env.NEXT_PUBLIC_BACKEND_HOST || 'localhost';
  const response = await fetch(`http://${hostname}:3300/fetch-data?search=${address}`);
  const jsonData = await response.json();

  // Process data to calculate total views for each unique time
  const viewCounts: { [key: string]: number } = {};
  const tweetEngagementCounts: { 
    [key: string]: {
      totalTweet: number; 
      usernames: {
        [username: string]: {
          count: number; 
          impression: number; 
          views: number;
          followers: number
        }
      }
    } 
  } = {};
  const engagementCounts: { [key: string]: number } = {};
  const tweetCounts: { [key: string]: number } = {};
  const tweetViews: { [key: string]: { last: number; prev: number } } = {};
  const emojiData: { [key: number]: string } = {};
  const extractedUsernames: string[] = [];
  const extractedTweets: string[] = [];
  const extractedView: string[] = [];
  const extractedLikes: string[] = [];
  const extractedTimes: string[] = [];
  const extractedProfile: string[] = [];
  let engagementMap: Record<string, Record<string, Engagement>> = {};

  // Filter tweets that include the target address
  const filteredTweets = jsonData.filter((entry: any) => {
      return entry.tweet && entry.tweet.includes(address);
  });
  
  const filteredData = filteredTweets.map((entry: any) => {
      const views = entry.params.views ? parseViewsCount(entry.params.views[entry.params.views.length - 1]) : 0;
      const likes = entry.params.likes ? parseViewsCount(entry.params.likes[entry.params.likes.length - 1]) : 0;
      const timestamp = entry.post_time ? entry.post_time : 0;
      return {
          tweet: entry.tweet,
          views,
          likes,
          timestamp,
      };
  });

  let tweetsWithAddress = filteredData;
  
  // Filter valid entries
  const validEntries = jsonData.filter((entry: any) => {
      return entry.tweet && (entry.tweet.includes(address) || (symbol && entry.tweet.includes(symbol)));
  });
  validEntries.sort((a:any, b:any) => new Date(b.post_time).getTime() - new Date(a.post_time).getTime());

  // Process each entry
  validEntries.forEach((entry: any) => {
      const times = entry.params.time;
      const views = entry.params.views;
      const likes = entry.params.likes;
      const comments = entry.params.comment;
      const retweets = entry.params.retweet;
      const timestamp = entry.post_time;
      const eng_time = entry.params.plot_time;
      const statusUrl = entry.status;
      const profileImag = entry.profile_image;
      const followers = entry.followers;
      const username = statusUrl.split('https://x.com/')[1].split('/status/')[0];
      
      if (profileImag != undefined) {
          extractedProfile.push(profileImag);
      }
      
      extractedUsernames.push("@" + username);
      extractedTweets.push(entry.tweet);
      extractedView.push(views);
      extractedLikes.push(likes);
      extractedTimes.push(timestamp);
      
      let minuteKey;
      if (timestamp) {
          try {
              minuteKey = new Date(timestamp).toISOString().slice(0, 16);
          } catch (error) {
              console.warn("Invalid timestamp:", timestamp, error);
              minuteKey = new Date().toISOString().slice(0, 16);
          }
      } else {
          console.warn("Timestamp is empty or null, using current time.");
          minuteKey = new Date().toISOString().slice(0, 16);
      }
      
      const emojiTimeStamp = new Date(timestamp).setSeconds(0, 0);
      
      times.forEach((time: number, index: number) => {
          const view = isNaN(parseViewsCount(views[index])) ? 0 : parseViewsCount(views[index]);
          const date = new Date(eng_time[index]);
          
          const pad = (num:any) => num.toString().padStart(2, '0');

          const year = date.getFullYear();
          const month = pad(date.getMonth() + 1);
          const day = pad(date.getDate());
          const hours = pad(date.getHours());
          const minutes = pad(date.getMinutes());

          const plot_mint = `${year}-${month}-${day}T${hours}:${minutes}`;
          const like = isNaN(parseViewsCount(likes[index])) ? 0 : parseViewsCount(likes[index]);
          const comment = isNaN(parseViewsCount(comments[index])) ? 0 : parseViewsCount(comments[index]);
          const retweet = isNaN(parseViewsCount(retweets[index])) ? 0 : parseViewsCount(retweets[index]);
          
          const timeKey = `${time} min`;

          if (viewCounts[plot_mint]) {
              viewCounts[plot_mint] += view;
          } else {
              viewCounts[plot_mint] = view;
          }
          
          if (entry.tweet.includes(address)) {
              const impression = (like) + (comment) + (retweet*2);
              
              if (tweetEngagementCounts[plot_mint]) {
                  tweetEngagementCounts[plot_mint].totalTweet += 1;
                  if (tweetEngagementCounts[plot_mint].usernames[username]) {
                      tweetEngagementCounts[plot_mint].usernames[username].count += 1;
                      const prevAvgView = tweetEngagementCounts[plot_mint].usernames[username].views
                      const vCount = tweetEngagementCounts[plot_mint].usernames[username].count;
                      const prevImpression = tweetEngagementCounts[plot_mint].usernames[username].impression;
                      const prevFollowers = tweetEngagementCounts[plot_mint].usernames[username].followers;
                      tweetEngagementCounts[plot_mint].usernames[username].impression = ((prevImpression*(vCount-1))+impression)/vCount;
                      
                      tweetEngagementCounts[plot_mint].usernames[username].views = ((prevAvgView*(vCount-1))+view)/vCount;
                      tweetEngagementCounts[plot_mint].usernames[username].followers = followers;
                  } else {
                      tweetEngagementCounts[plot_mint].usernames[username] = {
                          count: 1,
                          impression: impression,
                          views: view,
                          followers: followers
                      };
                  }
              } else {
                  tweetEngagementCounts[plot_mint] = {
                      totalTweet: 1,
                      usernames: {
                          [username]: {
                              count: 1,
                              impression: impression,
                              views: view,
                              followers: followers
                          }
                      }
                  };
              }
          }
          
          if (engagementCounts[plot_mint]) {
              engagementCounts[plot_mint] += ((like) + (comment) + (retweet*2));
          } else {
              engagementCounts[plot_mint] = ((like) + (comment) + (retweet*2));
          }

          if (entry.tweet.includes(address)) {
            if (!engagementMap[plot_mint]) {
              engagementMap[plot_mint] = {};
            }
            const isNewEntry = !engagementMap[plot_mint][username];
            if (isNewEntry) {
              engagementMap[plot_mint][username] = {
                    timestamp: plot_mint,
                    impressions: view,
                    likes: like,
                    retweets: retweet,
                    comments: comment,
                    followers: followers,
                    count: 1
                };
            } else {
                const bucket = engagementMap[plot_mint][username];
                bucket.count += 1;
                const prevImpression = bucket.impressions
                const vCount = bucket.count;
                const prevLikes = bucket.likes;
                const prevRetweets = bucket.retweets;
                const prevComments = bucket.comments;
                const prevFollowers = bucket.followers;
                bucket.impressions = ((prevImpression*(vCount-1))+view)/vCount;
                bucket.likes = ((prevLikes*(vCount-1))+like)/vCount;
                bucket.retweets = ((prevRetweets*(vCount-1))+retweet)/vCount;;
                bucket.comments = ((prevComments*(vCount-1))+comment)/vCount;;
                bucket.followers = followers;
            }
          }
      });
      
      if (tweetCounts[minuteKey]) {
          tweetCounts[minuteKey] += 1;
      } else {
          tweetCounts[minuteKey] = 1;
      }
      
      const view = isNaN(parseViewsCount(views[views.length-1])) ? 0 : parseViewsCount(views[views.length-1]);
      let viewPrev = 0;
      if (views.length > 1) {
          viewPrev = isNaN(parseViewsCount(views[views.length-2])) ? 0 : parseViewsCount(views[views.length-2]);
      }
      
      if (tweetViews[minuteKey]) {
          tweetViews[minuteKey].last += view;
          tweetViews[minuteKey].prev += viewPrev;
      } else {
          tweetViews[minuteKey] = { last: view, prev: viewPrev };
      }
      
      if (!emojiData[emojiTimeStamp]) {
          const sentiment = parseViewsCount(views[views.length - 1]);
          if (sentiment > 10000) {
              emojiData[emojiTimeStamp] = "💎";
          } else if (sentiment > 5000) {
              emojiData[emojiTimeStamp] = "♦️";
          } else if (sentiment > 1000) {
              emojiData[emojiTimeStamp] = "🥇";
          } else if (sentiment > 500) {
              emojiData[emojiTimeStamp] = "🥈";
          } else {
              emojiData[emojiTimeStamp] = "😎";
          }
      }
  });
    
  // Convert engagement map to array
  const engagementArray: Engagement[] = Object.values(engagementMap)
      .flatMap(userMap => Object.values(userMap))
      .sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      .map(data => ({
        timestamp:   data.timestamp,
        impressions: data.impressions,
        likes:       data.likes,
        retweets:    data.retweets,
        comments:    data.comments,
        followers:   data.followers,
        count:       data.count
      }));
  
  // Create time series
  const impressionsArray = Object.entries(viewCounts).map(([name, value]) => ({
      name,
      value
  })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  
  const engamentArray = Object.entries(engagementCounts).map(([name, value]) => ({
      name,
      value
  })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  
  const tweetsPerMinuteArray = Object.entries(tweetCounts).map(([name, value]) => ({
      name,
      value
  })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  
  const emojiArray = Object.entries(emojiData).map(([time, emoji]) => ({
      em_time: parseInt(time, 10),
      emoji,
  })).sort((a, b) => a.em_time - b.em_time);
  
  const tweetsPerViewsMinuteArray = Object.entries(tweetViews)
      .map(([name, data]) => ({
          name,
          value: data.last,
          preval: data.prev
      }))
      .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  
  // Modified: Process tweetEngagementCounts to average by username but count unique usernames for volume
  const tweetsEngagementPlot = Object.entries(tweetEngagementCounts).map(([name, data]) => {
      // Calculate averages per username
      let totalImpression = 0;
      let totalViews = 0;
      let user_followers = 0;
      const uniqueUsernames = Object.keys(data.usernames);
      const uniqueUsernameCount = uniqueUsernames.length; // Count of unique usernames
      
      // Process each username's data
      uniqueUsernames.forEach(username => {
          const userData = data.usernames[username];
          // Average the impressions and views for each username
          totalImpression += userData.impression // userData.count;
          totalViews += userData.views // userData.count;
          user_followers += userData.followers;
      });
      return {
          name,
          impression: totalImpression,
          views: totalViews,
          volume: uniqueUsernameCount, // Set volume to the count of unique usernames
          followers: user_followers,
      };
  }).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

  // Compute metrics
  const { count: tweetsWithAddressCount, views: tweetsWithAddressViews } = groupTweetsWithAddressByInterval(
    tweetsWithAddress,
    5
  );
  const totalTweetsWithAddress = tweetsWithAddressCount.reduce(
    (sum, { value }) => sum + value,
    0
  );
  const tweetwithAddAvgViews = calculateAverageViewsPerTweet(tweetsWithAddressViews, tweetsWithAddressCount);
  const tweetsWithAddressFrequency = calculateTweetFrequencyTrendPercentage(tweetsWithAddressCount, 5, 3, 80);
  const totalTweets_ = tweetsPerMinuteArray.reduce((sum, tweet) => sum + tweet.value, 0);
  const totalTweets = NumberFormatter.formatNumber(totalTweets_);

  const tweetPerFVmints = categorizeTweetsByInterval(tweetsPerMinuteArray, 5);
  const tweetViewsRatioPercentage = calculateCumulativeRatioPercentage(
    tweetPerFVmints,
    tweetsPerViewsMinuteArray
  );
  const avgViewsPerTweet = calculateAverageViewsPerTweet(tweetsPerViewsMinuteArray, tweetsPerMinuteArray);
  const tweetFrequencyTrend = calculateTweetFrequencyTrendPercentage(tweetsPerMinuteArray, 5, 5, 100);
  const averagePercentageFv = calculateAveragePercentage(tweetPerFVmints);
  
  const averagePercentage = calculateAveragePercentage(tweetsPerMinuteArray);
  const weighBasedImpression = computeImpressionsTimeSeries(engagementArray, 5);
  const EWMA_Value = computeSEIEMA(weighBasedImpression, 14);
  const SEI_value_x = computeTimeBasedSEI(engagementArray, 5);
  const SEI_EMA = computeSEIEMA(SEI_value_x, 14);
  const SEI_Velocity = computeOscillatingSEIVelocity(SEI_value_x, engagementArray, 15);
  const SEI_value = getDynamicSpikes(SEI_value_x);
  
  const tweetFomo = computeTimeBasedFOMO(engagementArray, 2, 0.2);
  const getMetricGrid = computeMetricsBins(engagementArray, 5, 5);
  const compositFomo = computeCompositeFOMOIndex(getMetricGrid);
  const macd = computeMACD(tweetFomo);
  const RSI = computeRSI(tweetFomo);
  const tweetFrequencyTrend_ = calculateTweetFrequencyTrendPercentage(tweetsPerMinuteArray, 5, 5, 100);
  const currentTweetFrequencyTrend = tweetFrequencyTrend_[tweetFrequencyTrend_.length - 1]?.value || 0;
  const timeseries = computeSentimentTimeSeries(validEntries);
  const sentimentTrend = calculateSentimentTrend(timeseries, 30);
  const currentSentimentTrend = sentimentTrend[sentimentTrend.length - 1]?.aggregatedSentiment || 0;
  const tweetViewsPerFVmints = categorizeTweetsByIntervalC(tweetsPerViewsMinuteArray, 5);
  const avgLstView = calculateAverageViewsPerTweet(tweetViewsPerFVmints.slice(-15), tweetViewsPerFVmints.slice(-15));
  const currentTweetWiAddFrequencyTrend = tweetsWithAddressFrequency[tweetsWithAddressFrequency.length - 1]?.value || 0;
  const tweetwithAddAvgViewsS = calculateAverageViewsPerTweet(tweetsWithAddressViews.slice(-15), tweetsWithAddressCount.slice(-15));

  const sentiMeter = Math.round(calculateSentimentScore(currentTweetFrequencyTrend, currentSentimentTrend, avgLstView, Number(totalTweets)));
  const sentiMeterAddr = Math.round(calculateSentimentScore(currentTweetWiAddFrequencyTrend, currentSentimentTrend, tweetwithAddAvgViewsS, totalTweetsWithAddress));

  // Structure data for different function types
  const frequency = { tweetFrequencyTrend, tweetsWithAddressFrequency };
  const tweetperMinutes = { tweetsPerMinuteArray, tweetPerFVmints, tweetsWithAddressCount, totalTweets, averagePercentageFv, averagePercentage };
  const SEI = { SEI_value, SEI_Velocity, SEI_EMA };
  const Fomo = { tweetFomo, compositFomo, macd, RSI };
  const impression = { weighBasedImpression, sentimentTrend, EWMA_Value };
  const views = { tweetViewsPerFVmints, tweetsWithAddressViews, tweetViewsRatioPercentage, avgViewsPerTweet, tweetwithAddAvgViews };
  const hype = { sentiMeter, sentiMeterAddr };
  const tweetDetail = { extractedUsernames, extractedTweets, extractedView, extractedLikes, extractedTimes, extractedProfile };
  
  switch (funtype) {
    case "frequency":
      return {
        frequency: {
          tweetFrequencyTrend,
          tweetsWithAddressFrequency
        },
        tweetDetail,
        emojiArray
      };
      
    case "tweetperMinutes": 
      return {
        tweetperMinutes,
        tweetDetail,
        emojiArray
      };

    case "SEI":
      return {
        SEI,
        tweetDetail,
        emojiArray
      };
    
    case "Fomo":
      return {
        Fomo,
        tweetDetail,
        emojiArray
      };
      
    case "impression":
      return {
        impression,
        tweetDetail,
        emojiArray
      };
  
    case "views":
      return {
        views,
        tweetDetail,
        emojiArray
      };
      
    case "hype":
      return {
        hype,
        tweetDetail,
        emojiArray
      };
      
    default:
      return {
        frequency,
        tweetperMinutes,
        SEI,
        Fomo,
        impression,
        views,
        hype,
        tweetDetail,
        emojiArray
      };
  }
}

// Keep the existing paginateFrequencyData function
function paginateFrequencyData(
  limit: number,
  page: number,
  frequency?: {
    tweetFrequencyTrend: Impression[],
    tweetsWithAddressFrequency: Impression[],
  },
  tweetperMinutes?: {
    tweetsPerMinuteArray: Impression[];
    tweetPerFVmints: Impression[];
    tweetsWithAddressCount: Impression[];
    totalTweets: string;
    averagePercentageFv: number;
    averagePercentage: number;
  },
  SEI?: {
    SEI_value: Impression[];
    SEI_Velocity: Impression[];
    SEI_EMA: Impression[];
  },
  Fomo?: {
    tweetFomo: Impression[];
    compositFomo: Impression[];
    macd: MACDPoint[];
    RSI: Impression[];
  },
  impression?: {
    weighBasedImpression: Impression[];
    sentimentTrend: TimeSeriess[];
    EWMA_Value: Impression[];
  },
  views?: {
    tweetViewsPerFVmints: CompImpression[];
    tweetsWithAddressViews: CompImpression[];
    tweetViewsRatioPercentage: Impression[];
    avgViewsPerTweet: number;
    tweetwithAddAvgViews: number;
  },
  hype?: {
    sentiMeter: number;
    sentiMeterAddr: number;
  },
  tweetDetail?: {
    extractedUsernames: string[];
    extractedTweets: string[];
    extractedView: string[];
    extractedLikes: string[];
    extractedTimes: string[];
    extractedProfile: string[];
  },
  emojiArray?: {
    em_time: number;
    emoji: string;
  }[]
) {
  const result: any = {};
  const sortByTimeDesc = <T extends { name?: string; time?: string }>(a: T, b: T) => {
    const aTime = new Date(a.name ?? a.time ?? "").getTime();
    const bTime = new Date(b.name ?? b.time ?? "").getTime();
    return bTime - aTime;
  };

  // If limit and page are 0, return the full dataset for caching
  // Otherwise, apply pagination
  const shouldPaginate = limit > 0 && page > 0;
  const start = shouldPaginate ? (page - 1) * limit : 0;
  const end = shouldPaginate ? start + limit : undefined; // undefined means no end limit

  const processArray = <T extends any[]>(array: T) => {
    if (!array) return array;
    
    const sorted = [...array].sort(sortByTimeDesc);
    return shouldPaginate ? sorted.slice(start, end) : sorted;
  };

  if (frequency) {
    result.frequency = {
      tweetFrequencyTrend: processArray(frequency.tweetFrequencyTrend),
      tweetsWithAddressFrequency: processArray(frequency.tweetsWithAddressFrequency),
    };
  }

  if (tweetperMinutes) {
    result.tweetperMinutes = {
      tweetsPerMinuteArray: processArray(tweetperMinutes.tweetsPerMinuteArray),
      tweetPerFVmints: processArray(tweetperMinutes.tweetPerFVmints),
      tweetsWithAddressCount: processArray(tweetperMinutes.tweetsWithAddressCount),
      totalTweets: tweetperMinutes.totalTweets,
      averagePercentageFv: tweetperMinutes.averagePercentageFv,
      averagePercentage: tweetperMinutes.averagePercentage,
    };
  }

  if (SEI) {
    result.SEI = {
      SEI_value: [...SEI.SEI_value].sort(sortByTimeDesc).slice(start, end),
      SEI_Velocity: [...SEI.SEI_Velocity].sort(sortByTimeDesc).slice(start, end),
      SEI_EMA: [...SEI.SEI_EMA].sort(sortByTimeDesc).slice(start, end),
    };
  }

  if (Fomo) {
    result.Fomo = {
      tweetFomo: [...Fomo.tweetFomo].sort(sortByTimeDesc).slice(start, end),
      compositFomo: [...Fomo.compositFomo].sort(sortByTimeDesc).slice(start, end),
      macd: [...Fomo.macd].sort(sortByTimeDesc).slice(start, end),
      RSI: [...Fomo.RSI].sort(sortByTimeDesc).slice(start, end),
    };
  }

  if (impression) {
    result.impression = {
      weighBasedImpression: [...impression.weighBasedImpression].sort(sortByTimeDesc).slice(start, end),
      sentimentTrend: [...impression.sentimentTrend].sort(sortByTimeDesc).slice(start, end),
      EWMA_Value: [...impression.EWMA_Value].sort(sortByTimeDesc).slice(start, end),
    };
  }

  if (views) {
    result.views = {
      tweetViewsPerFVmints: [...views.tweetViewsPerFVmints].sort(sortByTimeDesc).slice(start, end),
      tweetsWithAddressViews: [...views.tweetsWithAddressViews].sort(sortByTimeDesc).slice(start, end),
      tweetViewsRatioPercentage: [...views.tweetViewsRatioPercentage].sort(sortByTimeDesc).slice(start, end),
      avgViewsPerTweet: views.avgViewsPerTweet,
      tweetwithAddAvgViews: views.tweetwithAddAvgViews,
    };
  }

  if (hype) {
    result.hype = {
      sentiMeter: hype.sentiMeter,
      sentiMeterAddr: hype.sentiMeterAddr,
    };
  }

  if (tweetDetail) {
    const sortedTweetIndices = tweetDetail.extractedTimes
      .map((time, idx) => ({ time: new Date(time).getTime(), idx }))
      .sort((a, b) => b.time - a.time)
      .map(item => item.idx);

    const pagedTweetIndices = sortedTweetIndices.slice(start, end);

    result.tweetDetail = {
      extractedUsernames: pagedTweetIndices.map(i => tweetDetail.extractedUsernames[i]),
      extractedTweets: pagedTweetIndices.map(i => tweetDetail.extractedTweets[i]),
      extractedView: pagedTweetIndices.map(i => tweetDetail.extractedView[i]),
      extractedLikes: pagedTweetIndices.map(i => tweetDetail.extractedLikes[i]),
      extractedTimes: pagedTweetIndices.map(i => tweetDetail.extractedTimes[i]),
      extractedProfile: pagedTweetIndices.map(i => tweetDetail.extractedProfile[i]),
    };
  }

  if (emojiArray) {
    result.emojiArray = [...emojiArray].sort((a, b) => b.em_time - a.em_time).slice(start, end);
  }

  result.meta = {
    totalPages: frequency ? Math.ceil(frequency.tweetFrequencyTrend.length / limit) : 1,
    currentPage: page,
  };

  return result;

}

/*
//sentiment.ts
import { NextRequest, NextResponse } from 'next/server';
import { computeSellOffRiskScore ,parseViewsCount,groupTweetsWithAddressByInterval,calculateTweetFrequencyTrendPercentage,categorizeTweetsByInterval,calculateCumulativeRatioPercentage,calculateAverageViewsPerTweet,computeImpressionsTimeSeries,computeSEIEMA,computeTimeBasedSEI,computeOscillatingSEIVelocity,getDynamicSpikes,computeTimeBasedFOMO,computeMetricsBins,computeCompositeFOMOIndex,computeMACD,computeRSI,categorizeTweetsByIntervalC,calculateSentimentTrend,computeSentimentTimeSeries,calculateAveragePercentage,calculateSentimentScore} from '@/app/utils/holdersfunct'; // adjust path as needed
import { Engagement,Impression,CompImpression,TimeSeriess,MACDPoint } from '@/app/utils/app_types';
import { NumberFormatter } from '@/app/utils/largeNumber';
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    const symbol = searchParams.get('symbol');
    const funtype = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10); // default: 20 items per page

    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    const hostname = process.env.NEXT_PUBLIC_BACKEND_HOST || 'localhost';
    console.log("Limiite", limit)
    const response = await fetch(`http://${hostname}:3300/fetch-data?search=${address}`);
      const jsonData = await response.json();
  
      // Process data to calculate total views for each unique time
      const viewCounts: { [key: string]: number } = {};
      const tweetEngagementCounts: { [key: string]: { totalTweet: number; usernames: {[username: string]: {count: number; impression: number; views: number;followers:number}}} } = {};
      const engagementCounts: { [key: string]: number } = {};
      const tweetCounts: { [key: string]: number } = {};
      const tweetViews: { [key: string]: { last: number; prev: number } } = {};
      const emojiData: { [key: number]: string } = {};
      const extractedUsernames: string[] = [];
      const extractedTweets: string[] = [];
      const extractedView: string[] = [];
      const extractedLikes: string[] = [];
      const extractedTimes: string[] = [];
      const extractedProfile: string[] = [];
      let engagementMap: Record<string, Record<string, Engagement>> = {};
      const filteredTweets = jsonData.filter((entry: any) => {
          return entry.tweet && entry.tweet.includes(address);
      });
      
      const filteredData = filteredTweets.map((entry: any) => {
          const views = entry.params.views ? parseViewsCount(entry.params.views[entry.params.views.length - 1]) : 0;
          const likes = entry.params.likes ? parseViewsCount(entry.params.likes[entry.params.likes.length - 1]) : 0;
          const timestamp = entry.post_time ? entry.post_time : 0;
          return {
              tweet: entry.tweet,
              views,
              likes,
              timestamp,
          };
      });
  
      //setTweetsWithAddress(filteredData);
      let tweetsWithAddress = filteredData
      const validEntries = jsonData.filter((entry: any) => {
          return entry.tweet && (entry.tweet.includes(address) || entry.tweet.includes(symbol));
      });
      validEntries.sort((a:any, b:any) => new Date(b.post_time).getTime() - new Date(a.post_time).getTime());


      
      validEntries.forEach((entry: any) => {
        
          const times = entry.params.time;
          const views = entry.params.views;
          const likes = entry.params.likes;
          const comments = entry.params.comment;
          const retweets = entry.params.retweet;
          const timestamp = entry.post_time;
          const eng_time = entry.params.plot_time;
          const statusUrl = entry.status;
          const profileImag = entry.profile_image;
          const followers = entry.followers;
          const username = statusUrl.split('https://x.com/')[1].split('/status/')[0];
          const lastSeen: Record<string, string> = {};
          if (profileImag != undefined) {
              extractedProfile.push(profileImag);
          }
          
          extractedUsernames.push("@" + username);
          const tweets = entry.tweet;
          extractedTweets.push(tweets);
          extractedView.push(views);
          extractedLikes.push(likes);
          extractedTimes.push(timestamp);
          
          let minuteKey;
          if (timestamp) {
              try {
                  minuteKey = new Date(timestamp).toISOString().slice(0, 16);
              } catch (error) {
                  console.warn("Invalid timestamp:", timestamp, error);
                  minuteKey = new Date().toISOString().slice(0, 16);
              }
          } else {
              console.warn("Timestamp is empty or null, using current time.");
              minuteKey = new Date().toISOString().slice(0, 16);
          }
          
          const emojiTimeStamp = new Date(timestamp).setSeconds(0, 0);
          
          times.forEach((time: number, index: number) => {
              
              const view = isNaN(parseViewsCount(views[index])) ? 0 : parseViewsCount(views[index]);
              const date = new Date(eng_time[index]);
              
              const pad = (num:any) => num.toString().padStart(2, '0');
  
              const year = date.getFullYear();
              const month = pad(date.getMonth() + 1);
              const day = pad(date.getDate());
              const hours = pad(date.getHours());
              const minutes = pad(date.getMinutes());
  
              const plot_mint = `${year}-${month}-${day}T${hours}:${minutes}`;
              const like = isNaN(parseViewsCount(likes[index])) ? 0 : parseViewsCount(likes[index]);
              const comment = isNaN(parseViewsCount(comments[index])) ? 0 : parseViewsCount(comments[index]);
              const retweet = isNaN(parseViewsCount(retweets[index])) ? 0 : parseViewsCount(retweets[index]);
              
              const engagementMap_: Record<string, Record<string, Engagement>> = {};
              const timeKey = `${time} min`;
  
              if (viewCounts[plot_mint]) {
                  viewCounts[plot_mint] += view;
              } else {
                  viewCounts[plot_mint] = view;
              }
              
              if (entry.tweet.includes(address)) {
                  const impression = (like) + (comment) + (retweet*2);
                  
                  if (tweetEngagementCounts[plot_mint]) {
                      //tweetEngagementCounts[plot_mint].impression += impression;
                      //tweetEngagementCounts[plot_mint].views += view;
                      tweetEngagementCounts[plot_mint].totalTweet += 1;
                      //tweetEngagementCounts[plot_mint].followers += followers;
                      // Track per username
                      //(950 +350 +220)/ 3 = 
                      if (tweetEngagementCounts[plot_mint].usernames[username]) {
                          tweetEngagementCounts[plot_mint].usernames[username].count += 1;
                          const prevAvgView = tweetEngagementCounts[plot_mint].usernames[username].views
                          const vCount = tweetEngagementCounts[plot_mint].usernames[username].count;
                          const prevImpression = tweetEngagementCounts[plot_mint].usernames[username].impression;
                          const prevFollowers = tweetEngagementCounts[plot_mint].usernames[username].followers;
                          tweetEngagementCounts[plot_mint].usernames[username].impression = ((prevImpression*(vCount-1))+impression)/vCount;
                          
                          tweetEngagementCounts[plot_mint].usernames[username].views = ((prevAvgView*(vCount-1))+view)/vCount;
                          tweetEngagementCounts[plot_mint].usernames[username].followers = followers;
                      } else {
                          tweetEngagementCounts[plot_mint].usernames[username] = {
                              count: 1,
                              impression: impression,
                              views: view,
                              followers: followers
                          };
                      }
                  } else {
                      tweetEngagementCounts[plot_mint] = {
                          //impression: impression,
                          //views: view,
                          totalTweet: 1,
                          
                          usernames: {
                              [username]: {
                                  count: 1,
                                  impression: impression,
                                  views: view,
                                  followers: followers
                              }
                          }
                      };
                  }
              }
              
              if (engagementCounts[plot_mint]) {
                  engagementCounts[plot_mint] += ((like) + (comment) + (retweet*2));
              } else {
                  engagementCounts[plot_mint] = ((like) + (comment) + (retweet*2));
              }

              if (entry.tweet.includes(address)) {
                
                if (!engagementMap[plot_mint]) {
                  engagementMap[plot_mint] = {};
                }
                const isNewEntry = !engagementMap[plot_mint][username];
                if (isNewEntry) {
                  engagementMap[plot_mint][username] = {
                        timestamp: plot_mint,
                        impressions: view,
                        likes: like,
                        retweets: retweet,
                        comments: comment,
                        followers: followers,
                        count: 1
                    };
                } else {
                    //console.log("Engagement Map Key",plot_mint +":"+username)
                    const bucket = engagementMap[plot_mint][username];
                    bucket.count += 1;
                    const prevImpression = bucket.impressions
                    const vCount = bucket.count;
                    const prevLikes = bucket.likes;
                    const prevRetweets = bucket.retweets;
                    const prevComments = bucket.comments;
                    const prevFollowers = bucket.followers;
                    bucket.impressions = ((prevImpression*(vCount-1))+view)/vCount;
                    bucket.likes = ((prevLikes*(vCount-1))+like)/vCount;
                    bucket.retweets = ((prevRetweets*(vCount-1))+retweet)/vCount;;
                    bucket.comments = ((prevComments*(vCount-1))+comment)/vCount;;
                    bucket.followers = followers;
                    
                }
                
              }
          });
          
          if (tweetCounts[minuteKey]) {
              tweetCounts[minuteKey] += 1;
          } else {
              tweetCounts[minuteKey] = 1;
          }
          
          const view = isNaN(parseViewsCount(views[views.length-1])) ? 0 : parseViewsCount(views[views.length-1]);
          let viewPrev = 0;
          if (views.length > 1) {
              viewPrev = isNaN(parseViewsCount(views[views.length-2])) ? 0 : parseViewsCount(views[views.length-2]);
          }
          
          if (tweetViews[minuteKey]) {
              tweetViews[minuteKey].last += view;
              tweetViews[minuteKey].prev += viewPrev;
          } else {
              tweetViews[minuteKey] = { last: view, prev: viewPrev };
          }
          
          if (!emojiData[emojiTimeStamp]) {
              const sentiment = parseViewsCount(views[views.length - 1]);
              if (sentiment > 10000) {
                  emojiData[emojiTimeStamp] = "💎";
              } else if (sentiment > 5000) {
                  emojiData[emojiTimeStamp] = "♦️";
              } else if (sentiment > 1000) {
                  emojiData[emojiTimeStamp] = "🥇";
              } else if (sentiment > 500) {
                  emojiData[emojiTimeStamp] = "🥈";
              } else {
                  emojiData[emojiTimeStamp] = "😎";
              }
          }
      });
        
        const engagementArray: Engagement[] = Object.values(engagementMap)
            // 1) take each inner user-map and grab its values (the EngagementData objects)
            .flatMap(userMap => Object.values(userMap))
            // 2) sort by timestamp
            .sort((a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )
            // 3) map into the final shape (renaming followersSum → followers)
            .map(data => ({
              timestamp:   data.timestamp,
              impressions: data.impressions,
              likes:       data.likes,
              retweets:    data.retweets,
              comments:    data.comments,
              followers:   data.followers,
              count:       data.count
            }));
     
      const impressionsArray = Object.entries(viewCounts).map(([name, value]) => ({
          name,
          value
      })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
      
      const engamentArray = Object.entries(engagementCounts).map(([name, value]) => ({
          name,
          value
      })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
      
      const tweetsPerMinuteArray = Object.entries(tweetCounts).map(([name, value]) => ({
          name,
          value
      })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
      
      const emojiArray = Object.entries(emojiData).map(([time, emoji]) => ({
          em_time: parseInt(time, 10),
          emoji,
      })).sort((a, b) => a.em_time - b.em_time);
      
      const tweetsPerViewsMinuteArray = Object.entries(tweetViews)
          .map(([name, data]) => ({
              name,
              value: data.last,
              preval: data.prev
          }))
          .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
      
      // Modified: Process tweetEngagementCounts to average by username but count unique usernames for volume
      const tweetsEngagementPlot = Object.entries(tweetEngagementCounts).map(([name, data]) => {
          // Calculate averages per username
          let totalImpression = 0;
          let totalViews = 0;
          let user_followers = 0;
          const uniqueUsernames = Object.keys(data.usernames);
          const uniqueUsernameCount = uniqueUsernames.length; // Count of unique usernames
          
          // Process each username's data
          uniqueUsernames.forEach(username => {
              const userData = data.usernames[username];
              // Average the impressions and views for each username
              totalImpression += userData.impression // userData.count;
              totalViews += userData.views // userData.count;
              user_followers += userData.followers;
              //console.log("UserData",username,"Followers",userData.followers)
          });
          //console.log("Total Followers",user_followers,"Unique Usernames",uniqueUsernameCount,"Total Impression",totalImpression,"Total Views",totalViews)
          return {
              name,
              impression: totalImpression,
              views: totalViews,
              volume: uniqueUsernameCount, // Set volume to the count of unique usernames
              followers: user_followers,
          };
      }).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
      const { count: tweetsWithAddressCount, views: tweetsWithAddressViews } = groupTweetsWithAddressByInterval(
        tweetsWithAddress,
        5
      );
      const totalTweetsWithAddress = tweetsWithAddressCount.reduce(
        (sum, { value }) => sum + value,
        0
      );
      const tweetwithAddAvgViews = calculateAverageViewsPerTweet(tweetsWithAddressViews, tweetsWithAddressCount);
      const tweetsWithAddressFrequency = calculateTweetFrequencyTrendPercentage(tweetsWithAddressCount, 5, 3, 80);
        const totalTweets_ = tweetsPerMinuteArray.reduce((sum, tweet) => sum + tweet.value, 0);
        const totalTweets = NumberFormatter.formatNumber(totalTweets_);
    
        const tweetPerFVmints = categorizeTweetsByInterval(tweetsPerMinuteArray, 5);
        const tweetViewsRatioPercentage = calculateCumulativeRatioPercentage(
          tweetPerFVmints,
          tweetsPerViewsMinuteArray
        );
        const avgViewsPerTweet = calculateAverageViewsPerTweet(tweetsPerViewsMinuteArray, tweetsPerMinuteArray);
        const tweetFrequencyTrend = calculateTweetFrequencyTrendPercentage(tweetsPerMinuteArray, 5, 5,100);
        const averagePercentageFv = calculateAveragePercentage(tweetPerFVmints);
        
        const averagePercentage = calculateAveragePercentage(tweetsPerMinuteArray);
        const weighBasedImpression = computeImpressionsTimeSeries(engagementArray,5)//calculateImpressionPlot(tweetEngagemnt,9)
        const EWMA_Value = computeSEIEMA(weighBasedImpression,14)//computeTimeBasedEWMA(tweetEngagemnt, 14,0.3);
        const SEI_value_x = computeTimeBasedSEI(engagementArray,5)
        const SEI_EMA = computeSEIEMA(SEI_value_x,14)
        const SEI_Velocity = computeOscillatingSEIVelocity(SEI_value_x,engagementArray,15);
        const SEI_value= getDynamicSpikes(SEI_value_x)
        
        const tweetFomo = computeTimeBasedFOMO(engagementArray,2,0.2)
        //console.log("engagementArray",SEI_value)
        const getMetricGrid = computeMetricsBins(engagementArray,5,5)
        const compositFomo = computeCompositeFOMOIndex(getMetricGrid)
        const macd = computeMACD(tweetFomo,)
        const RSI = computeRSI(tweetFomo)
        const tweetFrequencyTrend_ = calculateTweetFrequencyTrendPercentage(tweetsPerMinuteArray, 5, 5,100);
        const currentTweetFrequencyTrend = tweetFrequencyTrend_[tweetFrequencyTrend_.length - 1]?.value || 0;
        const timeseries = computeSentimentTimeSeries(validEntries)
        const sentimentTrend = calculateSentimentTrend(timeseries, 30);
        const currentSentimentTrend = sentimentTrend[sentimentTrend.length - 1]?.aggregatedSentiment || 0;
        const tweetViewsPerFVmints = categorizeTweetsByIntervalC(tweetsPerViewsMinuteArray, 5);
        const avgLstView = calculateAverageViewsPerTweet(tweetViewsPerFVmints.slice(-15),tweetViewsPerFVmints.slice(-15))
        const currentTweetWiAddFrequencyTrend = tweetsWithAddressFrequency[tweetsWithAddressFrequency.length - 1]?.value || 0;
        const tweetwithAddAvgViewsS = calculateAverageViewsPerTweet(tweetsWithAddressViews.slice(-15), tweetsWithAddressCount.slice(-15));

        const sentiMeter = Math.round(calculateSentimentScore(currentTweetFrequencyTrend, currentSentimentTrend,avgLstView,Number(totalTweets) ))

        const sentiMeterAddr = Math.round(calculateSentimentScore(currentTweetWiAddFrequencyTrend, currentSentimentTrend,tweetwithAddAvgViewsS,totalTweetsWithAddress ))

        //-----** ---- Variable for Function -----///
        const frequency= {tweetFrequencyTrend,tweetsWithAddressFrequency}
        const tweetperMinutes= {tweetsPerMinuteArray,tweetPerFVmints,tweetsWithAddressCount,totalTweets,averagePercentageFv,averagePercentage}
        const SEI= {SEI_value,SEI_Velocity,SEI_EMA}
        const Fomo= {tweetFomo,compositFomo,macd,RSI}
        const impression= {weighBasedImpression,sentimentTrend,EWMA_Value}
        const views = {tweetViewsPerFVmints,tweetsWithAddressViews,tweetViewsRatioPercentage,avgViewsPerTweet,tweetwithAddAvgViews}
        const hype={sentiMeter,sentiMeterAddr}
        
        const tweetDetail={extractedUsernames,extractedTweets,extractedView,extractedLikes,extractedTimes,extractedProfile}
    // Switch
    switch (funtype) {
      
      case "frequency":
        const frequency_result = paginateFrequencyData(limit,page,frequency,undefined,undefined,undefined,undefined,undefined,undefined,tweetDetail,emojiArray);
        return NextResponse.json(frequency_result);
        
      case "tweetperMinutes": 
        const tweetperMinutes_result = paginateFrequencyData(limit,page,undefined,tweetperMinutes,undefined,undefined,undefined,undefined,undefined,tweetDetail,emojiArray);
        return NextResponse.json(tweetperMinutes_result);

      case "SEI":
        const SEI_result = paginateFrequencyData(limit,page,undefined,undefined,SEI,undefined,undefined,undefined,undefined,tweetDetail,emojiArray);
        return NextResponse.json(SEI_result);
      
      case "Fomo":
        const Fomo_result = paginateFrequencyData(limit,page,undefined,undefined,undefined,Fomo,undefined,undefined,undefined,tweetDetail,emojiArray);
        return NextResponse.json(Fomo_result);
        
      case "impression":
        const impressiont_result = paginateFrequencyData(limit,page,undefined,undefined,undefined,undefined,impression,undefined,undefined,tweetDetail,emojiArray);
        return NextResponse.json(impressiont_result);
    
      case "views":
        const views_result =paginateFrequencyData(limit,page,undefined,undefined,undefined,undefined,undefined,views,undefined,tweetDetail,emojiArray);
        return NextResponse.json(views_result);
        
      case "hype":
        const hype_result = paginateFrequencyData(limit,page,undefined,undefined,undefined,undefined,undefined,undefined,hype,tweetDetail,emojiArray);
        return NextResponse.json(hype_result);
        
      default:
        const default_result = paginateFrequencyData(limit,page,frequency,tweetperMinutes,SEI,Fomo,impression,views,hype,tweetDetail,emojiArray);
        return NextResponse.json(default_result);
        
    }
   

    
    
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
function paginateFrequencyData(
  limit: number,
  page: number,
  frequency?: {
    tweetFrequencyTrend: Impression[],
    tweetsWithAddressFrequency: Impression[],
  },
  tweetperMinutes?: {
    tweetsPerMinuteArray: Impression[];
    tweetPerFVmints: Impression[];
    tweetsWithAddressCount: Impression[];
    totalTweets: string;
    averagePercentageFv: number;
    averagePercentage: number;
  },
  SEI?: {
    SEI_value: Impression[];
    SEI_Velocity: Impression[];
    SEI_EMA: Impression[];
  },
  Fomo?: {
    tweetFomo: Impression[];
    compositFomo: Impression[];
    macd: MACDPoint[];
    RSI: Impression[];
  },
  impression?: {
    weighBasedImpression: Impression[];
    sentimentTrend: TimeSeriess[];
    EWMA_Value: Impression[];
  },
  views?: {
    tweetViewsPerFVmints: CompImpression[];
    tweetsWithAddressViews: CompImpression[];
    tweetViewsRatioPercentage: Impression[];
    avgViewsPerTweet: number;
    tweetwithAddAvgViews: number;
  },
  hype?: {
    sentiMeter: number;
    sentiMeterAddr: number;
  },
  tweetDetail?: {
    extractedUsernames: string[];
    extractedTweets: string[];
    extractedView: string[];
    extractedLikes: string[];
    extractedTimes: string[];
    extractedProfile: string[];
  },
  emojiArray?: {
    em_time: number;
    emoji: string;
  }[]
)
{
  const result: any = {};
  const sortByTimeDesc = <T extends { name?: string; time?: string }>(a: T, b: T) => {
    const aTime = new Date(a.name ?? a.time ?? "").getTime();
    const bTime = new Date(b.name ?? b.time ?? "").getTime();
    return bTime - aTime;
  };

  const start = (page - 1) * limit;
  const end = start + limit;

  if (frequency) {
    result.frequency = {
      tweetFrequencyTrend: [...frequency.tweetFrequencyTrend].sort(sortByTimeDesc).slice(start, end),
      tweetsWithAddressFrequency: [...frequency.tweetsWithAddressFrequency].sort(sortByTimeDesc).slice(start, end),
    };
  }

  if (tweetperMinutes) {
    result.tweetperMinutes = {
      tweetsPerMinuteArray: [...tweetperMinutes.tweetsPerMinuteArray].sort(sortByTimeDesc).slice(start, end),
      tweetPerFVmints: [...tweetperMinutes.tweetPerFVmints].sort(sortByTimeDesc).slice(start, end),
      tweetsWithAddressCount: [...tweetperMinutes.tweetsWithAddressCount].sort(sortByTimeDesc).slice(start, end),
      totalTweets: tweetperMinutes.totalTweets,
      averagePercentageFv: tweetperMinutes.averagePercentageFv,
      averagePercentage: tweetperMinutes.averagePercentage,
    };
  }

  if (SEI) {
    result.SEI = {
      SEI_value: [...SEI.SEI_value].sort(sortByTimeDesc).slice(start, end),
      SEI_Velocity: [...SEI.SEI_Velocity].sort(sortByTimeDesc).slice(start, end),
      SEI_EMA: [...SEI.SEI_EMA].sort(sortByTimeDesc).slice(start, end),
    };
  }

  if (Fomo) {
    result.Fomo = {
      tweetFomo: [...Fomo.tweetFomo].sort(sortByTimeDesc).slice(start, end),
      compositFomo: [...Fomo.compositFomo].sort(sortByTimeDesc).slice(start, end),
      macd: [...Fomo.macd].sort(sortByTimeDesc).slice(start, end),
      RSI: [...Fomo.RSI].sort(sortByTimeDesc).slice(start, end),
    };
  }

  if (impression) {
    result.impression = {
      weighBasedImpression: [...impression.weighBasedImpression].sort(sortByTimeDesc).slice(start, end),
      sentimentTrend: [...impression.sentimentTrend].sort(sortByTimeDesc).slice(start, end),
      EWMA_Value: [...impression.EWMA_Value].sort(sortByTimeDesc).slice(start, end),
    };
  }

  if (views) {
    result.views = {
      tweetViewsPerFVmints: [...views.tweetViewsPerFVmints].sort(sortByTimeDesc).slice(start, end),
      tweetsWithAddressViews: [...views.tweetsWithAddressViews].sort(sortByTimeDesc).slice(start, end),
      tweetViewsRatioPercentage: [...views.tweetViewsRatioPercentage].sort(sortByTimeDesc).slice(start, end),
      avgViewsPerTweet: views.avgViewsPerTweet,
      tweetwithAddAvgViews: views.tweetwithAddAvgViews,
    };
  }

  if (hype) {
    result.hype = {
      sentiMeter: hype.sentiMeter,
      sentiMeterAddr: hype.sentiMeterAddr,
    };
  }

  if (tweetDetail) {
    const sortedTweetIndices = tweetDetail.extractedTimes
      .map((time, idx) => ({ time: new Date(time).getTime(), idx }))
      .sort((a, b) => b.time - a.time)
      .map(item => item.idx);

    const pagedTweetIndices = sortedTweetIndices.slice(start, end);

    result.tweetDetail = {
      extractedUsernames: pagedTweetIndices.map(i => tweetDetail.extractedUsernames[i]),
      extractedTweets: pagedTweetIndices.map(i => tweetDetail.extractedTweets[i]),
      extractedView: pagedTweetIndices.map(i => tweetDetail.extractedView[i]),
      extractedLikes: pagedTweetIndices.map(i => tweetDetail.extractedLikes[i]),
      extractedTimes: pagedTweetIndices.map(i => tweetDetail.extractedTimes[i]),
      extractedProfile: pagedTweetIndices.map(i => tweetDetail.extractedProfile[i]),
    };
  }

  if (emojiArray) {
    result.emojiArray = [...emojiArray].sort((a, b) => b.em_time - a.em_time).slice(start, end);
  }

  result.meta = {
    totalPages: frequency ? Math.ceil(frequency.tweetFrequencyTrend.length / limit) : 1,
    currentPage: page,
  };

  return result;

}
*/