import React,{useState} from 'react';
import MarketDepthChart from './MarketDepth';
import OrderBookCard from './OrderBookCard';
import HoldersChart from './HoldersChart';
import MACDChart from './MacD';
import RSIChart from './RSIChart';
import { CandleData, RawTradeData } from '@/app/types/TradingView';
import StochRSIChart from './StochRSI';
import Modal from "react-modal";
import HolderStatsCard from './HoldersPlot';
import MultiAddressLineChart from './MultipleLine';
import HoldingsChartProps from './HolderDistribution';
import { computeDerivatives, computeSynchronizedSellSignal,computeSellOffRiskScore,aggregateSRSByFiveMinutes,computeEMASRS,computeRSI,computeStochRSI} from '@/app/utils/holdersfunct';
import { Impression,SmoothingMethod,StochRSIOptions,HolderDataPoint,AnalysisResult,PlotDataByAddress,SellOffRisk,TimeSeriesOutput,HolderDerivatives,DerivativePoint,OrderData,CategoryHoldings } from "@/app/utils/app_types";
import SRSChart from './SellOffPlot';
type ChartView = 'rsi' | 'stoch' | 'holders';
type ChartTView = 'rsi2' | 'stoch2' | 'hodls' | 'holders2';
let theme = 'dark';
type ZoomReport = {
  totalpage: number;
  currentpage: number;
};
  interface OrderBookPanelProps {
    holders: OrderData[]; // Replace 'any' with the appropriate type
    live_prx: RawTradeData[]; // Replace 'any' with the appropriate type
    holderplot: HolderDataPoint[]// Replace 'any' with the appropriate type
    holderhistroy: HolderDataPoint[]; // Replace 'any' with the appropriate type
    plotdata: SellOffRisk[]
    price_plot: RawTradeData[];
    plotDistribution: CategoryHoldings
    plotHoldingCount: CategoryHoldings
    fetchOlderHoldingCount
    : (page: number,funtype:string) => Promise<ZoomReport>;
  }
  const OrderBookPanel: React.FC<OrderBookPanelProps> = ({
    holders,
    live_prx,
    holderplot,
    holderhistroy,
    plotdata,
    price_plot,
    plotDistribution,
    plotHoldingCount,
    fetchOlderHoldingCount
  }) => {
 // Chart toggles
 const [showMarketDepthModal, setShowMarketDepthModal] = useState(false);
 const [showHoldersModal, setShowHoldersModal] = useState(false);
 const [selectedView, setSelectedView] = useState<ChartView>('rsi');
 const [selectedTwoView, setSelectedTwoView] = useState<ChartTView>('rsi2');

 // Dynamic RSI/StochRSI settings
 const [rsiPeriod, setRsiPeriod] = useState<number>(9);
 const [rsiMethod, setRsiMethod] = useState<SmoothingMethod>('ema');
 const [stochPeriod, setStochPeriod] = useState<number>(9);
 const [smoothK, setSmoothK] = useState<number>(3);
 const [smoothD, setSmoothD] = useState<number>(4);
//console.log("holderhistroy",holderhistroy)
holderhistroy.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
holderplot.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
 const impressions = holderplot.map(point => ({ name: point.time, value: point.holders }));
 const impressionsx = holderhistroy.map(point => ({ name: point.time, value: point.holders }));
 const computedRSI = computeRSI(impressions, rsiPeriod, rsiMethod);
 const computedRSI2 = computeRSI(impressionsx, rsiPeriod, rsiMethod);
 const computedStochRSI = computeStochRSI(impressions, { rsiPeriod, stochPeriod, smoothK, smoothD });
 const computedStochRSI2 = computeStochRSI(impressionsx, { rsiPeriod, stochPeriod, smoothK, smoothD });
//const macDplot =computeDerivatives(plotdata)
const getLiquidity = (time: string) => 1_000_000_000;
//const srs_ =computeSellOffRiskScore(plotdata,getLiquidity,1)
//console.log("plotdata",plotdata)
const srs = aggregateSRSByFiveMinutes(plotdata,5)


    return (
      <div className="rounded-lg shadow-md p-4 w-full bg-gray-800">
        <h2 className="text-xl font-semibold mb-4 text-white">Order Book & Market Depth</h2>
        <div className="">
          {/* Order Book Card */}
          <OrderBookCard
            orders={holders}
            currentPrice={live_prx?.[0]?.close ?? 0}
            totalSupply={1000000000000}
          />
  
          {/* Market Depth Card */}
          <div className="h-[90%] md:w-auto cursor-pointer" onClick={() => setShowMarketDepthModal(true)}>
            <MarketDepthChart orderBookData={holders} livePriceData={live_prx} />
          </div>
        </div>
  
      {/* Chart Buttons */}
      <div className="flex space-x-2 mb-4">
        <button onClick={() => setSelectedView('rsi')} className={`px-3 py-1 rounded ${selectedView === 'rsi' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}>Holder RSI</button>
        <button onClick={() => setSelectedView('stoch')} className={`px-3 py-1 rounded ${selectedView === 'stoch' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}>Stoch RSI</button>
        <button onClick={() => setSelectedView('holders')} className={`px-3 py-1 rounded ${selectedView === 'holders' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}>Holder Distribution</button>
      </div>

      <div>
        {selectedView === 'rsi' && <RSIChart rsiData={computedRSI} title={`Holder RSI (Period=${rsiPeriod}, Method=${rsiMethod.toUpperCase()})`} theme="dark" />}
        {selectedView === 'stoch' && <StochRSIChart data={computedStochRSI} title={`Stoch RSI (RSIp=${rsiPeriod}, W=${stochPeriod}, K=${smoothK}, D=${smoothD})`} theme="dark" />}
        {selectedView === 'holders' && (
          <div className="cursor-pointer">
            <HoldersChart funtype='hldnum' data={holderplot} title="Token Holder Distribution" theme="dark" onZoomOrPan={async(page) => {
    const earliest = Object.keys(plotHoldingCount.whales).sort()[0];
   // if (start < earliest) {
    return await fetchOlderHoldingCount(page,'hldnum');
   // }
  }}/>
            
          </div>
        )}
      </div>
        {/* Settings Panel */}
      <div className="mb-4 p-3 bg-gray-700 rounded-lg">
        <h3 className="text-lg font-medium text-white mb-2">RSI & StochRSI Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* RSI Settings */}
          <div>
            <label className="block text-gray-200">RSI Period:</label>
            <input
              type="number"
              min="2"
              max="100"
              value={rsiPeriod}
              onChange={e => setRsiPeriod(Number(e.target.value))}
              className="w-full mt-1 p-1 rounded text-black"
            />
            <label className="block text-gray-200 mt-2">RSI Method:</label>
            <select
              value={rsiMethod}
              onChange={e => setRsiMethod(e.target.value as SmoothingMethod)}
              className="w-full mt-1 p-1 rounded text-black"
            >
              <option value="ema">EMA</option>
              <option value="wilder">Wilder</option>
              <option value="sma">SMA</option>
            </select>
          </div>

          {/* StochRSI Settings */}
          <div>
            <label className="block text-gray-200">Stoch Window:</label>
            <input
              type="number"
              min="2"
              max="100"
              value={stochPeriod}
              onChange={e => setStochPeriod(Number(e.target.value))}
              className="w-full mt-1 p-1 rounded text-black"
            />
            <label className="block text-gray-200 mt-2">Smooth %K:</label>
            <input
              type="number"
              min="1"
              max="20"
              value={smoothK}
              onChange={e => setSmoothK(Number(e.target.value))}
              className="w-full mt-1 p-1 rounded text-black"
            />
            <label className="block text-gray-200 mt-2">Smooth %D:</label>
            <input
              type="number"
              min="1"
              max="20"
              value={smoothD}
              onChange={e => setSmoothD(Number(e.target.value))}
              className="w-full mt-1 p-1 rounded text-black"
            />
          </div>
          
        </div>
         
      </div>
{/* Chart Buttons */}
<br/>
      <div className="flex space-x-2 mb-4">
        <button onClick={() => setSelectedTwoView('rsi2')} className={`px-3 py-1 rounded ${selectedTwoView === 'rsi2' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}>Holder DS</button>
        <button onClick={() => setSelectedTwoView('stoch2')} className={`px-3 py-1 rounded ${selectedTwoView === 'stoch2' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}> SRS</button>
        <button onClick={() => setSelectedTwoView('hodls')} className={`px-3 py-1 rounded ${selectedTwoView === 'hodls' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}> Holder count</button>
        <button onClick={() => setSelectedTwoView('holders2')} className={`px-3 py-1 rounded ${selectedTwoView === 'holders2' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}>Holder Distribution</button>
      </div>

      <div>
        {selectedTwoView === 'rsi2' && <HoldingsChartProps funtype='ds' holdings={plotDistribution} onZoomOrPan={async(page) => {
    const earliest = Object.keys(plotHoldingCount.whales).sort()[0];
    //console.log("earliest",start)
    //if (start < earliest) {
      return await fetchOlderHoldingCount(page,'ds');
    //}
  }}/>}
        {selectedTwoView === 'stoch2' && <SRSChart
        data={srs}
        showDetails={true}
        title="Real-Time Sell-Off Risk Analysis"
        darkMode={true} // toggle based on your theme system
        funtype='srs'
        onZoomOrPan={async(page) => {
          const earliest = Object.keys(plotHoldingCount.whales).sort()[0];
         // if (start < earliest) {
          return await fetchOlderHoldingCount(page,'srs');
         // }
        }}
      />}
       {selectedTwoView === 'hodls' && <HoldingsChartProps funtype='ct' holdings={plotHoldingCount} onZoomOrPan={async(page) => {
    const earliest = Object.keys(plotHoldingCount.whales).sort()[0];
   // if (start < earliest) {
    return await fetchOlderHoldingCount(page,'ct');
   // }
  }}/>}
        {selectedTwoView === 'holders2' && (
          <div className="cursor-pointer">
            <HoldersChart funtype='hldds' data={holderhistroy} title="Holder Amount Distribution" theme="dark" onZoomOrPan={async(page) => {
    const earliest = Object.keys(plotHoldingCount.whales).sort()[0];
   // if (start < earliest) {
    return await fetchOlderHoldingCount(page,'hldds');
   // }
  }}/>
          </div>
        )}
      </div>
      <div className="cursor-pointer">
          {/*<MultiAddressLineChart data={plotdata} />*/}
      </div>

      <div className="p-6 dark:bg-zinc-950">
      
    </div>
    <div className="p-6 dark:bg-zinc-950">
      
    </div>
        {/* Modals */}
        <Modal
          isOpen={showMarketDepthModal || showHoldersModal}
          onRequestClose={() => { setShowMarketDepthModal(false); setShowHoldersModal(false); }}
          contentLabel="Chart Popup"
          style={{
            content: {
              top: '0', left: '0', right: '0', bottom: '0',
              padding: '1rem', background: '#1F2937', border: 'none'
            },
            overlay: { backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000 }
          }}
        >
          {showMarketDepthModal && (
            <div className="h-full flex flex-col">
              <h2 className="text-2xl text-white mb-4">Market Depth</h2>
              <div className="flex-grow">
                <MarketDepthChart orderBookData={holders} livePriceData={live_prx} />
              </div>
              <button onClick={() => setShowMarketDepthModal(false)} className="mt-4 bg-gray-0 text-white py-2 px-4 rounded self-end">
                Close
              </button>
            </div>
          )}
          {showHoldersModal && (
            <div className="h-full flex flex-col">
              <h2 className="text-2xl text-white mb-4">Holder Distribution</h2>
              <div className="flex-grow">
                <HoldersChart funtype='hldnum' data={holderplot} title="Token Holder Distribution" theme="dark" />
              </div>
              <button onClick={() => setShowHoldersModal(false)} className="mt-4 bg-gray-0 text-white py-2 px-4 rounded self-end">
                Close
              </button>
            </div>
          )}
        </Modal>
      </div>
    );
  };
  
  export default OrderBookPanel;
  