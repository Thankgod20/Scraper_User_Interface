// components/HoldersChart.tsx
import React, { useState, useMemo ,useRef} from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  Legend,
  ReferenceLine,
  Brush
} from 'recharts';

interface HolderDataPoint {
  holders: number;
  time: string;
}
type ZoomReport = {
  totalpage: number;
  currentpage: number;
};
interface HoldersChartProps {
  data: HolderDataPoint[];
  title?: string;
  theme?: 'light' | 'dark';
  funtype:string;
  onZoomOrPan?: (page: number, funtype:string) => Promise<ZoomReport>;
}

const HoldersChart: React.FC<HoldersChartProps> = ({
  data,
  funtype,
  title = "Open Interest: Holders Over Time",
  theme = 'light',
  onZoomOrPan
}) => {
  const [activePoint, setActivePoint] = useState<number | null>(null);
    const [isLoaded, setIsLoaded] = useState(true);
    const [isEnd, setIsEnd] = useState(false);
    const pageRef = useRef(2);
    const totalPage = useRef(0);
    const throttleRef = useRef(false);
  // Process and format data
  const formattedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map((point, index) => {
      const date = new Date(point.time);
      const formattedTime = formatTime(date);
      
      // Calculate change percentage if not the first point
      let changePercent = null;
      if (index > 0) {
        const prev = data[index - 1].holders;
        const change = point.holders - prev;
        changePercent = (change / prev) * 100;
      }
      
      return {
        ...point,
        formattedTime,
        timeObj: date,
        changePercent
      };
    });
  }, [data]);
  
  // Theme colors
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
  
  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div 
          className="rounded-md shadow-lg p-3 border z-10"
          style={{
            backgroundColor: colors.tooltipBackground,
            borderColor: colors.tooltipBorder,
            color: colors.tooltipText
          }}
        >
          <div className="font-medium mb-1">{formatTooltipDate(data.time)}</div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Holders:</span>
            <span className="font-semibold">{data.holders.toLocaleString()}</span>
          </div>
          {data.changePercent !== null && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm">Change:</span>
              <ChangeIndicator change={data.changePercent} />
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };
  
  // Calculate stats
  const stats = useMemo(() => {
    if (formattedData.length === 0) {
      return { peak: 0, current: 0, avg: 0 };
    }
    
    const peak = Math.max(...formattedData.map(d => d.holders));
    const current = formattedData[formattedData.length - 1].holders;
    const avg = average(formattedData.map(d => d.holders));
    
    return { peak, current, avg };
  }, [formattedData]);
  
  // Handle empty data state
  if (formattedData.length === 0) {
    return (
      <div 
        className="rounded-lg p-4 max-w-3xl mx-auto h-80 flex items-center justify-center"
      >
        <p className={`text-lg ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
          No data available to display
        </p>
      </div>
    );
  }
  //pageRef.current =formattedData.length/50
  return (
    <div className="rounded-lg p-4 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4" style={{ color: colors.text }}>
        {title}
      </h2>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={formattedData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            onMouseMove={(e) => {
              if (e.activeTooltipIndex !== undefined) {
                setActivePoint(e.activeTooltipIndex);
              }
            }}
            onMouseLeave={() => setActivePoint(null)}
          >
            <defs>
              <linearGradient id="colorHolders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={colors.primary} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={colors.gridLine} 
              vertical={false} 
            />
            <XAxis 
              dataKey="formattedTime"
              stroke={colors.axisLine}
              tick={{ fill: colors.text, fontSize: 12 }}
              tickMargin={10}
              label={{ 
                value: 'Time', 
                position: 'insideBottom', 
                offset: -10,
                fill: colors.text 
              }}
            />
            <YAxis
              stroke={colors.axisLine}
              tick={{ fill: colors.text, fontSize: 12 }}
              tickFormatter={formatNumber}
              label={{ 
                value: 'Number of Holders', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle' },
                fill: colors.text 
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="holders" 
              stroke={colors.primary} 
              fillOpacity={1} 
              fill="url(#colorHolders)" 
              strokeWidth={2}
              activeDot={{ r: 6, fill: colors.primary, stroke: "transparent", strokeWidth: 2 }}
              dot={{ r: 3, fill: colors.primary, stroke: "transparent", strokeWidth: 1.5 }}
            />
            {activePoint !== null && (
              <ReferenceLine 
                x={formattedData[activePoint]?.formattedTime} 
                stroke={colors.primary} 
                strokeDasharray="3 3" 
              />
            )}
            <Brush
              dataKey="formattedTime"
              height={30}
              stroke={colors.primary}
              travellerWidth={10}
              startIndex={pageRef.current >= totalPage.current
                ? 0
                : Math.max(0, formattedData.length - (formattedData.length-5))}  // show last 20 points
              endIndex={formattedData.length - 1}
              onChange={async(range) => {
                
                if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number' && !isEnd) {
                  
                  const start = formattedData[range.startIndex];
                  const end = formattedData[range.endIndex];
                  //console.log("onZoomOrPan",onZoomOrPan)
                  if (start && end && onZoomOrPan && range.startIndex <2 && isLoaded && !throttleRef.current) {
                    throttleRef.current= true
                    setIsLoaded(false);
                    
                    const report = await onZoomOrPan(pageRef.current,funtype); // Call external fetch 
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
        </ResponsiveContainer>
      </div>
      
      {/* Summary statistics */}
      <div className="flex justify-between mt-4 text-sm" style={{ color: colors.text }}>
        <div>
          <span className="font-medium">Peak:</span> {formatNumber(stats.peak)}
        </div>
        <div>
          <span className="font-medium">Current:</span> {formatNumber(stats.current)}
        </div>
        <div>
          <span className="font-medium">Avg:</span> {formatNumber(stats.avg)}
        </div>
      </div>
    </div>
  );
};

// Change indicator component for tooltip
const ChangeIndicator: React.FC<{ change: number }> = ({ change }) => {
  let color = "text-gray-500";
  let icon = "→";
  
  if (change > 0) {
    color = "text-green-500";
    icon = "↑";
  } else if (change < 0) {
    color = "text-red-500";
    icon = "↓";
  }
  
  return (
    <span className={`font-semibold ${color}`}>
      {icon} {Math.abs(change).toFixed(1)}%
    </span>
  );
};

// Helper functions
function formatTime(date: Date): string {
  const hh = date.getUTCHours();
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatTooltipDate(dateString: string): string {
  const date = new Date(dateString);
  // force UTC locale representation
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  });
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return Math.round(num).toString();
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, val) => sum + val, 0) / numbers.length;
}

export default HoldersChart;