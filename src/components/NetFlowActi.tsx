"use client"
import React, { useState, useRef, useEffect } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time } from 'lightweight-charts';

type ZoomReport = {
  totalpage: number;
  currentpage: number;
};

interface ChartData {
  timestamps: string[];
  prices: {
    timestamps: string[];
    values: number[];
  };
  inflow: Record<string, number[]>;
  outflow: Record<string, number[]>;
  netflow: Record<string, number[]>;
  activeHolders: Record<string, number[]>;
}

function groupByInterval(data: ChartData, intervalMinutes: number = 5): ChartData {
  const { timestamps, prices, inflow, outflow, netflow, activeHolders } = data;

  const floorToInterval = (date: Date, minutes: number): number => {
    return Math.floor(date.getTime() / (minutes * 60 * 1000)) * minutes * 60 * 1000;
  };

  type Aggregated = {
    [bucket: string]: {
      count: number;
      priceSum: number;
      inflow: Record<string, number>;
      outflow: Record<string, number>;
      netflow: Record<string, number>;
      activeHolders: Record<string, number>;
    };
  };

  const buckets: Aggregated = {};

  timestamps.forEach((ts, i) => {
    const date = new Date(ts);
    const bucketKey = new Date(floorToInterval(date, intervalMinutes)).toISOString();

    if (!buckets[bucketKey]) {
      buckets[bucketKey] = {
        count: 0,
        priceSum: 0,
        inflow: {},
        outflow: {},
        netflow: {},
        activeHolders: {},
      };
    }

    const bucket = buckets[bucketKey];
    bucket.count += 1;
    const priceValue = prices.values && typeof prices.values[i] === 'number' ? prices.values[i] : 0;
    bucket.priceSum += priceValue;

    const aggregateRecord = (record: Record<string, number>, source: Record<string, number[]>) => {
      for (const key in source) {
        if (source[key] && typeof source[key][i] === 'number') {
          if (!record[key]) record[key] = 0;
          record[key] += source[key][i];
        }
      }
    };

    aggregateRecord(bucket.inflow, inflow);
    aggregateRecord(bucket.outflow, outflow);
    aggregateRecord(bucket.netflow, netflow);
    aggregateRecord(bucket.activeHolders, activeHolders);
  });

  const groupedTimestamps = Object.keys(buckets).sort();
  const groupedPrices: number[] = [];
  const groupedInflow: Record<string, number[]> = {};
  const groupedOutflow: Record<string, number[]> = {};
  const groupedNetflow: Record<string, number[]> = {};
  const groupedActiveHolders: Record<string, number[]> = {};

  groupedTimestamps.forEach(bucketKey => {
    const bucket = buckets[bucketKey];
    groupedPrices.push(bucket.count > 0 ? bucket.priceSum / bucket.count : 0);

    const fillRecord = (target: Record<string, number[]>, source: Record<string, number>) => {
      for (const key in source) {
        if (!target[key]) target[key] = [];
        target[key].push(source[key]);
      }
    };

    fillRecord(groupedInflow, bucket.inflow);
    fillRecord(groupedOutflow, bucket.outflow);
    fillRecord(groupedNetflow, bucket.netflow);
    fillRecord(groupedActiveHolders, bucket.activeHolders);
  });

  return {
    timestamps: groupedTimestamps,
    prices: {
      timestamps: groupedTimestamps,
      values: groupedPrices,
    },
    inflow: groupedInflow,
    outflow: groupedOutflow,
    netflow: groupedNetflow,
    activeHolders: groupedActiveHolders,
  };
}

function sortChartData(data: ChartData): ChartData {
  const { timestamps, prices, inflow, outflow, netflow, activeHolders } = data;

  const sortedIndices = timestamps
    .map((ts, index) => ({ ts, index }))
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    .map(item => item.index);

  const sortedPriceIndices = prices.timestamps
    .map((ts, index) => ({ ts, index }))
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    .map(item => item.index);

  const sortedTimestamps = sortedIndices.map(i => timestamps[i]);
  const sortedPriceTimestamps = sortedPriceIndices.map(i => prices.timestamps[i]);
  const sortedPriceValues = sortedPriceIndices.map(i => prices.values[i]);

  const sortRecord = (record: Record<string, number[]>): Record<string, number[]> => {
    const sorted: Record<string, number[]> = {};
    if(record) {
      for (const key in record) {
        if (Array.isArray(record[key])) {
          sorted[key] = sortedIndices.map(i => record[key][i]);
        } else {
          sorted[key] = [];
        }
      }
    }
    return sorted;
  };

  return {
    timestamps: sortedTimestamps,
    prices: {
      timestamps: sortedPriceTimestamps,
      values: sortedPriceValues,
    },
    inflow: sortRecord(inflow),
    outflow: sortRecord(outflow),
    netflow: sortRecord(netflow),
    activeHolders: sortRecord(activeHolders),
  };
}

