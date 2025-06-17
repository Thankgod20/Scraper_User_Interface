// components/OrderBookPanel.tsx
import React, {useState} from 'react';
import Modal from "react-modal";
import { Maximize2, X } from 'lucide-react';


// Child Components
import MarketDepthChart from './MarketDepth';
import OrderBookCard from './OrderBookCard';
import HoldersChart from './HoldersChart';
import ActiveWallets from './NetFlowActi';
import InflowNetflowChart from './NetFlow';
import HoldingsDistributionChart from './HolderDistribution';
import SRSChart from './SellOffPlot';

// Types
import { RawTradeData } from '@/app/types/TradingView';
import { HolderDataPoint, OrderData, CategoryHoldings, SellOffRisk, ChartData as NetflowChartData } from "@/app/utils/app_types";

type ZoomReport = { totalpage: number; currentpage: number; };

interface OrderBookPanelProps {
  holders: OrderData[];
  live_prx: RawTradeData[];
  holderplot: HolderDataPoint[];
  holderhistroy: HolderDataPoint[];
  plotBuyData: NetflowChartData;
  plotDistribution: CategoryHoldings;
  plotHoldingCount: CategoryHoldings;
  fetchOlderHoldingCount: (page: number, funtype: string) => Promise<ZoomReport>;
}

type MainChartView = 'depth' | 'orders';
type SecondaryChartView = 'active_wallets' | 'inflow_outflow' | 'holder_growth' | 'holder_dist'; // Removed SRS, added growth

