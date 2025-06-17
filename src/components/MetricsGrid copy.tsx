//MetricGrid.tsx
import React, { JSX, useState, useEffect,ReactNode } from 'react';
import LineGraph from "./LineGraph";
import LineGraphTimeS from "./LineGraphTimeS"
import DLineGraph from './DetailedLineGraph';
import { NumberFormatter } from '@/app/utils/largeNumber';
import { QRCodeCanvas } from "qrcode.react"; // Ensure you install this package: npm install qrcode.react
import { CandleData, RawTradeData } from '@/app/types/TradingView';
import Modal from "react-modal";
import ReactDOM from "react-dom";
import LineGraphTimeD from "./LineGraphTimeD"
import BarGraph from './BarChar';
import BarGraph_Main from './BarChar_Main';

import MarketDepthChart from './MarketDepth';
import MACDChart from './MacD';
import RSIChart from './RSIChart';
import MACDMainChart from './MacDMain';
import { Signal as SignalIcon, Users as UsersIcon, Eye as EyeIcon } from 'lucide-react';
import { SmoothingMethod,StochRSIOptions,HolderDataPoint,AnalysisResult,PlotDataByAddress,SellOffRisk,TimeSeriesOutput,HolderDerivatives,DerivativePoint,Holder,CategoryHoldings,Impression ,MACDPoint,Engagement,MetricsBin,EngagementImpression,TimeSeriess,CompImpression,InfoBoxProps} from "@/app/utils/app_types";
import { parseViewsCount,calculateSentimentScore } from '@/app/utils/holdersfunct';
//import BarChartCard from './BarChartCard';
import dynamic from 'next/dynamic';

// Dynamically import BarChartCard with SSR disabled.
const BarChartCard = dynamic(() => import('./BarChartCard'), { ssr: false });
//Modal.setAppElement("#root");
 interface Props {
  children?: React.ReactNode;
}
type ZoomReport = {
  totalpage: number;
  currentpage: number;
};
 interface MetricGridProps {
  address: any;
  name: any;
  twitter: any;
  Frequency:{tweetFrequencyTrend: Impression[],tweetsWithAddressFrequency: Impression[];}
  Tweets:{tweetPerMinut: Impression[],tweetPerFVmints: Impression[],tweetsWithAddressCount: Impression[];}
  Values:{totalTweets: string;averagePercentage:number;averagePercentageFv: number;}
  SEI:{SEI_value: Impression[],SEI_Velocity:Impression[]}
  FOMO:{tweetFomo:Impression[],macd:MACDPoint[],RSIx:Impression[]}
  TweetImpression:{weighBasedImpression: Impression[],sentimentTrend:TimeSeriess[],EWMA_Value:Impression[]}
  Views:{tweetViewsPerFVmints:CompImpression[],tweetsWithAddressViews:CompImpression[],tweetViewsRatioPercentage:Impression[]}
  ViewsAlt:{avgViewsPerTweet:number,tweetwithAddAvgViews:number}
  HypeMeter:{sentiMeter:number,sentiMeterAddr:number;}
  holders: {amount: number;price: number; time:string}[]
  live_prx: RawTradeData[]
  fetchOlderHoldingCount
    : (page: number,funtype:string) => Promise<ZoomReport>;
}
 interface MetricCardProps {
  title: string;
  value: string;
  percentageChange: string;
  subText: string;
  graph: JSX.Element;
  isPositiveChange: boolean;
  onClick: () => void;
  toggleControls?: React.ReactNode; 
}
const ClientOnly: React.FC<Props> = ({ children }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <>{children}</>;
};
const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  percentageChange,
  subText,
  graph,
  isPositiveChange,
  onClick,
  toggleControls
}) => {
  return (
    <div className="bg-gray-900 text-white p-4 rounded-lg shadow-md">
      {toggleControls && (
        <div className="mb-2">
          {toggleControls}
        </div>
      )}
      <h3 className="text-sm text-gray-400 mb-1">{title}</h3>
      <div className="text-2xl font-bold mb-2">{value}</div>
      <div className={`text-sm ${isPositiveChange ? "text-green-400" : "text-red-400"}`}>
        {percentageChange}
      </div>
      <p className="text-xs text-gray-500 mt-1">{subText}</p>
      <div className="mt-4" onClick={onClick}>{graph}</div>
    </div>
  );
};


