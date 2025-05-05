import React,{useState} from 'react';
import MarketDepthChart from './MarketDepth';
import OrderBookCard from './OrderBookCard';
import HoldersChart from './HoldersChart';
import MACDChart from './MacD';
import RSIChart from './RSIChart';
import { CandleData, RawTradeData } from '@/app/types/TradingView';
import Modal from "react-modal";
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
  interface OrderBookPanelProps {
    holders: OrderData[]; // Replace 'any' with the appropriate type
    live_prx: RawTradeData[]; // Replace 'any' with the appropriate type
    holderplot: HolderDataPoint[]// Replace 'any' with the appropriate type
  }
  function computeRSI(
    data: Impression[],
    period = 14
  ): Impression[] {
    const rsiPoints: Impression[] = [];
    if (data.length < period + 1) return rsiPoints;
  
    // Arrays to hold U and D values
    const gains: number[] = [];
    const losses: number[] = [];
  
    // 1. Compute raw gains and losses for each period
    for (let i = 1; i < data.length; i++) {
      const change = data[i].value - data[i - 1].value;
      gains[i]  = Math.max(change,  0);
      losses[i] = Math.max(-change, 0);
    }
  
    // 2. Initialize first smoothed averages (simple mean)
    let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  
    // 3. Compute first RSI value at index = period
    let rs = avgGain / avgLoss;
    rsiPoints.push({
      name: data[period].name,
      value: 100 - (100 / (1 + rs)),
    });
  
    // 4. Wilder’s smoothing for subsequent values
    for (let i = period + 1; i < data.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      rs      = avgGain / avgLoss;
  
      rsiPoints.push({
        name: data[i].name,
        value: 100 - (100 / (1 + rs)),
      });
    }
  
    return rsiPoints;
  }
  const OrderBookPanel: React.FC<OrderBookPanelProps> = ({
    holders,
    live_prx,
    holderplot
  }) => {
    const [showMarketDepthModal, setShowMarketDepthModal] = useState(false);
    const [showHoldersModal, setShowHoldersModal] = useState(false);
    const impressions: Impression[] = holderplot.map((point) => ({
      name:  point.time,
      value: point.holders,
    }));
    const computedRSI = computeRSI(impressions, 14);
    return (
        <div className="rounded-lg shadow-md p-4 w-full">
          <h2 className="text-xl font-semibold mb-4">Order Book & Market Depth</h2>
          <div className="flex-row gap-4">
            {/* Order Book Card */}
            <div className="w">
              <OrderBookCard
                orders={holders}
                currentPrice={live_prx?.[0]?.close ?? 0}
                totalSupply={1000000000000}
              />
            </div>
            
            {/* Market Depth Chart */}
            <div className="md:col-span-1 h-64 cursor-pointer" onClick={() => setShowMarketDepthModal(true)}>
              <MarketDepthChart
                orderBookData={holders}
                livePriceData={live_prx}
              />
              <br/>
            </div>
            {/* RSI */}
            <div className="md:col-span-full h-64 cursor-pointer order-last w-full">
            <h2 className="text-xl font-semibold mb-4">HOLDER CHANGE</h2>
              <RSIChart 
                rsiData={computedRSI} 
                title="Holder RSI" 
                theme="dark" // or "light"
              />
             </div>
            {/* Holder Plot*/}
            <div className="md:col-span-1 h-64 cursor-pointer" onClick={() => setShowHoldersModal(true)}>
            <HoldersChart 
              data={holderplot} 
              title="Token Holder Distribution" 
              theme="dark" // or "light"
            />
            </div>
            
            
          </div>
          <Modal
         isOpen={showMarketDepthModal || showHoldersModal}
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
       >{showMarketDepthModal && (
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
         ) || showHoldersModal && (
            <div className="h-full flex flex-col">
            <h2 className="text-2xl text-white mb-4">Market Depth</h2>
            <div className="flex-grow">
              <HoldersChart 
                data={holderplot} 
                title="Token Holder Distribution" 
                theme="dark" // or "light"
              />
            </div>
            <button
              onClick={() => setShowHoldersModal(false)}
              className="mt-4 bg-gray-700 text-white py-2 px-4 rounded self-end"
            >
              Close
            </button>
          </div>
         )
         } 
       </Modal>
        </div>
         
      );
};

export default OrderBookPanel;
