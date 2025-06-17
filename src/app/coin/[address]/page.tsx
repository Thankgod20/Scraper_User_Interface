// pages.tsx
"use client"
import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useMetadata } from '@/context/MetadataContext';
import Script from 'next/script';
import { CandlestickChart as CandlestickChartIcon, ListOrdered, MessagesSquare, LineChart as LineChartIcon,BarChartBig,Star } from 'lucide-react';
import Watchlist from '@/components/Watchlist'

// Components
import TVChartContainer from '@/components/AdvChart';
import MetricsGrid from '@/components/MetricsGrid';
import TopTweets from '@/components/TopTweets';
import OrderBookPanel from '@/components/OrderBookPanel';
import MobileNav from '@/components/MobileNav'; // Import MobileNav

// Types (assuming these are correctly defined elsewhere)
import { RawTradeData } from '@/app/types/TradingView';
import {  CategoryHoldings, MACDPoint, TimeSeriess, Impression, CompImpression } from '@/app/utils/app_types';
type ZoomReport = {
  totalpage: number;
  currentpage: number;
};
type BusinessDay = { year: number; month: number; day: number };

interface ChartData {
  timestamps: string[];
  prices: {
    timestamps: string[]; // OHLCV-native timestamps
    values: number[];
  };
  inflow: Record<string, number[]>;
  outflow: Record<string, number[]>;
  netflow: Record<string, number[]>;
  activeHolders: Record<string, number[]>;
}
// Constants for API calls


