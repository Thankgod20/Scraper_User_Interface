'use client';
import React, { useMemo, useState } from "react";
import BarGraph from './HomeBar';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { useMetadata } from "@/context/MetadataContext";
import { useRouter } from 'next/navigation';
interface Impression {
  name: string;
  value: number;
}
interface CompImpression {
    name: string;
    value: number;
    preval: number;
  }
interface UITableProps {
  addresses: { address: string }[];
  othermetadata: { 
    name: string;
    symbol: string;
    description: string;
    image: string;
    showName: boolean;
    createdOn: string;
    twitter: string;
    telegram: string;
    website: string 
  }[];
  usrname: string[][];
  tweetsPerMin: Impression[][]
  tweets: string[][];
  impressionsData: CompImpression[][];
  onRowClick?: (index: number) => void;
}

// Component for displaying the Fear/Greed dial meter
const FearGreedDial = ({ score }: { score: number }) => {
  if (Number.isNaN(score)) {
    score= 0;      // Gray when score is not a valid number
  }
  // Determine color based on score
  const getColor = (score: number) => {
    if (Number.isNaN(score)) return "#AAAAAA";      // Gray when score is not a valid number
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
    <div className="relative w-24 h-24">
      {/* Semi-circular background */}
      <svg viewBox="0 0 100 60" className="w-full">
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
      <div className="absolute bottom-0 left-0 right-0 text-center text-xs font-bold">
        {score < 25 ? "Extreme Fear" : 
         score < 50 ? "Fear" : 
         score < 75 ? "Greed" : "Extreme Greed"}
        <div className="text-sm font-bold">{score.toFixed(0)}</div>
      </div>
    </div>
  );
};

// Format large numbers for display
const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num;
};

const UITable = ({ 
  addresses, 
  othermetadata, 
  usrname, 
  tweetsPerMin,
  tweets, 
  impressionsData,
  onRowClick = (index) => console.log(`Row ${index} clicked`)
}: UITableProps) => {
    const router = useRouter();
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const { setMetadata } = useMetadata();
  // Extract and prepare data for the table

  const tableData = useMemo(() => {
    return addresses.map((address, index) => {
      const metadata = othermetadata[index] || {};
      const usernames = usrname[index] || [];
      const tweetTexts = tweets[index] || [];
      const impressions = impressionsData[index] || [];
      const tweetperMin = tweetsPerMin[index] || []
      //console.log("Impressiond ",impressions)
      // Calculate number of tweets
      const numberOfTweets = tweetTexts.length;
      
      // Use total views from all impressions for a single view count
      const totalViews = impressions.reduce((sum, imp) => sum + imp.value, 0);
      const averageViews = totalViews/impressions.length
      // Calculate tweet frequency
      const tweetFrequency = calculateTweetFrequencyTrendPercentage(
        tweetperMin,
        10,
        5,
        10
      );
      //console.log("Tweet frq",tweetFrequency)
      const avgTweetFrequency = tweetFrequency.length > 0
        ? tweetFrequency[tweetFrequency.length-1].value
        : 0;
      
      // Calculate sentiment score (fear/greed index)
      const sentimentTrend = calculateSentimentMomentum(impressions);
      
      const fearGreedIndex = calculateSentimentScore(
        avgTweetFrequency,
        0,
        averageViews,
        numberOfTweets
      );
      
      return {
        address: address.address,
        metadata,
        name: metadata.name,
        symbol: metadata.symbol,
        image: metadata.image,
        numberOfTweets,
        totalViews,
        averageViews,
        impressions,
        tweetFrequency: avgTweetFrequency,
        fearGreedIndex
      };
    });
  }, [addresses, othermetadata, usrname, tweets, impressionsData]);

  // Utility functions from the provided code
  function calculateSentimentMomentum(impressions: Impression[]): number {
    if (!impressions || impressions.length < 2) return 0;
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
    //console.log("rawTrend",sortedData)
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

  const handleRowClick = (address: string, metadata: any,index: number) => {
    setSelectedRow(index);
    onRowClick(index);
    setMetadata(metadata);
    router.push(`/coin/${address}`);
  };

  return (
    <div className="overflow-x-auto mb-8">
      <h2 className="text-xl font-bold mb-4">Token Analytics</h2>
      <table className="min-w-full bg-gray-800 text-white rounded-lg overflow-hidden">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left">Token</th>
            <th className="px-4 py-3 text-left">Number of Tweets</th>
            <th className="px-4 py-3 text-left">Views</th>
            <th className="px-4 py-3 text-left">Tweet Frequency</th>
            <th className="px-4 py-3 text-left">Hype Meter</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((item, index) => (
            <tr 
              key={index} 
              className={`${index % 2 === 0 ? "bg-gray-800" : "bg-gray-750"} 
                ${selectedRow === index ? "bg-indigo-900" : ""} 
                cursor-pointer hover:bg-gray-700 transition-colors`}
              onClick={() => handleRowClick(item.address,item.metadata,index)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center">
                  {item.image && (
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-8 h-8 rounded-full mr-3" 
                    />
                  )}
                  <div>
                    <div className="font-medium"><a href={`/coin/${item.address}`}>{item.name || "Unknown"}</a></div>
                    <div className="text-gray-400 text-sm">{item.symbol}</div>
                  </div>
                </div>
              </td>
              
              <td className="px-4 py-3">
                <div className="font-medium">{item.numberOfTweets}</div>
              </td>
              
              <td className="px-4 py-3">
                <div className="h-20 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarGraph data={item.impressions}  />
                  </ResponsiveContainer>
                  <div className="text-center text-sm font-medium">
                    {formatNumber(Number(item.averageViews.toFixed(2)))}
                  </div>
                </div>
              </td>
              
              <td className="px-4 py-3">
                <div className="font-medium">{item.tweetFrequency.toFixed(1)}%</div>
                <div className="text-gray-400 text-sm">
                  {item.tweetFrequency < 25 ? "Low" : 
                   item.tweetFrequency < 50 ? "Moderate" : 
                   item.tweetFrequency < 75 ? "High" : "Very High"}
                </div>
              </td>
              
              <td className="px-4 py-3 flex justify-center items-center">
                <FearGreedDial score={item.fearGreedIndex} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UITable;