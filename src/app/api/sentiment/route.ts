
import { NextRequest, NextResponse } from 'next/server';
import { 
  parseViewsCount, groupTweetsWithAddressByInterval,
  calculateTweetFrequencyTrendPercentage, categorizeTweetsByInterval,
  calculateCumulativeRatioPercentage, calculateAverageViewsPerTweet,
  computeImpressionsTimeSeries,computeViewVelocityImpressions,computeRawImpressionsByTierTimeSeries,computeAccountCountsFromTweetEngagementData, computeSEIEMA, computeTimeBasedSEI,
  computeOscillatingSEIVelocity, getDynamicSpikes, computeTimeBasedFOMO,detectFomoPoints,
  computeMetricsBins, computeCompositeFOMOIndex, computeMACD, computeRSI,
  categorizeTweetsByIntervalC, calculateSentimentTrend, computeSentimentTimeSeries,
  calculateAveragePercentage, calculateSentimentScore,calculateFomoFromTweetEntries
} from '@/app/utils/holdersfunct';
import { Engagement, Impression, CompImpression, TimeSeriess, MACDPoint } from '@/app/utils/app_types';
import { NumberFormatter } from '@/app/utils/largeNumber';
import redis from '@/lib/redis';
// Import the new function and its type at the top of your page file

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache lifetime
const refreshing: Record<string, boolean> = {};
//const [time, setTime] = useState(false)
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

interface FilteredTweet {
  tweet: string;
  views: number;
  likes: number;
  timestamp: string;
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

interface TweetDetail {
  extractedUsernames: string[];
  extractedUserfollowers: string[];
  extractedTweets: string[];
  extractedView: string[];
  extractedLikes: string[];
  extractedTimes: string[];
  extractedProfile: string[];
}

interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
}

interface PaginatedResponse {
  meta: PaginationMeta;
  [key: string]: unknown;
}

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


let alldataPlot = false
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Extract params
    const { searchParams } = new URL(req.url);
    console.log("searchParams", searchParams)
    const address = searchParams.get('address');
    const symbol = searchParams.get('symbol');
    const funtype = searchParams.get('type');
    const alldata = searchParams.get('alldata');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const time = searchParams.get('time') || '';
    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }
    if (alldata) {
      console.log("alldata is true")
      alldataPlot= true;
    } else {
      alldataPlot= false;
    }
    // Generate cache key based on all parameters
    const cacheKey = `${address}-${symbol || ''}-${funtype || ''}`;
    const redisKey = `sentim:${cacheKey}`;
    const cacheEntry = await redis.get(redisKey);

    let data: Record<string, unknown>;

    // Handle cache scenarios
    if (cacheEntry) {
      // If cache exists but stale, trigger background refresh and use stale data
      triggerBackgroundRefresh(cacheKey, redisKey, address, symbol, funtype);
      data = JSON.parse(cacheEntry) as Record<string, unknown>;
    } else {
      // No cache - compute data and cache it
      data = await fetchAndProcessData(address, symbol, funtype);
      await redis.set(redisKey, JSON.stringify(data), 'EX', CACHE_TTL);
    }
    if (time !='') {
      console.log("time is not empty", time)
      const [startTime, endTime] = time.split(" to ").map(t => t.trim());
      const timePaginate = filterDataByTime(data as unknown as TweetData, startTime,endTime);
      console.log("timePaginate", timePaginate)
      return NextResponse.json(timePaginate);
    } 
    
    // Apply pagination to the data
    const paginatedData = applyPagination(data, page, limit);
    
    return NextResponse.json(paginatedData);
  } catch (err: unknown) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Helper function to trigger background refresh
function triggerBackgroundRefresh(
  cacheKey: string,
  redisKey: string,
  address: string | null,
  symbol: string | null,
  funtype: string | null
): void {
  if (refreshing[cacheKey]) return;
  
  console.log(`Triggering background refresh for ${cacheKey}`);
  refreshing[cacheKey] = true;
  
  fetchAndProcessData(address, symbol, funtype)
    .then(async (data) => {
      await redis.set(redisKey, JSON.stringify(data), 'EX', CACHE_TTL);
      console.log(`Cache refreshed for ${cacheKey}`);
    })
    .catch(err => {
      console.error(`Background refresh failed for ${cacheKey}:`, err);
    })
    .finally(() => {
      refreshing[cacheKey] = false;
    });
}

