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
//import AdvChart from '@/components/AdvChart';
interface Impression {
  name: string;
  value: number;
}
const ALPHA = 0.01; // baseline pump magnitude (e.g., 1%)
const BETA = 0.05;  // sensitivity coefficient
export default function Home() {
  const { address }: { address: string } = useParams();
  const { metadata } = useMetadata();
  const [manualMetadata, setManualMetadata] = useState<{ name: string; symbol: string; uri: string }>();
  const [allMetadata, setAllMetadata] = useState<{ name: string; symbol: string; description: string; image: string; showName: boolean; createdOn: string; twitter: string; telegram: string; website: string }>();
  //console.log("metadata", metadata, metadata?.twitter)
  const [impressionsData, setImpressionsData] = useState<Impression[]>([]);
  const [engaments, setEngamentData] = useState<Impression[]>([]);
  const [tweetPerMinute, setTweetsPerMinuteData] = useState<Impression[]>([]);
  const [tweetViewsPerMinute, setTweetsViewsPerMinuteData] = useState<Impression[]>([]);
  const [emojiRawData, setEmojiRawData] = useState<{ em_time: number, emoji: string }[]>([]);
  const [holderRawData, setHoldersRawData] = useState<{ amount: number, time: number }[]>([]);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [tweets, setTweets] = useState<string[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [viewscount, setViewCount] = useState<string[]>([]);
  const [time, setTime] = useState<string[]>([]);
  const [profile, setProfile] = useState<string[]>([]);

  const [chartData, setChartData] = useState<RawTradeData[]>([]);
  const [totalchartData, setTotalChartData] = useState<RawTradeData[]>([]);
  const [sentimentTimeSeries, setSentimentTimeSeries] = useState<{ time: string; aggregatedSentiment: number }[]>([]);
  // Overall aggregated sentiment and pump prediction across all tweets (optional)
  const [aggregatedSentiment, setAggregatedSentiment] = useState<number | null>(null);
  const [predictedPump, setPredictedPump] = useState<number | null>(null);
  const sentimentAnalyzer = new Sentiment();
  const options = {
    extras: {
      // Single words & tokens for phrases
      'bundles': -5,
      'control': -5,
      'manipulate': -3,
      'market': -2,
      'doesn\'t_look': -2,
      'SCAM': -5,
      'scam': -5,
      'dump': -3,
      'rug': -5,
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
      'not_safe': -3,
      'poor_quality': -4,
      'high_risk': -5,
      'low_confidence': -3,
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
          result.score = -5;
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
      const result = sentimentAnalyzer.analyze(processedText, options);
  
      // Custom rule for "Rug probability:"
      const rugMatch = processedText.match(/Rug probability:\s*(\d+)%/i);
      if (rugMatch) {
        const prob = parseFloat(rugMatch[1]);
        if (prob > 40) {
          result.score = -5;
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
      sentimentByTime[timeKey].totalSentiment += result.score * weight;
      sentimentByTime[timeKey].weight += weight;
    });
    const timeSeries = Object.entries(sentimentByTime).map(([time, obj]) => ({
      time,
      aggregatedSentiment: obj.weight > 0 ? obj.totalSentiment / obj.weight : 0,
    }));
    // Sort time series by time
    timeSeries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    console.log("timeSeries", timeSeries);
    setSentimentTimeSeries(timeSeries);
  };
  

  useEffect(() => {

    const fetchMetadata = async () => {
      //const fetchedMetadata: { name: string; symbol: string; uri: string }[] = [];
      if (!metadata) {
        // console.log("addresses", addresses, "address", address.address)
        try {
          const response = await fetch(`http://${window.location.hostname}:3300/api/token-metadata?mint=${address}`);
          const data = await response.json();
          //fetchedMetadata.push(data);
          setManualMetadata(data)
          console.log("manualMetadata", data)
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
        console.log('Metadata URI is missing');
        return;
      }
      console.log("manualMetadata===", manualMetadata?.uri)
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
    /*const interval = setInterval(() => {
     // fetchData();
      fetchRaydiumData();
    }, 600000); // Fetch every 60 seconds

    return () => clearInterval(interval);*/ // Clean up interval on component unmount
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
    }
    return parseFloat(views); // For plain numbers
  };
  useEffect(() => {
    const fetchData = async () => {


      const response = await fetch(`http://${window.location.hostname}:3300/fetch-data?search=${address}`)//fetch(`http://localhost:3300/spltoken/${address}.json`); 4x77NhFuVzWWDGEMUyB17e3nhvVdkV7HT2AZNmz6pump// Load the JSON data
      const jsonData = await response.json();

      // Process data to calculate total views for each unique time
      const viewCounts: { [key: string]: number } = {};
      const engagementCounts: { [key: string]: number } = {};
      const tweetCounts: { [key: string]: number } = {};
      const tweetViews: { [key: string]: number } = {};
      const emojiData: { [key: number]: string } = {};
      const extractedUsernames: string[] = [];
      const extractedTweets: string[] = [];
      const extractedView: string[] = [];
      const extractedLikes: string[] = [];
      const extractedTimes: string[] = [];
      const extractedProfile: string[] = [];
      jsonData.forEach((entry: any) => {
        const times = entry.params.time;
        const views = entry.params.views;
        const likes = entry.params.likes
        const comments = entry.params.comment
        const retweets = entry.params.retweet
        const timestamp = entry.post_time
        const eng_time = entry.params.plot_time
        const statusUrl = entry.status;
        const profileImag = entry.profile_image
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
        //console.log("Time Stamp",timestamp)
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
        times.forEach((time: number, index: number) => {
          const view = isNaN(parseViewsCount(views[index])) ? 0 : parseViewsCount(views[index]);
          const plot_mint = new Date(eng_time[index]).toISOString().slice(0, 16);
          const like = isNaN(parseViewsCount(likes[index])) ? 0 : parseViewsCount(likes[index]);
          const comment = isNaN(parseViewsCount(comments[index])) ? 0 : parseViewsCount(comments[index]);
          const retweet = isNaN(parseViewsCount(retweets[index])) ? 0 : parseViewsCount(retweets[index]);
          const timeKey = `${time} min`;

          if (viewCounts[plot_mint]) {
            viewCounts[plot_mint] += view;
          } else {
            viewCounts[plot_mint] = view;
          }
          if (engagementCounts[plot_mint]) {
            engagementCounts[plot_mint] += (like + comment + retweet);
          } else {
            engagementCounts[plot_mint] = (like + comment + retweet);
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
        if (tweetViews[minuteKey]) {
          
          tweetViews[minuteKey] += view; // Increment the count for tweets in this minute
        } else {
          tweetViews[minuteKey] = view; // Initialize with 1 tweet for this minute
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

      // Convert the viewCounts object into an array
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
      const tweetsPerViewsMinuteArray = Object.entries(tweetViews).map(([name, value]) => ({
        name,
        value
      })).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
      //console.log("emojiArray", emojiArray)
      //setEmojiRawData(emojiArray)
      setEmojiRawData(prevData => {
      const newDataString = JSON.stringify(emojiArray);
      const prevDataString = JSON.stringify(prevData);
      
      return newDataString !== prevDataString ? emojiArray : prevData;
    });
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
    fetchData();
    const fetchHolersData = async () => {
      const response = await fetch(`http://${window.location.hostname}:3300/fetch-holders?search=${address}`)//fetch(`http://localhost:3300/spltoken/${address}.json`); 4x77NhFuVzWWDGEMUyB17e3nhvVdkV7HT2AZNmz6pump// Load the JSON data
      const jsonData = await response.json();
      const holderData: { [key: number]: number } = {};
      jsonData.forEach((entry: any) => {
        const timestamp = entry.time;
        const amount = parseFloat(entry.amount);
        const holderTimeStamp = new Date(timestamp).setSeconds(0, 0);
        if (holderData[holderTimeStamp]) {
          holderData[holderTimeStamp]+=amount
        } else {
          holderData[holderTimeStamp]=amount
        }
      })
      const holdersArray = Object.entries(holderData).map(([time, amount]) => ({
        time: parseInt(time, 10),
        amount
      })).sort((a, b) => a.time - b.time);
      setHoldersRawData((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(holdersArray)) {
          return holdersArray;
        }
        return prev;
      });
     // console.log("Holders Data",holderData)
    }
      fetchHolersData()
    const interval = setInterval(() => {
      fetchData();fetchHolersData()
    }, 60000); // Fetch every 60 seconds

    return () => clearInterval(interval);
  }, [address]);

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
      <main className="flex-grow p-4 flex flex-col lg:flex-row">
        {/* Left Section */}
        <section className="w-full lg:w-2/3 flex flex-col">
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
                console.log("Loadedd--xx--", window.TradingView.widget)
                setIsScriptWidgetReady(true);
              }}
            />
            {isScriptReady && isScriptWidgetReady && <TVChartContainer data={totalchartData} name={metadata_?.name} address={address} symbol={metadata_?.symbol} emojiData={emojiRawData} holders={holderRawData} />}
          </div>

          {/* <Chart name={metadata?.name} symbol={metadata?.symbol} />*/}
          {/* Use flex-grow to push TopTweets to the bottom */}
         
          <div className="flex-grow"></div>
          <TopTweets username={usernames} tweets_={tweets} likes={likes} viewscount={viewscount} timestamp={time} profile={profile} />
        </section>

        {/* Right Section (Sidebar) */}
        <aside className="w-full lg:w-1/3 p-4 border-l border-gray-700">
          <MetricsGrid address={address} name={metadata_?.image} twitter={metadata_?.twitter} tweetPerMinut={tweetPerMinute} impression={impressionsData} engagement={engaments} tweetViews={tweetViewsPerMinute} sentimentPlot={sentimentTimeSeries}/>
        </aside>
      </main>
    </div>
  );
}