export default function ActiveWallets({ 
  chartdata, 
  funtype, 
  onZoomOrPan 
}: { 
  chartdata: ChartData;
  funtype: string;
  onZoomOrPan?: (page: number, funtype: string) => Promise<ZoomReport>;
}) {
  // ALL HOOKS MUST BE CALLED FIRST, BEFORE ANY CONDITIONAL LOGIC
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<{
    whaleNetflow?: ISeriesApi<'Histogram'>;
    sharkNetflow?: ISeriesApi<'Histogram'>;
    retailNetflow?: ISeriesApi<'Histogram'>;
    whaleActive?: ISeriesApi<'Line'>;
    sharkActive?: ISeriesApi<'Line'>;
    retailActive?: ISeriesApi<'Line'>;
    totalActive?: ISeriesApi<'Line'>;
  }>({});

  const [mode, setMode] = useState<'normal' | 'netflow'>('netflow');
  const [visibleSeries, setVisibleSeries] = useState({
    whaleNetflow: true,
    sharkNetflow: true,
    retailNetflow: true,
    whaleActive: true,
    sharkActive: true,
    retailActive: true,
    totalActive: true,
  });
  const pageRef = useRef(1);
  const totalPage = useRef(0);
  const throttleRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(true);
  const [isEnd, setIsEnd] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // Process data (this can be done conditionally since it's not a hook)
  const processedData = React.useMemo(() => {
    if (!chartdata || !chartdata.timestamps || chartdata.timestamps.length === 0) {
      return null;
    }

    const sorteddata = sortChartData(chartdata);
    const { timestamps, prices, inflow, outflow, netflow, activeHolders } = sorteddata;

    // Convert data to lightweight charts format
    const chartData = timestamps.map((timestamp, index) => {
      const time = (new Date(timestamp).getTime() / 1000) as Time;
      return {
        time,
        timestamp,
        whaleNetflow: netflow?.whale?.[index] || 0,
        sharkNetflow: netflow?.shark?.[index] || 0,
        retailNetflow: netflow?.retail?.[index] || 0,
        whaleActive: activeHolders?.whale?.[index] || 0,
        sharkActive: activeHolders?.shark?.[index] || 0,
        retailActive: activeHolders?.retail?.[index] || 0,
        totalActive: activeHolders?.total?.[index] || 0,
      };
    });

    return chartData;
  }, [chartdata]);

  // useEffect hook - this must always be called
  useEffect(() => {
    if (!chartContainerRef.current || !processedData || processedData.length === 0) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1F2937' },
        textColor: '#E5E7EB',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(75, 85, 99, 0.3)' },
        horzLines: { color: 'rgba(75, 85, 99, 0.3)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(156, 163, 175, 0.5)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      leftPriceScale: {
        visible: true,
        borderColor: 'rgba(156, 163, 175, 0.5)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(156, 163, 175, 0.5)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Create histogram series for netflows
    const whaleNetflowSeries = chart.addHistogramSeries({
      color: '#10B981',
      priceFormat: { type: 'volume' },
      priceScaleId: 'left',
      title: 'Whale Netflow',
      visible: visibleSeries.whaleNetflow,
    });

    const sharkNetflowSeries = chart.addHistogramSeries({
      color: '#3B82F6',
      priceFormat: { type: 'volume' },
      priceScaleId: 'left',
      title: 'Shark Netflow',
      visible: visibleSeries.sharkNetflow,
    });

    const retailNetflowSeries = chart.addHistogramSeries({
      color: '#A855F7',
      priceFormat: { type: 'volume' },
      priceScaleId: 'left',
      title: 'Retail Netflow',
      visible: visibleSeries.retailNetflow,
    });

    // Create line series for active holders
    const whaleActiveSeries = chart.addLineSeries({
      color: '#3B82F6',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'Whale Active',
      visible: visibleSeries.whaleActive,
    });

    const sharkActiveSeries = chart.addLineSeries({
      color: '#10B981',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'Shark Active',
      visible: visibleSeries.sharkActive,
    });

    const retailActiveSeries = chart.addLineSeries({
      color: '#F59E0B',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'Retail Active',
      visible: visibleSeries.retailActive,
    });

    const totalActiveSeries = chart.addLineSeries({
      color: '#A855F7',
      lineWidth: 2,
      priceScaleId: 'right',
      title: 'Total Active',
      visible: visibleSeries.totalActive,
    });

    // Store series references
    seriesRefs.current = {
      whaleNetflow: whaleNetflowSeries,
      sharkNetflow: sharkNetflowSeries,
      retailNetflow: retailNetflowSeries,
      whaleActive: whaleActiveSeries,
      sharkActive: sharkActiveSeries,
      retailActive: retailActiveSeries,
      totalActive: totalActiveSeries,
    };

    // Set data for histogram series (netflows)
    const whaleNetflowData = processedData.map(d => ({
      time: d.time,
      value: d.whaleNetflow,
      color: d.whaleNetflow >= 0 ? '#10B981' : '#EF4444',
    }));

    const sharkNetflowData = processedData.map(d => ({
      time: d.time,
      value: d.sharkNetflow,
      color: d.sharkNetflow >= 0 ? '#3B82F6' : '#F472B6',
    }));

    const retailNetflowData = processedData.map(d => ({
      time: d.time,
      value: d.retailNetflow,
      color: d.retailNetflow >= 0 ? '#A855F7' : '#FACC15',
    }));

    whaleNetflowSeries.setData(whaleNetflowData);
    sharkNetflowSeries.setData(sharkNetflowData);
    retailNetflowSeries.setData(retailNetflowData);

    // Set data for line series (active holders)
    const whaleActiveData = processedData.map(d => ({ time: d.time, value: d.whaleActive }));
    const sharkActiveData = processedData.map(d => ({ time: d.time, value: d.sharkActive }));
    const retailActiveData = processedData.map(d => ({ time: d.time, value: d.retailActive }));
    const totalActiveData = processedData.map(d => ({ time: d.time, value: d.totalActive }));

    whaleActiveSeries.setData(whaleActiveData);
    sharkActiveSeries.setData(sharkActiveData);
    retailActiveSeries.setData(retailActiveData);
    totalActiveSeries.setData(totalActiveData);

    // Handle zoom/pan events
    if (onZoomOrPan) {
      chart.timeScale().subscribeVisibleTimeRangeChange(async (timeRange) => {
        if (!timeRange || isEnd || !isLoaded || throttleRef.current || isPaused) return;

        const fromTime = timeRange.from as number;
        const toTime = timeRange.to as number;
        
        const visibleData = processedData.filter(d => {
          const time = d.time as number;
          return time >= fromTime && time <= toTime;
        });

        // Check if we're at the beginning of data and need to load more
        if (visibleData.length > 0 && processedData.indexOf(visibleData[0]) < 2) {
          throttleRef.current = true;
          setIsLoaded(false);
          
          try {
            const report = await onZoomOrPan(pageRef.current, funtype);
            if (report.totalpage > 0) {
              totalPage.current = report.totalpage;
              if (report.totalpage > pageRef.current) {
                pageRef.current = report.currentpage + 1;
              } else {
                setIsEnd(true);
              }
            } else {
              setIsEnd(true);
            }
          } catch (error) {
            console.error("Error during onZoomOrPan:", error);
            setIsEnd(true);
          } finally {
            setIsLoaded(true);
            setTimeout(() => {
              throttleRef.current = false;
            }, 1000);
          }
        }
      });
    }

    // Fit content
    if (!isPaused){
      chart.timeScale().fitContent();
    }
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
        chartRef.current = null;
      }
    };
  }, [processedData, onZoomOrPan, funtype, isLoaded, isEnd, visibleSeries]);

  // NOW we can do conditional rendering after all hooks have been called
  if (!processedData) {
    return <div className="h-96 w-full flex items-center justify-center text-gray-500">Loading chart data...</div>;
  }

  if (processedData.length === 0) {
    return <div className="h-96 w-full flex items-center justify-center text-gray-500">No data available for the chart.</div>;
  }

  return (
    <div className="w-full space-y-4 bg-gray-900 p-4 rounded-lg">
      {/* Controls */}
      <div className="flex items-center gap-4">
        
        
        {!isLoaded && (
          <div className="text-sm text-gray-400">Loading...</div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-300">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500"></div>
          <span>Whale Netflow</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500"></div>
          <span>Shark Netflow</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-500"></div>
          <span>Retail Netflow</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-blue-500"></div>
          <span>Whale Active</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-green-500"></div>
          <span>Shark Active</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-amber-500"></div>
          <span>Retail Active</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-purple-500"></div>
          <span>Total Active</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
              type="checkbox"
              checked={isPaused}
              onChange={(e) => setIsPaused(e.target.checked)}
          />
          <span style={{ 
              width: '16px', 
              height: '12px', 
              backgroundColor: isPaused ? '#EF4444' : '#10B981', 
              display: 'inline-block',
              marginRight: '4px'
          }}></span>
          Pause Data Fetching
      </label>
      </div>

      {/* Chart container */}
      <div 
        ref={chartContainerRef} 
        className="w-full h-96 bg-gray-800 rounded-lg border border-gray-600"
        style={{ minHeight: '384px' }}
      />
    </div>
  );
}