const InfoBox: React.FC<InfoBoxProps> = ({ title, value, icon }) => {
  return (
    <div className="bg-gray-700 rounded-lg p-4 shadow flex items-center">
      {icon && <div className="mr-4">{icon}</div>}
      <div>
        <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
        <p className="text-white text-xl font-bold">{value}</p>
      </div>
    </div>
  );
};

const MetricsGrid: React.FC<MetricGridProps> = ({ address, name, twitter, Frequency, Tweets,Values,SEI,FOMO,TweetImpression,Views,ViewsAlt,HypeMeter,holders,live_prx,fetchOlderHoldingCount}) => {
  let twt = `https://x.com/search?q=${address}`;
  if (twitter != null) {
    twt = twitter;
  }
  //console.log("Tweets",SEI)
  const [activeTweetMetric, setActiveTweetMetric] = useState<'frequency' | 'address'>('frequency');
  const [activeCallerMetric, setActiveCallerMetric] = useState<'min' | 'fiveMin' | 'address'>('min');
  const [activeImpressionMetric, setActiveImpressionMetric] = useState<'growth' | 'volatility' | 'peaks'>('growth');
  const [activeEngagementMetric, setActiveEngagementMetric] = useState<'growth' | 'peaks'>('growth');
  const [activeFomoMetric, setActiveFomoMetric] = useState<'growth' | 'peaks' | 'macd'>('growth');
  const [activeViewsMetric, setActiveViewsMetric] = useState<'average' | 'address' | 'ratio'>('average');
  const [showMarketDepthModal, setShowMarketDepthModal] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<{ title: string; data: Impression[] | null } | null>(null);
    const [selectedRSIMetric, setSelectedRSIMetric] = useState<{ title: string; data: Impression[] | null } | null>(null);
    //setSelectedRSIMetric
    const [selectedTimeMetric, setSelectedTimeMetric] = useState<{ title: string; data: TimeSeriess[] | null } | null>(null);
    const [selectedMacDMetric, setSelectedMacDMetric] = useState<{ title: string; data: MACDPoint[] | null } | null>(null);
    const [selectedbarMetric, setSelectedbarMetric] = useState<{ title: string; data: Impression[] | null } | null>(null);
    const totalTweetsWithAddress = Tweets.tweetsWithAddressCount.reduce(
      (sum, { value }) => sum + value,
      0
    );
  const openPopup = (title: string, data: Impression[]) => {
    setSelectedMetric({ title, data });
  };
  const openPopupTime = (title: string, data: TimeSeriess[]) => {
    setSelectedTimeMetric({ title, data });
  };
  const openPopupMacD = (title: string, data: MACDPoint[]) => {
    setSelectedMacDMetric({ title, data });
  };
  const openPopupRSI = (title: string, data: Impression[]) => {
    setSelectedRSIMetric({ title, data });
  };
  const openPopupBar = (title: string, data: Impression[]) => {
    setSelectedbarMetric({ title, data });
  };

  const closePopup = () => {
    setSelectedMetric(null);
    setSelectedTimeMetric(null);
    setSelectedbarMetric(null);
    setSelectedMacDMetric(null)
    setSelectedRSIMetric(null)
  };

  useEffect(() => {
    Modal.setAppElement("#root");
  }, []);
  
  const downloadDataAsCSV = () => {
    let csvContent = "";

    // Helper to escape CSV values (handles commas, quotes, newlines)
    const escapeCsvValue = (value: string): string => {
        if (/[",\n]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    };

    // Helper to add a dataset to the CSV string
    const addSection = (title: string, headers: string[], data: any[], rowFormatter: (item: any) => string[]) => {
        csvContent += `${escapeCsvValue(title)}\n`;
        csvContent += headers.map(escapeCsvValue).join(',') + '\n';
        data.forEach(item => {
            csvContent += rowFormatter(item).map(escapeCsvValue).join(',') + '\n';
        });
        csvContent += '\n'; // Add a blank line separator
    };

    // Add each dataset used in the plots, ensuring numbers are converted to strings
    addSection(
        "Tweet Frequency Trend (%)",
        ["Timestamp", "Value"],
        Frequency.tweetFrequencyTrend,
        (item: Impression) => [item.name, String(item.value)]
    );

    addSection(
        "Tweet w/ Address Frequency (%)",
        ["Timestamp", "Value"],
        Frequency.tweetsWithAddressFrequency,
        (item: Impression) => [item.name, String(item.value)]
    );

    addSection(
        "Callers/min (Raw)",
        ["Timestamp", "Value"],
        Tweets.tweetPerMinut,
        (item: Impression) => [item.name, String(item.value)]
    );

    addSection(
        "Callers/5min (Grouped)",
        ["Timestamp", "Value"],
        Tweets.tweetPerFVmints,
        (item: Impression) => [item.name, String(item.value)]
    );

     addSection(
        "Tweets w/ Address Count (5min Grouped)",
        ["Timestamp", "Count"],
        Tweets.tweetsWithAddressCount,
        (item: Impression) => [item.name, String(item.value)]
    );

    

    addSection(
        "Sentiment Trend (Smoothed)",
        ["Timestamp", "Aggregated Sentiment"],
        TweetImpression.sentimentTrend,
        (item: TimeSeriess) => [item.time, String(item.aggregatedSentiment)]
    );

    

    addSection(
        "Average Views/Tweet (5min Grouped)",
        ["Timestamp", "Current Views", "Previous Views (Count)"],
        Views.tweetViewsPerFVmints,
        (item: CompImpression) => [item.name, String(item.value), String(item.preval)]
    );

    addSection(
        "Views for Tweets w/ Address (5min Grouped)",
         ["Timestamp", "Aggregated Views", "Tweet Count"],
        Views.tweetsWithAddressViews,
        (item: CompImpression) => [item.name, String(item.value), String(item.preval)]
    );

    addSection(
        "AvgTweetMade/AvgViews (Cumulative Ratio %)",
        ["Timestamp", "Ratio (%)"],
        Views.tweetViewsRatioPercentage,
        (item: Impression) => [item.name, String(item.value)]
    );

    

    // Create blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const safeAddress = address?.replace(/[^a-z0-9]/gi, '_') || 'unknown_address';
    link.setAttribute("download", `metrics_data_${safeAddress}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper component for toggle buttons
  const ToggleButton = ({ 
    active, 
    onClick, 
    children 
  }: { 
    active: boolean; 
    onClick: () => void; 
    children: React.ReactNode 
  }) => (
    <button
      className={`px-2 py-1 text-xs rounded-md transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );

  // Render metric cards based on active toggles
  const renderTweetFrequencyCard = () => {
    if (activeTweetMetric === 'frequency') {
      return (
        <MetricCard
          title="Tweet Frequency Trend (%)"
          value={Frequency.tweetFrequencyTrend.length > 0 ? Frequency.tweetFrequencyTrend[Frequency.tweetFrequencyTrend.length - 1].value.toFixed(2) + "%" : "0%"}
          percentageChange=""
          subText="Frequency of tweets over time"
          isPositiveChange={Frequency.tweetFrequencyTrend.length > 0 && Frequency.tweetFrequencyTrend[Frequency.tweetFrequencyTrend.length - 1].value > 0}
          graph={<LineGraph data={Frequency.tweetFrequencyTrend} color="#10B981" funtype='twtft' onZoomOrPan={async(page) => {
            
           // if (start < earliest) {
            return await fetchOlderHoldingCount(page,'twtft');
           // }
          }}/>}
          onClick={() => openPopup("Tweet Frequency Trend", Frequency.tweetFrequencyTrend)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={true} onClick={() => setActiveTweetMetric('frequency')}>
                Frequency
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveTweetMetric('address')}>
                Address
              </ToggleButton>
            </div>
          }
        />
      );
    } else {
      return (
        <MetricCard
          title="Tweet w/ Address Frequency (%)"
          value={
            Frequency.tweetsWithAddressFrequency.length > 0
              ? Frequency.tweetsWithAddressFrequency[Frequency.tweetsWithAddressFrequency.length - 1].value.toFixed(2) + "%"
              : "0%"
          }
          percentageChange=""
          subText="Frequency trend for tweets with address"
          isPositiveChange={
            Frequency.tweetsWithAddressFrequency.length > 0 &&
            Frequency.tweetsWithAddressFrequency[Frequency.tweetsWithAddressFrequency.length - 1].value > 0
          }
          graph={<LineGraph data={Frequency.tweetsWithAddressFrequency} color="#34D399" funtype='twtft' onZoomOrPan={async(page) => {
            
            // if (start < earliest) {
             return await fetchOlderHoldingCount(page,'twtft');
            // }
           }} />}
          onClick={() => openPopup("Tweet w/ Address Frequency", Frequency.tweetsWithAddressFrequency)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveTweetMetric('frequency')}>
                Frequency
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveTweetMetric('address')}>
                Address
              </ToggleButton>
            </div>
          }
        />
      );
    }
  };

  const renderCallersCard = () => {
    if (activeCallerMetric === 'min') {
      return (
        <MetricCard
          title="Callers/min (Avg.)"
          value={Values.totalTweets}
          percentageChange={(Values.averagePercentage > 0 ? "+" : "") + Values.averagePercentage.toFixed(2) + "%"}
          subText={Values.averagePercentage.toFixed(2) + (Values.averagePercentage > 0 ? " Increase" : " Decrease") + " in tweets/min"}
          isPositiveChange={Values.averagePercentage > 0}
          graph={<LineGraph data={Tweets.tweetPerMinut} color="#10B981" funtype='twt' onZoomOrPan={async(page) => {
            
            // if (start < earliest) {
             return await fetchOlderHoldingCount(page,'twt');
            // }
           }} />}
          onClick={() => openPopup("Callers/min (Avg.)", Tweets.tweetPerMinut)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={true} onClick={() => setActiveCallerMetric('min')}>
                Per Min
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('fiveMin')}>
                Per 5 Min
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('address')}>
                With Address
              </ToggleButton>
            </div>
          }
        />
      );
    } else if (activeCallerMetric === 'fiveMin') {
      return (
        <MetricCard
          title="Callers/5min (Avg.)"
          value={Values.totalTweets}
          percentageChange={(Values.averagePercentageFv > 0 ? "+" : "") + Values.averagePercentageFv.toFixed(2) + "%"}
          subText={Values.averagePercentageFv.toFixed(2) + (Values.averagePercentageFv > 0 ? " Increase" : " Decrease") + " in tweets/5min"}
          isPositiveChange={Values.averagePercentageFv > 0}
          graph={<LineGraph data={Tweets.tweetPerFVmints} color="#10B981" funtype='twt' onZoomOrPan={async(page) => {
            
            // if (start < earliest) {
             return await fetchOlderHoldingCount(page,'twt');
            // }
           }} />}
          onClick={() => openPopup("Callers/5min (Avg.)", Tweets.tweetPerFVmints)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('min')}>
                Per Min
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveCallerMetric('fiveMin')}>
                Per 5 Min
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('address')}>
                With Address
              </ToggleButton>
            </div>
          }
        />
      );
    } else {
      return (
        <MetricCard
          title="Tweets w/ Address (5min Count)"
          value={totalTweetsWithAddress.toString()}
          percentageChange=""
          subText="Number of tweets with address per 5 minutes"
          isPositiveChange={
            Tweets.tweetsWithAddressCount.length > 0 &&
            Tweets.tweetsWithAddressCount[Tweets.tweetsWithAddressCount.length - 1].value > 0
          }
          graph={<LineGraph data={Tweets.tweetsWithAddressCount} color="#60A5FA" funtype='twt' onZoomOrPan={async(page) => {
            
            // if (start < earliest) {
             return await fetchOlderHoldingCount(page,'twt');
            // }
           }} />}
          onClick={() => openPopup("Tweets w/ Address Count", Tweets.tweetsWithAddressCount)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('min')}>
                Per Min
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveCallerMetric('fiveMin')}>
                Per 5 Min
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveCallerMetric('address')}>
                With Address
              </ToggleButton>
            </div>
          }
        />
      );
    }
  };
  const renderEngagementCard = () => {
    if (activeEngagementMetric === 'growth') {
      //const latestSEI = Array.isArray(SEI_value) && SEI_value.length > 0 ? SEI_value[SEI_value.length - 1] : null;
      //  const latestValue = latestSEI && typeof latestSEI.value === 'number' ? latestSEI.value : null;
     // if (SEI.SEI_value.length > 0) {
      const lastSEIValue = SEI?.SEI_value?.length
      ? SEI.SEI_value[SEI.SEI_value.length - 1]?.value
      : null;
      return (
        <MetricCard
        title="Social Engagement Index"
        value={lastSEIValue !== null && lastSEIValue !== undefined
          ? `${lastSEIValue.toFixed(2)}%`
          : 'N/A'}
        percentageChange={
          lastSEIValue !== null && lastSEIValue !== undefined
            ? `${lastSEIValue >= 0 ? '+' : ''}${lastSEIValue.toFixed(2)}%`
            : 'N/A'
        }
        subText="Avg. impressions per minute interval"
        isPositiveChange={lastSEIValue !== null && lastSEIValue !== undefined
          ? lastSEIValue >= 0
          : false}
          graph={<BarGraph_Main data={SEI.SEI_value || []}  />}
          onClick={() => openPopupBar("Engagement Rate", SEI.SEI_value)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={true} onClick={() => setActiveEngagementMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveEngagementMetric('peaks')}>
                Velocity
              </ToggleButton>
            </div>
          }
        />

      );//}
    } else {
      //if (SEI.SEI_Velocity.length > 0) {
        const latestValue =
        SEI?.SEI_Velocity?.length > 0
          ? SEI.SEI_Velocity[SEI.SEI_Velocity.length - 1]?.value
          : null;
      
      return(
        <MetricCard
        title="Velocity Rate"
        value={latestValue !== null && latestValue !== undefined
          ? `${latestValue.toFixed(2)}%`
          : 'N/A'}
        percentageChange={
          latestValue !== null && latestValue !== undefined
            ? `${latestValue >= 0 ? '+' : ''}${latestValue.toFixed(2)}%`
            : 'N/A'
        }
        subText="Velocity rate analysis"
        isPositiveChange={
          latestValue !== null && latestValue !== undefined
            ? latestValue > 0
            : false
        }
          graph={<LineGraph data={SEI.SEI_Velocity} color="#8B5CF6" funtype='vlcrt' onZoomOrPan={async(page) => {
            
            // if (start < earliest) {
             return await fetchOlderHoldingCount(page,'vlcrt');
            // }
           }} />}
          onClick={() => openPopup("Engagement Rate", SEI.SEI_Velocity)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveEngagementMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveEngagementMetric('peaks')}>
                Velocity
              </ToggleButton>
              
            </div>
          }
        />
      );
   // }
    }
  }
  const renderFomoCard = () => {
    if (activeFomoMetric === 'growth') {
      if (FOMO.tweetFomo.length > 0) {
        const lastValue = FOMO.tweetFomo[FOMO.tweetFomo.length - 1].value;
      return (
        <MetricCard
          title="Fomo Growth"
          value={
            isNaN(lastValue) || lastValue == null
              ? "0%"
              : `${lastValue.toFixed(2)}%`
          }
          percentageChange={
            isNaN(lastValue) || lastValue == null
              ? "0%"
              : `${lastValue >= 0 ? "+" : ""}${lastValue.toFixed(2)}%`
          }
          subText={
            isNaN(lastValue) || lastValue == null
              ? "0% change in impressions"
              : `${lastValue.toFixed(2)}% change in impressions`
          }
          isPositiveChange={!!(lastValue != null && lastValue >= 0)}
          graph={<LineGraph data={FOMO.tweetFomo} color="#8B5CF6" funtype='fmgwt' onZoomOrPan={async(page) => {
            
            // if (start < earliest) {
             return await fetchOlderHoldingCount(page,'fmgwt');
            // }
           }}/>}
          onClick={() => openPopup("Fomo Growth", FOMO.tweetFomo)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={true} onClick={() => setActiveFomoMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('macd')}>
                MacD
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('peaks')}>
              Velocity
              </ToggleButton>
              
            </div>
          }
        />
      );
    }
    } else if (activeFomoMetric === 'macd') {
      if (FOMO.macd.length > 0) {
        const lastValue = FOMO.macd[FOMO.macd.length - 1].macd;
      return (
        <MetricCard
          title="MACD Growth"
          value={
            isNaN(lastValue) || lastValue == null
              ? "0%"
              : `${lastValue.toFixed(2)}%`
          }
          percentageChange={
            isNaN(lastValue) || lastValue == null
              ? "0%"
              : `${lastValue >= 0 ? "+" : ""}${lastValue.toFixed(2)}%`
          }
          subText={
            isNaN(lastValue) || lastValue == null
              ? "0% change in impressions"
              : `${lastValue.toFixed(2)}% change in impressions`
          }
          isPositiveChange={!!(lastValue != null && lastValue >= 0)}
          graph={<MACDChart data={FOMO.macd} />}
          onClick={() => openPopupMacD("MACD Growth", FOMO.macd)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveFomoMetric('macd')}>
                MacD
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('peaks')}>
              Velocity
              </ToggleButton>
              
            </div>
          }
        />
      );
    }
    } else {
      if (FOMO.RSIx.length > 0) {
        const lastValue = FOMO.RSIx[FOMO.RSIx.length - 1].value;
      return(
        <MetricCard
          title="FOMO Index"
          value={
            isNaN(lastValue) || lastValue == null
              ? "0%"
              : `${lastValue.toFixed(2)}%`
          }
          percentageChange={
            isNaN(lastValue) || lastValue == null
              ? "0%"
              : `${lastValue >= 0 ? "+" : ""}${lastValue.toFixed(2)}%`
          }
          subText={
            isNaN(lastValue) || lastValue == null
              ? "0% change in impressions"
              : `${lastValue.toFixed(2)}% change in impressions`
          }
          isPositiveChange={!!(lastValue != null && lastValue >= 0)}
          graph={<RSIChart rsiData={FOMO.RSIx} color="#8B5CF6" />}
          onClick={() => openPopupRSI("Engagement Rate", FOMO.RSIx)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveFomoMetric('macd')}>
                MacD
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveFomoMetric('peaks')}>
                Velocity
              </ToggleButton>
              
            </div>
          }
        />
      );
    }
    }
  }
  const renderImpressionCard = () => {
    if (activeImpressionMetric === 'growth') {
      // Determine which impression growth card to show
      if (TweetImpression.weighBasedImpression.length > 0) {
        const lastValue =
  TweetImpression.weighBasedImpression?.length &&
  TweetImpression.weighBasedImpression[TweetImpression.weighBasedImpression.length - 1]?.value;
       // console.log("Wated Impression",TweetImpression.weighBasedImpression)
        return (
          <MetricCard
          title="Impression Growth"
          value={
            isNaN(lastValue) || lastValue == null
              ? "0%"
              : `${lastValue.toFixed(2)}%`
          }
          percentageChange={
            isNaN(lastValue) || lastValue == null
              ? "0%"
              : `${lastValue >= 0 ? "+" : ""}${lastValue.toFixed(2)}%`
          }
          subText={
            isNaN(lastValue) || lastValue == null
              ? "0% change in impressions"
              : `${lastValue.toFixed(2)}% change in impressions`
          }
          isPositiveChange={!!(lastValue != null && lastValue >= 0)}
            graph={<LineGraph data={TweetImpression.weighBasedImpression} color="#10B981" funtype='impgrw' onZoomOrPan={async(page) => {
            
              // if (start < earliest) {
               return await fetchOlderHoldingCount(page,'impgrw');
              // }
             }} />}
            onClick={() => openPopup("Impression Growth", TweetImpression.weighBasedImpression)}
            toggleControls={
              <div className="flex space-x-2 mb-2">
                <ToggleButton active={true} onClick={() => setActiveImpressionMetric('growth')}>
                  Growth
                </ToggleButton>
                <ToggleButton active={false} onClick={() => setActiveImpressionMetric('volatility')}>
                  Volatility
                </ToggleButton>
                <ToggleButton active={false} onClick={() => setActiveImpressionMetric('peaks')}>
                  Peaks
                </ToggleButton>
              </div>
            }
          />
        );
      } //else {
        
      //}
    } else if (activeImpressionMetric === 'volatility') {
      if (TweetImpression.sentimentTrend.length > 0) {
       // const latestValue = FOMO.tweetFomo[FOMO.tweetFomo.length - 1].value;
      return (
        <MetricCard
          title="Sentiment Volatility"
          value={TweetImpression.sentimentTrend?.[TweetImpression.sentimentTrend.length-1].aggregatedSentiment.toFixed(2)}
          percentageChange="Variability"
          subText="Variability in sentiment over time"
          isPositiveChange={TweetImpression.sentimentTrend?.[TweetImpression.sentimentTrend.length-1].aggregatedSentiment < 1}
          graph={<LineGraphTimeS data={TweetImpression.sentimentTrend} color="#F59E0B" />}
          onClick={() => openPopupTime("Sentiment Volatility", TweetImpression.sentimentTrend)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveImpressionMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveImpressionMetric('volatility')}>
                Volatility
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveImpressionMetric('peaks')}>
                Peaks
              </ToggleButton>
            </div>
          }
        />
      );}
    } else {
     // if (FOMO.tweetFomo.length > 0) {
        //const latestValue = FOMO.tweetFomo[FOMO.tweetFomo.length - 1].value;
        const lastEWMAValue =
  TweetImpression.EWMA_Value?.length &&
  TweetImpression.EWMA_Value[TweetImpression.EWMA_Value.length - 1]?.value;

      return (
        <MetricCard
        title="Peak Sentiments"
        value={lastEWMAValue != null ? lastEWMAValue.toFixed(2) : "0"}
        percentageChange="Detected Peaks"
        subText="Number of sentiment peaks detected"
        isPositiveChange={lastEWMAValue != null && lastEWMAValue > 0}
          graph={<LineGraph data={TweetImpression.EWMA_Value} color="#EF4444" funtype='impgrw' onZoomOrPan={async(page) => {
            
            // if (start < earliest) {
             return await fetchOlderHoldingCount(page,'impgrw');
            // }
           }} />}
          onClick={() => openPopup("Peak Sentiments",TweetImpression.EWMA_Value)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveImpressionMetric('growth')}>
                Growth
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveImpressionMetric('volatility')}>
                Volatility
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveImpressionMetric('peaks')}>
                Peaks
              </ToggleButton>
            </div>
          }
        />
      );//}
    }
  };

  const renderViewsCard = () => {
    if (activeViewsMetric === 'average') {
      return (
        <MetricCard
          title="Avg. Views/Tweet"
          value={NumberFormatter.formatNumber(Number(ViewsAlt.avgViewsPerTweet.toFixed(2)))}
          percentageChange=""
          subText="Overall average views per tweet"
          isPositiveChange={ViewsAlt.avgViewsPerTweet >= 0}
          graph={<BarGraph data={Views.tweetViewsPerFVmints}/>}
          onClick={() => openPopupBar("Average Views/Tweet", Views.tweetViewsPerFVmints)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={true} onClick={() => setActiveViewsMetric('average')}>
                Average
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('address')}>
                With Address
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('ratio')}>
                Ratio
              </ToggleButton>
            </div>
          }
        />
      );
    } else if (activeViewsMetric === 'address') {
      return (
        <MetricCard
          title="Views for Tweets w/ Address (5min)"
          value={NumberFormatter.formatNumber(Number(ViewsAlt.tweetwithAddAvgViews.toFixed(2)))}
          percentageChange=""
          subText="Aggregated views per 5 minutes for tweets with address"
          isPositiveChange={
            Views.tweetsWithAddressViews.length > 0 &&
            Views.tweetsWithAddressViews[Views.tweetsWithAddressViews.length - 1].value > 0
          }
          graph={<BarGraph data={Views.tweetsWithAddressViews}  />}
          onClick={() => openPopupBar("Views for Tweets w/ Address", Views.tweetsWithAddressViews)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('average')}>
                Average
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveViewsMetric('address')}>
                With Address
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('ratio')}>
                Ratio
              </ToggleButton>
            </div>
          }
        />
      );
    } else {
      return (
        <MetricCard
          title="AvgTweetMade/AvgViews"
          value={NumberFormatter.formatNumber(Number(((Number(parseViewsCount(Values.totalTweets))/ViewsAlt.avgViewsPerTweet)*100).toFixed(2)))}
          percentageChange=""
          subText="Overall Interest of callers"
          isPositiveChange={ViewsAlt.avgViewsPerTweet >= 0}
          graph={<LineGraph data={Views.tweetViewsRatioPercentage} color="#3B82F6" funtype='avtwavvw' onZoomOrPan={async(page) => {
            
            // if (start < earliest) {
             return await fetchOlderHoldingCount(page,'avtwavvw');
            // }
           }}/>}
          onClick={() => openPopup("Average Views/Tweet", Views.tweetViewsRatioPercentage)}
          toggleControls={
            <div className="flex space-x-2 mb-2">
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('average')}>
                Average
              </ToggleButton>
              <ToggleButton active={false} onClick={() => setActiveViewsMetric('address')}>
                With Address
              </ToggleButton>
              <ToggleButton active={true} onClick={() => setActiveViewsMetric('ratio')}>
                Ratio
              </ToggleButton>
            </div>
          }
        />
      );
    }
  };

  return (
    <div className="bg-gray-800 text-white rounded-lg p-4 shadow-lg w-full">
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
      
      <div className="mb-4">
        <button
          onClick={downloadDataAsCSV}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-bold text-center transition duration-150 ease-in-out"
        >
          Download Plot Data (CSV)
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {renderTweetFrequencyCard()}
        {renderCallersCard()}
        {renderImpressionCard()}
        {renderViewsCard()}
        {renderEngagementCard()}
        {renderFomoCard()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        
        
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoBox 
          title="Holders" 
          value={NumberFormatter.formatNumber(holders.length)} 
          icon={<UsersIcon className="h-6 w-6 text-blue-400" />} 
        />
        <InfoBox 
          title="Tweet Views" 
          value={NumberFormatter.formatNumber(Math.round(ViewsAlt.avgViewsPerTweet))} 
          icon={<EyeIcon className="h-6 w-6 text-green-400" />} 
        />
        <InfoBox 
          title="Live PRX" 
          value={NumberFormatter.formatNumber(live_prx.length)} 
          icon={<SignalIcon className="h-6 w-6 text-purple-400" />} 
        />
      </div>
      <div className="flex flex-col justify-center items-center h-screen">
        <h1>Hype Meter</h1>
        <SentimentMeter score={HypeMeter.sentiMeter} />
        <h1>Hype Meter For Address</h1>
        <SentimentMeter score={HypeMeter.sentiMeterAddr} />
      </div>
      {/* Modal for Market Depth Chart Popup */}
      <Modal
        isOpen={showMarketDepthModal}
        onRequestClose={() => setShowMarketDepthModal(false)}
        contentLabel="Market Depth Popup"
        style={{
          content: {
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            padding: '1rem',
            background: '#1F2937', // Tailwind gray-800 color
            border: 'none'
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 1000
          }
        }}
      >
        <div className="h-full flex flex-col">
          <h2 className="text-2xl text-white mb-4">Market Depth</h2>
          <div className="flex-grow">
            <MarketDepthChart
              orderBookData={holders}
              livePriceData={live_prx}
            />
          </div>
          <button
            onClick={() => setShowMarketDepthModal(false)}
            className="mt-4 bg-gray-700 text-white py-2 px-4 rounded self-end"
          >
            Close
          </button>
        </div>
      </Modal>
      <Modal
        isOpen={!!selectedMetric || !!selectedTimeMetric || !!selectedbarMetric || !!selectedMacDMetric || !!selectedRSIMetric}
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
        ) || selectedbarMetric && (
          <>
            <h3 className="text-xl font-bold mb-4">{selectedbarMetric.title}</h3>
            <BarGraph_Main data={selectedbarMetric.data || []}/>
            <button
              className="mt-6 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
              onClick={closePopup}
            >
              Close
            </button>
          </>
        ) || selectedMacDMetric && (
          <>
            <h3 className="text-xl font-bold mb-4">{selectedMacDMetric.title}</h3>
            <MACDMainChart data={selectedMacDMetric.data || []}/>
            <button
              className="mt-6 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
              onClick={closePopup}
            >
              Close
            </button>
          </>
        ) || selectedRSIMetric && (
          <>
            <h3 className="text-xl font-bold mb-4">{selectedRSIMetric.title}</h3>
            <RSIChart rsiData={selectedRSIMetric.data || []}/>
            <button
              className="mt-6 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
              onClick={closePopup}
            >
              Close
            </button>
          </>
        )
        
        }
      </Modal>
     
    </div>
  );
};

export default MetricsGrid;

interface SentimentMeterProps {
  score: number; // Value between 0 and 100
}
const SentimentMeter: React.FC<SentimentMeterProps> = ({ score }) => {
  // Determine color based on score
  const getColor = (score: number) => {
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
    <div className="relative w-60 h-60">
      <svg viewBox="0 0 100 60" className="w-full h-full">
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
      <div className="absolute bottom-0 left-0 right-0 text-center text-sm font-bold">
        {score < 25 ? "Extreme Fear" : 
         score < 50 ? "Fear" : 
         score < 75 ? "Greed" : "Extreme Greed"}
        <div className="text-sm font-bold">{score.toFixed(0)}</div>
      </div>
    </div>
  );
};
