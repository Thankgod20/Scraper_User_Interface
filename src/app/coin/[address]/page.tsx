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
import { SellOffRisk,CategoryHoldings,MACDPoint,TimeSeriess } from '@/app/utils/app_types';
//import { console } from 'inspector';
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
  followers: number;
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
  count: number;
}
type HistoryEntry = { 
  amount: number;
  time: string;
};
type ZoomReport = {
  totalpage: number;
  currentpage: number;
};
const ALPHA = 0.01; // baseline pump magnitude (e.g., 1%)
const BETA = 0.05;  // sensitivity coefficient

export function loadMore(page:number,type:string):{data:{ amount: number, price: number,time:string }[],status:String} {
   return {data:[],status:"End"}
  
  }
export default function Home() {
  const { address }: { address: string } = useParams();
  const { metadata } = useMetadata();
  const [manualMetadata, setManualMetadata] = useState<{ name: string; symbol: string; uri: string }>();
  const [allMetadata, setAllMetadata] = useState<{ name: string; symbol: string; description: string; image: string; showName: boolean; createdOn: string; twitter: string; telegram: string; website: string }>();
  //console.log("metadata", metadata, metadata?.twitter)

  const [emojiRawData, setEmojiRawData] = useState<{ em_time: number, emoji: string }[]>([]);
  const [holderRawData, setHoldersRawData] = useState<{ amount: number, price: number,time:string }[]>([]);
  const [holderData, setHoldersData] = useState<{ holders: number; time: string }[]>([]);
  const [holderHistoryData, setHolderHistoryData] = useState<{ holders: number; time: string }[]>([]);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [utweets, setUTweets] = useState<string[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [viewscount, setViewCount] = useState<string[]>([]);
  const [time, setTime] = useState<string[]>([]);
  const [profile, setProfile] = useState<string[]>([]);
  const [plotData, setPlotData] = useState<SellOffRisk[]>([]);
  const [plotDistribution, setPlotDistribution] = useState<CategoryHoldings>();
  const [plotHoldigCount, setPlotHoldingCount] = useState<CategoryHoldings>();
  const [chartData, setChartData] = useState<RawTradeData[]>([]);
  const [livePrice, setLivePrice] = useState<RawTradeData[]>([]);
  const [totalchartData, setTotalChartData] = useState<RawTradeData[]>([]);
  const [sentimentTimeSeries, setSentimentTimeSeries] = useState<{ time: string; aggregatedSentiment: number }[]>([]);
  // Overall aggregated sentiment and pump prediction across all tweets (optional)
  const [aggregatedSentiment, setAggregatedSentiment] = useState<number | null>(null);
  const [predictedPump, setPredictedPump] = useState<number | null>(null);
  const [poolID, setPoolID] = useState<string>()
  
  const [frequency, setFrequency] = useState<{
    tweetFrequencyTrend: Impression[];
    tweetsWithAddressFrequency: Impression[];
  }>({
    tweetFrequencyTrend: [],
    tweetsWithAddressFrequency: [],
  });

  const [tweets, setTweets] = useState<{
    tweetPerMinut: Impression[];
    tweetPerFVmints: Impression[];
    tweetsWithAddressCount: Impression[];
  }>({
    tweetPerMinut: [],
    tweetPerFVmints: [],
    tweetsWithAddressCount: [],
  });

  const [values, setValues] = useState<{
    totalTweets: string;
    averagePercentage: number;
    averagePercentageFv: number;
  }>({
    totalTweets: '',
    averagePercentage: 0,
    averagePercentageFv: 0,
  });

  const [sei, setSEI] = useState<{
    SEI_value: Impression[];
    SEI_Velocity: Impression[];
  }>({
    SEI_value: [],
    SEI_Velocity: [],
  });

  const [fomo, setFomo] = useState<{
    tweetFomo: Impression[];
    macd: MACDPoint[];
    RSIx: Impression[];
  }>({
    tweetFomo: [],
    macd: [],
    RSIx: [],
  });

  const [tweetImpression, setTweetImpression] = useState<{
    weighBasedImpression: Impression[];
    sentimentTrend: TimeSeriess[];
    EWMA_Value: Impression[];
  }>({
    weighBasedImpression: [],
    sentimentTrend: [],
    EWMA_Value: [],
  });

  const [views, setViews] = useState<{
    tweetViewsPerFVmints: CompImpression[];
    tweetsWithAddressViews: CompImpression[];
    tweetViewsRatioPercentage: Impression[];
  }>({
    tweetViewsPerFVmints: [],
    tweetsWithAddressViews: [],
    tweetViewsRatioPercentage: [],
  });

  const [viewsAlt, setViewsAlt] = useState<{
    avgViewsPerTweet: number;
    tweetwithAddAvgViews: number;
  }>({
    avgViewsPerTweet: 0,
    tweetwithAddAvgViews: 0,
  });

  const [hypeMeter, setHypeMeter] = useState<{
    sentiMeter: number;
    sentiMeterAddr: number;
  }>({
    sentiMeter: 0,
    sentiMeterAddr: 0,
  });



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
  

    const fetchRaydiumData = async () => {
      const response = await fetch('/api/raydium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });
    
      const result = await response.json();
    
      // Retrieve poolId
      const poolId = result.poolId;
      console.log("Pool ID:", poolId);
      setPoolID(poolId)
      // Retrieve and map OHLCV data
      const ohlcvList = result.ohlcv?.data?.attributes?.ohlcv_list || [];
    
      const mappedData: RawTradeData[] = ohlcvList.map((entry: number[]) => ({
        time: entry[0],
        open: entry[1],
        high: entry[2],
        low: entry[3],
        close: entry[4],
        volume: entry[5],
      }));
    
      setChartData((prevData) => {
        if (JSON.stringify(prevData) !== JSON.stringify(mappedData)) {
          return mappedData;
        }
        return prevData;
      });
    
      // You can store poolId in state or use it elsewhere as needed
      // setPoolId(poolId); // if you have a state for poolId
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
      const ohlcvList = result.data?.attributes?.ohlcv_list || [];
      const mappedData: RawTradeData[] = ohlcvList.map((entry: number[]) => ({
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
  function appendUnique<T>(prev: T[], next: T[], uniqueKey: keyof T): T[] {
    const existingKeys = new Set(prev.map(item => item[uniqueKey]));
    const filtered = next.filter(item => !existingKeys.has(item[uniqueKey]));
    return [...prev, ...filtered];
  }
  function appendUniqueByTime(
    prev: { em_time: number; emoji: string }[],
    next: { em_time: number; emoji: string }[]
  ): { em_time: number; emoji: string }[] {
    const existingTimes = new Set(prev.map(item => item.em_time));
    const newItems = next.filter(item => !existingTimes.has(item.em_time));
    return [...prev, ...newItems];
  }
  function appendUniqueAndSortByTime(
    prev: { em_time: number; emoji: string }[],
    next: { em_time: number; emoji: string }[]
  ): { em_time: number; emoji: string }[] {
    const combined = appendUniqueByTime(prev, next);
    return combined.sort((a, b) => a.em_time - b.em_time);
  }
  useEffect(() => {
    if (!address || !poolID) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/sentiment?address=${address}&symbol=${allMetadata?.symbol}&page=1&limit=20`);
        const data = await res.json();
    
        if (!res.ok) throw new Error(data.error || 'Failed to fetch');
        /*
        setUTweets(data.tweetDetail.extractedTweets)
        setLikes(data.tweetDetail.extractedLikes)
        setUsernames(data.tweetDetail.extractedUsernames)
        setViewCount(data.tweetDetail.extractedView)
        setTime(data.tweetDetail.extractedTimes)
        setProfile(data.tweetDetail.extractedProfile)*/
        setUTweets(prevTweets => {
          const existing = new Set(prevTweets);
          const newUnique = data.tweetDetail.extractedTweets.filter((t:any) => !existing.has(t));
          return [...prevTweets, ...newUnique];
        });
        
        setLikes(prevLikes => {
          const existing = new Set(prevLikes);
          const newUnique = data.tweetDetail.extractedLikes.filter((l:any) => !existing.has(l));
          return [...prevLikes, ...newUnique];
        });
        
        setUsernames(prev => {
          const existing = new Set(prev);
          const newUnique = data.tweetDetail.extractedUsernames.filter((u:any) => !existing.has(u));
          return [...prev, ...newUnique];
        });
        
        setViewCount(prev => {
          const existing = new Set(prev);
          const newUnique = data.tweetDetail.extractedView.filter((v:any) => !existing.has(v));
          return [...prev, ...newUnique];
        });
        
        setTime(prev => {
          const existing = new Set(prev);
          const newUnique = data.tweetDetail.extractedTimes.filter((t:any) => !existing.has(t));
          return [...prev, ...newUnique];
        });
        
        setProfile(prev => {
          const existing = new Set(prev);
          const newUnique = data.tweetDetail.extractedProfile.filter((p:any) => !existing.has(p));
          return [...prev, ...newUnique];
        });
        const { tweetFrequencyTrend, tweetsWithAddressFrequency } = data.frequency;

        const {tweetsPerMinuteArray,tweetPerFVmints,tweetsWithAddressCount,totalTweets,averagePercentageFv,averagePercentage} = data.tweetperMinutes;
       /*
        setFrequency({
          tweetFrequencyTrend: tweetFrequencyTrend.map((d: any) => ({
            name: d.name,
            value: d.value,
          })),
          tweetsWithAddressFrequency: tweetsWithAddressFrequency.map((d: any) => ({
            name: d.name,
            value: d.value,
          })),
        });

        setTweets({
          tweetPerMinut:tweetsPerMinuteArray,
          tweetPerFVmints,
          tweetsWithAddressCount
        });
         
        setValues({
          totalTweets,
          averagePercentage,
          averagePercentageFv,
        });*/
        setFrequency(prev => ({
          tweetFrequencyTrend: appendUnique(prev.tweetFrequencyTrend, tweetFrequencyTrend, 'name'),
          tweetsWithAddressFrequency: appendUnique(prev.tweetsWithAddressFrequency, tweetsWithAddressFrequency, 'name'),
        }));
        setTweets(prev => ({
          tweetPerMinut: appendUnique(prev.tweetPerMinut, tweetsPerMinuteArray, 'name'),
          tweetPerFVmints: appendUnique(prev.tweetPerFVmints, tweetPerFVmints, 'name'),
          tweetsWithAddressCount:appendUnique(prev.tweetsWithAddressCount, tweetsWithAddressCount, 'name'),
        }));
        setValues({
          totalTweets,
          averagePercentage,
          averagePercentageFv,
        });
        
       const {SEI_value,SEI_Velocity,SEI_EMA} = data.SEI;
/*
        setSEI({
          SEI_value: SEI_value.map((d: any) => ({
            name: d.name,
            value: d.value,
          })),
          SEI_Velocity: SEI_Velocity.map((d: any) => ({
            name: d.name,
            value: d.value,
          })),
        });
        //console.log("data.Fomo",data.SEI)
        const {tweetFomo,compositFomo,macd,RSI} = data.Fomo;
        
        setFomo({
          tweetFomo,
          macd,
          RSIx: RSI,
        });
        */
        setSEI(prev => ({
          SEI_value: appendUnique(prev.SEI_value, SEI_value, 'name'),
          SEI_Velocity: appendUnique(prev.SEI_Velocity, SEI_Velocity, 'name'),
        }));
        const {tweetFomo,compositFomo,macd,RSI} = data.Fomo;
        setFomo(prev => ({
          tweetFomo: appendUnique(prev.tweetFomo, tweetFomo, 'name'),
          macd: appendUnique(prev.macd, macd, 'name'),
          RSIx: appendUnique(prev.RSIx, RSI, 'name'),
        }));
       const {weighBasedImpression,sentimentTrend,EWMA_Value} =data.impression
        //setTweetImpression({weighBasedImpression,sentimentTrend,EWMA_Value})
        setTweetImpression(prev=>({
          weighBasedImpression: appendUnique(prev.weighBasedImpression, weighBasedImpression, 'name'),
          sentimentTrend: appendUnique(prev.sentimentTrend, sentimentTrend, 'time'),
          EWMA_Value: appendUnique(prev.EWMA_Value, EWMA_Value, 'name'),
        }))
       const {tweetViewsPerFVmints,tweetsWithAddressViews,tweetViewsRatioPercentage,avgViewsPerTweet,tweetwithAddAvgViews} =data.views
        //console.log("data.impression",data.impression)
        setViews(prev=>({
          tweetViewsPerFVmints: appendUnique(prev.tweetViewsPerFVmints, tweetViewsPerFVmints, 'name'),
          tweetsWithAddressViews: appendUnique(prev.tweetsWithAddressViews, tweetsWithAddressViews, 'name'),
          tweetViewsRatioPercentage: appendUnique(prev.tweetViewsRatioPercentage, tweetViewsRatioPercentage, 'name'),
        }))

        setViewsAlt({
          avgViewsPerTweet,
          tweetwithAddAvgViews
        })
        const {sentiMeter,sentiMeterAddr}= data.hype
        setHypeMeter({
          sentiMeter,
          sentiMeterAddr,
        })
        setEmojiRawData(prev => {
          //const newDataString = JSON.stringify(data.emojiArray);
          //const prevDataString = JSON.stringify(prevData);
          
          //return newDataString !== prevDataString ? data.emojiArray : prevData;
          const uniqueData = appendUniqueAndSortByTime(prev, data.emojiArray); // or another unique field
          return uniqueData//.length !== prev.length ? uniqueData : prev;
      });
      } catch (err) {
        console.error('Error fetching aggregated holders:', err);
      }
    };
  
  fetchData();
    const fetchHolersData = async () => {
      try {
        const res = await fetch(`/api/holders-aggregated?address=${address}&page=1&limit=50`);
        const data = await res.json();
    
        if (!res.ok) throw new Error(data.error || 'Failed to fetch');
    
        setHoldersRawData((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data.holders)) {
            return data.holders;
          }
          return prev;
        });
      } catch (err) {
        console.error('Error fetching aggregated holders:', err);
      }
    };
    
     fetchHolersData()
     const fetchHoldersPlot = async () => {
      try {
        const res = await fetch(`/api/holder-snapshots?address=${address}&page=1&limit=50`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to fetch');
        
        // Only update state if the new data differs from the current state
        setHoldersData((prev) => {
          //if (JSON.stringify(prev) !== JSON.stringify(data.snapshot)) {
           // return data.snapshot;
          //}
          //return prev;
          const existingTimes = new Set(prev.map((d) => d.time));
    
          // Filter out duplicates based on time
          const newUniqueData = data.snapshot.filter((d:any) => !existingTimes.has(d.time));
    
          // Append new unique data to the end
          return [...prev, ...newUniqueData];
        });
        
        return data.snapshot;
      } catch (error) {
        console.error('Error fetching holders data:', error);
        return [];
      }
    };
    fetchHoldersPlot()
    
    const fetchHolderHistory = async () => {
      try {
        const res = await fetch(`/api/holders-history?address=${address}&page=1&limit=50`);
        const data = await res.json();
    
        if (!res.ok) throw new Error(data.error || 'Failed to fetch');
    
        setHolderHistoryData((prev) => {
          const existingTimes = new Set(prev.map((d) => d.time));
    
          // Filter out duplicates based on time
          const newUniqueData = data.history.filter((d:any) => !existingTimes.has(d.time));
    
          // Append new unique data to the end
          return [...prev, ...newUniqueData];
        });
    
        return data.history;
      } catch (error) {
        console.error('Error fetching holder history data:', error);
        return [];
      }
    };
    
    
    
    fetchHolderHistory()
    const fetchSRS = async () => {
      try {
        const res = await fetch(`/api/holder-srs?address=${address}&lps=${poolID}&page=1&limit=50`);
        const data = await res.json();
    
        if (!res.ok) throw new Error(data.error || 'Unknown error');
        //console.log('SRS:', data);
    
        // Replace full distribution and SRS plot data
        setPlotDistribution((prev) => ({
          whales: { ...prev?.whales, ...data.procssholding.whales },
          retail: { ...prev?.retail, ...data.procssholding.retail },
          lps: { ...prev?.lps, ...data.procssholding.lps },
        }));
    
        setPlotData((prev) => {
          const existingTimestamps = new Set(prev.map(p => p.time));
          const newPoints = data.srs.filter((point: any) => !existingTimestamps.has(point.timestamp));
          return [...prev, ...newPoints];
        });
    
        // Append and override entries in each category
        setPlotHoldingCount((prev) => {
          const safePrev: CategoryHoldings = {
            whales: prev?.whales || {},
            retail: prev?.retail || {},
            lps: prev?.lps || {},
          };
    
          return {
            whales: { ...safePrev.whales, ...data.procssholdingcount.whales },
            retail: { ...safePrev.retail, ...data.procssholdingcount.retail },
            lps: { ...safePrev.lps, ...data.procssholdingcount.lps },
          };
        });
      } catch (err) {
        console.error('Error fetching SRS:', err);
      }
    };
    
    fetchSRS();
    
    
    const interval = setInterval(() => {
      fetchData();fetchHolersData();fetchHoldersPlot();fetchHolderHistory();fetchSRS()
    }, 60000); // Fetch every 60 seconds

    return () => clearInterval(interval);
  }, [address,allMetadata,poolID]);

const fetchHolderMain = async (page:number,funtype:string) : Promise<ZoomReport> => {
  console.log("fetchHolderMain",page,funtype)
  switch (funtype) {
    case "hldnum":
      return await fetchHolderPlot_(page) 
    case "hldds":
      return await fetchHolderHistory_(page)
    case "ct":
      return await fetchOlderHoldingCount(page)
    case "ds":
      return await fetchOlderPlotDS(page)
    case "srs":
      console.log('srs')
      return await fetchOlderPlotData(page)
    default:
      return { totalpage: 0, currentpage: 0 };
      
  }
}
const fetchHolderPlot_ = async (page:number) => {
  try {
    const res = await fetch(`/api/holder-snapshots?address=${address}&page=${page}&limit=50`);
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error || 'Failed to fetch');
    
    // Only update state if the new data differs from the current state
    setHoldersData((prev) => {
      //if (JSON.stringify(prev) !== JSON.stringify(data.snapshot)) {
        // return data.snapshot;
      //}
      //return prev;
      const existingTimes = new Set(prev.map((d) => d.time));

      // Filter out duplicates based on time
      const newUniqueData = data.snapshot.filter((d:any) => !existingTimes.has(d.time));

      // Append new unique data to the end
      return [...prev, ...newUniqueData];
    });

    return {
      totalpage: data.totalPages,
      currentpage: data.page,
    };
  } catch (error) {
    console.error('Error fetching holder history data:', error);
    return { totalpage: 0, currentpage: 0 };
  }
};
const fetchHolderHistory_ = async (page:number) => {
  try {
    const res = await fetch(`/api/holders-history?address=${address}&page=${page}&limit=50`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to fetch');

    setHolderHistoryData((prev) => {
      const existingTimes = new Set(prev.map((d) => d.time));

      // Filter out duplicates based on time
      const newUniqueData = data.history.filter((d:any) => !existingTimes.has(d.time));

      // Append new unique data to the end
      return [...prev, ...newUniqueData];
    });

    return {
      totalpage: data.totalPages,
      currentpage: data.page,
    };
  } catch (error) {
    console.error('Error fetching holder history data:', error);
    return { totalpage: 0, currentpage: 0 };
  }
};

const fetchOlderPlotData = async (
  page: number
): Promise<ZoomReport> => {
  if (!address || !poolID) {
    console.warn('Missing address or poolID for fetching older holding count.');
    return { totalpage: 0, currentpage: 0 }; // ✅ fallback ZoomReport
  }

  try {
    const res = await fetch(
      `/api/holder-srs?address=${address}&lps=${poolID}&page=${page}&limit=50`
    );
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Unknown error');

    setPlotData((prev) => {
      const existingTimestamps = new Set(prev.map(p => p.time));
      const newPoints = data.srs.filter((point: any) => !existingTimestamps.has(point.timestamp));
      return [...prev, ...newPoints];
    });
    return {
      totalpage: data.totalPages,
      currentpage: data.page,
    };
 } catch (err) {
    console.error('Error fetching older data:', err);
    return { totalpage: 0, currentpage: 0 }; // ✅ fallback value
  }
};
const fetchOlderPlotDS = async (
  page: number
): Promise<ZoomReport> => {
  if (!address || !poolID) {
    console.warn('Missing address or poolID for fetching older holding count.');
    return { totalpage: 0, currentpage: 0 }; // ✅ fallback ZoomReport
  }

  try {
    const res = await fetch(
      `/api/holder-srs?address=${address}&lps=${poolID}&page=${page}&limit=50`
    );
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Unknown error');

    setPlotDistribution((prev) => ({
      whales: { ...prev?.whales, ...data.procssholding.whales },
      retail: { ...prev?.retail, ...data.procssholding.retail },
      lps: { ...prev?.lps, ...data.procssholding.lps },
    }));
    return {
      totalpage: data.totalPages,
      currentpage: data.page,
    };
 } catch (err) {
    console.error('Error fetching older data:', err);
    return { totalpage: 0, currentpage: 0 }; // ✅ fallback value
  }
};

const fetchOlderHoldingCount = async (
  page: number
): Promise<ZoomReport> => {
  if (!address || !poolID) {
    console.warn('Missing address or poolID for fetching older holding count.');
    return { totalpage: 0, currentpage: 0 }; // ✅ fallback ZoomReport
  }

  try {
    const res = await fetch(
      `/api/holder-srs?address=${address}&lps=${poolID}&page=${page}&limit=50`
    );
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Unknown error');

    setPlotHoldingCount((prev) => {
      const safePrev: CategoryHoldings = {
        whales: prev?.whales || {},
        retail: prev?.retail || {},
        lps: prev?.lps || {},
      };

      return {
        whales: { ...safePrev.whales, ...data.procssholdingcount.whales },
        retail: { ...safePrev.retail, ...data.procssholdingcount.retail },
        lps: { ...safePrev.lps, ...data.procssholdingcount.lps },
      };
    });

    return {
      totalpage: data.totalPages,
      currentpage: data.page,
    };
  } catch (err) {
    console.error('Error fetching older data:', err);
    return { totalpage: 0, currentpage: 0 }; // ✅ fallback value
  }
};

const fetchSentimentData = async (page:number,funtype:string) : Promise<ZoomReport> => {
  console.log("Requesting",page,funtype)
  const res = await fetch(`/api/sentiment?address=${address}&symbol=${allMetadata?.symbol}&page=${page}&limit=20`);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to fetch');

  
  const {sentiMeter,sentiMeterAddr}= data.hype
  setHypeMeter({
    sentiMeter,
    sentiMeterAddr,
  })
  setEmojiRawData(prev => {

    const uniqueData = appendUniqueAndSortByTime(prev, data.emojiArray); // or another unique field
    return uniqueData//.length !== prev.length ? uniqueData : prev;
  });
  
  switch (funtype) {
    case "twtft":
      const { tweetFrequencyTrend, tweetsWithAddressFrequency } = data.frequency;
      setFrequency(prev => ({
        tweetFrequencyTrend: appendUnique(prev.tweetFrequencyTrend, tweetFrequencyTrend, 'name'),
        tweetsWithAddressFrequency: appendUnique(prev.tweetsWithAddressFrequency, tweetsWithAddressFrequency, 'name'),
      }));
      console.log("twtft",frequency)
      return  {
        totalpage: data.meta.totalPages,
        currentpage: data.meta.currentPage,
      };
    case "twt":
      const {tweetsPerMinuteArray,tweetPerFVmints,tweetsWithAddressCount,totalTweets,averagePercentageFv,averagePercentage} = data.tweetperMinutes;
      setTweets(prev => ({
        tweetPerMinut: appendUnique(prev.tweetPerMinut, tweetsPerMinuteArray, 'name'),
        tweetPerFVmints: appendUnique(prev.tweetPerFVmints, tweetPerFVmints, 'name'),
        tweetsWithAddressCount:appendUnique(prev.tweetsWithAddressCount, tweetsWithAddressCount, 'name'),
      }));
      setValues({
        totalTweets,
        averagePercentage,
        averagePercentageFv,
      });
      return  {
        totalpage: data.meta.totalPages,
        currentpage: data.meta.currentPage,
      };
    case "vlcrt":
      const {SEI_value,SEI_Velocity,SEI_EMA} = data.SEI;

      setSEI(prev => ({
       SEI_value: appendUnique(prev.SEI_value, SEI_value, 'name'),
       SEI_Velocity: appendUnique(prev.SEI_Velocity, SEI_Velocity, 'name'),
     }));
     return  {
      totalpage: data.meta.totalPages,
      currentpage: data.meta.currentPage,
    };
    case "fmgwt":
      const {tweetFomo,compositFomo,macd,RSI} = data.Fomo;
      setFomo(prev => ({
        tweetFomo: appendUnique(prev.tweetFomo, tweetFomo, 'name'),
        macd: appendUnique(prev.macd, macd, 'name'),
        RSIx: appendUnique(prev.RSIx, RSI, 'name'),
      }));
      return  {
        totalpage: data.meta.totalPages,
        currentpage: data.meta.currentPage,
      };
    case "impgrw":
      const {weighBasedImpression,sentimentTrend,EWMA_Value} =data.impression
      setTweetImpression(prev=>({
        weighBasedImpression: appendUnique(prev.weighBasedImpression, weighBasedImpression, 'name'),
        sentimentTrend: appendUnique(prev.sentimentTrend, sentimentTrend, 'time'),
        EWMA_Value: appendUnique(prev.EWMA_Value, EWMA_Value, 'name'),
      }))
      return  {
        totalpage: data.meta.totalPages,
        currentpage: data.meta.currentPage,
      };
    case "avtwavvw":
      const {tweetViewsPerFVmints,tweetsWithAddressViews,tweetViewsRatioPercentage,avgViewsPerTweet,tweetwithAddAvgViews} =data.views
      //console.log("data.impression",data.impression)
      setViews(prev=>({
        tweetViewsPerFVmints: appendUnique(prev.tweetViewsPerFVmints, tweetViewsPerFVmints, 'name'),
        tweetsWithAddressViews: appendUnique(prev.tweetsWithAddressViews, tweetsWithAddressViews, 'name'),
        tweetViewsRatioPercentage: appendUnique(prev.tweetViewsRatioPercentage, tweetViewsRatioPercentage, 'name'),
      }))

      setViewsAlt({
        avgViewsPerTweet,
        tweetwithAddAvgViews
      })
      return  {
        totalpage: data.meta.totalPages,
        currentpage: data.meta.currentPage,
      };
    default:
      return { totalpage: 0, currentpage: 0 };
      
  }
  
}

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
            <TopTweets username={usernames} tweets_={utweets} likes={likes} viewscount={viewscount} timestamp={time} profile={profile} />
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
              holderhistroy={holderHistoryData}
              plotdata={plotData}
              price_plot={totalchartData}
              plotDistribution={plotDistribution!}
              plotHoldingCount = {plotHoldigCount!}
              fetchOlderHoldingCount={fetchHolderMain!}
            />
          </div>  
          {/* Right Section (Sidebar) { address, name, twitter, Frequency, Tweets,Values,SEI,FOMO,TweetImpression,Views,ViewsAlt,HypeMeter,holders,live_prx} */}
          <aside className="w-full lg:w-1/2 p-4 border-l border-gray-700 overflow-auto">
          <MetricsGrid address={address} name={metadata_?.image} twitter={metadata_?.twitter} Frequency={frequency} Tweets={tweets} Values={values} SEI={sei} FOMO={fomo} TweetImpression={tweetImpression} Views={views} ViewsAlt={viewsAlt} HypeMeter={hypeMeter} holders={holderRawData} live_prx={livePrice} fetchOlderHoldingCount={fetchSentimentData}/>
          </aside>
          </div>
        </main>
      </div>
    
  );
}