export default function Home() {
  const { address }: { address: string } = useParams();
  const { metadata } = useMetadata();
  const [manualMetadata, setManualMetadata] = useState<{ name: string; symbol: string; uri: string }>();
  const [allMetadata, setAllMetadata] = useState<{ name: string; symbol: string; description: string; image: string; showName: boolean; createdOn: string; twitter: string; telegram: string; website: string }>();
  
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
  const [plotNetFlow, setPlotNetFlow] = useState<ChartData>({
    timestamps: [], prices: { timestamps: [], values: [] },
    inflow: { whale: [], retail: [], shark: [] }, outflow: { whale: [], retail: [], shark: [] },
    netflow: { whale: [], retail: [], shark: [] }, activeHolders: { whale: [], retail: [], shark: [], total:[]},
  });
  const [plotDistribution, setPlotDistribution] = useState<CategoryHoldings>();
  const [plotHoldigCount, setPlotHoldingCount] = useState<CategoryHoldings>();
  const [chartData, setChartData] = useState<RawTradeData[]>([]);
  const [livePrice, setLivePrice] = useState<RawTradeData[]>([]);
  const [totalchartData, setTotalChartData] = useState<RawTradeData[]>([]);
  const [poolID, setPoolID] = useState<string>()

  // State for component data (simplified for brevity, keep your existing state structure)
  const [frequency, setFrequency] = useState<{ tweetFrequencyTrend: Impression[]; tweetsWithAddressFrequency: Impression[]; }>({ tweetFrequencyTrend: [], tweetsWithAddressFrequency: [] });
  const [tweets, setTweets] = useState<{ tweetPerMinut: Impression[]; tweetPerFVmints: Impression[]; tweetsWithAddressCount: Impression[]; }>({ tweetPerMinut: [], tweetPerFVmints: [], tweetsWithAddressCount: [] });
  const [values, setValues] = useState<{ totalTweets: string; averagePercentage: number; averagePercentageFv: number; }>({ totalTweets: '', averagePercentage: 0, averagePercentageFv: 0 });
  const [sei, setSEI] = useState<{ SEI_value: Impression[]; SEI_Velocity: Impression[]; }>({ SEI_value: [], SEI_Velocity: [] });
  const [fomo, setFomo] = useState<{ tweetFomo: Impression[]; macd: MACDPoint[]; RSIx: Impression[]; }>({ tweetFomo: [], macd: [], RSIx: [] });
  const [tweetImpression, setTweetImpression] = useState<{ weighBasedImpression: Impression[]; sentimentTrend: TimeSeriess[]; EWMA_Value: Impression[]; }>({ weighBasedImpression: [], sentimentTrend: [], EWMA_Value: [] });
  const [views, setViews] = useState<{ tweetViewsPerFVmints: CompImpression[]; tweetsWithAddressViews: CompImpression[]; tweetViewsRatioPercentage: Impression[]; }>({ tweetViewsPerFVmints: [], tweetsWithAddressViews: [], tweetViewsRatioPercentage: [] });
  const [viewsAlt, setViewsAlt] = useState<{ avgViewsPerTweet: number; tweetwithAddAvgViews: number; }>({ avgViewsPerTweet: 0, tweetwithAddAvgViews: 0 });
  const [hypeMeter, setHypeMeter] = useState<{ sentiMeter: number; sentiMeterAddr: number; }>({ sentiMeter: 0, sentiMeterAddr: 0 });

  const [isScriptReady, setIsScriptReady] = useState(false);
  const [isScriptWidgetReady, setIsScriptWidgetReady] = useState(false);
  
  // Mobile navigation state
  const [activeMobileView, setActiveMobileView] = useState('chart'); // Default view

  const metadata_ = metadata || allMetadata;

  const fetchHostnameFromConfig = async () => {
    try {
      const configResponse = await fetch('/config.json');
      if (!configResponse.ok) throw new Error('Failed to load config file');
      return (await configResponse.json()).hostname;
    } catch (error) {
      console.error('Error fetching hostname from config:', error);
      throw error;
    }
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
    const combined = appendUnique(prev, next, 'em_time'); // Use generic appendUnique
    return combined.sort((a, b) => a.em_time - b.em_time);
  }


  // ALL YOUR useEffect hooks for data fetching (fetchMetadata, fetchRaydiumData, etc.) remain here.
  // Keep them as they are, but ensure they handle errors gracefully and update loading states.
  // For brevity, I'm omitting the full fetch logic but ensure it's robust.

  useEffect(() => {
    const fetchInitialMetadata = async () => {
      if (!metadata) {
        try {
          const hostname = await fetchHostnameFromConfig();
          const response = await fetch(`http://${hostname}:3300/api/token-metadata?mint=${address}`);
          const data = await response.json();
          setManualMetadata(data);
        } catch (error) {
          console.error('Error fetching token metadata:', error);
        }
      }
    };
    fetchInitialMetadata();
  }, [metadata, address]);

  useEffect(() => {
    const fetchFullMetadata = async () => {
      if (!manualMetadata?.uri) return;
      try {
        const response = await fetch(manualMetadata.uri);
        const data = await response.json();
        setAllMetadata(data);
      } catch (error) {
        console.error('Error fetching full token metadata:', error);
      }
    };
    fetchFullMetadata();
  }, [manualMetadata]);

  useEffect(() => {
    const fetchRaydiumAndLiveData = async () => {
      try {
        // Fetch initial Raydium data (poolId and ohlcv)
        const raydiumResponse = await fetch('/api/raydium', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }),
        });
        const raydiumResult = await raydiumResponse.json();
        const poolId = raydiumResult.poolId;
        setPoolID(poolId);
        const ohlcvList = raydiumResult.ohlcv?.data?.attributes?.ohlcv_list || [];
        const initialMappedData: RawTradeData[] = ohlcvList.map((entry: number[]) => ({
          time: entry[0], open: entry[1], high: entry[2], low: entry[3], close: entry[4], volume: entry[5],
        }));
        setChartData(initialMappedData);

        // Fetch live data
        const fetchLive = async () => {
          const liveResponse = await fetch('/api/live', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }),
          });
          const liveResult = await liveResponse.json();
          const liveOhlcvList = liveResult.data?.attributes?.ohlcv_list || [];
          const liveMappedData: RawTradeData[] = liveOhlcvList.map((entry: number[]) => ({
            time: entry[0], open: entry[1], high: entry[2], low: entry[3], close: entry[4], volume: entry[5],
          }));
          setLivePrice(liveMappedData);
        };
        fetchLive(); // Initial fetch
        const liveInterval = setInterval(fetchLive, 60000); // Fetch every 60 seconds
        return () => clearInterval(liveInterval);
      } catch (error) {
        console.error("Error fetching Raydium/Live data:", error);
      }
    };
    if (address) fetchRaydiumAndLiveData();
  }, [address]);
  
  useEffect(() => {
    setTotalChartData((prevTotalChartData) => {
      const mergedData = [...prevTotalChartData, ...chartData];
      const uniqueData = mergedData.reduce((acc, item) => {
        if (!acc.some((d) => d.time === item.time)) acc.push(item);
        return acc;
      }, [] as RawTradeData[]);
      
      return uniqueData.sort((a, b) => {
        const getTimeValue = (time: string | BusinessDay | number): number => {
          if (typeof time === 'number') return time;
          if (typeof time === 'string') return new Date(time).getTime();
          
          // Type guard for BusinessDay
          if (typeof time === 'object' && time !== null && 'year' in time && 'month' in time && 'day' in time) {
            const businessDay = time as BusinessDay;
            return new Date(businessDay.year, businessDay.month - 1, businessDay.day).getTime();
          }
          
          throw new Error('Invalid time format');
        };
        
        return getTimeValue(a.time) - getTimeValue(b.time);
      });
    });
  }, [chartData]);

  const fetchDataAndSentiment = useCallback(async () => {
    if (!address || !poolID || !allMetadata?.symbol) return;
    try {
      const res = await fetch(`/api/sentiment?address=${address}&symbol=${allMetadata.symbol}&page=1&limit=20`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch sentiment data');

      // Update all states (abbreviated, use your existing logic with appendUnique)
      setUTweets(prevTweets => {
        const existing = new Set(prevTweets);
        const newUnique = data.tweetDetail.extractedTweets.filter((t:string) => !existing.has(t));
        return [...prevTweets, ...newUnique];
      });
      
      setLikes(prevLikes => {
        const existing = new Set(prevLikes);
        const newUnique = data.tweetDetail.extractedLikes.filter((l:string) => !existing.has(l));
        return [...prevLikes, ...newUnique];
      });
      
      setUsernames(prev => {
        const existing = new Set(prev);
        const newUnique = data.tweetDetail.extractedUsernames.filter((u:string) => !existing.has(u));
        return [...prev, ...newUnique];
      });
      
      setViewCount(prev => {
        const existing = new Set(prev);
        const newUnique = data.tweetDetail.extractedView.filter((v:string) => !existing.has(v));
        return [...prev, ...newUnique];
      });
      
      setTime(prev => {
        const existing = new Set(prev);
        const newUnique = data.tweetDetail.extractedTimes.filter((t:string) => !existing.has(t));
        return [...prev, ...newUnique];
      });
      
      setProfile(prev => {
        const existing = new Set(prev);
        const newUnique = data.tweetDetail.extractedProfile.filter((p:string) => !existing.has(p));
        return [...prev, ...newUnique];
      });

      setFrequency(prev => ({
        tweetFrequencyTrend: appendUnique(prev.tweetFrequencyTrend, data.frequency.tweetFrequencyTrend, 'name'),
        tweetsWithAddressFrequency: appendUnique(prev.tweetsWithAddressFrequency, data.frequency.tweetsWithAddressFrequency, 'name'),
      }));
      setTweets(prev => ({
        tweetPerMinut: appendUnique(prev.tweetPerMinut, data.tweetperMinutes.tweetsPerMinuteArray, 'name'),
        tweetPerFVmints: appendUnique(prev.tweetPerFVmints, data.tweetperMinutes.tweetPerFVmints, 'name'),
        tweetsWithAddressCount: appendUnique(prev.tweetsWithAddressCount, data.tweetperMinutes.tweetsWithAddressCount, 'name'),
      }));
      setValues(data.tweetperMinutes); // Assuming totalTweets, averagePercentage, averagePercentageFv are directly in tweetperMinutes

      setSEI(prev => ({
        SEI_value: appendUnique(prev.SEI_value, data.SEI.SEI_value, 'name'),
        SEI_Velocity: appendUnique(prev.SEI_Velocity, data.SEI.SEI_Velocity, 'name'),
      }));
      setFomo(prev => ({
        tweetFomo: appendUnique(prev.tweetFomo, data.Fomo.tweetFomo, 'name'),
        macd: appendUnique(prev.macd, data.Fomo.macd, 'name'),
        RSIx: appendUnique(prev.RSIx, data.Fomo.RSI, 'name'), // Assuming RSI key is 'RSI' in Fomo
      }));
      setTweetImpression(prev => ({
        weighBasedImpression: appendUnique(prev.weighBasedImpression, data.impression.weighBasedImpression, 'name'),
        sentimentTrend: appendUnique(prev.sentimentTrend, data.impression.sentimentTrend, 'time'),
        EWMA_Value: appendUnique(prev.EWMA_Value, data.impression.EWMA_Value, 'name'),
      }));
      setViews(prev => ({
        tweetViewsPerFVmints: appendUnique(prev.tweetViewsPerFVmints, data.views.tweetViewsPerFVmints, 'name'),
        tweetsWithAddressViews: appendUnique(prev.tweetsWithAddressViews, data.views.tweetsWithAddressViews, 'name'),
        tweetViewsRatioPercentage: appendUnique(prev.tweetViewsRatioPercentage, data.views.tweetViewsRatioPercentage, 'name'),
      }));
      setViewsAlt(data.views); // Assuming avgViewsPerTweet, tweetwithAddAvgViews are directly in views
      setHypeMeter(data.hype);
      setEmojiRawData(prev => appendUniqueByTime(prev, data.emojiArray));

    } catch (err) {
      console.error('Error fetching aggregated data:', err);
    }
  }, [address, poolID, allMetadata?.symbol]);

  const fetchHoldersDataAndSRS = useCallback(async () => {
    if (!address || !poolID) return;
    try {
      const hostname = await fetchHostnameFromConfig();
      // Fetch holders raw data
      const holdersRes = await fetch(`http://${hostname}:3300/api/holder-aggregated?address=${address}&page=1&limit=5000`);
      const holdersData = await holdersRes.json();
      if (!holdersRes.ok) throw new Error(holdersData.error || 'Failed to fetch holders');
      setHoldersRawData(prev => appendUnique(prev, holdersData.holders, 'time')); // Assuming 'time' or another key for uniqueness

      // Fetch holder snapshots
      const snapshotsRes = await fetch(`http://${hostname}:3300/api/holder_snapshots?address=${address}&page=1&limit=50`);
      const snapshotsData = await snapshotsRes.json();
      if (!snapshotsRes.ok) throw new Error(snapshotsData.error || 'Failed to fetch snapshots');
      //setHoldersData(prev => appendUnique(prev, snapshotsData.snapshot, 'time'));
      setHoldersData((prev) => {
        //if (JSON.stringify(prev) !== JSON.stringify(data.snapshot)) {
         // return data.snapshot;
        //}
        //return prev;
        const existingTimes = new Set(prev.map((d) => d.time));
  
        // Filter out duplicates based on time
        const newUniqueData = snapshotsData.snapshot.filter((d:{ holders: number; time: string }) => !existingTimes.has(d.time));
  
        // Append new unique data to the end
        return [...prev, ...newUniqueData];
      });
      // Fetch holder history
      const historyRes = await fetch(`http://${hostname}:3300/api/holder_history?address=${address}&page=1&limit=50`);
      const historyData = await historyRes.json();
      if (!historyRes.ok) throw new Error(historyData.error || 'Failed to fetch history');
      setHolderHistoryData(prev => appendUnique(prev, historyData.history, 'time'));

      // Fetch SRS data (which includes distribution and count)
      const srsRes = await fetch(`http://${hostname}:3300/api/holder_srs?address=${address}&lps=${poolID}&page=1&limit=50`);
      const srsData = await srsRes.json();
      if (!srsRes.ok) throw new Error(srsData.error || 'Unknown error in SRS');
      
      setPlotDistribution(prev => ({
        whales: { ...prev?.whales, ...srsData.procssholding.whales },
        retail: { ...prev?.retail, ...srsData.procssholding.retail },
        lps: { ...prev?.lps, ...srsData.procssholding.lps },
      }));
      setPlotHoldingCount(prev => ({
        whales: { ...prev?.whales, ...srsData.procssholdingcount.whales },
        retail: { ...prev?.retail, ...srsData.procssholdingcount.retail },
        lps: { ...prev?.lps, ...srsData.procssholdingcount.lps },
      }));
      

       // Fetch NetFlow data
      const netFlowRes = await fetch(`http://${hostname}:3300/api/flow-analytics?address=${address}&lps=${poolID}&page=1&limit=50`);
      const netFlowData = await netFlowRes.json();
      if (!netFlowRes.ok) throw new Error(netFlowData.error || 'Unknown error in NetFlow');

        const appendCorrespondingValues = (
            previousValues: number[] = [],
            allIncomingValues?: number[],
            incomingMasterTimestamps?: string[], // Must pass this now
            newMasterTimestampsWithOriginalIndices?: { timestamp: string; originalIndex: number }[] // Must pass this now
        ) => {
            if (!allIncomingValues || allIncomingValues.length === 0 || !incomingMasterTimestamps || !newMasterTimestampsWithOriginalIndices) {
            return previousValues;
            }
            if (allIncomingValues.length !== incomingMasterTimestamps.length) {
                console.warn("Mismatch in lengths for appendCorrespondingValues. Data might be inconsistent.");
            }
            const valuesToAdd = newMasterTimestampsWithOriginalIndices
            .filter(item => item.originalIndex < allIncomingValues.length) 
            .map(item => allIncomingValues[item.originalIndex]);
            return [...previousValues, ...valuesToAdd];
        };
        
        setPlotNetFlow(prev => {
            const newIncomingData = netFlowData;
        
            const prevMasterTimestampsSet = new Set(prev.timestamps);
            const incomingMasterTimestamps = newIncomingData.timestamps || [];
            const newMasterTimestampsWithOriginalIndices: { timestamp: string; originalIndex: number }[] = [];
            const combinedMasterTimestamps = [...prev.timestamps];
        
            incomingMasterTimestamps.forEach((ts: string, index: number) => {
            if (!prevMasterTimestampsSet.has(ts)) {
                newMasterTimestampsWithOriginalIndices.push({ timestamp: ts, originalIndex: index });
                combinedMasterTimestamps.push(ts);
                prevMasterTimestampsSet.add(ts);
            }
            });
        
            const prevPriceTimestampsSet = new Set(prev.prices.timestamps);
            const incomingPriceTimestamps = newIncomingData.prices?.timestamps || [];
            const incomingPriceValues = newIncomingData.prices?.values || [];
            const combinedPriceTimestamps = [...prev.prices.timestamps];
            const combinedPriceValues = [...prev.prices.values];
        
            if (incomingPriceTimestamps.length === incomingPriceValues.length) {
            incomingPriceTimestamps.forEach((ts: string, index: number) => {
                if (!prevPriceTimestampsSet.has(ts)) {
                combinedPriceTimestamps.push(ts);
                combinedPriceValues.push(incomingPriceValues[index]);
                prevPriceTimestampsSet.add(ts);
                }
            });
            } else if (incomingPriceTimestamps.length > 0 || incomingPriceValues.length > 0) {
            console.warn("Prices timestamps and values arrays have different lengths in new NetFlow data.");
            }
        
            return {
            ...prev,
            timestamps: combinedMasterTimestamps,
            netflow: {
                whale: appendCorrespondingValues(prev.netflow.whale, newIncomingData.netflow?.whale, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                retail: appendCorrespondingValues(prev.netflow.retail, newIncomingData.netflow?.retail, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                shark: appendCorrespondingValues(prev.netflow.shark, newIncomingData.netflow?.shark, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
            },
            inflow: {
                whale: appendCorrespondingValues(prev.inflow.whale, newIncomingData.inflow?.whale, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                retail: appendCorrespondingValues(prev.inflow.retail, newIncomingData.inflow?.retail, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                shark: appendCorrespondingValues(prev.inflow.shark, newIncomingData.inflow?.shark, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
            },
            outflow: {
                whale: appendCorrespondingValues(prev.outflow.whale, newIncomingData.outflow?.whale, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                retail: appendCorrespondingValues(prev.outflow.retail, newIncomingData.outflow?.retail, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                shark: appendCorrespondingValues(prev.outflow.shark, newIncomingData.outflow?.shark, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
            },
            activeHolders: {
                whale: appendCorrespondingValues(prev.activeHolders.whale, newIncomingData.activeHolders?.whale, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                retail: appendCorrespondingValues(prev.activeHolders.retail, newIncomingData.activeHolders?.retail, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                shark: appendCorrespondingValues(prev.activeHolders.shark, newIncomingData.activeHolders?.shark, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                total: appendCorrespondingValues(prev.activeHolders.total, newIncomingData.activeHolders?.total, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
            },
            prices: {
                timestamps: combinedPriceTimestamps,
                values: combinedPriceValues,
            },
            };
        });

    } catch (err) {
      console.error('Error fetching holder/SRS data:', err);
    }
  }, [address, poolID]);

  useEffect(() => {
    fetchDataAndSentiment();
    fetchHoldersDataAndSRS();
    const interval = setInterval(() => {
      fetchDataAndSentiment();
      fetchHoldersDataAndSRS();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchDataAndSentiment, fetchHoldersDataAndSRS]);


  // Pagination/Infinite scroll handlers for child components
  const fetchMoreDataForChild = useCallback(async (page: number, funtype: string): Promise<ZoomReport> => {
    console.log("Fetching more for:", funtype, "Page:", page);
    if (!address || !poolID) return { totalpage: 0, currentpage: 0 };
    const hostname = await fetchHostnameFromConfig();
    let url = '';
    
    // Determine API endpoint based on funtype
    if (['hldnum', 'hldds'].includes(funtype)) {
        url = `http://${hostname}:3300/api/holder_${funtype === 'hldnum' ? 'snapshots' : 'history'}?address=${address}&page=${page}&limit=50`;
    } else if (['ct', 'ds', 'srs', 'netflow'].includes(funtype)) {
        url = `http://${hostname}:3300/api/${funtype === 'netflow' ? 'flow-analytics' : 'holder_srs'}?address=${address}&lps=${poolID}&page=${page}&limit=50`;
    } else { // Sentiment related data
        url = `/api/sentiment?address=${address}&symbol=${allMetadata?.symbol}&page=${page}&limit=20`;
    }

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to fetch for ${funtype}`);

      // Update relevant state based on funtype
      if (funtype === 'hldnum') { //setHoldersData(prev => appendUnique(prev, data.snapshot, 'time'));
        setHoldersData((prev) => {
          //if (JSON.stringify(prev) !== JSON.stringify(data.snapshot)) {
           // return data.snapshot;
          //}
          //return prev;
          const existingTimes = new Set(prev.map((d) => d.time));
    
          // Filter out duplicates based on time
          const newUniqueData = data.snapshot.filter((d:{ holders: number; time: string }) => !existingTimes.has(d.time));
    
          // Append new unique data to the end
          return [...prev, ...newUniqueData];
        });
      }
      else if (funtype === 'hldds') setHolderHistoryData(prev => appendUnique(prev, data.history, 'time'));
      else if (funtype === 'ct') setPlotHoldingCount(prev => ({
          whales: { ...prev?.whales, ...data.procssholdingcount.whales },
          retail: { ...prev?.retail, ...data.procssholdingcount.retail },
          lps: { ...prev?.lps, ...data.procssholdingcount.lps },
        }));
      else if (funtype === 'ds') setPlotDistribution(prev => ({
          whales: { ...prev?.whales, ...data.procssholding.whales },
          retail: { ...prev?.retail, ...data.procssholding.retail },
          lps: { ...prev?.lps, ...data.procssholding.lps },
        }));
      //else if (funtype === 'srs') setPlotData(prev => appendUnique(prev, data.plotdata_srs, 'time'));
      else if (funtype === 'netflow') {
        // Complex update for plotNetFlow similar to initial fetch
         const appendCorrespondingValues = (
            previousValues: number[] = [],
            allIncomingValues?: number[],
            incomingMasterTimestamps?: string[], // Must pass this now
            newMasterTimestampsWithOriginalIndices?: { timestamp: string; originalIndex: number }[] // Must pass this now
        ) => {
            if (!allIncomingValues || allIncomingValues.length === 0 || !incomingMasterTimestamps || !newMasterTimestampsWithOriginalIndices) {
            return previousValues;
            }
            if (allIncomingValues.length !== incomingMasterTimestamps.length) {
                console.warn("Mismatch in lengths for appendCorrespondingValues. Data might be inconsistent.");
            }
            const valuesToAdd = newMasterTimestampsWithOriginalIndices
            .filter(item => item.originalIndex < allIncomingValues.length) 
            .map(item => allIncomingValues[item.originalIndex]);
            return [...previousValues, ...valuesToAdd];
        };
        
        setPlotNetFlow(prev => {
            const newIncomingData = data;
        
            const prevMasterTimestampsSet = new Set(prev.timestamps);
            const incomingMasterTimestamps = newIncomingData.timestamps || [];
            const newMasterTimestampsWithOriginalIndices: { timestamp: string; originalIndex: number }[] = [];
            const combinedMasterTimestamps = [...prev.timestamps];
        
            incomingMasterTimestamps.forEach((ts: string, index: number) => {
            if (!prevMasterTimestampsSet.has(ts)) {
                newMasterTimestampsWithOriginalIndices.push({ timestamp: ts, originalIndex: index });
                combinedMasterTimestamps.push(ts);
                prevMasterTimestampsSet.add(ts);
            }
            });
        
            const prevPriceTimestampsSet = new Set(prev.prices.timestamps);
            const incomingPriceTimestamps = newIncomingData.prices?.timestamps || [];
            const incomingPriceValues = newIncomingData.prices?.values || [];
            const combinedPriceTimestamps = [...prev.prices.timestamps];
            const combinedPriceValues = [...prev.prices.values];
        
            if (incomingPriceTimestamps.length === incomingPriceValues.length) {
            incomingPriceTimestamps.forEach((ts: string, index: number) => {
                if (!prevPriceTimestampsSet.has(ts)) {
                combinedPriceTimestamps.push(ts);
                combinedPriceValues.push(incomingPriceValues[index]);
                prevPriceTimestampsSet.add(ts);
                }
            });
            } else if (incomingPriceTimestamps.length > 0 || incomingPriceValues.length > 0) {
            console.warn("Prices timestamps and values arrays have different lengths in new NetFlow data.");
            }
        
            return {
            ...prev,
            timestamps: combinedMasterTimestamps,
            netflow: {
                whale: appendCorrespondingValues(prev.netflow.whale, newIncomingData.netflow?.whale, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                retail: appendCorrespondingValues(prev.netflow.retail, newIncomingData.netflow?.retail, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                shark: appendCorrespondingValues(prev.netflow.shark, newIncomingData.netflow?.shark, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
            },
            inflow: {
                whale: appendCorrespondingValues(prev.inflow.whale, newIncomingData.inflow?.whale, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                retail: appendCorrespondingValues(prev.inflow.retail, newIncomingData.inflow?.retail, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                shark: appendCorrespondingValues(prev.inflow.shark, newIncomingData.inflow?.shark, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
            },
            outflow: {
                whale: appendCorrespondingValues(prev.outflow.whale, newIncomingData.outflow?.whale, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                retail: appendCorrespondingValues(prev.outflow.retail, newIncomingData.outflow?.retail, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                shark: appendCorrespondingValues(prev.outflow.shark, newIncomingData.outflow?.shark, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
            },
            activeHolders: {
                whale: appendCorrespondingValues(prev.activeHolders.whale, newIncomingData.activeHolders?.whale, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                retail: appendCorrespondingValues(prev.activeHolders.retail, newIncomingData.activeHolders?.retail, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                shark: appendCorrespondingValues(prev.activeHolders.shark, newIncomingData.activeHolders?.shark, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
                total: appendCorrespondingValues(prev.activeHolders.total, newIncomingData.activeHolders?.total, incomingMasterTimestamps, newMasterTimestampsWithOriginalIndices),
            },
            prices: {
                timestamps: combinedPriceTimestamps,
                values: combinedPriceValues,
            },
            };
        });
      }
      // For sentiment related data
      else if (funtype === 'twtft') setFrequency(prev => ({ tweetFrequencyTrend: appendUnique(prev.tweetFrequencyTrend, data.frequency.tweetFrequencyTrend, 'name'), tweetsWithAddressFrequency: appendUnique(prev.tweetsWithAddressFrequency, data.frequency.tweetsWithAddressFrequency, 'name') }));
      else if (funtype === 'twt') {
        setTweets(prev => ({
            tweetPerMinut: appendUnique(prev.tweetPerMinut, data.tweetperMinutes.tweetsPerMinuteArray, 'name'),
            tweetPerFVmints: appendUnique(prev.tweetPerFVmints, data.tweetperMinutes.tweetPerFVmints, 'name'),
            tweetsWithAddressCount: appendUnique(prev.tweetsWithAddressCount, data.tweetperMinutes.tweetsWithAddressCount, 'name'),
          }));
        setValues(data.tweetperMinutes);
      }
      else if (funtype === 'vlcrt') setSEI(prev => ({ SEI_value: appendUnique(prev.SEI_value, data.SEI.SEI_value, 'name'), SEI_Velocity: appendUnique(prev.SEI_Velocity, data.SEI.SEI_Velocity, 'name') }));
      else if (funtype === 'fmgwt') setFomo(prev => ({ tweetFomo: appendUnique(prev.tweetFomo, data.Fomo.tweetFomo, 'name'), macd: appendUnique(prev.macd, data.Fomo.macd, 'name'), RSIx: appendUnique(prev.RSIx, data.Fomo.RSI, 'name') }));
      else if (funtype === 'impgrw') setTweetImpression(prev => ({ weighBasedImpression: appendUnique(prev.weighBasedImpression, data.impression.weighBasedImpression, 'name'), sentimentTrend: appendUnique(prev.sentimentTrend, data.impression.sentimentTrend, 'time'), EWMA_Value: appendUnique(prev.EWMA_Value, data.impression.EWMA_Value, 'name') }));
      else if (funtype === 'avtwavvw') {
        setViews(prev => ({
            tweetViewsPerFVmints: appendUnique(prev.tweetViewsPerFVmints, data.views.tweetViewsPerFVmints, 'name'),
            tweetsWithAddressViews: appendUnique(prev.tweetsWithAddressViews, data.views.tweetsWithAddressViews, 'name'),
            tweetViewsRatioPercentage: appendUnique(prev.tweetViewsRatioPercentage, data.views.tweetViewsRatioPercentage, 'name'),
          }));
        setViewsAlt(data.views);
      }


      return { totalpage: data.totalPages ?? data.meta?.totalPages ?? 0, currentpage: data.page ?? data.meta?.currentPage ?? 0 };
    } catch (err) {
      console.error(`Error fetching more data for ${funtype}:`, err);
      return { totalpage: 0, currentpage: 0 };
    }
  }, [address, poolID, allMetadata?.symbol]);


  const mobileNavItems = [
    { id: 'chart', label: 'Chart', icon: <CandlestickChartIcon size={24} /> },
    { id: 'metrics', label: 'Sentiment', icon: <LineChartIcon size={24} /> },
    { id: 'orders', label: 'Order Book', icon: <ListOrdered size={24} /> },
    { id: 'social', label: 'Social', icon: <MessagesSquare size={24} /> },
    { id: 'watchlist', label: 'Watchlist', icon: <Star size={24} /> }, // <- New item
  ];
  

  
  const lastPrice = livePrice[livePrice.length - 1]?.close;
  const prevPrice = livePrice.length > 1 ? livePrice[livePrice.length - 2]?.close : lastPrice;
  const priceChangePositive = lastPrice && prevPrice ? lastPrice >= prevPrice : true;


  // src/pages/[address].tsx (or your page file)
// ... (all your imports, state, useEffects, functions remain the same above this)

  // Make sure these are defined:
  // const lastPrice = livePrice[livePrice.length - 1]?.close;
  // const prevPrice = livePrice.length > 1 ? livePrice[livePrice.length - 2]?.close : lastPrice;
  // const priceChangePositive = lastPrice && prevPrice ? lastPrice >= prevPrice : true;
  // And also metadata_, isScriptReady, totalchartData, etc.

  // --- Start of the return statement ---
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <Script src="/static/datafeeds/udf/dist/bundle.js" strategy="lazyOnload" onReady={() => setIsScriptReady(true)} />
      <Script src="/static/charting_library/charting_library.js" strategy="lazyOnload" onReady={() => setIsScriptWidgetReady(true)} />
  
      <header className="px-4 py-3 border-b border-gray-700/50 bg-gray-850 shadow-lg sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-gray-700 rounded-md">
                <CandlestickChartIcon size={20} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-100">
                {/* Using lastPriceData from useMemo for consistency */}
                {metadata_?.symbol ? `${metadata_?.symbol}/USDT` : (address ? `${address.substring(0,4)}...${address.substring(address.length-4)}/USDT` : 'Loading...')} 
              </h1>
              <p className="text-xs text-gray-400 font-mono">
                {metadata_?.name || 'Token Name'}
              </p>
            </div>
          </div>
          
          {/* Using lastPriceData from useMemo */}
          {lastPrice !== undefined && (
            <div className="flex items-center space-x-2 bg-gray-800/70 rounded-md px-3 py-1.5">
              <span className={`text-lg font-semibold ${priceChangePositive ? 'text-green-400' : 'text-red-400'}`}>
                ${lastPrice.toFixed(6)}
              </span>
            </div>
          )}
        </div>
      </header>
  
      <main className="flex-grow flex flex-col md:flex-row overflow-hidden p-2 md:p-3 gap-2 md:gap-3">
        {/* Desktop Layout: 3 Columns */}
        {/* 
          IMPORTANT: The `h-[calc(100vh-68px-1.5rem)]` on this div will try to fit everything within the viewport.
          If the content in the left or center columns is too tall, it will overflow or be cut off
          unless the individual panels have their own `overflow-y-auto` and defined heights.
          The previous `h-[200vh]` was likely for testing scroll, but for a fixed layout, viewport height is more common.
          Let's revert to a viewport-based height and ensure inner panels manage their scroll.
        */}
        <div className="hidden md:flex flex-grow gap-3 h-[150vh]"> {/* Header height ~68px, padding ~1.5rem */}
          
          {/* Left Panel (Chart, Social Feed, Key Metrics) */}
          <section className="w-[calc(65%-0.375rem)] flex flex-col gap-3"> {/* 65% minus half gap */}
            
            {/* Chart Container - Aim for ~50% of the left panel's height */}
            <div className="h-[80%] bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-gray-700/50 bg-gray-800/60 rounded-t-xl flex-shrink-0">
                <h2 className="text-base font-semibold text-gray-200">Price Chart</h2>
                 <div className="flex items-center space-x-2">
                   <div className={`w-2 h-2 rounded-full animate-pulse ${livePrice.length > 0 ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                   <span className="text-xs text-gray-400">{livePrice.length > 0 ? 'Live Data' : 'Connecting...'}</span>
                 </div>
              </div>
              <div className="p-0.5 flex-grow overflow-hidden"> {/* Chart itself takes remaining space */}
                {isScriptReady && isScriptWidgetReady && totalchartData.length > 0 ? (
                  <TVChartContainer data={totalchartData} name={metadata_?.name} address={address} symbol={metadata_?.symbol} emojiData={emojiRawData} />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400 mx-auto mb-3"></div>
                      <p className="text-sm text-gray-400">Loading Chart...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Social Feed - Aim for ~25% of the left panel's height */}
            <div className="h-[25%] bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-gray-700/50 bg-gray-800/60 rounded-t-xl flex-shrink-0">
                <h2 className="text-base font-semibold text-gray-200">Social Feed</h2>
                 <div className="flex items-center space-x-2">
                   <MessagesSquare size={16} className="text-blue-400" />
                   <span className="text-xs text-gray-400">Real-time</span>
                 </div>
              </div>
              <div className="p-3 flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
                <TopTweets username={usernames} tweets_={utweets} likes={likes} viewscount={viewscount} timestamp={time} profile={profile} />
              </div>
            </div>

            {/* Key Metrics - Aim for ~25% of the left panel's height */}
            <div className="h-[25%] bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-gray-700/50 bg-gray-800/60 rounded-t-xl flex-shrink-0">
                <h2 className="text-base font-semibold text-gray-200">Key Metrics</h2>
                <div className="flex items-center space-x-2">
                   <BarChartBig size={16} className="text-yellow-400" />
                   <span className="text-xs text-gray-400">Analytics</span>
                 </div>
              </div>
              <div className="p-3 flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
                <MetricsGrid 
                  address={address} name={metadata_?.image} twitter={metadata_?.twitter} Frequency={frequency} 
                  Tweets={tweets} Values={values} SEI={sei} FOMO={fomo} TweetImpression={tweetImpression} 
                  Views={views} ViewsAlt={viewsAlt} HypeMeter={hypeMeter}
                  holders={holderRawData} live_prx={livePrice}
                  fetchOlderHoldingCount={fetchMoreDataForChild}
                />
              </div>
            </div>
          </section>
  
          {/* Center Panel (Order Book ONLY) - Full height of its column */}
          <aside className="w-[calc(35%-0.375rem)] flex flex-col gap-3"> {/* 35% minus half gap */}
            {/* OrderBookPanel takes the full height of this aside column */}
            <div className="flex-1 bg-transparent p-0 rounded-xl overflow-hidden min-h-0">
              <OrderBookPanel 
                holders={holderRawData} live_prx={livePrice} holderplot={holderData} holderhistroy={holderHistoryData}
                plotBuyData={plotNetFlow} 
                plotDistribution={plotDistribution!} // Ensure plotDistribution is defined
                plotHoldingCount={plotHoldigCount!} // Ensure plotHoldingCount is defined
                fetchOlderHoldingCount={fetchMoreDataForChild}
              />
            </div>
          </aside>

          {/* Right Panel (Watchlist) - Fixed width, full height of its column */}
          <aside className="w-64 flex-shrink-0">
             <Watchlist />
          </aside>
        </div>
  
        {/* Mobile Layout (No changes here, kept as is from previous version) */}
        <div className="md:hidden flex-grow overflow-y-auto pb-16 space-y-3">
          {activeMobileView === 'chart' && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl overflow-hidden h-[80vh]">
               <div className="flex items-center justify-between p-3 border-b border-gray-700/50 bg-gray-800/60 rounded-t-xl">
                <h2 className="text-base font-semibold text-gray-200">Price Chart</h2>
                 <div className={`w-2 h-2 rounded-full animate-pulse ${livePrice.length > 0 ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              </div>
              <div className="p-0.5 h-[calc(100%-3rem-1px)]">
                {isScriptReady && isScriptWidgetReady && totalchartData.length > 0 ? (
                  <TVChartContainer data={totalchartData} name={metadata_?.name} address={address} symbol={metadata_?.symbol} emojiData={emojiRawData} />
                ) : ( <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading Chart...</div> )}
              </div>
            </div>
          )}
          {activeMobileView === 'orders' && (
            <div className="bg-transparent rounded-xl overflow-hidden h-auto">
              <OrderBookPanel 
                holders={holderRawData} live_prx={livePrice} holderplot={holderData} holderhistroy={holderHistoryData} 
                plotBuyData={plotNetFlow} 
                plotDistribution={plotDistribution!} 
                plotHoldingCount={plotHoldigCount!}
                fetchOlderHoldingCount={fetchMoreDataForChild}
              />
            </div>
          )}
          {activeMobileView === 'metrics' && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl overflow-hidden p-3">
               <div className="flex items-center justify-between pb-3 border-b border-gray-700/50 mb-3">
                <h2 className="text-base font-semibold text-gray-200">Key Metrics</h2>
                 <BarChartBig size={16} className="text-yellow-400" />
              </div>
              <MetricsGrid 
                address={address} name={metadata_?.image} twitter={metadata_?.twitter} Frequency={frequency} 
                Tweets={tweets} Values={values} SEI={sei} FOMO={fomo} TweetImpression={tweetImpression} 
                Views={views} ViewsAlt={viewsAlt} HypeMeter={hypeMeter}
                holders={holderRawData} live_prx={livePrice}
                fetchOlderHoldingCount={fetchMoreDataForChild}
              />
            </div>
          )}
          {activeMobileView === 'social' && (
            <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl overflow-hidden p-3">
               <div className="flex items-center justify-between pb-3 border-b border-gray-700/50 mb-3">
                <h2 className="text-base font-semibold text-gray-200">Social Feed</h2>
                 <MessagesSquare size={16} className="text-blue-400" />
              </div>
              <TopTweets username={usernames} tweets_={utweets} likes={likes} viewscount={viewscount} timestamp={time} profile={profile} />
            </div>
          )}
          {activeMobileView === 'watchlist' && (
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl overflow-hidden p-3">
            <div className="flex items-center justify-between pb-3 border-b border-gray-700/50 mb-3">
              <h2 className="text-base font-semibold text-gray-200">Watchlist</h2>
              <Star size={16} className="text-yellow-400" />
            </div>
            <Watchlist />
          </div>
        )}
        </div>
      </main>
  
      <MobileNav activeView={activeMobileView} onNavClick={setActiveMobileView} navItems={mobileNavItems} />
    </div>
  );
// --- End of the return statement ---

// ... (the rest of your component, if any, below the return statement)
} // This curly brace closes the TokenDetailPage component