function applyPagination(data: Record<string, unknown>, page: number, limit: number): PaginatedResponse {
  const result: Record<string, unknown> = {};
  
  // Helper function to paginate arrays
  const paginateArray = (array: unknown[]): unknown[] => {
    if (!array || !Array.isArray(array)) return array;
    
    // Sort in reverse chronological order if the array has time-related properties
    const sortedArray = [...array].sort((a: unknown, b: unknown) => {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      
      if (aObj.name && bObj.name) {
        return new Date(bObj.name as string).getTime() - new Date(aObj.name as string).getTime();
      } else if (aObj.timestamp && bObj.timestamp) {
        return new Date(bObj.timestamp as string).getTime() - new Date(aObj.timestamp as string).getTime();
      } else if (aObj.time && bObj.time) {
        return new Date(bObj.time as string).getTime() - new Date(aObj.time as string).getTime();
      } else if (aObj.em_time && bObj.em_time) {
        return (bObj.em_time as number) - (aObj.em_time as number);
      }
      return 0;
    });
    
    const start = (page - 1) * limit;
    const end = start + limit;
    return sortedArray.slice(start, end);
  };
  
  // Custom pagination for tweet details which require special handling
  const paginateTweetDetails = (details: unknown): TweetDetail | unknown => {
    if (!details) return details;
    
    const tweetDetails = details as TweetDetail;
    const times = tweetDetails.extractedTimes;
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
      extractedUsernames: paginatedIndices.map(i => tweetDetails.extractedUsernames[i]),
      extractedUserfollowers: paginatedIndices.map(i => tweetDetails.extractedUserfollowers[i]),
      extractedTweets: paginatedIndices.map(i => tweetDetails.extractedTweets[i]),
      extractedView: paginatedIndices.map(i => tweetDetails.extractedView[i]),
      extractedLikes: paginatedIndices.map(i => tweetDetails.extractedLikes[i]),
      extractedTimes: paginatedIndices.map(i => tweetDetails.extractedTimes[i]),
      extractedProfile: paginatedIndices.map(i => tweetDetails.extractedProfile[i]),
    };
  };
  
  // Special handling for tweetDetail
  if (data.tweetDetail) {
    result.tweetDetail = paginateTweetDetails(data.tweetDetail);
  }
  
  // Handle emojiArray directly since it's at the top level
  if (data.emojiArray && Array.isArray(data.emojiArray)) {
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
        const nestedResult = result[key] as Record<string, unknown>;
        const nestedValue = value as Record<string, unknown>;
        
        for (const subKey in nestedValue) {
          const subValue = nestedValue[subKey];
          
          if (Array.isArray(subValue)) {
            // Paginate arrays inside nested objects
            nestedResult[subKey] = paginateArray(subValue);
          } else {
            // Copy non-array values
            nestedResult[subKey] = subValue;
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
  const findMaxArraySize = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    
    if (Array.isArray(obj)) {
      maxArraySize = Math.max(maxArraySize, obj.length);
    } else {
      const objRecord = obj as Record<string, unknown>;
      for (const key in objRecord) {
        findMaxArraySize(objRecord[key]);
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
  
  return result as PaginatedResponse;
}

// Main data processing function


async function fetchAndProcessData(
  address: string | null,
  symbol: string | null,
  funtype: string | null
): Promise<Record<string, unknown>> {
  if (!address) {
    throw new Error('Missing address');
  }

  const hostname = process.env.DATA_HOST || 'localhost';
  const limit = 1000;
  let allTweetData: TweetEntry[] = [];
  let currentPage = 1;
  let totalPages = 1;

  try {
    // Fetch first page to get pagination info
    const firstResponse = await fetch(
      `http://${hostname}:3300/fetch-data?search=${address}&limit=${limit}&page=1`
    );
    
    if (!firstResponse.ok) {
      throw new Error(`HTTP error! status: ${firstResponse.status}`);
    }
    
    const firstPageData = await firstResponse.json();
    
    // Add first page data
    if (Array.isArray(firstPageData.data)) {
      allTweetData.push(...firstPageData.data);
      totalPages = firstPageData.total_pages || 1;
    } else {
      // Handle case where response is directly an array (backward compatibility)
      if (Array.isArray(firstPageData)) {
        allTweetData.push(...firstPageData);
        totalPages = 1;
      } else {
        throw new Error('Invalid response format');
      }
    }
    
    console.log(`Fetching ${totalPages} pages`);

    // If there are more pages, fetch them concurrently
    if (totalPages > 1) {
      const pagePromises: Promise<TweetEntry[]>[] = [];
      
      // Create promises for remaining pages (2 to totalPages)
      for (let page = 2; page <= totalPages; page++) {
        const pagePromise = fetch(
          `http://${hostname}:3300/fetch-data?search=${address}&limit=${limit}&page=${page}`
        )
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`HTTP error on page ${page}! status: ${response.status}`);
            }
            const pageData = await response.json();
            return Array.isArray(pageData.data) ? pageData.data : [];
          })
          .catch((error) => {
            console.error(`Error fetching page ${page}:`, error);
            return []; // Return empty array on error to continue with other pages
          });
        
        pagePromises.push(pagePromise);
      }

      // Wait for all pages to complete
      const pageResults = await Promise.all(pagePromises);
      
      // Flatten and add all page results
      pageResults.forEach((pageData) => {
        if (Array.isArray(pageData)) {
          allTweetData.push(...pageData);
        }
      });
    }

    console.log(`Successfully fetched ${allTweetData.length} tweet entries across ${totalPages} pages`);
    
    // Process and return the data (keeping original structure)
    //return allTweetData as any;

  } catch (error) {
    console.error('Error in fetchAndProcessData:', error);
    throw new Error(`Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  const jsonData = allTweetData as TweetEntry[];
    // Process and return the data (keeping original structure)
    //return allTweetData as u
  // Process data to calculate total views for each unique time
  const viewCounts: { [key: string]: number } = {};
  const tweetEngagementCounts: { [key: string]: TweetEngagementData } = {};
  const engagementCounts: { [key: string]: number } = {};
  const tweetCounts: { [key: string]: number } = {};
  const tweetViews: { [key: string]: { last: number; prev: number } } = {};
  const emojiData: { [key: number]: string } = {};
  const extractedUsernames: string[] = [];
  const extractedUserfollowers: string[] = [];
  const extractedTweets: string[] = [];
  const extractedView: string[] = [];
  const extractedLikes: string[] = [];
  const extractedTimes: string[] = [];
  const extractedProfile: string[] = [];
  const engagementMap: Record<string, Record<string, Engagement>> = {};

  // Filter tweets that include the target address
  const filteredTweets = jsonData.filter((entry: TweetEntry) => {
      return entry.tweet && entry.tweet.includes(address);
  });
  
  const filteredData: FilteredTweet[] = filteredTweets.map((entry: TweetEntry) => {
      const views = entry.params.views ? parseViewsCount(entry.params.views[entry.params.views.length - 1]) : 0;
      const likes = entry.params.likes ? parseViewsCount(entry.params.likes[entry.params.likes.length - 1]) : 0;
      const timestamp = entry.post_time ? entry.post_time : '0';
      return {
          tweet: entry.tweet,
          views,
          likes,
          timestamp,
      };
  });

  const tweetsWithAddress = filteredData;
  
  const validEntries = jsonData.filter((entry: TweetEntry) => {
  if (!entry.tweet || !entry.params) return false;
      return entry.tweet && (entry.tweet.includes(address) || (symbol && entry.tweet.includes(symbol)));
  });
  validEntries.sort((a: TweetEntry, b: TweetEntry) => new Date(b.post_time).getTime() - new Date(a.post_time).getTime());
  let tweetcnt = 0
  let numbottweet = 0
  // Process each entry
  validEntries.forEach((entry: TweetEntry) => {
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
      
      if (profileImag !== undefined) {
          extractedProfile.push(profileImag);
      }
      
      extractedUsernames.push("@" + username);
      extractedUserfollowers.push(followers.toString())
      extractedTweets.push(entry.tweet);
      extractedView.push(views[views.length - 1]);
      extractedLikes.push(likes[likes.length - 1]);
      extractedTimes.push(timestamp);
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
  
      if (botPatterns.some(pattern => pattern.test(entry.tweet))) {
          //console.log("======Bot Tweets======", text)
          numbottweet += 1;
      }
      let minuteKey: string;
      if (timestamp) {
          try {
              minuteKey = new Date(timestamp).toISOString()//.slice(0, 16);
          } catch (error) {
              console.warn("Invalid timestamp:", timestamp, error);
              minuteKey = new Date().toISOString()//.slice(0, 16);
          }
      } else {
          console.warn("Timestamp is empty or null, using current time.");
          minuteKey = new Date().toISOString()//.slice(0, 16);
      }
      
      const emojiTimeStamp = new Date(timestamp).setSeconds(0, 0);
      
      times.forEach((time: number, index: number) => {
          const view = isNaN(parseViewsCount(views[index])) ? 0 : parseViewsCount(views[index]);
          const date = new Date(eng_time[index]);
          
          const pad = (num: number): string => num.toString().padStart(2, '0');

          const year = date.getFullYear();
          const month = pad(date.getMonth() + 1);
          const day = pad(date.getDate());
          const hours = pad(date.getHours());
          const minutes = pad(date.getMinutes());

          const plot_mint = `${year}-${month}-${day}T${hours}:${minutes}`;
          const like = isNaN(parseViewsCount(likes[index])) ? 0 : parseViewsCount(likes[index]);
          const comment = isNaN(parseViewsCount(comments[index])) ? 0 : parseViewsCount(comments[index]);
          const retweet = isNaN(parseViewsCount(retweets[index])) ? 0 : parseViewsCount(retweets[index]);
          
          if (viewCounts[plot_mint]) {
              viewCounts[plot_mint] += view;
          } else {
              viewCounts[plot_mint] = view;
          }
          
          if (entry.tweet.includes(address) || alldataPlot) {
              const impression = (like) + (comment) + (retweet*2);
              
              if (tweetEngagementCounts[plot_mint]) {
                  tweetEngagementCounts[plot_mint].totalTweet += 1;
                  if (tweetEngagementCounts[plot_mint].usernames[username]) {
                      tweetEngagementCounts[plot_mint].usernames[username].count += 1;
                      const prevAvgView = tweetEngagementCounts[plot_mint].usernames[username].views;
                      const vCount = tweetEngagementCounts[plot_mint].usernames[username].count;
                      const prevImpression = tweetEngagementCounts[plot_mint].usernames[username].impression;
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

          if (entry.tweet.includes(address) || alldataPlot) {
   
            //console.log("Tweet Count g",tweetcnt)
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
                    count: 1,
                    post_time: timestamp, // ✅ Add this
                    tweet: entry.tweet // Add tweet text for AI analysis
                };
            } else {
                const bucket = engagementMap[plot_mint][username];
                bucket.count += 1;
                const prevImpression = bucket.impressions;
                const vCount = bucket.count;
                const prevLikes = bucket.likes;
                const prevRetweets = bucket.retweets;
                const prevComments = bucket.comments;
                bucket.impressions = ((prevImpression*(vCount-1))+view)/vCount;
                bucket.likes = Math.floor((prevLikes*(vCount-1))+like)/vCount;
                bucket.retweets = Math.floor((prevRetweets*(vCount-1))+retweet)/vCount;
                bucket.comments = Math.floor((prevComments*(vCount-1))+comment)/vCount;
                bucket.followers = followers;
            }
           tweetcnt+=1; 
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
      
  });/*
  let aiAnalysis: AINarrativeResponse | null = null;
  if (extractedTweets.length > 0) {
    console.log(`Sending ${extractedTweets.length} tweets to AI for narrative analysis...`);
    try {
      aiAnalysis = await getAINarrativeAnalysis(extractedTweets);
      //console.log("AI Analysis result:", aiAnalysis);
    } catch (e) {
        console.error("AI Analysis step failed:", e);
        // aiAnalysis will remain null and you can handle this on the frontend
    }
  } else {
    console.log("No tweets found to send for AI analysis.");
  }*/
  // Convert engagement map to array
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
  const engagementArray: Engagement[] = Object.values(engagementMap)
      .flatMap(userMap => Object.values(userMap))
      .sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      .map(data => ({
        timestamp:   convertToUTCFormat(data.timestamp).replace('+00:00', 'Z'),
        impressions: data.impressions,
        likes:       data.likes,
        retweets:    data.retweets,
        comments:    data.comments,
        followers:   data.followers,
        count:       data.count,
        post_time: data.post_time,
        tweet: data.tweet // Include the tweet text for AI analysis
      }));
      //console.log("engagementArray", engagementArray)
  // Create time series
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
  const tiredImpression = computeRawImpressionsByTierTimeSeries(engagementArray, 1);
  const tieredAccountCount =computeAccountCountsFromTweetEngagementData(tweetEngagementCounts)

  const weighBasedImpression = computeImpressionsTimeSeries(engagementArray, 1);
  const EWMA_Value = computeSEIEMA(weighBasedImpression, 14);
  const SEI_value_x = computeTimeBasedSEI(engagementArray, 5);
  const SEI_EMA = computeSEIEMA(SEI_value_x, 14);
  const SEI_Velocity = computeOscillatingSEIVelocity(SEI_value_x, engagementArray, 15);
  const SEI_value = getDynamicSpikes(SEI_value_x);
  
  const tweetFomo = detectFomoPoints(engagementArray,5,0.2)//computeTimeBasedFOMO(engagementArray, 1, 0.2);
  const getMetricGrid = computeMetricsBins(engagementArray, 5, 5);
  const compositFomo = computeCompositeFOMOIndex(getMetricGrid);
  const macd = computeMACD(tweetFomo);
  const RSI = computeRSI(tweetFomo);
  const tweetFrequencyTrend_ = calculateTweetFrequencyTrendPercentage(tweetsPerMinuteArray, 5, 5, 100);
  const tweetvelocityImpressions = computeViewVelocityImpressions(filteredTweets, 0.3);
  const currentTweetFrequencyTrend = tweetFrequencyTrend_[tweetFrequencyTrend_.length - 1]?.value || 0;
  const timeseries = computeSentimentTimeSeries(validEntries);
  const sentimentTrend = calculateSentimentTrend(timeseries, 30);
  const currentSentimentTrend = sentimentTrend[sentimentTrend.length - 1]?.value || 0;
  const tweetViewsPerFVmints = categorizeTweetsByIntervalC(tweetsPerViewsMinuteArray, 5);
  const avgLstView = calculateAverageViewsPerTweet(tweetViewsPerFVmints.slice(-15), tweetViewsPerFVmints.slice(-15));
  const currentTweetWiAddFrequencyTrend = tweetsWithAddressFrequency[tweetsWithAddressFrequency.length - 1]?.value || 0;
  const tweetwithAddAvgViewsS = calculateAverageViewsPerTweet(tweetsWithAddressViews.slice(-15), tweetsWithAddressCount.slice(-15));

  const sentiMeter = Math.round(calculateSentimentScore(currentTweetFrequencyTrend, currentSentimentTrend, avgLstView, Number(totalTweets)));
  const sentiMeterAddr = Math.round(calculateSentimentScore(currentTweetWiAddFrequencyTrend, currentSentimentTrend, tweetwithAddAvgViewsS, totalTweetsWithAddress));

  // Structure data for different function types
  const frequency = { tweetFrequencyTrend, tweetsWithAddressFrequency };
  const tweetperMinutes = { tweetsPerMinuteArray, tweetPerFVmints, tweetsWithAddressCount, totalTweets, averagePercentageFv, averagePercentage ,numbottweet};
  const SEI = { SEI_value, SEI_Velocity, SEI_EMA };
  const Fomo = { tweetFomo, compositFomo, macd, RSI };
  const impression = { weighBasedImpression, sentimentTrend, EWMA_Value ,tiredImpression,tieredAccountCount,tweetvelocityImpressions};
  const views = { tweetViewsPerFVmints, tweetsWithAddressViews, tweetViewsRatioPercentage, avgViewsPerTweet, tweetwithAddAvgViews };
  const hype = { sentiMeter, sentiMeterAddr };
  //console.log("AI Analysis result:", aiAnalysis);
  const tweetDetail = { extractedUsernames,extractedUserfollowers, extractedTweets, extractedView, extractedLikes, extractedTimes, extractedProfile };
  
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
        emojiArray,
        
      };
  }
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
    console.log(`FilteringX ${data.tweetperMinutes} from ${startTime} to ${endTime}`);
    //console.dir(data, { depth: null, colors: true }); 
    const start = normalizeTimeInput(startTime);
    const end = normalizeTimeInput(endTime);
    
    // Handle case where end time is before start time (crossing midnight)
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }
    
    console.log(`Filtering data from ${start.toISOString()} to ${end.toISOString()}, normal time ${startTime} to ${endTime}`);
    
    // Filter tweetDetail arrays using extractedTimes as reference
    const filteredTweetDetail = filterTweetDetailArrays(data.tweetDetail, start, end);
    console.log(`Filtered tweetDetail: ${filteredTweetDetail.extractedTimes.length} items`);
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
        totalPages: Math.ceil(totalFilteredItems / 1),
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