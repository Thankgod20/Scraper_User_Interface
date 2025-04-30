//pages.tsx
"use client"
import Chart from '@/components/Chart';
import TradeCard from '@/components/TradeCard';
import MetricsGrid from '@/components/MetricsGrid';
import TopTweets from '@/components/TopTweets';
import { useParams } from "next/navigation";
import { useMetadata } from '@/context/MetadataContext';
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { CandlestickData } from 'lightweight-charts';
import TVChart from '@/components/TVChart';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
//import { TVChartContainer } from '@/components/AdvChart';
import TVChartContainer from '@/components/AdvChart';
import Script from 'next/script';
import { CandleData, RawTradeData } from '@/app/types/TradingView';
import Sentiment from 'sentiment';
import OrderBookCard from '@/components/OrderBookCard';
import OrderBookPanel from '@/components/OrderBookPanel';
import vader from 'vader-sentiment';
//import AdvChart from '@/components/AdvChart';
interface Impression {
  name: string;
  value: number;
}
interface EngagementImpression {
  name: string;
  impression: number;
  views: number;
  volume: number;
}
interface CompImpression {
  name: string;
  value: number;
  preval: number;
}
interface Engagement {
  timestamp: string;
  impressions: number;
  likes: number;
  retweets: number;
  comments: number;
  followers: number;
}
const ALPHA = 0.01; // baseline pump magnitude (e.g., 1%)
const BETA = 0.05;  // sensitivity coefficient
export default function Home() {
  const { address }: { address: string } = useParams();
  const { metadata } = useMetadata();
  const [manualMetadata, setManualMetadata] = useState<{ name: string; symbol: string; uri: string }>();
  const [allMetadata, setAllMetadata] = useState<{ name: string; symbol: string; description: string; image: string; showName: boolean; createdOn: string; twitter: string; telegram: string; website: string }>();
  //console.log("metadata", metadata, metadata?.twitter)
  const [tweetsWithAddress, setTweetsWithAddress] = useState<any[]>([]);
  const [impressionsData, setImpressionsData] = useState<Impression[]>([]);
  const [engaments, setEngamentData] = useState<Impression[]>([]);
  const [tweetPerMinute, setTweetsPerMinuteData] = useState<Impression[]>([]);
  const [tweetViewsPerMinute, setTweetsViewsPerMinuteData] = useState<CompImpression[]>([]);
  const [tweetEngagment, setTweetEngagment] = useState<EngagementImpression[]>([]);
  const [emojiRawData, setEmojiRawData] = useState<{ em_time: number, emoji: string }[]>([]);
  const [holderRawData, setHoldersRawData] = useState<{ amount: number, price: number,time:string }[]>([]);
  const [holderData, setHoldersData] = useState<{ holders: number; time: string }[]>([]);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [tweets, setTweets] = useState<string[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [viewscount, setViewCount] = useState<string[]>([]);
  const [time, setTime] = useState<string[]>([]);
  const [profile, setProfile] = useState<string[]>([]);

  const [chartData, setChartData] = useState<RawTradeData[]>([]);
  const [livePrice, setLivePrice] = useState<RawTradeData[]>([]);
  const [totalchartData, setTotalChartData] = useState<RawTradeData[]>([]);
  const [sentimentTimeSeries, setSentimentTimeSeries] = useState<{ time: string; aggregatedSentiment: number }[]>([]);
  // Overall aggregated sentiment and pump prediction across all tweets (optional)
  const [aggregatedSentiment, setAggregatedSentiment] = useState<number | null>(null);
  const [predictedPump, setPredictedPump] = useState<number | null>(null);
  const [engagementData, setEngagementData] = useState<Engagement[]>([])
  
  const engagementMap: Record<
  string,
  { timestamp: string;
    impressions: number;
    likes: number;
    retweets: number;
    comments: number;
    followersSum: number;
    count: number;
  }
> = {};
  const sentimentAnalyzer = new Sentiment();
  const options = {
    extras: {
      // Single words & tokens for phrases
      'bundles': -15,
      'control': -15,
      'manipulate': -13,
      'market': -2,
      'doesn\'t_look': -12,
      'SCAM': -15,
      'scam': -15,
      'dump': -13,
      'rug': -15,
      'dex': 2,
      'KOL': 2,
      'bullish': 2,
      'paid': 3,
      '1x': 2,
      '2x': 2,
      '3x': 2,
      '4x': 2,
      '5x': 2,
      '10x': 2,
      '100x': 2,
      '1000x': 2,
      'moon': 2,
      // Additional phrases can be added here
      'not_safe': -13,
      'poor_quality': -14,
      'high_risk': -15,
      'low_confidence': -13,
    }
  };
  const fetchHostnameFromConfig = async () => {
    try {
      const configResponse = await fetch('/config.json');
      if (!configResponse.ok) {
        throw new Error('Failed to load config file');
      }
      const configData = await configResponse.json();
      //console.log("Configuration",configData)
      return configData.hostname; // Return the hostname from the config
    } catch (error) {
      console.error('Error fetching hostname from config:', error);
      throw error;
    }
  };
  // Preprocessing function to replace known multi-word phrases with a single token
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
  
  // Helper function to compute overall aggregated sentiment (if needed)
  const computeOverallSentiment = (tweetData: any[]) => {
    let weightedSentiment = 0;
    let totalWeight = 0;
    tweetData.forEach((entry) => {
      const text = entry.tweet;
      if (!text) return;
      
      // Preprocess text to handle multi-word phrases
      const processedText = preprocessText(text);
      const result = sentimentAnalyzer.analyze(processedText, options);
  
      // Custom rule: if "Rug probability:" exists and is > 40%, force negative score.
      const rugMatch = processedText.match(/Rug probability:\s*(\d+)%/i);
      if (rugMatch) {
        const prob = parseFloat(rugMatch[1]);
        if (prob > 40) {
          // For example, force the score to -5 (or adjust as needed)
          result.score = -10;
        }
      }
      
      //console.log("Tweet:", text, "\nProcessed:", processedText, "\nResult:", result);
      
      let weight = 0.3;
      if (entry.params?.views && entry.params.views.length > 0) {
        weight = parseFloat(entry.params.views[0]) || 1;
      }
      weightedSentiment += result.score * weight;
      totalWeight += weight;
    });
    const aggSent = totalWeight > 0 ? weightedSentiment / totalWeight : 0;
    setAggregatedSentiment(aggSent);
    setPredictedPump(ALPHA + BETA * aggSent);
  };
  
  // Helper function to compute sentiment per minute
  const computeSentimentTimeSeries = (tweetData: any[]) => {
    const sentimentByTime: { [time: string]: { totalSentiment: number, weight: number } } = {};
    tweetData.forEach((entry) => {
      const text = entry.tweet;
      if (!text) return;
      
      const processedText = preprocessText(text);
      const result = vader.SentimentIntensityAnalyzer.polarity_scores(processedText);
      console.log("Sentiment Text",processedText,result)
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
    setSentimentTimeSeries(timeSeries);
  };
  

  useEffect(() => {

    const fetchMetadata = async () => {
      //const fetchedMetadata: { name: string; symbol: string; uri: string }[] = [];
      if (!metadata) {
        // console.log("addresses", addresses, "address", address.address)
        try {
          const hostname = await fetchHostnameFromConfig();
          //console.log("hostname",hostname)
          const response = await fetch(`http://${hostname}:3300/api/token-metadata?mint=${address}`);
          const data = await response.json();
          //fetchedMetadata.push(data);
          setManualMetadata(data)
          //console.log("manualMetadata", data)
        } catch (error) {
          console.error('Error fetching token metadata:', error);
        }
      };
    }
    fetchMetadata();

  }, [metadata]);

  useEffect(() => {
    const fetchMetadata = async () => {
      const fetchedOtherMetadata: { name: string; symbol: string; description: string; image: string; showName: boolean; createdOn: string; twitter: string; telegram: string; website: string }[] = [];
      //for (const metadata_ of metadata) {

      if (!manualMetadata?.uri) {
        //console.log('Metadata URI is missing');
        return;
      }
      //console.log("manualMetadata===", manualMetadata?.uri)
      try {
        const response = await fetch(manualMetadata.uri);
        const data = await response.json();
        //setOtherMetadata(data)
        setAllMetadata(data)
      } catch (error) {
        console.error('Error fetching token metadata:', error);
      }
      // }
    };

    fetchMetadata();
  }, [manualMetadata]);
  useEffect(() => {
  /*  const fetchData = async () => {
      const response = await fetch('/api/bitquery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });
      const result = await response.json();
      setChartData(result.data.Solana.DEXTradeByTokens);
    };*/

    const fetchRaydiumData = async () => {
      const response = await fetch('/api/raydium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });
      const result = await response.json();
      //console.log("Result chart",result.data.attributes.ohlcv_list)
      const mappedData: RawTradeData[] = result.data.attributes.ohlcv_list.map((entry: number[]) => ({
        time: entry[0],
        open: entry[1],
        high: entry[2],
        low: entry[3],
        close: entry[4],
        volume: entry[5],
      }));
      //console.log("Result chart",mappedData)
      //setChartData(mappedData);
      setChartData((prevData) => {
        if (JSON.stringify(prevData) !== JSON.stringify(mappedData)) {
          return mappedData;
        }
        return prevData;
      });
      
    };
   // fetchData();
    fetchRaydiumData();
    const fetchRaydiumLive = async () => {
      const response = await fetch('/api/live', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });
      const result = await response.json();
      //console.log("Result chart",result.data.attributes.ohlcv_list)
      const mappedData: RawTradeData[] = result.data.attributes.ohlcv_list.map((entry: number[]) => ({
        time: entry[0],
        open: entry[1],
        high: entry[2],
        low: entry[3],
        close: entry[4],
        volume: entry[5],
      }));
      //console.log("Result chart",mappedData)
      //setChartData(mappedData);
      setLivePrice((prevData) => {
        if (JSON.stringify(prevData) !== JSON.stringify(mappedData)) {
          return mappedData;
        }
        return prevData;
      });
      
    };
    fetchRaydiumLive()
    const interval = setInterval(() => {
      fetchRaydiumLive()
    }, 60000); 
  }, [address]);
  type BusinessDay = { year: number; month: number; day: number };

  useEffect(() => {
    setTotalChartData((prevTotalChartData) => {
      const mergedData = [...prevTotalChartData, ...chartData];
      
      // Remove duplicates based on `time` and sort
      const uniqueData = mergedData.reduce((acc, item) => {
        if (!acc.some((d) => d.time === item.time)) acc.push(item);
        return acc;
      }, [] as RawTradeData[]);

      //return uniqueData.sort((a, b) => a.time - b.time);
      return uniqueData.sort((a, b) => {
        const getTimeValue = (time: string | BusinessDay | number): number => {
          if (typeof time === 'number') return time;
          if (typeof time === 'string') return new Date(time).getTime();
          if ('year' in time && 'month' in time && 'day' in time) {
            // Convert BusinessDay to a Date object
            return new Date(time.year, time.month - 1, time.day).getTime();
          }
          throw new Error('Invalid time format');
        };

        const timeA = getTimeValue(a.time);
        const timeB = getTimeValue(b.time);

        return timeA - timeB;
      });

    });
  }, [chartData]);
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
  useEffect(() => {/*
    const fetchData = async () => {

      const hostname = await fetchHostnameFromConfig();
      const response = await fetch(`http://${hostname}:3300/fetch-data?search=${address}`)//fetch(`http://localhost:3300/spltoken/${address}.json`); 4x77NhFuVzWWDGEMUyB17e3nhvVdkV7HT2AZNmz6pump// Load the JSON data
      const jsonData = await response.json();

      // Process data to calculate total views for each unique time
      const viewCounts: { [key: string]: number } = {};
      const tweetEngagementCounts: { [key: string]: {impression:number;views:number,totalTweet:number} } = {};
      const engagementCounts: { [key: string]: number } = {};
      const tweetCounts: { [key: string]: number } = {};
      const tweetViews: { [key: string]: { last: number; prev: number } } = {};//const tweetViews: { [key: string]: number } = {};
      const emojiData: { [key: number]: string } = {};
      const extractedUsernames: string[] = [];
      const extractedTweets: string[] = [];
      const extractedView: string[] = [];
      const extractedLikes: string[] = [];
      const extractedTimes: string[] = [];
      const extractedProfile: string[] = [];
      
      const filteredTweets = jsonData.filter((entry: any) => {
        return entry.tweet && entry.tweet.includes(address);
      });
      //console.log("Twittes with Address",filteredTweets)
      // Map the filtered tweets to extract tweet, views, and likes
      const filteredData = filteredTweets.map((entry: any) => {
        // Assuming that views and likes are stored in entry.params.views and entry.params.likes respectively
        // and that you want the last value from each array (as seen in your existing code)
        const views = entry.params.views ? parseViewsCount(entry.params.views[entry.params.views.length - 1]) : 0;
        const likes = entry.params.likes ? parseViewsCount(entry.params.likes[entry.params.likes.length - 1]) : 0;
        const timestamp = entry.post_time ? entry.post_time : 0;
        return {
          tweet: entry.tweet,
          views,
          likes,
          timestamp,
          // You can include additional fields if needed
        };
      });
    
      // Update state with the new filtered data
      setTweetsWithAddress(filteredData);
      const validEntries = jsonData.filter((entry: any) => {
        return entry.tweet && (entry.tweet.includes(address) || entry.tweet.includes(allMetadata?.symbol));
      });
      //console.log("Valid tweets", validEntries);
      validEntries.forEach((entry: any) => {
        const times = entry.params.time;
        const views = entry.params.views;
        const likes = entry.params.likes
        const comments = entry.params.comment
        const retweets = entry.params.retweet
        const timestamp = entry.post_time
        const eng_time = entry.params.plot_time
        const statusUrl = entry.status;
        const profileImag = entry.profile_image
        const followers = entry.followers
        const username = statusUrl.split('https://x.com/')[1].split('/status/')[0];
        if (profileImag != undefined) {
          extractedProfile.push(profileImag)
        }
        extractedUsernames.push("@" + username);
        const tweets = entry.tweet;
        extractedTweets.push(tweets)
        extractedView.push(views)
        extractedLikes.push(likes)
        extractedTimes.push(timestamp)
        
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
        //console.log("Time Stamp minuteKey",minuteKey) // Format: "YYYY-MM-DDTHH:MM"
        // console.log("TIme Stampe", timestamp, "Minutets", minuteKey)
        const emojiTimeStamp = new Date(timestamp).setSeconds(0, 0);
        let number_Tweet = 0
        times.forEach((time: number, index: number) => {
          const view = isNaN(parseViewsCount(views[index])) ? 0 : parseViewsCount(views[index]);
          //const plot_mint = new Date(eng_time[index]).toISOString().slice(0, 16);
          const date = new Date(eng_time[index]);

          const pad = (num:any) => num.toString().padStart(2, '0');

          const year = date.getFullYear();
          const month = pad(date.getMonth() + 1); // Months are zero-based
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
            if (tweetEngagementCounts[plot_mint]) {
              tweetEngagementCounts[plot_mint].impression+=(like*0.2) + (comment*0.3) + (retweet*0.5)
              tweetEngagementCounts[plot_mint].views+=view
              tweetEngagementCounts[plot_mint].totalTweet+=1
            } else {
              tweetEngagementCounts[plot_mint] = {impression:(like*0.2) + (comment*0.3) + (retweet*0.5),views:view,totalTweet:1}
            }
          }
          if (engagementCounts[plot_mint]) {
            engagementCounts[plot_mint] += ((like*0.2) + (comment*0.3) + (retweet*0.5));
          } else {
            engagementCounts[plot_mint] = ((like*0.2) + (comment*0.3) + (retweet*0.5));
          }
          if (!engagementMap[plot_mint]) {
            engagementMap[plot_mint] = {
              timestamp: plot_mint,
              impressions:view,
              likes:like,
              retweets:retweet,
              comments:comment,
              followersSum: followers,
              count: 1
            };
          } else {
            const bucket = engagementMap[plot_mint];
            bucket.impressions += view;
            bucket.likes += like;
            bucket.retweets += retweet;
            bucket.comments += comment;
            bucket.followersSum += followers;
            bucket.count += 1;
          }
          //console.log("Engagement", like, comment, retweet, "Total", (like + comment + retweet))
        });
        
        if (tweetCounts[minuteKey]) {
          tweetCounts[minuteKey] += 1; // Increment the count for tweets in this minute
        } else {
          tweetCounts[minuteKey] = 1; // Initialize with 1 tweet for this minute
        }
        //console.log("views[time.length-1]",views[views.length-1])
        const view = isNaN(parseViewsCount(views[views.length-1])) ? 0 : parseViewsCount(views[views.length-1]);
        let viewPrev = 0//isNaN(parseViewsCount(views[views.length-2])) ? 0 : parseViewsCount(views[views.length-2]);
        if (views.length>1) {
          viewPrev = isNaN(parseViewsCount(views[views.length-2])) ? 0 : parseViewsCount(views[views.length-2]);
        }
        if (tweetViews[minuteKey]) {
          tweetViews[minuteKey].last += view;
          tweetViews[minuteKey].prev += viewPrev;
        } else {
          tweetViews[minuteKey] = { last: view, prev: viewPrev };
        }
        if (!emojiData[emojiTimeStamp]) {
          const sentiment = parseViewsCount(views[views.length - 1])
          if (sentiment > 10000) {
            emojiData[emojiTimeStamp] = "💎"//profileImag ?? "https://via.placeholder.com/40"// Add emoji based on timestamp
          } else if (sentiment > 5000) {
            emojiData[emojiTimeStamp] = "♦️"
          } else if (sentiment > 1000) {
            emojiData[emojiTimeStamp] = "🥇"
          } else if (sentiment > 500) {
            emojiData[emojiTimeStamp] = "🥈"
          } else {
            emojiData[emojiTimeStamp] = "😎"
          }
        }
      });
      //console.log("Views tweetsPerViewsMinuteArray ",tweetViews)
      // Convert the viewCounts object into an array
      const engagementArray: Engagement[] = Object.values(engagementMap)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(bucket => ({
          timestamp: bucket.timestamp,
          impressions: bucket.impressions,
          likes: bucket.likes,
          retweets: bucket.retweets,
          comments: bucket.comments,
          followers: Math.round(bucket.followersSum / bucket.count)
        }));
      const impressionsArray = Object.entries(viewCounts).map(([name, value]) => ({
        name,
        value
      })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
      const engamentArray = Object.entries(engagementCounts).map(([name, value]) => ({
        name,
        value
      })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
      // Convert the tweetCounts object into an array
      const tweetsPerMinuteArray = Object.entries(tweetCounts).map(([name, value]) => ({
        name,
        value
      })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
      const emojiArray = Object.entries(emojiData).map(([time, emoji]) => ({
        em_time: parseInt(time, 10),
        emoji,
      })).sort((a, b) => a.em_time - b.em_time);
      /*
      const tweetsPerViewsMinuteArray = Object.entries(tweetViews).map(([name, value]) => ({
        name,
        value
      })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());*//*
      const tweetsPerViewsMinuteArray = Object.entries(tweetViews)
      .map(([name, data]) => ({
      name,
      value: data.last,
      preval: data.prev
    }))
    .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
    const tweetsEngagementPlot = Object.entries(tweetEngagementCounts)
      .map(([name, data]) => ({
      name,
      impression: data.impression,
      views: data.views,
      volume:data.totalTweet
    }))
    .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
    setTweetsViewsPerMinuteData(tweetsPerViewsMinuteArray);
    setTweetEngagment(tweetsEngagementPlot)
      
    setEmojiRawData(prevData => {
      const newDataString = JSON.stringify(emojiArray);
      const prevDataString = JSON.stringify(prevData);
      
      return newDataString !== prevDataString ? emojiArray : prevData;
    });
    //console.log("impressionsArray",impressionsArray)
    setEngagementData(engagementArray);
    setImpressionsData(impressionsArray);
    setTweetsPerMinuteData(tweetsPerMinuteArray);
    setTweetsViewsPerMinuteData(tweetsPerViewsMinuteArray);
    setEngamentData(engamentArray)
    setUsernames(extractedUsernames);
    setTweets(extractedTweets)
    setLikes(extractedLikes)
    setViewCount(extractedView)
    setTime(extractedTimes)
    setProfile(extractedProfile)

    computeOverallSentiment(jsonData);
    // Compute sentiment time series (grouped by minute)
    computeSentimentTimeSeries(jsonData);
    };
    fetchData();*/
    const fetchData = async () => {
      const hostname = await fetchHostnameFromConfig();
      const response = await fetch(`http://${hostname}:3300/fetch-data?search=${address}`);
      const jsonData = await response.json();
  
      // Process data to calculate total views for each unique time
      const viewCounts: { [key: string]: number } = {};
      const tweetEngagementCounts: { [key: string]: {impression: number; views: number; totalTweet: number; usernames: {[username: string]: {count: number; impression: number; views: number}}} } = {};
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
  
      setTweetsWithAddress(filteredData);
      const validEntries = jsonData.filter((entry: any) => {
          return entry.tweet && (entry.tweet.includes(address) || entry.tweet.includes(allMetadata?.symbol));
      });
  
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
              const timeKey = `${time} min`;
  
              if (viewCounts[plot_mint]) {
                  viewCounts[plot_mint] += view;
              } else {
                  viewCounts[plot_mint] = view;
              }
              
              if (entry.tweet.includes(address)) {
                  const impression = (like*0.2) + (comment*0.3) + (retweet*0.5);
                  
                  if (tweetEngagementCounts[plot_mint]) {
                      tweetEngagementCounts[plot_mint].impression += impression;
                      tweetEngagementCounts[plot_mint].views += view;
                      tweetEngagementCounts[plot_mint].totalTweet += 1;
                      
                      // Track per username
                      if (tweetEngagementCounts[plot_mint].usernames[username]) {
                          tweetEngagementCounts[plot_mint].usernames[username].count += 1;
                          tweetEngagementCounts[plot_mint].usernames[username].impression += impression;
                          tweetEngagementCounts[plot_mint].usernames[username].views += view;
                      } else {
                          tweetEngagementCounts[plot_mint].usernames[username] = {
                              count: 1,
                              impression: impression,
                              views: view
                          };
                      }
                  } else {
                      tweetEngagementCounts[plot_mint] = {
                          impression: impression,
                          views: view,
                          totalTweet: 1,
                          usernames: {
                              [username]: {
                                  count: 1,
                                  impression: impression,
                                  views: view
                              }
                          }
                      };
                  }
              }
              
              if (engagementCounts[plot_mint]) {
                  engagementCounts[plot_mint] += ((like*0.2) + (comment*0.3) + (retweet*0.5));
              } else {
                  engagementCounts[plot_mint] = ((like*0.2) + (comment*0.3) + (retweet*0.5));
              }
              
              if (!engagementMap[plot_mint]) {
                  engagementMap[plot_mint] = {
                      timestamp: plot_mint,
                      impressions: view,
                      likes: like,
                      retweets: retweet,
                      comments: comment,
                      followersSum: followers,
                      count: 1
                  };
              } else {
                  const bucket = engagementMap[plot_mint];
                  bucket.impressions += view;
                  bucket.likes += like;
                  bucket.retweets += retweet;
                  bucket.comments += comment;
                  bucket.followersSum += followers;
                  bucket.count += 1;
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
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .map(bucket => ({
              timestamp: bucket.timestamp,
              impressions: bucket.impressions,
              likes: bucket.likes,
              retweets: bucket.retweets,
              comments: bucket.comments,
              followers: Math.round(bucket.followersSum / bucket.count)
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
          const uniqueUsernames = Object.keys(data.usernames);
          const uniqueUsernameCount = uniqueUsernames.length; // Count of unique usernames
          
          // Process each username's data
          uniqueUsernames.forEach(username => {
              const userData = data.usernames[username];
              // Average the impressions and views for each username
              totalImpression += userData.impression / userData.count;
              totalViews += userData.views / userData.count;
          });
          
          return {
              name,
              impression: totalImpression,
              views: totalViews,
              volume: uniqueUsernameCount // Set volume to the count of unique usernames
          };
      }).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
      
      setTweetsViewsPerMinuteData(tweetsPerViewsMinuteArray);
      setTweetEngagment(tweetsEngagementPlot);
      
      setEmojiRawData(prevData => {
          const newDataString = JSON.stringify(emojiArray);
          const prevDataString = JSON.stringify(prevData);
          
          return newDataString !== prevDataString ? emojiArray : prevData;
      });
      
      setEngagementData(engagementArray);
      setImpressionsData(impressionsArray);
      setTweetsPerMinuteData(tweetsPerMinuteArray);
      setTweetsViewsPerMinuteData(tweetsPerViewsMinuteArray);
      setEngamentData(engamentArray);
      setUsernames(extractedUsernames);
      setTweets(extractedTweets);
      setLikes(extractedLikes);
      setViewCount(extractedView);
      setTime(extractedTimes);
      setProfile(extractedProfile);
  
      computeOverallSentiment(jsonData);
      computeSentimentTimeSeries(jsonData);
  };
  
  fetchData();
    const fetchHolersData = async () => {
      try {
        const hostname = await fetchHostnameFromConfig();
        const response = await fetch(`http://${hostname}:3300/fetch-holders?search=${address}`);
        const jsonData = await response.json();
    
        // Aggregate data by price and time (converted to an ISO string with seconds and milliseconds reset)
        const holderData: { [key: string]: { price: number; amount: number; time: string } } = {};
        jsonData.forEach((entry: any) => {
          const price = parseFloat(entry.price);
          const amount = parseFloat(entry.amount);
          // Round the time to the nearest minute (seconds & milliseconds zeroed)
          const timeNumber = new Date(entry.time).setSeconds(0, 0);
          // Convert the time back to a string (ISO format)
          const formattedTime = new Date(timeNumber).toISOString();
          // Create a composite key using price and the formatted time
          const key = `${price}_${formattedTime}`;
    
          if (holderData[key] !== undefined) {
            holderData[key].amount += amount;
          } else {
            holderData[key] = { price, amount, time: formattedTime };
          }
        });
    
        // Convert aggregated object to an array of objects with numerical price, amount, and time string.
        const holdersArray = Object.values(holderData);
    
        // Only update state if the new data differs from the current state.
        setHoldersRawData((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(holdersArray)) {
            return holdersArray;
          }
          return prev;
        });
      } catch (error) {
        console.error('Error fetching holders data:', error);
      }
    };
    
     fetchHolersData()
     const fetchHoldersPlot = async () => {
      try {
        const hostname = await fetchHostnameFromConfig();
        
        // Use the provided URL pattern but with the correct path
        const response = await fetch(`http://${hostname}:3300/api/holder-snapshots?address=${address}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const jsonData = await response.json();
        
        // Aggregate data by price and time (converted to an ISO string with seconds and milliseconds reset)
        const holderData: { [key: string]: { holders: number; time: string } } = {};
        
        jsonData.forEach((entry: any) => {
          // Extract the holders count
          const holders = parseInt(entry.holders);
          
          // Round the time to the nearest minute (seconds & milliseconds zeroed)
          const timeNumber = new Date(entry.time).setSeconds(0, 0);
          
          // Convert the time back to a string (ISO format)
          const formattedTime = new Date(timeNumber).toISOString();
          
          // Use the formatted time as the key since we're tracking holders over time
          const key = formattedTime;
          
          // For holder snapshots, we're likely interested in the latest count for each minute
          // We could also sum or average if there are multiple entries per minute
          holderData[key] = { holders, time: formattedTime };
        });
        
        // Convert aggregated object to an array of objects with holders count and time
        const holdersArray = Object.values(holderData);
        
        // Sort by time to ensure chronological order
        holdersArray.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        
        // Only update state if the new data differs from the current state
        setHoldersData((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(holdersArray)) {
            return holdersArray;
          }
          return prev;
        });
        
        return holdersArray;
      } catch (error) {
        console.error('Error fetching holders data:', error);
        return [];
      }
    };
    fetchHoldersPlot()
    const interval = setInterval(() => {
      fetchData();fetchHolersData();fetchHoldersPlot()
    }, 60000); // Fetch every 60 seconds

    return () => clearInterval(interval);
  }, [address,allMetadata]);

  const [isScriptReady, setIsScriptReady] = useState(false);
  const [isScriptWidgetReady, setIsScriptWidgetReady] = useState(false);
  const metadata_ = metadata || allMetadata
  //console.log("Metadsss", metadata_)
  
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}

      <header className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold">{metadata_?.name} ({metadata_?.symbol})</h1>
        {aggregatedSentiment !== null && predictedPump !== null && (
          <div className="mt-2">
            <p>Overall Aggregated Sentiment: {aggregatedSentiment.toFixed(2)}</p>
            <p>Predicted Overall Pump Magnitude: {(predictedPump * 100).toFixed(2)}%</p>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex flex-col lg:flex-row items-stretch overflow-hidden lg:h-[90vh]">
        {/* Left Section */}
        <section className="w-full lg:w-3/5 flex flex-col overflow-auto">
          <div>
            <h1>Blockchain Data on TradingView Charts</h1>
            {/*totalchartData.length > 0 ? <TVChart data={totalchartData} /> : <p>Loading...</p>*/}
            <Script
              src="/static/datafeeds/udf/dist/bundle.js"
              strategy="lazyOnload"
              onReady={() => {
                setIsScriptReady(true);
              }}
            />
            <Script
              src="/static/charting_library/charting_library.js"
              strategy="lazyOnload"
              onReady={() => {
                //console.log("Loadedd--xx--", window.TradingView.widget)
                setIsScriptWidgetReady(true);
              }}
            />
            {isScriptReady && isScriptWidgetReady && <TVChartContainer data={totalchartData} name={metadata_?.name} address={address} symbol={metadata_?.symbol} emojiData={emojiRawData} />}
          </div>

          {/* <Chart name={metadata?.name} symbol={metadata?.symbol} />*/}
          {/* Use flex-grow to push TopTweets to the bottom */}
         
          <div className="">
            <TopTweets username={usernames} tweets_={tweets} likes={likes} viewscount={viewscount} timestamp={time} profile={profile} />
          </div>
        </section>
          {/* Right Section (Sidebar + OrderBook) */}
        <div className="w-full flex flex-col lg:flex-row">
          {/* Order Book */}
          <div className="lg:w-1/2 p-4 border-l border-gray-700 overflow-auto">
            
            <OrderBookPanel 
              holders={holderRawData}
              live_prx={livePrice}
              holderplot={holderData}
            />
          </div>  
          {/* Right Section (Sidebar) */}
          <aside className="w-full lg:w-1/2 p-4 border-l border-gray-700 overflow-auto">
            <MetricsGrid address={address} name={metadata_?.image} twitter={metadata_?.twitter} tweetPerMinut={tweetPerMinute} impression={impressionsData} engagementData={engagementData} engagement={engaments} tweetEngagemnt={tweetEngagment} tweetViews={tweetViewsPerMinute} sentimentPlot={sentimentTimeSeries} tweetsWithAddress={tweetsWithAddress} holders={holderRawData} live_prx={livePrice}/>
          </aside>
          </div>
        </main>
      </div>
    
  );
}
