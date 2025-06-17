// components/MetricsGrid.tsx
import React, { JSX, useState, useEffect, ReactNode } from 'react';
import Modal from "react-modal";
import { QRCodeCanvas } from "qrcode.react";
import { Signal as SignalIcon, Users as UsersIcon, Eye as EyeIcon, Download } from 'lucide-react';

// Child Components
import LineGraph from "./LineGraph";
import DLineGraph from './DetailedLineGraph';
import BarGraph from './BarChar'; // Assuming this is the one with `preval`
import BarGraph_Main from './BarChar_Main';
import MACDChart from './MacD';
import MACDMainChart from './MacDMain';
import RSIChart from './RSIChart';
import LineGraphTimeD from "./LineGraphTimeD";
import LineGraphTimeS from "./LineGraphTimeS";
import MarketDepthChart from './MarketDepth'; // If used directly, or part of OrderBookPanel
import { CandleData, RawTradeData } from '@/app/types/TradingView';
// Utils & Types
import { NumberFormatter } from '@/app/utils/largeNumber';
import { Impression, CompImpression, TimeSeriess, MACDPoint, Engagement, MetricsBin, EngagementImpression, InfoBoxProps } from "@/app/utils/app_types";
import { parseViewsCount, calculateSentimentScore } from '@/app/utils/holdersfunct'; // Assuming these are correctly defined

type ZoomReport = {
  totalpage: number;
  currentpage: number;
};

