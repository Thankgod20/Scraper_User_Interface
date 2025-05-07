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
interface OrderData {
    amount: number;
    time: string;
    price: number;
  }
  interface HolderDataPoint {
    holders: number;
    time: string;
  }
interface Impression {
  name:  string;
  value: number;
}
type HistoryEntry = { 
  amount: number;
  time: string;
};
 type PlotDataByAddress = {
  address: string;
  data: { time: string; amount: number }[];
};
type ChartView = 'rsi' | 'stoch' | 'holders';
type ChartTView = 'rsi2' | 'stoch2' | 'holders2';
let theme = 'dark';
  interface OrderBookPanelProps {
    holders: OrderData[]; // Replace 'any' with the appropriate type
    live_prx: RawTradeData[]; // Replace 'any' with the appropriate type
    holderplot: HolderDataPoint[]// Replace 'any' with the appropriate type
    holderhistroy: HolderDataPoint[]; // Replace 'any' with the appropriate type
    plotdata: PlotDataByAddress[]
  }
  
  type SmoothingMethod = 'wilder' | 'ema' | 'sma';

  function computeRSI(
    data: Impression[],
    period = 14,
    method: SmoothingMethod = 'ema'
  ): Impression[] {
    const rsiPoints: Impression[] = [];
    if (data.length < period + 1) return rsiPoints;
  
    // 1. compute raw gains/losses
    const gains: number[] = [0], losses: number[] = [0];
    for (let i = 1; i < data.length; i++) {
      const change = data[i].value - data[i - 1].value;
      gains[i]  = Math.max(change, 0);
      losses[i] = Math.max(-change, 0);
    }
  
    // 2. initial averages (SMA)
    let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  
    // 3. helper EMA α
    const alpha = method === 'ema' ? 2 / (period + 1) : 1 / period;
  
    // 4. first RSI value
    let rs   = avgGain / avgLoss;
    rsiPoints.push({
      name: data[period].name,
      value: 100 - (100 / (1 + rs)),
    });
  
    // 5. subsequent values with chosen smoothing
    for (let i = period + 1; i < data.length; i++) {
      if (method === 'wilder') {
        // Wilder smoothing: α = 1/period
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      } else if (method === 'ema') {
        // Standard EMA smoothing: α = 2/(period+1)
        avgGain = alpha * gains[i] + (1 - alpha) * avgGain;
        avgLoss = alpha * losses[i] + (1 - alpha) * avgLoss;
      } else { // 'sma'
        // Rolling SMA: drop old, include new
        avgGain = (avgGain * period - gains[i - period] + gains[i]) / period;
        avgLoss = (avgLoss * period - losses[i - period] + losses[i]) / period;
      }
  
      rs = avgGain / avgLoss;
      rsiPoints.push({
        name: data[i].name,
        value: 100 - (100 / (1 + rs)),
      });
    }
  
    return rsiPoints;
  }
  
    
    
    interface StochRSIOptions {
      rsiPeriod?: number;      // look-back for base RSI (default 14)
      stochPeriod?: number;    // look-back for stochastic window (default 14)
      smoothK?: number;        // smoothing for %K (default 3)
      smoothD?: number;        // smoothing for %D (default 3), if undefined no %D
    }
    
    /**
     * Compute Wilder-smoothed RSI
     */
    function computeRSIS(
      data: Impression[],
      period = 14
    ): number[] {
      const rsi: number[] = [];
      if (data.length < period + 1) return rsi;
    
      const gains: number[] = [0];
      const losses: number[] = [0];
      for (let i = 1; i < data.length; i++) {
        const change = data[i].value - data[i - 1].value;
        gains.push(Math.max(change, 0));
        losses.push(Math.max(-change, 0));
      }
    
      let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
      let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    
      // first RSI value at index = period
      rsi[period] = avgLoss === 0 
        ? 100 
        : avgGain === 0 
        ? 0 
        : 100 - 100 / (1 + avgGain / avgLoss);
    
      for (let i = period + 1; i < data.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        rsi[i] = avgLoss === 0 
          ? 100 
          : avgGain === 0 
          ? 0 
          : 100 - 100 / (1 + avgGain / avgLoss);
      }
    
      return rsi;
    }
    
    /**
     * Compute Stochastic RSI (%K and optional %D)
     */
    function computeStochRSI(
      data: Impression[],
      {
        rsiPeriod   = 14,
        stochPeriod = 14,
        smoothK     = 3,
        smoothD = 4,
      }: StochRSIOptions = {}
    ): Array<{ name: string; k: number; d?: number }> {
      // 1. get base RSI series
      const rsi = computeRSIS(data, rsiPeriod);
      const result: Array<{ name: string; k: number; d?: number }> = [];
    
      if (rsi.length === 0) return result;
    
      // helper to SMA-smooth an array
      const smooth = (arr: number[], period: number): number[] => {
        const out: number[] = [];
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          sum += arr[i];
          if (i >= period) {
            sum -= arr[i - period];
          }
          if (i >= period - 1) {
            out[i] = sum / period;
          }
        }
        return out;
      };
    
      // 2. compute raw %K
      const rawK: number[] = [];
      for (let i = 0; i < rsi.length; i++) {
        if (i < stochPeriod - 1) {
          rawK[i] = NaN;
        } else {
          const window = rsi.slice(i - (stochPeriod - 1), i + 1);
          const minR = Math.min(...window);
          const maxR = Math.max(...window);
          rawK[i] = maxR === minR
            ? 50
            : ((rsi[i] - minR) / (maxR - minR)) * 100;
        }
      }
    
      // 3. smooth %K if requested
      const smoothedK = smoothK > 1 ? smooth(rawK.filter(v => !isNaN(v)), smoothK) : rawK;
    
      // 4. smooth %D if requested
      let smoothedD: number[] | undefined;
      if (typeof smoothD === 'number' && smoothD > 1) {
        smoothedD = smooth(smoothedK.slice(stochPeriod - 1), smoothD);
      }
    
      // 5. assemble output aligning with original data
      for (let i = 0; i < data.length; i++) {
        const kVal = smoothedK[i - (stochPeriod - 1)] ?? rawK[i];
        const dVal = smoothedD ? smoothedD[i - (stochPeriod - 1) - (smoothD - 1)] : undefined;
        if (!isNaN(kVal) && kVal !== undefined) {
          result.push({
            name: data[i].name,
            k: Math.min(100, Math.max(0, kVal)),
            d: dVal !== undefined ? Math.min(100, Math.max(0, dVal)) : undefined,
          });
        }
      }
    
      return result;
    }
    
  const OrderBookPanel: React.FC<OrderBookPanelProps> = ({
    holders,
    live_prx,
    holderplot,
    holderhistroy,
    plotdata
  }) => {
 // Chart toggles
 const [showMarketDepthModal, setShowMarketDepthModal] = useState(false);
 const [showHoldersModal, setShowHoldersModal] = useState(false);
 const [selectedView, setSelectedView] = useState<ChartView>('rsi');
 const [selectedTwoView, setSelectedTwoView] = useState<ChartTView>('rsi2');
//console.log('plotdata', plotdata);
 // Dynamic RSI/StochRSI settings
 const [rsiPeriod, setRsiPeriod] = useState<number>(9);
 const [rsiMethod, setRsiMethod] = useState<SmoothingMethod>('ema');
 const [stochPeriod, setStochPeriod] = useState<number>(9);
 const [smoothK, setSmoothK] = useState<number>(3);
 const [smoothD, setSmoothD] = useState<number>(4);

 const impressions = holderplot.map(point => ({ name: point.time, value: point.holders }));
 const impressionsx = holderhistroy.map(point => ({ name: point.time, value: point.holders }));
 const computedRSI = computeRSI(impressions, rsiPeriod, rsiMethod);
 const computedRSI2 = computeRSI(impressionsx, rsiPeriod, rsiMethod);
 const computedStochRSI = computeStochRSI(impressions, { rsiPeriod, stochPeriod, smoothK, smoothD });
 const computedStochRSI2 = computeStochRSI(impressionsx, { rsiPeriod, stochPeriod, smoothK, smoothD });

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
          <div className="cursor-pointer" onClick={() => setShowHoldersModal(true)}>
            <HoldersChart data={holderplot} title="Token Holder Distribution" theme="dark" />
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
        <button onClick={() => setSelectedTwoView('rsi2')} className={`px-3 py-1 rounded ${selectedTwoView === 'rsi2' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}>Holder RSI</button>
        <button onClick={() => setSelectedTwoView('stoch2')} className={`px-3 py-1 rounded ${selectedTwoView === 'stoch2' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}>Stoch RSI</button>
        <button onClick={() => setSelectedTwoView('holders2')} className={`px-3 py-1 rounded ${selectedTwoView === 'holders2' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}>Holder Distribution</button>
      </div>

      <div>
        {selectedTwoView === 'rsi2' && <RSIChart rsiData={computedRSI2} title={`Holder RSI (Period=${rsiPeriod}, Method=${rsiMethod.toUpperCase()})`} theme="dark" />}
        {selectedTwoView === 'stoch2' && <StochRSIChart data={computedStochRSI2} title={`Stoch RSI (RSIp=${rsiPeriod}, W=${stochPeriod}, K=${smoothK}, D=${smoothD})`} theme="dark" />}
        {selectedTwoView === 'holders2' && (
          <div className="cursor-pointer" onClick={() => setShowHoldersModal(true)}>
            <HoldersChart data={holderhistroy} title="Token Holder Distribution" theme="dark" />
          </div>
        )}
      </div>
      <div className="cursor-pointer">
          <MultiAddressLineChart data={plotdata} />
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
                <HoldersChart data={holderplot} title="Token Holder Distribution" theme="dark" />
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
  