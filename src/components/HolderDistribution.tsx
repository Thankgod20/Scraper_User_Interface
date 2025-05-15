import { useState, useEffect,useMemo ,useRef} from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Brush
} from 'recharts';
import { CategoryHoldings } from '@/app/utils/app_types';
// Import the types only - assume the function is imported from elsewhere

type ZoomReport = {
  totalpage: number;
  currentpage: number;
};
type HoldingsChartProps = {
  holdings: CategoryHoldings;
  funtype:string;
  theme?: 'light' | 'dark';
  onZoomOrPan?: (page: number, funtype:string) => Promise<ZoomReport>;
};

export default function HoldingsDistributionChart({ holdings,funtype,theme,onZoomOrPan }: HoldingsChartProps) {
    if (!holdings) {
        return (
          <div className="text-center text-gray-500 p-4">
            No holdings data available to display.
          </div>
        );
      }
      const colors = useMemo(() => {
        return theme === 'light' ? {
          text: '#333',
          axisLine: '#888',
          gridLine: '#e5e5e5',
          primary: '#3b82f6',
          primaryLight: 'rgba(59, 130, 246, 0.1)',
          tooltipBackground: 'rgba(255, 255, 255, 0.95)',
          tooltipBorder: '#d1d5db',
          tooltipText: '#1f2937'
        } : {
          text: '#e5e5e5',
          axisLine: '#6b7280',
          gridLine: '#374151',
          primary: '#60a5fa',
          primaryLight: 'rgba(96, 165, 250, 0.15)',
          tooltipBackground: 'rgba(31, 41, 55, 0.95)',
          tooltipBorder: '#4b5563',
          tooltipText: '#e5e5e5'
        };
      }, [theme]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [visibleData, setVisibleData] = useState<any[]>([]);
  const [chartType, setChartType] = useState<'line' | 'area' | 'stacked'>('line');
  const [isPercentage, setIsPercentage] = useState(false);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isLoaded, setIsLoaded] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  const pageRef = useRef(1);
  const totalPage = useRef(1);
  const throttleRef = useRef(false);
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  
  useEffect(() => {
    // Transform the data for Recharts
    const timestamps = Object.keys(holdings.whales).sort();
    
    const data = timestamps.map(timestamp => {
      const whalesVal = holdings.whales[timestamp] || 0;
      const retailVal = holdings.retail[timestamp] || 0;
      const lpsVal = holdings.lps[timestamp] || 0;
      const total = whalesVal + retailVal + lpsVal;
      
      return {
        timestamp,
        whales: isPercentage ? (whalesVal / total) * 100 : whalesVal,
        retail: isPercentage ? (retailVal / total) * 100 : retailVal,
        lps: isPercentage ? (lpsVal / total) * 100 : lpsVal,
        total: isPercentage ? 100 : total
      };
    });
    
    setChartData(data);
    // Reset brush range if data changes
  if (!brushRange) {
    setVisibleData(data);
  } else {
    const { startIndex, endIndex } = brushRange;
    setVisibleData(data.slice(startIndex, endIndex + 1));
  }
  }, [holdings, isPercentage]);

  const formatYAxis = (value: number) => {
    if (isPercentage) return `${value.toFixed(0)}%`;
    
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toISOString().slice(11, 19); // Extracts 'HH:MM:SS'
  };
  //let page = 2;
  
  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          
          <LineChart data={visibleData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatDate}
              padding={{ left: 20, right: 20 }} 
            />
            <YAxis tickFormatter={formatYAxis} />
            <Tooltip 
            contentStyle={{
                backgroundColor: '#1f2937', // Tailwind slate-800
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                boxShadow: '0 0 10px rgba(0,0,0,0.2)',
                }}
              formatter={(value: number) => [formatYAxis(value), '']}
              labelFormatter={(label) => formatDate(label)}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="whales" 
              stroke="#8884d8" 
              strokeWidth={2} 
              activeDot={{ r: 8 }} 
              name="Whales"
            />
            <Line 
              type="monotone" 
              dataKey="retail" 
              stroke="#82ca9d" 
              strokeWidth={2} 
              activeDot={{ r: 8 }} 
              name="Retail"
            />
            <Line 
              type="monotone" 
              dataKey="lps" 
              stroke="#ffc658" 
              strokeWidth={2} 
              activeDot={{ r: 8 }} 
              name="LPs"
            />
            <Brush
              dataKey="formattedTime"
              height={30}
              stroke={colors.primary}
              travellerWidth={10}
              startIndex={pageRef.current >= totalPage.current
                ? 0
                :Math.max(0, visibleData.length - (visibleData.length -2))}  // show last 20 points
              endIndex={visibleData.length - 1}
              onChange={async(range) => {
                pageRef.current =visibleData.length/50
                if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number' && !isEnd) {
                  
                  const start = chartData[range.startIndex];
                  const end = chartData[range.endIndex];
                  
                  if (start && end && onZoomOrPan && range.startIndex <2 && isLoaded && !throttleRef.current) {
                    if (pageRef.current == 1) {
                      //pageRef.current = Math.round(visibleData.length/50)
                    }
                    console.log("Visable Data",chartData.length)
                    throttleRef.current = true
                    setIsLoaded(false);
                    const report = await onZoomOrPan(pageRef.current,funtype); // Call external fetch function
                    ;
                    console.log('Brush range:', report)
                    if (report?.totalpage > 0) {
                      totalPage.current = report.totalpage;
                      if (report.totalpage > pageRef.current) {
                        pageRef.current = report.currentpage+1;
                        console.log('Updated page:', pageRef.current);
                      } else {
                        setIsEnd(true);
                      }
                      
                      setIsLoaded(true); // ✅ use React state setter
                      setTimeout(() => {
                        throttleRef.current = false;
                      }, 1000);
                    }
                   // console.log('Brush range:', report)
                  }
                }
              }}
            />

          </LineChart>
        );
      
      case 'area':
        return (
          <AreaChart data={visibleData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatDate}
              padding={{ left: 20, right: 20 }} 
            />
            <YAxis tickFormatter={formatYAxis} />
            <Tooltip 
            contentStyle={{
                backgroundColor: '#1f2937', // Tailwind slate-800
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                boxShadow: '0 0 10px rgba(0,0,0,0.2)',
                }}
              formatter={(value: number) => [formatYAxis(value), '']}
              labelFormatter={(label) => formatDate(label)}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="whales" 
              stackId={isPercentage ? "1" : undefined}
              stroke="#8884d8" 
              fill="#8884d8" 
              name="Whales"
            />
            <Area 
              type="monotone" 
              dataKey="retail" 
              stackId={isPercentage ? "1" : undefined}
              stroke="#82ca9d" 
              fill="#82ca9d" 
              name="Retail"
            />
            <Area 
              type="monotone" 
              dataKey="lps" 
              stackId={isPercentage ? "1" : undefined}
              stroke="#ffc658" 
              fill="#ffc658" 
              name="LPs"
            />
            <Brush
              dataKey="formattedTime"
              height={30}
              stroke={colors.primary}
              travellerWidth={10}
              startIndex={pageRef.current >= totalPage.current
                ? 0
                :Math.max(0, visibleData.length - (visibleData.length -2))}  // show last 20 points
              endIndex={visibleData.length - 1}
              onChange={async(range) => {
                pageRef.current =visibleData.length/50
                if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number' && !isEnd) {
                  
                  const start = chartData[range.startIndex];
                  const end = chartData[range.endIndex];
                  
                  if (start && end && onZoomOrPan && range.startIndex <2 && isLoaded && !throttleRef.current) {
                    throttleRef.current = true
                    setIsLoaded(false);
                    const report = await onZoomOrPan(pageRef.current,funtype); // Call external fetch function
                    ;
                    console.log('Brush range:', report)
                    if (report?.totalpage > 0) {
                      totalPage.current = report.totalpage;
                      if (report.totalpage > pageRef.current) {
                        pageRef.current = report.currentpage+1;
                        console.log('Updated page:', pageRef.current);
                      } else {
                        setIsEnd(true);
                      }
                      
                      setIsLoaded(true); // ✅ use React state setter
                      setTimeout(() => {
                        throttleRef.current = false;
                      }, 1000);
                    }
                   // console.log('Brush range:', report)
                  }
                }
              }}
            />
          </AreaChart>
        );
        
      case 'stacked':
        return (
          <AreaChart data={visibleData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatDate}
              padding={{ left: 20, right: 20 }} 
            />
            <YAxis tickFormatter={formatYAxis} />
            <Tooltip 
            contentStyle={{
                backgroundColor: '#1f2937', // Tailwind slate-800
                border: 'none',
                borderRadius: '0.5rem',
                color: 'white',
                boxShadow: '0 0 10px rgba(0,0,0,0.2)',
                }}
              formatter={(value: number) => [formatYAxis(value), '']}
              labelFormatter={(label) => formatDate(label)}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="whales" 
              stackId="1"
              stroke="#8884d8" 
              fill="#8884d8" 
              name="Whales"
            />
            <Area 
              type="monotone" 
              dataKey="retail" 
              stackId="1"
              stroke="#82ca9d" 
              fill="#82ca9d" 
              name="Retail"
            />
            <Area 
              type="monotone" 
              dataKey="lps" 
              stackId="1"
              stroke="#ffc658" 
              fill="#ffc658" 
              name="LPs"
            />
           <Brush
              dataKey="formattedTime"
              height={30}
              stroke={colors.primary}
              travellerWidth={10}
              startIndex={pageRef.current >= totalPage.current
                ? 0
                :Math.max(0, visibleData.length - (visibleData.length -2))}  // show last 20 points
              endIndex={visibleData.length - 1}
              onChange={async(range) => {
                pageRef.current =visibleData.length/50
                if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number' && !isEnd) {
                  
                  const start = chartData[range.startIndex];
                  const end = chartData[range.endIndex];
                  
                  if (start && end && onZoomOrPan && range.startIndex <2 && isLoaded && !throttleRef.current) {
                    throttleRef.current = true
                    setIsLoaded(false);
                    const report = await onZoomOrPan(pageRef.current,funtype); // Call external fetch function
                    ;
                    console.log('Brush range:', report)
                    if (report?.totalpage > 0) {
                      totalPage.current = report.totalpage
                      if (report.totalpage > pageRef.current) {
                        pageRef.current = report.currentpage+1;
                        console.log('Updated page:', pageRef.current);
                      } else {
                        setIsEnd(true);
                      }
                      
                      setIsLoaded(true); // ✅ use React state setter
                      setTimeout(() => {
                        throttleRef.current = false;
                      }, 1000);
                    }
                   // console.log('Brush range:', report)
                  }
                }
              }}
            />
          </AreaChart>
        );
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-dark p-4 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 text-center">Token Holdings Distribution</h2>
      
      <div className="flex justify-between mb-4">
        <div className="flex space-x-2">
          <button 
            className={`px-3 py-1 rounded ${chartType === 'line' ? 'bg-blue-500 text-white' : 'bg-gray-700'}`}
            onClick={() => setChartType('line')}
          >
            Line
          </button>
          <button 
            className={`px-3 py-1 rounded ${chartType === 'area' ? 'bg-blue-500 text-white' : 'bg-gray-700'}`}
            onClick={() => setChartType('area')}
          >
            Area
          </button>
          <button 
            className={`px-3 py-1 rounded ${chartType === 'stacked' ? 'bg-blue-500 text-white' : 'bg-gray-700'}`}
            onClick={() => setChartType('stacked')}
          >
            Stacked
          </button>
        </div>
      

        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <span className="mr-2 text-sm">Show Percentage</span>
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={isPercentage}
                onChange={() => setIsPercentage(!isPercentage)}
              />
              <div className={`block w-10 h-6 rounded-full ${isPercentage ? 'bg-blue-500' : 'bg-gray-500'}`}></div>
              <div className={`absolute left-1 top-1 bg-dark w-4 h-4 rounded-full transition-transform ${isPercentage ? 'transform translate-x-4' : ''}`}></div>
            </div>
          </label>
        </div>
      </div>
      
      <div className="flex-grow w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>Chart shows the distribution of token holdings across different categories over time.</p>
        <p>Whales: Holders with &gt;= 10M tokens | Retail: Holders with &lt; 10M tokens | LPs: Liquidity providers</p>
      </div>
    </div>
  );
}