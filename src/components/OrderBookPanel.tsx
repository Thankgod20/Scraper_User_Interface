import React,{useState} from 'react';
import MarketDepthChart from './MarketDepth';
import OrderBookCard from './OrderBookCard';
import HoldersChart from './HoldersChart';
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

  interface OrderBookPanelProps {
    holders: OrderData[]; // Replace 'any' with the appropriate type
    live_prx: RawTradeData[]; // Replace 'any' with the appropriate type
    holderplot: HolderDataPoint[]// Replace 'any' with the appropriate type
  }
  const OrderBookPanel: React.FC<OrderBookPanelProps> = ({
    holders,
    live_prx,
    holderplot
  }) => {
    const [showMarketDepthModal, setShowMarketDepthModal] = useState(false);
    const [showHoldersModal, setShowHoldersModal] = useState(false);
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
            </div>
            {/* Market Depth Chart */}
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