interface MetricCardProps {
  title: string;
  value: string;
  percentageChange?: string; // Made optional
  subText: string;
  graph: JSX.Element;
  isPositiveChange?: boolean; // Made optional
  onClick?: () => void; // Made optional
  toggleControls?: React.ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title, value, percentageChange, subText, graph, isPositiveChange, onClick, toggleControls, icon, isLoading
}) => {
  return (
    <div className="bg-gray-800 text-white p-4 rounded-lg shadow-lg transition-all hover:shadow-xl flex flex-col h-full">
      {toggleControls && <div className="mb-2">{toggleControls}</div>}
      <div className="flex items-center mb-1">
        {icon && <span className="mr-2 text-blue-400">{icon}</span>}
        <h3 className="text-sm text-gray-400 font-medium truncate">{title}</h3>
      </div>
      {isLoading ? (
        <div className="text-2xl font-bold mb-2 animate-pulse bg-gray-700 h-8 w-3/4 rounded"></div>
      ) : (
        <div className="text-2xl font-bold mb-2">{value}</div>
      )}
      {percentageChange && (
        <div className={`text-sm mb-1 ${isPositiveChange ? "text-green-400" : "text-red-400"}`}>
          {percentageChange}
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1 flex-shrink-0">{subText}</p>
      <div className="mt-auto pt-2 flex-grow min-h-[64px]" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
        {isLoading ? <div className="bg-gray-700 h-16 w-full rounded animate-pulse"></div> : graph}
      </div>
    </div>
  );
};


const InfoBox: React.FC<InfoBoxProps> = ({ title, value, icon }) => {
  return (
    <div className="bg-gray-700/50 backdrop-blur-sm rounded-lg p-4 shadow-md flex items-center hover:bg-gray-700 transition-colors">
      {icon && <div className="mr-3 text-blue-300">{icon}</div>}
      <div>
        <h3 className="text-gray-300 text-sm font-medium">{title}</h3>
        <p className="text-white text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
};

interface SentimentMeterProps {
  score: number;
}
const SentimentMeter: React.FC<SentimentMeterProps> = ({ score }) => {
  const getColor = (s: number) => {
    if (s < 25) return "#EF4444"; // Red
    if (s < 50) return "#F59E0B"; // Orange
    if (s < 75) return "#EAB308"; // Yellow
    return "#22C55E"; // Green
  };
  const needleRotation = -90 + (score / 100) * 180;
  const color = getColor(score);

  return (
    <div className="relative w-48 h-32 sm:w-60 sm:h-36 mx-auto my-4"> {/* Adjusted size */}
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <defs>
          <linearGradient id="dialGradientMetric" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="33%" stopColor="#F59E0B" />
            <stop offset="66%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
        </defs>
        <path d="M 10,50 A 40,40 0 0,1 90,50" stroke="url(#dialGradientMetric)" strokeWidth="10" fill="none" />
        <g transform={`rotate(${needleRotation}, 50, 50)`}>
          <line x1="50" y1="50" x2="50" y2="15" stroke={color} strokeWidth="2.5" />
          <circle cx="50" cy="50" r="3.5" fill={color} stroke="white" strokeWidth="0.5"/>
        </g>
        <text x="50" y="40" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">{score.toFixed(0)}</text>
      </svg>
      <div className="absolute bottom-[-10px] left-0 right-0 text-center text-xs font-semibold" style={{ color }}>
        {score < 25 ? "Extreme Fear" : score < 50 ? "Fear" : score < 75 ? "Greed" : "Extreme Greed"}
      </div>
    </div>
  );
};

const ToggleButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    className={`px-2.5 py-1.5 text-xs rounded-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500
                ${active ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
    onClick={onClick}
  >
    {children}
  </button>
);

interface MetricsGridProps {
  address: any; name: any; twitter: any;
  Frequency: { tweetFrequencyTrend: Impression[]; tweetsWithAddressFrequency: Impression[]; };
  Tweets: { tweetPerMinut: Impression[]; tweetPerFVmints: Impression[]; tweetsWithAddressCount: Impression[]; };
  Values: { totalTweets: string; averagePercentage: number; averagePercentageFv: number; };
  SEI: { SEI_value: Impression[]; SEI_Velocity: Impression[]; };
  FOMO: { tweetFomo: Impression[]; macd: MACDPoint[]; RSIx: Impression[]; };
  TweetImpression: { weighBasedImpression: Impression[]; sentimentTrend: TimeSeriess[]; EWMA_Value: Impression[]; };
  Views: { tweetViewsPerFVmints: CompImpression[]; tweetsWithAddressViews: CompImpression[]; tweetViewsRatioPercentage: Impression[]; };
  ViewsAlt: { avgViewsPerTweet: number; tweetwithAddAvgViews: number; };
  HypeMeter: { sentiMeter: number; sentiMeterAddr: number; };
  holders: { amount: number; price: number; time: string }[];
  live_prx: RawTradeData[];
  fetchOlderHoldingCount: (page: number, funtype: string) => Promise<ZoomReport>;
}

const MetricsGrid: React.FC<MetricsGridProps> = ({
  address, name, twitter, Frequency, Tweets, Values, SEI, FOMO,
  TweetImpression, Views, ViewsAlt, HypeMeter, holders, live_prx, fetchOlderHoldingCount
}) => {
  const [selectedMetric, setSelectedMetric] = useState<{ title: string; data: Impression[] | CompImpression[] | null } | null>(null);
  const [selectedTimeMetric, setSelectedTimeMetric] = useState<{ title: string; data: TimeSeriess[]  } | null>(null);
  const [selectedMacDMetric, setSelectedMacDMetric] = useState<{ title: string; data: MACDPoint[] } | null>(null);
  
  const [activeTweetMetric, setActiveTweetMetric] = useState<'frequency' | 'address'>('frequency');
  const [activeCallerMetric, setActiveCallerMetric] = useState<'min' | 'fiveMin' | 'address'>('min');
  const [activeImpressionMetric, setActiveImpressionMetric] = useState<'growth' | 'volatility' | 'peaks'>('growth');
  const [activeEngagementMetric, setActiveEngagementMetric] = useState<'growth' | 'peaks'>('growth');
  const [activeFomoMetric, setActiveFomoMetric] = useState<'growth' | 'macd' | 'rsi'>('growth'); // Changed 'peaks' to 'rsi' for FOMO
  const [activeViewsMetric, setActiveViewsMetric] = useState<'average' | 'address' | 'ratio'>('average');

  let twt = `https://x.com/search?q=${address}`;
  if (twitter) twt = twitter;

  const totalTweetsWithAddress = Tweets.tweetsWithAddressCount.reduce((sum, { value }) => sum + value, 0);

  const openModal = (type: 'line' | 'time' | 'macd' | 'bar', title: string, data: any) => {
    if (type === 'line') setSelectedMetric({ title, data });
    else if (type === 'time') setSelectedTimeMetric({ title, data });
    else if (type === 'macd') setSelectedMacDMetric({ title, data });
    else if (type === 'bar') setSelectedMetric({ title, data }); // Use selectedMetric for bar too or create new state
  };
  const closeModal = () => {
    setSelectedMetric(null); setSelectedTimeMetric(null); setSelectedMacDMetric(null);
  };

  useEffect(() => { Modal.setAppElement("#root-modal-element"); }, []); // Ensure #root-modal-element exists in your layout

  // Simplified CSV download function (implement actual CSV generation as before)
  const downloadDataAsCSV = () => { console.log("Download CSV clicked"); /* Implement full CSV logic */ };

  const isLoading = !Frequency || !Tweets || !Values || !SEI || !FOMO || !TweetImpression || !Views || !ViewsAlt || !HypeMeter;


  const renderTweetFrequencyCard = () => {
    const data = activeTweetMetric === 'frequency' ? Frequency.tweetFrequencyTrend : Frequency.tweetsWithAddressFrequency;
    const title = activeTweetMetric === 'frequency' ? "Tweet Frequency Trend (%)" : "Tweet w/ Address Freq. (%)";
    const subText = activeTweetMetric === 'frequency' ? "Frequency of tweets over time" : "Trend for tweets with address";
    const value = data.length > 0 ? `${data[data.length - 1].value.toFixed(2)}%` : "0%";
    const isPositive = data.length > 0 && data[data.length - 1].value > 0;

    return (
      <MetricCard
        title={title} value={value} subText={subText} isPositiveChange={isPositive} isLoading={isLoading}
        graph={<LineGraph data={data} color="#10B981" funtype='twtft' onZoomOrPan={fetchOlderHoldingCount} />}
        onClick={() => openModal('line', title, data)}
        toggleControls={
          <div className="flex space-x-1 mb-2">
            <ToggleButton active={activeTweetMetric === 'frequency'} onClick={() => setActiveTweetMetric('frequency')}>Overall Freq.</ToggleButton>
            <ToggleButton active={activeTweetMetric === 'address'} onClick={() => setActiveTweetMetric('address')}>Address Freq.</ToggleButton>
          </div>
        }
      />
    );
  };

  const renderCallersCard = () => {
    let data, title, subText, value, percentageChange, isPositive;
    if (activeCallerMetric === 'min') {
      data = Tweets.tweetPerMinut; title = "Callers/min (Avg.)";
      value = Values.totalTweets; percentageChange = `${(Values.averagePercentage > 0 ? "+" : "")}${Values.averagePercentage.toFixed(2)}%`;
      subText = `${Values.averagePercentage.toFixed(2)}% ${Values.averagePercentage > 0 ? "Increase" : "Decrease"} in tweets/min`;
      isPositive = Values.averagePercentage > 0;
    } else if (activeCallerMetric === 'fiveMin') {
      data = Tweets.tweetPerFVmints; title = "Callers/5min (Avg.)";
      value = Values.totalTweets; percentageChange = `${(Values.averagePercentageFv > 0 ? "+" : "")}${Values.averagePercentageFv.toFixed(2)}%`;
      subText = `${Values.averagePercentageFv.toFixed(2)}% ${Values.averagePercentageFv > 0 ? "Increase" : "Decrease"} in tweets/5min`;
      isPositive = Values.averagePercentageFv > 0;
    } else { // address
      data = Tweets.tweetsWithAddressCount; title = "Tweets w/ Address (5min Count)";
      value = totalTweetsWithAddress.toString(); percentageChange = "";
      subText = "Tweets with address per 5 min";
      isPositive = data.length > 0 && data[data.length - 1].value > 0;
    }
    return (
      <MetricCard
        title={title} value={value} percentageChange={percentageChange} subText={subText} isPositiveChange={isPositive} isLoading={isLoading}
        graph={<LineGraph data={data} color="#34D399" funtype='twt' onZoomOrPan={fetchOlderHoldingCount} />}
        onClick={() => openModal('line', title, data)}
        toggleControls={
          <div className="flex space-x-1 mb-2">
            <ToggleButton active={activeCallerMetric === 'min'} onClick={() => setActiveCallerMetric('min')}>Per Min</ToggleButton>
            <ToggleButton active={activeCallerMetric === 'fiveMin'} onClick={() => setActiveCallerMetric('fiveMin')}>Per 5 Min</ToggleButton>
            <ToggleButton active={activeCallerMetric === 'address'} onClick={() => setActiveCallerMetric('address')}>With Address</ToggleButton>
          </div>
        }
      />
    );
  };

  const renderEngagementCard = () => {
    let data, title, value, percentageChange, subText, isPositive, graphType;
    if (activeEngagementMetric === 'growth') {
        data = SEI.SEI_value; title = "Social Engagement Index";
        const lastSEI = SEI.SEI_value.length ? SEI.SEI_value[SEI.SEI_value.length - 1].value : 0;
        value = `${lastSEI.toFixed(2)}%`; percentageChange = `${lastSEI >= 0 ? '+' : ''}${lastSEI.toFixed(2)}%`;
        subText = "Avg. engagement score"; isPositive = lastSEI >= 0; graphType = 'bar';
    } else { // peaks
        data = SEI.SEI_Velocity; title = "Engagement Velocity";
        const lastVel = SEI.SEI_Velocity.length ? SEI.SEI_Velocity[SEI.SEI_Velocity.length - 1].value : 0;
        value = `${lastVel.toFixed(2)}%`; percentageChange = `${lastVel >= 0 ? '+' : ''}${lastVel.toFixed(2)}%`;
        subText = "Rate of engagement change"; isPositive = lastVel > 0; graphType = 'line';
    }
    return (
        <MetricCard
            title={title} value={value} percentageChange={percentageChange} subText={subText} isPositiveChange={isPositive} isLoading={isLoading}
            graph={graphType === 'bar' ? <BarGraph_Main data={data as Impression[]} /> : <LineGraph data={data as Impression[]} color="#8B5CF6" funtype='vlcrt' onZoomOrPan={fetchOlderHoldingCount} />}
            onClick={() => openModal(graphType === 'bar' ? 'bar' : 'line', title, data)}
            toggleControls={
                <div className="flex space-x-1 mb-2">
                    <ToggleButton active={activeEngagementMetric === 'growth'} onClick={() => setActiveEngagementMetric('growth')}>SEI</ToggleButton>
                    <ToggleButton active={activeEngagementMetric === 'peaks'} onClick={() => setActiveEngagementMetric('peaks')}>Velocity</ToggleButton>
                </div>
            }
        />
    );
  };

  const renderFomoCard = () => {
    let  value = "0%", percentageChange = "0%", subText = "", isPositive = false, graph, onClickHandler, graphType = 'line';
    const fomoData = FOMO.tweetFomo;
    const macdData = FOMO.macd;
    const rsiData = FOMO.RSIx;
    let data: Impression[] | MACDPoint[] | TimeSeriess[] = [];
    let title = "FOMO Index"; // Default title, will be updated based on metric
    if (activeFomoMetric === 'growth' && fomoData.length > 0) {
        const lastVal = fomoData[fomoData.length - 1].value;
        data = fomoData; title = "FOMO Growth"; value = `${lastVal.toFixed(2)}%`;
        percentageChange = `${lastVal >= 0 ? "+" : ""}${lastVal.toFixed(2)}%`;
        subText = "Change in FOMO"; isPositive = lastVal >= 0;
        graph = <LineGraph data={data} color="#8B5CF6" funtype='fmgwt' onZoomOrPan={fetchOlderHoldingCount} />;
        onClickHandler = () => openModal('line', title, data);
    } else if (activeFomoMetric === 'macd' && macdData.length > 0) {
        const lastVal = macdData[macdData.length - 1].macd;
        data = macdData; title = "FOMO MACD"; value = `${lastVal.toFixed(2)}`;
        percentageChange = `${lastVal >= 0 ? "+" : ""}${lastVal.toFixed(2)}`;
        subText = "MACD of FOMO Index"; isPositive = lastVal >= 0; graphType = 'macd';
        graph = <MACDChart data={data as MACDPoint[]} />;
        onClickHandler = () => openModal('macd', title, data);
    } else if (activeFomoMetric === 'rsi' && rsiData.length > 0) {
        const lastVal = rsiData[rsiData.length - 1].value;
        data = rsiData; title = "FOMO RSI"; value = `${lastVal.toFixed(2)}`;
        percentageChange = ""; subText = "RSI of FOMO Index"; isPositive = lastVal < 70 && lastVal > 30; // Example
        graph = <RSIChart rsiData={data as Impression[]} />;
        onClickHandler = () => openModal('line', title, data); // RSIChart uses Impression[]
    } else {
        // Default empty state or loading
        title = activeFomoMetric === 'growth' ? "FOMO Growth" : activeFomoMetric === 'macd' ? "FOMO MACD" : "FOMO RSI";
        subText = "Not enough data.";
        graph = <div className="h-16 flex items-center justify-center text-gray-500">No Data</div>;
    }
    return (
      <MetricCard
        title={title} value={value} percentageChange={percentageChange} subText={subText} isPositiveChange={isPositive} isLoading={isLoading}
        graph={graph} onClick={onClickHandler}
        toggleControls={
          <div className="flex space-x-1 mb-2">
            <ToggleButton active={activeFomoMetric === 'growth'} onClick={() => setActiveFomoMetric('growth')}>Growth</ToggleButton>
            <ToggleButton active={activeFomoMetric === 'macd'} onClick={() => setActiveFomoMetric('macd')}>MACD</ToggleButton>
            <ToggleButton active={activeFomoMetric === 'rsi'} onClick={() => setActiveFomoMetric('rsi')}>RSI</ToggleButton>
          </div>
        }
      />
    );
  };

  const renderImpressionCard = () => {
    let  title, value, percentageChange, subText, isPositive, graphType;
    let data: Impression[] | TimeSeriess[] = [];
    if (activeImpressionMetric === 'growth' && TweetImpression.weighBasedImpression.length > 0) {
        const lastVal = TweetImpression.weighBasedImpression[TweetImpression.weighBasedImpression.length - 1].value;
        data = TweetImpression.weighBasedImpression; title = "Impression Growth"; value = `${isNaN(lastVal) ? 0 : lastVal.toFixed(2)}%`;
        percentageChange = `${(isNaN(lastVal) || lastVal < 0) ? "" : "+"}${isNaN(lastVal) ? 0 : lastVal.toFixed(2)}%`;
        subText = "Weighted impression change"; isPositive = !isNaN(lastVal) && lastVal >= 0; graphType = 'line';
    } else if (activeImpressionMetric === 'volatility' && TweetImpression.sentimentTrend.length > 0) {
        const lastVal = TweetImpression.sentimentTrend[TweetImpression.sentimentTrend.length - 1].aggregatedSentiment;
        data = TweetImpression.sentimentTrend; title = "Sentiment Volatility"; value = lastVal.toFixed(2);
        percentageChange = "Variability"; subText = "Sentiment variability"; isPositive = lastVal < 1; graphType = 'time';
    } else if (activeImpressionMetric === 'peaks' && TweetImpression.EWMA_Value.length > 0) {
        const lastVal = TweetImpression.EWMA_Value[TweetImpression.EWMA_Value.length-1].value;
        data = TweetImpression.EWMA_Value; title = "Impression EWMA"; value = lastVal.toFixed(2);
        percentageChange = "Smoothed Peaks"; subText = "Exponential Moving Average of Impressions"; isPositive = lastVal > 0; graphType = 'line';
    } else {
        // Fallback for empty data
        title = "Impression Data"; subText = "No data available"; value="N/A"; percentageChange="N/A"; isPositive = false;
        data = []; graphType = 'line'; // Default, won't render much
    }

    return (
        <MetricCard
            title={title} value={value} percentageChange={percentageChange} subText={subText} isPositiveChange={isPositive} isLoading={isLoading}
            graph={
                graphType === 'time' ? <LineGraphTimeS data={data as TimeSeriess[]} color="#F59E0B" /> :
                <LineGraph data={data as Impression[]} color={activeImpressionMetric === 'growth' ? "#10B981" : "#EF4444"} funtype='impgrw' onZoomOrPan={fetchOlderHoldingCount} />
            }
            onClick={() => openModal(graphType as any, title, data)}
            toggleControls={
                <div className="flex space-x-1 mb-2">
                    <ToggleButton active={activeImpressionMetric === 'growth'} onClick={() => setActiveImpressionMetric('growth')}>Growth</ToggleButton>
                    <ToggleButton active={activeImpressionMetric === 'volatility'} onClick={() => setActiveImpressionMetric('volatility')}>Volatility</ToggleButton>
                    <ToggleButton active={activeImpressionMetric === 'peaks'} onClick={() => setActiveImpressionMetric('peaks')}>EWMA</ToggleButton>
                </div>
            }
        />
    );
  };
  
  const renderViewsCard = () => {
    let data, title, value, subText, isPositive, graphType;
    if (activeViewsMetric === 'average') {
        data = Views.tweetViewsPerFVmints; title = "Avg. Views/Tweet"; value = NumberFormatter.formatNumber(Number(ViewsAlt.avgViewsPerTweet.toFixed(2)));
        subText = "Overall average views per tweet"; isPositive = ViewsAlt.avgViewsPerTweet >= 0; graphType = 'bar';
    } else if (activeViewsMetric === 'address') {
        data = Views.tweetsWithAddressViews; title = "Views for Tweets w/ Address (5min)"; value = NumberFormatter.formatNumber(Number(ViewsAlt.tweetwithAddAvgViews.toFixed(2)));
        subText = "Aggregated views for tweets with address"; isPositive = Views.tweetsWithAddressViews.length > 0 && Views.tweetsWithAddressViews[Views.tweetsWithAddressViews.length-1].value > 0; graphType = 'bar';
    } else { // ratio
        data = Views.tweetViewsRatioPercentage; title = "Tweet Count / Avg Views Ratio"; 
        const ratioVal = (Number(parseViewsCount(Values.totalTweets))/ViewsAlt.avgViewsPerTweet)*100;
        value = isNaN(ratioVal) ? "0%" : `${NumberFormatter.formatNumber(Number(ratioVal.toFixed(2)))}%`;
        subText = "Caller interest vs. viewership"; isPositive = ViewsAlt.avgViewsPerTweet >= 0; graphType = 'line';
    }
    return (
        <MetricCard
            title={title} value={value} subText={subText} isPositiveChange={isPositive} isLoading={isLoading}
            graph={
                graphType === 'bar' ? <BarGraph data={data as CompImpression[]} /> :
                <LineGraph data={data as Impression[]} color="#3B82F6" funtype='avtwavvw' onZoomOrPan={fetchOlderHoldingCount} />
            }
            onClick={() => openModal(graphType === 'bar' ? 'bar' : 'line', title, data)}
            toggleControls={
                <div className="flex space-x-1 mb-2">
                    <ToggleButton active={activeViewsMetric === 'average'} onClick={() => setActiveViewsMetric('average')}>Average</ToggleButton>
                    <ToggleButton active={activeViewsMetric === 'address'} onClick={() => setActiveViewsMetric('address')}>Address</ToggleButton>
                    <ToggleButton active={activeViewsMetric === 'ratio'} onClick={() => setActiveViewsMetric('ratio')}>Ratio</ToggleButton>
                </div>
            }
        />
    );
  };

  return (
    <div className="bg-gray-850 text-white rounded-lg p-3 shadow-lg w-full h-full flex flex-col">
      <div id="root-modal-element"></div> {/* For Modal accessibility */}
      <div className="flex items-center justify-between mb-4 p-2 bg-gray-800 rounded-md">
        <div className="flex items-center">
            {name && <img src={name} alt="Token" className="w-10 h-10 rounded-full mr-3 border-2 border-gray-700"/>}
            <div className="flex-grow">
                <p className="text-xs text-gray-400 mb-1 truncate" title={address}>
                    {address}
                </p>
            </div>
        </div>
        <div className="flex-shrink-0">
          {address && <QRCodeCanvas value={address} size={60} bgColor="#2D3748" fgColor="#FFFFFF" level="L" className="rounded-md border border-gray-700" />}
        </div>
      </div>
      
      <div className="flex space-x-2 mb-4">
        <a href={twt} target="_blank" rel="noopener noreferrer" className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg font-semibold text-center text-xs transition-colors">
          X/Twitter
        </a>
        <a href={`https://dexscreener.com/search?q=${address}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-lg font-semibold text-center text-xs transition-colors">
          DexScreener
        </a>
      </div>
      
      <div className="mb-4">
        <button onClick={downloadDataAsCSV} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-lg font-semibold text-xs transition-colors flex items-center justify-center">
          <Download size={14} className="mr-2"/> Download Plot Data (CSV)
        </button>
      </div>
      
      <div className="flex-grow overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-850">
        {renderTweetFrequencyCard()}
        {renderCallersCard()}
        {renderImpressionCard()}
        {renderViewsCard()}
        {renderEngagementCard()}
        {renderFomoCard()}
      
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <InfoBox title="Holders" value={NumberFormatter.formatNumber(holders.length)} icon={<UsersIcon size={20} />} />
            <InfoBox title="Tweet Views (Avg)" value={NumberFormatter.formatNumber(Math.round(ViewsAlt.avgViewsPerTweet))} icon={<EyeIcon size={20} />} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="bg-gray-800 p-3 rounded-lg shadow-lg">
                <h3 className="text-sm text-center font-semibold mb-1 text-gray-300">Hype Meter</h3>
                <SentimentMeter score={HypeMeter.sentiMeter} />
            </div>
            <div className="bg-gray-800 p-3 rounded-lg shadow-lg">
                <h3 className="text-sm text-center font-semibold mb-1 text-gray-300">Hype Meter (Address Mentions)</h3>
                <SentimentMeter score={HypeMeter.sentiMeterAddr} />
            </div>
        </div>
      </div>

      <Modal
        isOpen={!!selectedMetric || !!selectedTimeMetric || !!selectedMacDMetric}
        onRequestClose={closeModal}
        contentLabel="Metric Details"
        className="bg-gray-900 text-white w-[90vw] max-w-[1200px] h-[80vh] mx-auto my-auto rounded-lg p-4 shadow-2xl flex flex-col"
        overlayClassName="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-[1000]"
      >
        <h3 className="text-lg font-bold mb-3 text-blue-300 flex-shrink-0">
          {selectedMetric?.title || selectedTimeMetric?.title || selectedMacDMetric?.title}
        </h3>
        <div className="flex-grow overflow-hidden">
          {selectedMetric && (selectedMetric.title.includes("View") || selectedMetric.title.includes("Engagement Index")) ? (
            <BarGraph_Main data={selectedMetric.data as Impression[]} />
          ) : selectedMetric ? (
            <DLineGraph data={selectedMetric.data as Impression[]} color="#3B82F6" detailed />
          ) : selectedTimeMetric ? (
            <LineGraphTimeD data={selectedTimeMetric.data} color="#3B82F6" />
          ) : selectedMacDMetric ? (
            <MACDMainChart data={selectedMacDMetric.data} />
          ) : null}
        </div>
        <button className="mt-4 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-semibold self-end transition-colors flex-shrink-0" onClick={closeModal}>
          Close
        </button>
      </Modal>
    </div>
  );
};

export default MetricsGrid;