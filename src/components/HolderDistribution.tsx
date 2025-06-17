import { useState, useEffect, useMemo, useRef } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';

// Type definitions
type ZoomReport = {
  totalpage: number;
  currentpage: number;
};

type CategoryHoldings = {
  whales: { [timestamp: string]: number };
  retail: { [timestamp: string]: number };
  lps: { [timestamp: string]: number };
};

type HoldingsChartProps = {
  holdings: CategoryHoldings;
  funtype: string;
  theme?: 'light' | 'dark';
  onZoomOrPan?: (page: number, funtype: string) => Promise<ZoomReport>;
};

type ChartDataPoint = {
  timestamp: string;
  time: number;
  whales: number;
  retail: number;
  lps: number;
  corr_whale_lp: number;
  corr_retail_lp: number;
  macd_whales?: number;
  signal_whales?: number;
  macd_retail?: number;
  signal_retail?: number;
  macd_lps?: number;
  signal_lps?: number;
  correlation_ratio?: number;
  ema_correlation_ratio?: number;
  lp_inflow?: number;
  lp_outflow?: number;
  net_lp_flow?: number;
  ema_lp_inflow?: number;
  ema_lp_outflow?: number;
  ema_net_lp_flow?: number;
};
type EMASettings = {
  correlation: number;
  lpFlow: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
};
export default function HoldingsDistributionChart({ 
  holdings, 
  funtype, 
  theme = 'dark', 
  onZoomOrPan 
}: HoldingsChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRefs = useRef<any>({});
  
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [visibleData, setVisibleData] = useState<ChartDataPoint[]>([]);
  const [chartType, setChartType] = useState<'line' | 'area' | 'stacked' | 'flows'>('line');
  const [isPercentage, setIsPercentage] = useState(false);
  const [showEMA, setShowEMA] = useState(true);
  const [isLoaded, setIsLoaded] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);
  const [showEMAMenu, setShowEMAMenu] = useState(false);
  const [emaSettings, setEMASettings] = useState<EMASettings>({
    correlation: 14,
    lpFlow: 32,
    macdFast: 5,
    macdSlow: 13,
    macdSignal: 4
  });
  const pageRef = useRef(1);
  const totalPage = useRef(1);
  const throttleRef = useRef(false);

  // Chart colors based on theme
  const colors = useMemo(() => {
    return theme === 'light' ? {
      background: '#ffffff',
      textColor: '#333333',
      gridColor: '#e1e1e1',
      whales: '#8884d8',
      retail: '#82ca9d',
      lps: '#ffc658',
      macd_whales: '#FF00FF',
      signal_whales: '#FFB6C1',
      macd_retail: '#00BFFF',
      signal_retail: '#87CEFA',
      macd_lps: '#7FFF00',
      signal_lps: '#ADFF2F',
      correlation: '#8884d8',
      ema_correlation: '#ff7300',
      lp_inflow: '#4ade80',
      lp_outflow: '#ef4444',
      ema_inflow: '#22c55e',
      ema_outflow: '#dc2626',
      net_flow: '#3b82f6',
      ema_net_flow: '#1d4ed8'
    } : {
      background: '#1F2937',
      textColor: '#d1d5db',
      gridColor: '#374151',
      whales: '#8884d8',
      retail: '#82ca9d',
      lps: '#ffc658',
      macd_whales: '#FF00FF',
      signal_whales: '#FFB6C1',
      macd_retail: '#00BFFF',
      signal_retail: '#87CEFA',
      macd_lps: '#7FFF00',
      signal_lps: '#ADFF2F',
      correlation: '#8884d8',
      ema_correlation: '#ff7300',
      lp_inflow: '#4ade80',
      lp_outflow: '#ef4444',
      ema_inflow: '#22c55e',
      ema_outflow: '#dc2626',
      net_flow: '#3b82f6',
      ema_net_flow: '#1d4ed8'
    };
  }, [theme]);

  if (!holdings) {
    return (
      <div className="text-center text-gray-500 p-4">
        No holdings data available to display.
      </div>
    );
  }

  // Helper functions
  function calculateMACD(data: any[], key: string) {
    const ema = (data: number[], period: number) => {
      const k = 2 / (period + 1);
      let emaArr = [data[0]];
      for (let i = 1; i < data.length; i++) {
        emaArr.push(data[i] * k + emaArr[i - 1] * (1 - k));
      }
      return emaArr;
    };

    const values = data.map(d => d[key]);
    //const ema12 = ema(values, 5);
    //const ema26 = ema(values, 13);
    const ema12 = ema(values, emaSettings.macdFast);
    const ema26 = ema(values, emaSettings.macdSlow);

    const macdLine = ema12.map((v, i) => v - (ema26[i] || 0));
    //const signalLine = ema(macdLine, 4);
    const signalLine = ema(macdLine, emaSettings.macdSignal);
    return data.map((d, i) => ({
      ...d,
      [`macd_${key}`]: macdLine[i],
      [`signal_${key}`]: signalLine[i]
    }));
  }

  function calculateEMA(data: ChartDataPoint[], key: keyof ChartDataPoint, period: number = 9): ChartDataPoint[] {
    const k = 2 / (period + 1);
    const values = data.map(d => d[key] as number).filter(v => v !== undefined && v !== null && !isNaN(v));
    
    if (values.length === 0) {
      return data.map(d => ({ ...d, [`ema_${String(key)}`]: 0 }));
    }
    
    let emaValue = values[0];
    
    return data.map((d, i) => {
      const currentValue = d[key] as number;
      if (currentValue !== undefined && currentValue !== null && !isNaN(currentValue)) {
        emaValue = currentValue * k + emaValue * (1 - k);
      }
      return {
        ...d,
        [`ema_${String(key)}`]: emaValue
      };
    });
  }

  function calculateLPFlows(data: ChartDataPoint[]): ChartDataPoint[] {
    return data.map((d, i) => {
      if (i === 0) {
        return {
          ...d,
          lp_inflow: 0,
          lp_outflow: 0,
          net_lp_flow: 0
        };
      }

      const prevLPs = data[i - 1].lps;
      const currentLPs = d.lps;
      const change = currentLPs - prevLPs;
      const maxLP = Math.max(...data.map(d => d.lps || 0));
      const scarcityFactor = Math.log10(maxLP + 1) - Math.log10(currentLPs + 1);//maxLP / (currentLPs + 1); 
      return {
        ...d,
        lp_inflow: change > 0 ? change : 0,
        lp_outflow: change < 0 ? Math.abs(change) : 0,
        net_lp_flow: change*(scarcityFactor*14)//(change-(change * scarcityFactor))
      };
    });
  }

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.textColor,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: colors.gridColor,
      },
      timeScale: {
        borderColor: colors.gridColor,
        timeVisible: true,
        secondsVisible: true,
      },
    });

    chartRef.current = chart;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [colors]);

  // Process data and merge with existing data
  /*useEffect(() => {
    const timestamps = Object.keys(holdings.whales).sort();
    let baseData = timestamps.map(timestamp => {
      const whalesVal = holdings.whales[timestamp] || 0;
      const retailVal = holdings.retail[timestamp] || 0;
      const lpsVal = holdings.lps[timestamp] || 0;
      const total = whalesVal + retailVal + lpsVal;

      return {
        timestamp,
        time: new Date(timestamp).getTime() / 1000, // Convert to seconds for lightweight-charts
        whales: isPercentage ? (whalesVal / total) * 100 : whalesVal,
        retail: isPercentage ? (retailVal / total) * 100 : retailVal,
        lps: isPercentage ? (lpsVal / total) * 100 : lpsVal,
        corr_whale_lp: 0,
        corr_retail_lp: 0,
      };
    });

    // Calculate LP flows
    baseData = calculateLPFlows(baseData);

    // Calculate MACD for all three categories
   /* baseData = calculateMACD(baseData, 'whales');
    baseData = calculateMACD(baseData, 'retail');
    baseData = calculateMACD(baseData, 'lps');
*/
// With:
/*baseData = calculateEMA(baseData, 'correlation_ratio', emaSettings.correlation);
baseData = calculateEMA(baseData, 'lp_inflow', emaSettings.lpFlow);
baseData = calculateEMA(baseData, 'lp_outflow', emaSettings.lpFlow);
baseData = calculateEMA(baseData, 'net_lp_flow', emaSettings.lpFlow);

    // Calculate inverse correlation using MACD values
    for (let i = 1; i < baseData.length; i++) {
      const prev = baseData[i - 1] as any;
      const cur = baseData[i] as any;

      const macd_whale_prev = prev.macd_whales || 0;
      const macd_whale_cur = cur.macd_whales || 0;
      const macd_retail_prev = prev.macd_retail || 0;
      const macd_retail_cur = cur.macd_retail || 0;
      const macd_lp_prev = prev.macd_lps || 0;
      const macd_lp_cur = cur.macd_lps || 0;

      const macd_whale_direction = macd_whale_cur - macd_whale_prev;
      const macd_retail_direction = macd_retail_cur - macd_retail_prev;
      const macd_lp_direction = macd_lp_cur - macd_lp_prev;

      let whale_lp_correlation = 0;
      let retail_lp_correlation = 0;

      if ((macd_lp_direction > 0 && macd_whale_direction < 0) || 
          (macd_lp_direction < 0 && macd_whale_direction > 0)) {
        whale_lp_correlation = Math.abs(macd_lp_direction);
      }

      if ((macd_lp_direction > 0 && macd_retail_direction < 0) || 
          (macd_lp_direction < 0 && macd_retail_direction > 0)) {
        retail_lp_correlation = Math.abs(macd_lp_direction);
      }

      if (retail_lp_correlation === 0 && whale_lp_correlation === 0) {
        cur.correlation_ratio = 0;
      } else if (retail_lp_correlation === 0) {
        cur.correlation_ratio = whale_lp_correlation;
      } else if (whale_lp_correlation === 0) {
        cur.correlation_ratio = -retail_lp_correlation;
      } else {
        cur.correlation_ratio = whale_lp_correlation - retail_lp_correlation;
      }

      cur.corr_whale_lp = whale_lp_correlation;
      cur.corr_retail_lp = -retail_lp_correlation;
    }

    if (baseData.length > 0) {
      (baseData[0] as any).correlation_ratio = 0;
      (baseData[0] as any).corr_whale_lp = 0;
      (baseData[0] as any).corr_retail_lp = 0;
    }

    // Calculate EMAs
    baseData = calculateEMA(baseData, 'correlation_ratio', 14);
    baseData = calculateEMA(baseData, 'lp_inflow', 9);
    baseData = calculateEMA(baseData, 'lp_outflow', 9);
    baseData = calculateEMA(baseData, 'net_lp_flow', 9);
    
    // Merge with existing data to avoid duplicates and maintain sort order
    setChartData(prevData => {
      const newTimestamps = new Set(baseData.map(d => d.timestamp));
      const existingData = prevData.filter(d => !newTimestamps.has(d.timestamp));
      const merged = [...existingData, ...baseData].sort((a, b) => a.time - b.time);
      
      // Remove duplicates based on timestamp
      const unique = merged.filter((item, index, arr) => 
        index === 0 || arr[index - 1].timestamp !== item.timestamp
      );
      
      console.log(`Merged data: ${prevData.length} existing + ${baseData.length} new = ${unique.length} total`);
      return unique;
    });
    
    setVisibleData(prevData => {
      const newTimestamps = new Set(baseData.map(d => d.timestamp));
      const existingData = prevData.filter(d => !newTimestamps.has(d.timestamp));
      const merged = [...existingData, ...baseData].sort((a, b) => a.time - b.time);
      
      // Remove duplicates based on timestamp
      const unique = merged.filter((item, index, arr) => 
        index === 0 || arr[index - 1].timestamp !== item.timestamp
      );
      
      return unique;
    });
  }, [holdings, isPercentage, emaSettings]);*/

  // Process data and merge with existing data