const OrderBookPanel: React.FC<OrderBookPanelProps> = ({
  holders, live_prx, holderplot, holderhistroy, plotBuyData,
  plotDistribution, plotHoldingCount, fetchOlderHoldingCount
}) => {
  const plotdata: SellOffRisk[] = []; // SRS data not used here based on screenshot context
  holderplot.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  
  const [mainView, setMainView] = useState<MainChartView>('depth');
  const [secondaryView, setSecondaryView] = useState<SecondaryChartView>('active_wallets');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);
  const [modalTitle, setModalTitle] = useState<string>("");

  const openChartModal = (chartComponent: React.ReactNode, title: string) => {
    setModalTitle(title);
    setModalContent(chartComponent);
    setIsModalOpen(true);
  };
  
  const ToggleButton = ({ 
    active, 
    onClick, 
    children, 
  }: { 
    active: boolean; 
    onClick: () => void; 
    children: React.ReactNode;
  }) => {
    return (
      <button
        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 focus:outline-none
                    border border-transparent
                    ${active 
                      ? 'bg-blue-600/80 text-white shadow-md' 
                      : 'bg-gray-700/60 text-gray-300 hover:bg-gray-600/80 hover:text-gray-100 border-gray-600/50'
                    }`}
        onClick={onClick}
      >
        {children}
      </button>
    );
  };

  const renderChartWithModalOption = (chartComponent: React.ReactNode, title: string, chartKey: string) => (
    <div className="relative h-full group">
      <div className="h-full w-full">
         {chartComponent}
      </div>
      <button 
        onClick={() => openChartModal(chartComponent, title)}
        className="absolute top-1 right-1 bg-gray-700/50 hover:bg-blue-600/80 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        title={`Expand ${title}`}
        aria-label={`Expand ${title}`}
      >
        <Maximize2 size={14} className="text-gray-300 hover:text-white" />
      </button>
    </div>
  );


  return (
    <div className="text-white w-full h-full flex flex-col gap-3">
      {/* Main View Area (Order Book / Depth) */}
      <div className="flex flex-col bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl overflow-hidden flex-[1_1_45%]">
        <div className="flex items-center justify-between p-3 border-b border-gray-700/50 bg-gray-800/60">
            <div className="flex space-x-1.5">
                <ToggleButton active={mainView === 'depth'} onClick={() => setMainView('depth')}>
                    Market Depth
                </ToggleButton>
                <ToggleButton active={mainView === 'orders'} onClick={() => setMainView('orders')}>
                    Order Book
                </ToggleButton>
            </div>
             {/* Placeholder for controls like "Window: 5m", "Precision: 3" from screenshot if needed */}
        </div>
        <div className="p-2 flex-grow overflow-hidden">
          {mainView === 'depth' && renderChartWithModalOption(
            <MarketDepthChart orderBookData={holders} livePriceData={live_prx} />,
            "Market Depth Analysis",
            "market-depth"
          )}
          {mainView === 'orders' && (
            <OrderBookCard 
              orders={holders} 
              currentPrice={live_prx?.[live_prx.length-1]?.close ?? 0} 
              totalSupply={1_000_000_000_000} // Example total supply
            />
          )}
        </div>
      </div>

      {/* Secondary Charts Area (Advanced Analytics) */}
      <div className="flex flex-col bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-xl overflow-hidden flex-[1_1_55%]">
        <div className="p-3 border-b border-gray-700/50 bg-gray-800/60">
            <h3 className="text-xs font-semibold text-gray-300 mb-2 text-center sr-only">Advanced Analytics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <ToggleButton active={secondaryView === 'active_wallets'} onClick={() => setSecondaryView('active_wallets')}>
                Active Wallets
                </ToggleButton>
                <ToggleButton active={secondaryView === 'inflow_outflow'} onClick={() => setSecondaryView('inflow_outflow')}>
                Net Flow
                </ToggleButton>
                <ToggleButton active={secondaryView === 'holder_growth'} onClick={() => setSecondaryView('holder_growth')}>
                Growth
                </ToggleButton>
                <ToggleButton active={secondaryView === 'holder_dist'} onClick={() => setSecondaryView('holder_dist')}>
                Distribution
                </ToggleButton>
            </div>
        </div>
        
        <div className="p-2 flex-grow overflow-hidden min-h-[150px]"> {/* Added min-h for small screens */}
          {secondaryView === 'active_wallets' && plotBuyData && renderChartWithModalOption(
            <ActiveWallets chartdata={plotBuyData} funtype='netflow' onZoomOrPan={fetchOlderHoldingCount} />,
            "Active Wallets Analysis",
            "active-wallets"
          )}
          {secondaryView === 'inflow_outflow' && plotBuyData && renderChartWithModalOption(
            <InflowNetflowChart chartdata={plotBuyData} funtype='netflow' onZoomOrPan={fetchOlderHoldingCount} />,
            "Net Flow Analysis",
            "inflow-outflow"
          )}
          {secondaryView === 'holder_growth' && holderplot && renderChartWithModalOption(
            <HoldersChart data={holderplot} title="" theme="dark" funtype='hldnum' onZoomOrPan={fetchOlderHoldingCount}/>,
            "Token Holder Growth",
            "holder-growth"
          )}
          {secondaryView === 'holder_dist' && plotDistribution && renderChartWithModalOption(
            <HoldingsDistributionChart holdings={plotDistribution} funtype='ds' onZoomOrPan={fetchOlderHoldingCount} theme="dark" />,
            "Holder Distribution Analysis",
            "holder-distribution"
          )}
        </div>
      </div>
      
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        contentLabel="Chart Analysis Modal"
        className="bg-gray-850 text-white w-[95vw] max-w-[1200px] h-[85vh] mx-auto my-auto rounded-xl shadow-2xl flex flex-col border border-gray-700/50"
        overlayClassName="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-[1000]"
        appElement={typeof window !== 'undefined' ? document.getElementById('__next') || undefined : undefined}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-800 rounded-t-xl">
          <h2 className="text-lg font-semibold text-gray-100">{modalTitle}</h2>
          <button 
            onClick={() => setIsModalOpen(false)} 
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-grow overflow-hidden p-4">
          {modalContent}
        </div>
      </Modal>
    </div>
  );
};

export default OrderBookPanel;