useEffect(() => {
  const timestamps = Object.keys(holdings.whales).sort();
  let baseData = timestamps.map(timestamp => {
    const whalesVal = holdings.whales[timestamp] || 0;
    const retailVal = holdings.retail[timestamp] || 0;
    const lpsVal = holdings.lps[timestamp] || 0;
    const total = whalesVal + retailVal + lpsVal;

    return {
      timestamp,
      time: new Date(timestamp).getTime() / 1000, // Convert to seconds for lightweight-charts
      whales: isPercentage ? (whalesVal / total) * 100 : whalesVal,
      retail: isPercentage ? (retailVal / total) * 100 : retailVal,
      lps: isPercentage ? (lpsVal / total) * 100 : lpsVal,
      corr_whale_lp: 0,
      corr_retail_lp: 0,
    };
  });

  // Calculate LP flows FIRST
  baseData = calculateLPFlows(baseData);

  // Calculate MACD for all three categories USING EMA SETTINGS
  baseData = calculateMACD(baseData, 'whales');
  baseData = calculateMACD(baseData, 'retail');
  baseData = calculateMACD(baseData, 'lps');

  // Calculate inverse correlation using MACD values
  for (let i = 1; i < baseData.length; i++) {
    const prev = baseData[i - 1] as any;
    const cur = baseData[i] as any;

    const macd_whale_prev = prev.macd_whales || 0;
    const macd_whale_cur = cur.macd_whales || 0;
    const macd_retail_prev = prev.macd_retail || 0;
    const macd_retail_cur = cur.macd_retail || 0;
    const macd_lp_prev = prev.macd_lps || 0;
    const macd_lp_cur = cur.macd_lps || 0;

    const macd_whale_direction = macd_whale_cur - macd_whale_prev;
    const macd_retail_direction = macd_retail_cur - macd_retail_prev;
    const macd_lp_direction = macd_lp_cur - macd_lp_prev;

    let whale_lp_correlation = 0;
    let retail_lp_correlation = 0;

    if ((macd_lp_direction > 0 && macd_whale_direction < 0) || 
        (macd_lp_direction < 0 && macd_whale_direction > 0)) {
      whale_lp_correlation = Math.abs(macd_lp_direction);
    }

    if ((macd_lp_direction > 0 && macd_retail_direction < 0) || 
        (macd_lp_direction < 0 && macd_retail_direction > 0)) {
      retail_lp_correlation = Math.abs(macd_lp_direction);
    }

    if (retail_lp_correlation === 0 && whale_lp_correlation === 0) {
      cur.correlation_ratio = 0;
    } else if (retail_lp_correlation === 0) {
      cur.correlation_ratio = whale_lp_correlation;
    } else if (whale_lp_correlation === 0) {
      cur.correlation_ratio = -retail_lp_correlation;
    } else {
      cur.correlation_ratio = whale_lp_correlation - retail_lp_correlation;
    }

    cur.corr_whale_lp = whale_lp_correlation;
    cur.corr_retail_lp = -retail_lp_correlation;
  }

  if (baseData.length > 0) {
    (baseData[0] as any).correlation_ratio = 0;
    (baseData[0] as any).corr_whale_lp = 0;
    (baseData[0] as any).corr_retail_lp = 0;
  }

  // Calculate EMAs AFTER correlation calculation USING EMA SETTINGS
  baseData = calculateEMA(baseData, 'correlation_ratio', emaSettings.correlation);
  baseData = calculateEMA(baseData, 'lp_inflow', emaSettings.lpFlow);
  baseData = calculateEMA(baseData, 'lp_outflow', emaSettings.lpFlow);
  baseData = calculateEMA(baseData, 'net_lp_flow', emaSettings.lpFlow);
  
  // Merge with existing data to avoid duplicates and maintain sort order
  setChartData(prevData => {
    const newTimestamps = new Set(baseData.map(d => d.timestamp));
    const existingData = prevData.filter(d => !newTimestamps.has(d.timestamp));
    const merged = [...existingData, ...baseData].sort((a, b) => a.time - b.time);
    
    // Remove duplicates based on timestamp
    const unique = merged.filter((item, index, arr) => 
      index === 0 || arr[index - 1].timestamp !== item.timestamp
    );
    
    console.log(`Merged data: ${prevData.length} existing + ${baseData.length} new = ${unique.length} total`);
    return unique;
  });
  
  setVisibleData(prevData => {
    const newTimestamps = new Set(baseData.map(d => d.timestamp));
    const existingData = prevData.filter(d => !newTimestamps.has(d.timestamp));
    const merged = [...existingData, ...baseData].sort((a, b) => a.time - b.time);
    
    // Remove duplicates based on timestamp
    const unique = merged.filter((item, index, arr) => 
      index === 0 || arr[index - 1].timestamp !== item.timestamp
    );
    
    return unique;
  });
}, [holdings, isPercentage, emaSettings]); // Added emaSettings as dependency

  // Handle zoom/pan detection
  useEffect(() => {
    if (!chartRef.current) return;

    const handleVisibleTimeRangeChange = async () => {
      if (!onZoomOrPan || !isLoaded || throttleRef.current || isEnd) return;

      const timeRange = chartRef.current.timeScale().getVisibleRange();
      if (!timeRange) return;

      const totalDataRange = {
        from: chartData[0]?.time || 0,
        to: chartData[chartData.length - 1]?.time || 0,
      };

      const visibleRange = timeRange.to - timeRange.from;
      const totalRange = totalDataRange.to - totalDataRange.from;
      
      // Check if user is zooming out (visible range is getting larger relative to data)
      const isZoomingOut = visibleRange > totalRange * 0.8;
      
      // Check if user is near the beginning of the data (potential need for historical data)
      const isNearStart = timeRange.from <= totalDataRange.from + (totalRange * 0.1);
      
      if (isZoomingOut || isNearStart) {
        throttleRef.current = true;
        setIsLoaded(false);
        
        try {
          const report = await onZoomOrPan(pageRef.current, funtype);
          
          if (report?.totalpage > 0) {
            totalPage.current = report.totalpage;
            if (report.totalpage > pageRef.current) {
              pageRef.current = report.currentpage + 1;
              console.log('Loading more data - Updated page:', pageRef.current);
            } else {
              setIsEnd(true);
              console.log('Reached end of data');
            }
          }
        } catch (error) {
          console.error('Error loading more data:', error);
        } finally {
          setIsLoaded(true);
          setTimeout(() => {
            throttleRef.current = false;
          }, 1000);
        }
      }
    };

    chartRef.current.timeScale().subscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);

    return () => {
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
      }
    };
  }, [chartData, onZoomOrPan, funtype, isLoaded, isEnd]);

  // Update chart series based on chart type
  useEffect(() => {
    if (!chartRef.current || !visibleData.length) return;

    // Clear existing series
    Object.values(seriesRefs.current).forEach((series: any) => {
      if (series && chartRef.current) {
        try {
          chartRef.current.removeSeries(series);
        } catch (e) {
          // Series might already be removed
        }
      }
    });
    seriesRefs.current = {};

    // Create series based on chart type
    switch (chartType) {
      case 'line':
        // Create line series for whales, retail, lps
        if (!hiddenSeries.includes('whales')) {
          const whalesSeries = chartRef.current.addLineSeries({
            color: colors.whales,
            lineWidth: 2,
            title: 'Whales',
          });
          const whalesData = visibleData.map(d => ({ time: d.time, value: d.whales }));
          whalesSeries.setData(whalesData);
          seriesRefs.current.whales = whalesSeries;
        }

        if (!hiddenSeries.includes('retail')) {
          const retailSeries = chartRef.current.addLineSeries({
            color: colors.retail,
            lineWidth: 2,
            title: 'Retail',
          });
          const retailData = visibleData.map(d => ({ time: d.time, value: d.retail }));
          retailSeries.setData(retailData);
          seriesRefs.current.retail = retailSeries;
        }

        if (!hiddenSeries.includes('lps')) {
          const lpsSeries = chartRef.current.addLineSeries({
            color: colors.lps,
            lineWidth: 2,
            title: 'LPs',
          });
          const lpsData = visibleData.map(d => ({ time: d.time, value: d.lps }));
          lpsSeries.setData(lpsData);
          seriesRefs.current.lps = lpsSeries;
        }
        break;

      case 'area':
        // Create MACD series
        const macdSeriesConfig = [
          { key: 'macd_whales', color: colors.macd_whales, title: 'MACD (Whales)' },
          { key: 'signal_whales', color: colors.signal_whales, title: 'Signal (Whales)', style: LineStyle.Dashed },
          { key: 'macd_retail', color: colors.macd_retail, title: 'MACD (Retail)' },
          { key: 'signal_retail', color: colors.signal_retail, title: 'Signal (Retail)', style: LineStyle.Dashed },
          { key: 'macd_lps', color: colors.macd_lps, title: 'MACD (LPs)' },
          { key: 'signal_lps', color: colors.signal_lps, title: 'Signal (LPs)', style: LineStyle.Dashed },
        ];

        macdSeriesConfig.forEach(config => {
          if (!hiddenSeries.includes(config.key)) {
            const series = chartRef.current.addLineSeries({
              color: config.color,
              lineWidth: 2,
              title: config.title,
              lineStyle: config.style || LineStyle.Solid,
            });
            const data = visibleData
              .map(d => ({ time: d.time, value: (d as any)[config.key] }))
              .filter(d => d.value !== undefined && d.value !== null);
            series.setData(data);
            seriesRefs.current[config.key] = series;
          }
        });
        break;

      case 'stacked':
        // Create correlation series
        if (!hiddenSeries.includes('correlation_ratio')) {
          const correlationSeries = chartRef.current.addLineSeries({
            color: colors.correlation,
            lineWidth: 1,
            title: 'Correlation Ratio (Raw)',
          });
          const correlationData = visibleData
            .map(d => ({ time: d.time, value: d.correlation_ratio || 0 }))
            .filter(d => d.value !== undefined);
          correlationSeries.setData(correlationData);
          seriesRefs.current.correlation_ratio = correlationSeries;
        }

        if (!hiddenSeries.includes('ema_correlation_ratio')) {
          const emaCorrelationSeries = chartRef.current.addLineSeries({
            color: colors.ema_correlation,
            lineWidth: 3,
            title: 'EMA Correlation (Smoothed)',
          });
          const emaCorrelationData = visibleData
            .map(d => ({ time: d.time, value: d.ema_correlation_ratio || 0 }))
            .filter(d => d.value !== undefined);
          emaCorrelationSeries.setData(emaCorrelationData);
          seriesRefs.current.ema_correlation_ratio = emaCorrelationSeries;
        }

        // Add zero reference line
        const zeroLineSeries = chartRef.current.addLineSeries({
          color: '#666666',
          lineWidth: 1,
          title: 'Zero Line',
          lineStyle: LineStyle.Dashed,
        });
        const zeroLineData = visibleData.map(d => ({ time: d.time, value: 0 }));
        zeroLineSeries.setData(zeroLineData);
        seriesRefs.current.zeroLine = zeroLineSeries;
        break;

      case 'flows':
        // Create LP flow series - Inflows as positive bars
        if (!hiddenSeries.includes('lp_inflow')) {
          const inflowSeries = chartRef.current.addHistogramSeries({
            color: colors.lp_inflow,
            title: 'LP Inflows',
            priceFormat: {
              type: 'volume',
            },
          });
          const inflowData = visibleData
            .map(d => ({ time: d.time, value: d.lp_inflow || 0 }))
            .filter(d => d.value !== undefined);
          inflowSeries.setData(inflowData);
          seriesRefs.current.lp_inflow = inflowSeries;
        }

        // Create LP outflow series - Outflows as negative bars
        if (!hiddenSeries.includes('lp_outflow')) {
          const outflowSeries = chartRef.current.addHistogramSeries({
            color: colors.lp_outflow,
            title: 'LP Outflows',
            priceFormat: {
              type: 'volume',
            },
          });
          const outflowData = visibleData
            .map(d => ({ time: d.time, value: -(d.lp_outflow || 0) }))
            .filter(d => d.value !== undefined);
          outflowSeries.setData(outflowData);
          seriesRefs.current.lp_outflow = outflowSeries;
        }

        // Add EMA overlays if enabled
        if (showEMA) {
          if (!hiddenSeries.includes('ema_lp_inflow')) {
            const emaInflowSeries = chartRef.current.addLineSeries({
              color: colors.ema_inflow,
              lineWidth: 2,
              title: 'EMA Inflows',
            });
            const emaInflowData = visibleData
              .map(d => ({ time: d.time, value: d.ema_lp_inflow || 0 }))
              .filter(d => d.value !== undefined);
            emaInflowSeries.setData(emaInflowData);
            seriesRefs.current.ema_lp_inflow = emaInflowSeries;
          }

          if (!hiddenSeries.includes('ema_lp_outflow')) {
            const emaOutflowSeries = chartRef.current.addLineSeries({
              color: colors.ema_outflow,
              lineWidth: 2,
              title: 'EMA Outflows',
            });
            const emaOutflowData = visibleData
              .map(d => ({ time: d.time, value: -(d.ema_lp_outflow || 0) }))
              .filter(d => d.value !== undefined);
            emaOutflowSeries.setData(emaOutflowData);
            seriesRefs.current.ema_lp_outflow = emaOutflowSeries;
          }

          if (!hiddenSeries.includes('ema_net_lp_flow')) {
            const emaNetFlowSeries = chartRef.current.addLineSeries({
              color: colors.ema_net_flow,
              lineWidth: 3,
              title: 'EMA Net Flow',
            });
            const emaNetFlowData = visibleData
              .map(d => ({ time: d.time, value: d.ema_net_lp_flow || 0 }))
              .filter(d => d.value !== undefined);
            emaNetFlowSeries.setData(emaNetFlowData);
            seriesRefs.current.ema_net_lp_flow = emaNetFlowSeries;
          }
        }

        // Add zero reference line
        const zeroLineFlowSeries = chartRef.current.addLineSeries({
          color: '#666666',
          lineWidth: 1,
          title: 'Zero Line',
          lineStyle: LineStyle.Dashed,
        });
        const zeroLineFlowData = visibleData.map(d => ({ time: d.time, value: 0 }));
        zeroLineFlowSeries.setData(zeroLineFlowData);
        seriesRefs.current.zeroLineFlow = zeroLineFlowSeries;
        break;
    }

    // Fit content to show all data
    chartRef.current.timeScale().fitContent();
  }, [chartType, visibleData, hiddenSeries, colors, showEMA]);

  const toggleSeries = (seriesKey: string) => {
    setHiddenSeries(prev => 
      prev.includes(seriesKey) 
        ? prev.filter(key => key !== seriesKey)
        : [...prev, seriesKey]
    );
  };

  const formatValue = (value: number) => {
    if (isPercentage) return `${value.toFixed(1)}%`;
    
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }
    return value.toFixed(2);
  };

  const getLegendItems = () => {
    switch (chartType) {
      case 'line':
        return [
          { key: 'whales', label: 'Whales', color: colors.whales },
          { key: 'retail', label: 'Retail', color: colors.retail },
          { key: 'lps', label: 'LPs', color: colors.lps },
        ];
      case 'area':
        return [
          { key: 'macd_whales', label: 'MACD (Whales)', color: colors.macd_whales },
          { key: 'signal_whales', label: 'Signal (Whales)', color: colors.signal_whales },
          { key: 'macd_retail', label: 'MACD (Retail)', color: colors.macd_retail },
          { key: 'signal_retail', label: 'Signal (Retail)', color: colors.signal_retail },
          { key: 'macd_lps', label: 'MACD (LPs)', color: colors.macd_lps },
          { key: 'signal_lps', label: 'Signal (LPs)', color: colors.signal_lps },
        ];
      case 'stacked':
        return [
          { key: 'correlation_ratio', label: 'Correlation Ratio (Raw)', color: colors.correlation },
          { key: 'ema_correlation_ratio', label: 'EMA Correlation (Smoothed)', color: colors.ema_correlation },
        ];
      case 'flows':
        const flowItems = [
          { key: 'lp_inflow', label: 'LP Inflows', color: colors.lp_inflow },
          { key: 'lp_outflow', label: 'LP Outflows', color: colors.lp_outflow },
        ];
        if (showEMA) {
          flowItems.push(
            { key: 'ema_lp_inflow', label: 'EMA Inflows', color: colors.ema_inflow },
            { key: 'ema_lp_outflow', label: 'EMA Outflows', color: colors.ema_outflow },
            { key: 'ema_net_lp_flow', label: 'EMA Net Flow', color: colors.ema_net_flow }
          );
        }
        return flowItems;
      default:
        return [];
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-gray-900 p-4 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 text-center text-white">Token Holdings Distribution</h2>
      
      <div className="flex flex-wrap justify-between mb-4 gap-2">
  <div className="flex flex-wrap gap-2">
    <button 
      className={`px-3 py-1 rounded ${chartType === 'line' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}
      onClick={() => setChartType('line')}
    >
      Holdings
    </button>
    <button 
      className={`px-3 py-1 rounded ${chartType === 'area' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}
      onClick={() => setChartType('area')}
    >
      MACD
    </button>
    <button 
      className={`px-3 py-1 rounded ${chartType === 'stacked' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}
      onClick={() => setChartType('stacked')}
    >
      Correlation
    </button>
    <button 
      className={`px-3 py-1 rounded ${chartType === 'flows' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}
      onClick={() => setChartType('flows')}
    >
      LP Flows
    </button>
  </div>

  <div className="flex flex-wrap gap-2 items-center">
    <button 
      className={`px-3 py-1 rounded ${isPercentage ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}
      onClick={() => setIsPercentage(!isPercentage)}
    >
      {isPercentage ? 'Percentage' : 'Absolute'}
    </button>

    {chartType === 'flows' && (
      <button 
        className={`px-3 py-1 rounded ${showEMA ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-300'}`}
        onClick={() => setShowEMA(!showEMA)}
      >
        EMA
      </button>
    )}
    
    <button 
      className="px-3 py-1 rounded bg-orange-600 text-white hover:bg-orange-700"
      onClick={() => setShowEMAMenu(!showEMAMenu)}
    >
      EMA Settings
    </button>

    {!isLoaded && (
      <div className="text-yellow-400 text-sm">Loading...</div>
    )}

    {isEnd && (
      <div className="text-green-400 text-sm">All data loaded</div>
    )}
  </div>
</div>

{/* EMA Settings Menu */}
{showEMAMenu && (
  <div className="mb-4 bg-gray-800 p-4 rounded border border-gray-600">
    <h3 className="text-white font-semibold mb-3">EMA Settings</h3>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <div>
        <label className="block text-gray-300 text-sm mb-1">Correlation EMA</label>
        <input
          type="number"
          min="1"
          max="100"
          value={emaSettings.correlation}
          onChange={(e) => setEMASettings(prev => ({
            ...prev,
            correlation: parseInt(e.target.value) || 14
          }))}
          className="w-full px-2 py-1 bg-gray-700 text-white rounded text-sm"
        />
      </div>
      
      <div>
        <label className="block text-gray-300 text-sm mb-1">LP Flow EMA</label>
        <input
          type="number"
          min="1"
          max="100"
          value={emaSettings.lpFlow}
          onChange={(e) => setEMASettings(prev => ({
            ...prev,
            lpFlow: parseInt(e.target.value) || 9
          }))}
          className="w-full px-2 py-1 bg-gray-700 text-white rounded text-sm"
        />
      </div>
      
      <div>
        <label className="block text-gray-300 text-sm mb-1">MACD Fast</label>
        <input
          type="number"
          min="1"
          max="50"
          value={emaSettings.macdFast}
          onChange={(e) => setEMASettings(prev => ({
            ...prev,
            macdFast: parseInt(e.target.value) || 5
          }))}
          className="w-full px-2 py-1 bg-gray-700 text-white rounded text-sm"
        />
      </div>
      
      <div>
        <label className="block text-gray-300 text-sm mb-1">MACD Slow</label>
        <input
          type="number"
          min="1"
          max="100"
          value={emaSettings.macdSlow}
          onChange={(e) => setEMASettings(prev => ({
            ...prev,
            macdSlow: parseInt(e.target.value) || 13
          }))}
          className="w-full px-2 py-1 bg-gray-700 text-white rounded text-sm"
        />
      </div>
      
      <div>
        <label className="block text-gray-300 text-sm mb-1">MACD Signal</label>
        <input
          type="number"
          min="1"
          max="50"
          value={emaSettings.macdSignal}
          onChange={(e) => setEMASettings(prev => ({
            ...prev,
            macdSignal: parseInt(e.target.value) || 4
          }))}
          className="w-full px-2 py-1 bg-gray-700 text-white rounded text-sm"
        />
      </div>
    </div>
    
    <div className="mt-3 flex space-x-2">
      <button
        onClick={() => setEMASettings({
          correlation: 14,
          lpFlow: 9,
          macdFast: 5,
          macdSlow: 13,
          macdSignal: 4
        })}
        className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-500"
      >
        Reset to Defaults
      </button>
      <button
        onClick={() => setShowEMAMenu(false)}
        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
      >
        Close
      </button>
    </div>
  </div>
)}
      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {getLegendItems().map(item => (
          <div 
            key={item.key}
            className={`flex items-center space-x-2 px-2 py-1 rounded cursor-pointer ${
              hiddenSeries.includes(item.key) ? 'opacity-50' : ''
            }`}
            onClick={() => toggleSeries(item.key)}
          >
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-white">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Chart Container */}
      <div className="flex-1 relative">
        <div 
        ref={chartContainerRef} 
        className="w-full h-96 bg-gray-800 rounded-lg border border-gray-600"
        style={{ minHeight: '384px' }}
      />
      </div>

      {/* Data Summary */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-gray-400">Latest Whales</div>
          <div className="text-white font-semibold">
            {visibleData.length > 0 ? formatValue(visibleData[visibleData.length - 1].whales) : '-'}
          </div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-gray-400">Latest Retail</div>
          <div className="text-white font-semibold">
            {visibleData.length > 0 ? formatValue(visibleData[visibleData.length - 1].retail) : '-'}
          </div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-gray-400">Latest LPs</div>
          <div className="text-white font-semibold">
            {visibleData.length > 0 ? formatValue(visibleData[visibleData.length - 1].lps) : '-'}
          </div>
        </div>
      </div>

      {/* Additional Info for Flow Chart */}
      {chartType === 'flows' && visibleData.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-800 p-3 rounded">
            <div className="text-gray-400">Latest Net Flow</div>
            <div className={`font-semibold ${
              (visibleData[visibleData.length - 1].net_lp_flow || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatValue(visibleData[visibleData.length - 1].net_lp_flow || 0)}
            </div>
          </div>
          <div className="bg-gray-800 p-3 rounded">
            <div className="text-gray-400">EMA Net Flow</div>
            <div className={`font-semibold ${
              (visibleData[visibleData.length - 1].ema_net_lp_flow || 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatValue(visibleData[visibleData.length - 1].ema_net_lp_flow || 0)}
            </div>
          </div>
        </div>
      )}

      {/* Chart Type Description */}
      <div className="mt-4 text-xs text-gray-400">
        {chartType === 'line' && 'Display raw holdings data for whales, retail, and LPs'}
        {chartType === 'area' && 'MACD (Moving Average Convergence Divergence) analysis for trend identification'}
        {chartType === 'stacked' && 'Correlation analysis between different holder categories'}
        {chartType === 'flows' && 'LP inflow/outflow analysis with EMA smoothing for trend detection'}
      </div>
    </div>
  );
}