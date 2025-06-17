"use client"
import React, { useState, useRef, useEffect } from 'react';
import * as Chart from 'chart.js';

// Register Chart.js components
Chart.Chart.register(
  Chart.CategoryScale,
  Chart.LinearScale,
  Chart.BarElement,
  Chart.LineElement,
  Chart.PointElement,
  Chart.Title,
  Chart.Tooltip,
  Chart.Legend,
  Chart.Filler
);

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
    for (const key in record) {
      sorted[key] = sortedIndices.map(i => record[key][i]);
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

// Calculate EMA
function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  
  const multiplier = 2 / (period + 1);
  const ema: number[] = [];
  
  // First EMA value is just the first data point
  ema[0] = data[0];
  
  // Calculate subsequent EMA values
  for (let i = 1; i < data.length; i++) {
    ema[i] = (data[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
  }
  
  return ema;
}

// Calculate total netflow
function calculateTotalNetflow(netflow: Record<string, number[]>): number[] {
  const whaleNetflow = netflow.whale || [];
  const sharkNetflow = netflow.shark || [];
  const retailNetflow = netflow.retail || [];
  
  const length = Math.max(whaleNetflow.length, sharkNetflow.length, retailNetflow.length);
  const totalNetflow: number[] = [];
  
  for (let i = 0; i < length; i++) {
    const whale = whaleNetflow[i] || 0;
    const shark = sharkNetflow[i] || 0;
    const retail = retailNetflow[i] || 0;
    totalNetflow[i] = whale + shark + retail;
  }
  
  return totalNetflow;
}

export default function InflowNetflowChart({ 
  chartdata, 
  funtype, 
  onZoomOrPan 
}: { 
  chartdata: ChartData;
  funtype: string; 
  onZoomOrPan?: (page: number, funtype: string) => Promise<ZoomReport>; 
}) {
  const sorteddata = sortChartData(chartdata);
  const data = sorteddata;
  
  const [mode, setMode] = useState<'normal' | 'netflow'>('normal');
  const [isDark, setIsDark] = useState(true);
  const [emaPeriod, setEmaPeriod] = useState(14);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart.Chart | null>(null);
  const pageRef = useRef(1);
  const totalPage = useRef(0);
  const throttleRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(true);
  const [isEnd, setIsEnd] = useState(false);

  const { timestamps, prices, inflow, outflow, netflow, activeHolders } = data;

  // Format labels for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      month: 'short',
      day: 'numeric'
    });
  };

  const labels = timestamps.slice(1).map(ts => formatTimestamp(ts));

  // Theme colors
  const theme = {
    light: {
      bg: '#ffffff',
      border: '#e5e7eb',
      text: '#374151',
      grid: '#f3f4f6',
      tooltip: '#ffffff'
    },
    dark: {
      bg: '#1f2937',
      border: '#374151',
      text: '#f9fafb',
      grid: '#374151',
      tooltip: '#374151'
    }
  };

  const currentTheme = isDark ? theme.dark : theme.light;

  useEffect(() => {
    if (!chartRef.current) return;

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    let chartConfig: any;

    if (mode === 'normal') {
      // Normal mode - Inflow/Outflow bars
      const whaleInflow = inflow.whale?.slice(1) || [];
      const whaleOutflow = outflow.whale?.slice(1).map(v => -v) || [];
      const sharkInflow = inflow.shark?.slice(1) || [];
      const sharkOutflow = outflow.shark?.slice(1).map(v => -v) || [];
      const retailInflow = inflow.retail?.slice(1) || [];
      const retailOutflow = outflow.retail?.slice(1).map(v => -v) || [];

      // Calculate total inflow and outflow
      const totalInflow = whaleInflow.map((whale, i) => 
        whale + (sharkInflow[i] || 0) + (retailInflow[i] || 0)
      );
      const totalOutflow = whaleOutflow.map((whale, i) => 
        whale + (sharkOutflow[i] || 0) + (retailOutflow[i] || 0)
      );

      // Calculate EMAs for inflow and outflow
      const whaleInflowEMA = calculateEMA(whaleInflow, emaPeriod);
      const whaleOutflowEMA = calculateEMA(whaleOutflow, emaPeriod);
      const sharkInflowEMA = calculateEMA(sharkInflow, emaPeriod);
      const sharkOutflowEMA = calculateEMA(sharkOutflow, emaPeriod);
      const retailInflowEMA = calculateEMA(retailInflow, emaPeriod);
      const retailOutflowEMA = calculateEMA(retailOutflow, emaPeriod);
      const totalInflowEMA = calculateEMA(totalInflow, emaPeriod);
      const totalOutflowEMA = calculateEMA(totalOutflow, emaPeriod);

      const datasets: any[] = [
        {
          label: 'Whale Inflow',
          data: whaleInflow,
          backgroundColor: isDark ? 'rgba(34, 197, 94, 0.9)' : 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 1,
          stack: 'whale'
        },
        {
          label: 'Whale Outflow',
          data: whaleOutflow,
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.9)' : 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
          stack: 'whale'
        },
        {
          label: 'Shark Inflow',
          data: sharkInflow,
          backgroundColor: isDark ? 'rgba(249, 115, 22, 0.9)' : 'rgba(249, 115, 22, 0.8)',
          borderColor: 'rgb(249, 115, 22)',
          borderWidth: 1,
          stack: 'shark'
        },
        {
          label: 'Shark Outflow',
          data: sharkOutflow,
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.6)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
          stack: 'shark'
        },
        {
          label: 'Retail Inflow',
          data: retailInflow,
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.9)' : 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
          stack: 'retail'
        },
        {
          label: 'Retail Outflow',
          data: retailOutflow,
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.9)' : 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
          stack: 'retail'
        },
        // Total flow lines
        {
          label: 'Total Inflow',
          data: totalInflow,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'transparent',
          borderWidth: 4,
          type: 'line',
          pointRadius: 2,
          pointHoverRadius: 6,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: 'Total Outflow',
          data: totalOutflow,
          borderColor: 'rgb(220, 38, 127)',
          backgroundColor: 'transparent',
          borderWidth: 4,
          type: 'line',
          pointRadius: 2,
          pointHoverRadius: 6,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        // EMA lines - hidden by default
        {
          label: `Whale Inflow EMA(${emaPeriod})`,
          data: whaleInflowEMA,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: `Whale Outflow EMA(${emaPeriod})`,
          data: whaleOutflowEMA,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: `Shark Inflow EMA(${emaPeriod})`,
          data: sharkInflowEMA,
          borderColor: 'rgb(249, 115, 22)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: `Shark Outflow EMA(${emaPeriod})`,
          data: sharkOutflowEMA,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: `Retail Inflow EMA(${emaPeriod})`,
          data: retailInflowEMA,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: `Retail Outflow EMA(${emaPeriod})`,
          data: retailOutflowEMA,
          borderColor: 'rgb(147, 51, 234)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: `Total Inflow EMA(${emaPeriod})`,
          data: totalInflowEMA,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          borderDash: [8, 4],
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: `Total Outflow EMA(${emaPeriod})`,
          data: totalOutflowEMA,
          borderColor: 'rgb(220, 38, 127)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          borderDash: [8, 4],
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        }
      ];

      chartConfig = {
        type: 'bar' as const,
        data: {
          labels,
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
                      // give a little padding so legend doesn't overlap
                    padding: { top: 10, bottom: 10 }
             },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Time',
                color: currentTheme.text
              },
              ticks: {
                color: currentTheme.text
              },
              grid: {
                color: currentTheme.grid
              }
            },
            y: {
              title: {
                display: true,
                text: 'Token Flow',
                color: currentTheme.text
              },
              ticks: {
                color: currentTheme.text,
                callback: function(value: any) {
                  return `${(value / 1e6).toFixed(1)}M`;
                }
              },
              grid: {
                color: currentTheme.grid
              }
            }
          },
          plugins: {
            /*legend: {
              display: true,
              position: 'top' as const,
              labels: {
                color: currentTheme.text
              }
            },*/
            legend: {
              display: true,
               position: 'bottom' as const,
             align: 'start' as const,
               maxHeight: 50,
               overflow: 'scroll',
               labels: {
                 boxWidth: 10,
                 boxHeight: 10,
                 padding: 8,
                 font: { size: 10 },
                 color: currentTheme.text
               }
             },
            tooltip: {
              backgroundColor: currentTheme.tooltip,
              titleColor: currentTheme.text,
              bodyColor: currentTheme.text,
              borderColor: currentTheme.border,
              borderWidth: 1,
              callbacks: {
                label: function(context: any) {
                  const value = context.parsed.y;
                  return `${context.dataset.label}: ${(value / 1e6).toFixed(2)}M`;
                }
              }
            }
          }
        }
      };
    } else {
      // Netflow mode
      const whaleNetflow = netflow.whale?.slice(1) || [];
      const sharkNetflow = netflow.shark?.slice(1) || [];
      const retailNetflow = netflow.retail?.slice(1) || [];
      
      // Calculate total netflow
      const totalNetflowData = calculateTotalNetflow({
        whale: netflow.whale?.slice(1) || [],
        shark: netflow.shark?.slice(1) || [],
        retail: netflow.retail?.slice(1) || []
      });

      // Calculate EMAs for netflow
      const whaleNetflowEMA = calculateEMA(whaleNetflow, emaPeriod);
      const sharkNetflowEMA = calculateEMA(sharkNetflow, emaPeriod);
      const retailNetflowEMA = calculateEMA(retailNetflow, emaPeriod);
      const totalNetflowEMA = calculateEMA(totalNetflowData, emaPeriod);

      // Create background colors based on positive/negative values with theme awareness
      const getColors = (data: number[], positiveColor: string, negativeColor: string) => {
        const opacity = isDark ? '0.9' : '0.8';
        return data.map(value => 
          value >= 0 
            ? positiveColor.replace('0.8', opacity)
            : negativeColor.replace('0.8', opacity)
        );
      };

      const datasets: any[] = [
        {
          label: 'Total Netflow',
          data: totalNetflowData,
          backgroundColor: getColors(totalNetflowData, 'rgba(16, 185, 129, 0.8)', 'rgba(220, 38, 127, 0.8)'),
          borderColor: getColors(totalNetflowData, 'rgb(16, 185, 129)', 'rgb(220, 38, 127)'),
          borderWidth: 2,
          order: 0
        },
        {
          label: 'Whale Netflow',
          data: whaleNetflow,
          backgroundColor: getColors(whaleNetflow, 'rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)'),
          borderColor: getColors(whaleNetflow, 'rgb(34, 197, 94)', 'rgb(239, 68, 68)'),
          borderWidth: 1,
          order: 1
        },
        {
          label: 'Shark Netflow',
          data: sharkNetflow,
          backgroundColor: getColors(sharkNetflow, 'rgba(59, 130, 246, 0.8)', 'rgba(236, 72, 153, 0.8)'),
          borderColor: getColors(sharkNetflow, 'rgb(59, 130, 246)', 'rgb(236, 72, 153)'),
          borderWidth: 1,
          order: 2
        },
        {
          label: 'Retail Netflow',
          data: retailNetflow,
          backgroundColor: getColors(retailNetflow, 'rgba(147, 51, 234, 0.8)', 'rgba(251, 191, 36, 0.8)'),
          borderColor: getColors(retailNetflow, 'rgb(147, 51, 234)', 'rgb(251, 191, 36)'),
          borderWidth: 1,
          order: 3
        },
        // EMA lines - hidden by default
        {
          label: `Total Netflow EMA(${emaPeriod})`,
          data: totalNetflowEMA,
          borderColor: 'rgb(6, 182, 212)',
          backgroundColor: 'transparent',
          borderWidth: 4,
          type: 'line',
          pointRadius: 1,
          pointHoverRadius: 5,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true,
          order: 0
        },
        {
          label: `Whale Netflow EMA(${emaPeriod})`,
          data: whaleNetflowEMA,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: `Shark Netflow EMA(${emaPeriod})`,
          data: sharkNetflowEMA,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        },
        {
          label: `Retail Netflow EMA(${emaPeriod})`,
          data: retailNetflowEMA,
          borderColor: 'rgb(147, 51, 234)',
          backgroundColor: 'transparent',
          borderWidth: 3,
          type: 'line',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: 'y',
          hidden: true
        }
      ];

      chartConfig = {
        type: 'bar' as const,
        data: {
          labels,
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            // give a little padding so legend doesn't overlap
          padding: { top: 10, bottom: 10 }
   },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Time',
                color: currentTheme.text
              },
              ticks: {
                color: currentTheme.text
              },
              grid: {
                color: currentTheme.grid
              }
            },
            y: {
              title: {
                display: true,
                text: 'Netflow',
                color: currentTheme.text
              },
              ticks: {
                color: currentTheme.text,
                callback: function(value: any) {
                  return `${(value / 1e6).toFixed(1)}M`;
                }
              },
              grid: {
                color: currentTheme.grid
              }
            }
          },
          plugins: {
            /*legend: {
              display: true,
              position: 'top' as const,
              labels: {
                color: currentTheme.text
              }
            }*/
              legend: {
                display: true,
                 position: 'bottom' as const,
               align: 'start' as const,
                 maxHeight: 50,
                 overflow: 'scroll',
                 labels: {
                   boxWidth: 10,
                   boxHeight: 10,
                   padding: 8,
                   font: { size: 10 },
                   color: currentTheme.text
                 }
               },
            tooltip: {
              backgroundColor: currentTheme.tooltip,
              titleColor: currentTheme.text,
              bodyColor: currentTheme.text,
              borderColor: currentTheme.border,
              borderWidth: 1,
              callbacks: {
                label: function(context: any) {
                  const value = context.parsed.y;
                  return `${context.dataset.label}: ${(value / 1e6).toFixed(2)}M`;
                }
              }
            }
          }
        }
      };
    }

    chartInstance.current = new Chart.Chart(ctx, chartConfig);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [mode, data, isDark, emaPeriod]);

  const handleZoomPan = async () => {
    if (onZoomOrPan && isLoaded && !throttleRef.current && !isEnd) {
      throttleRef.current = true;
      setIsLoaded(false);
      
      try {
        const report = await onZoomOrPan(pageRef.current, funtype);
        console.log('Zoom/Pan report:', report);
        
        if (report.totalpage > 0) {
          totalPage.current = report.totalpage;
          if (report.totalpage > pageRef.current) {
            pageRef.current = report.currentpage + 1;
            console.log('Updated page:', pageRef.current);
          } else {
            setIsEnd(true);
          }
        }
      } catch (error) {
        console.error('Error in zoom/pan:', error);
      } finally {
        setIsLoaded(true);
        setTimeout(() => {
          throttleRef.current = false;
        }, 1000);
      }
    }
  };

  return (
    <div className={`transition-colors duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="space-y-4 p-6">
        <div className="flex gap-4 items-center flex-wrap">
          <button
            onClick={() => setMode(mode === 'normal' ? 'netflow' : 'normal')}
            className={`font-bold py-2 px-4 rounded transition-colors ${
              isDark 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            Switch to {mode === 'normal' ? 'Netflow' : 'Normal'} Mode
          </button>

          <div className="flex items-center gap-2">
            <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              EMA Period:
            </label>
            <input
              type="number"
              min="2"
              max="50"
              value={emaPeriod}
              onChange={(e) => setEmaPeriod(parseInt(e.target.value) || 14)}
              className={`w-16 px-2 py-1 text-sm rounded border ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>
          
          <button
            onClick={handleZoomPan}
            disabled={!isLoaded || isEnd}
            className={`font-bold py-2 px-4 rounded transition-colors ${
              !isLoaded || isEnd
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : isDark
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {!isLoaded ? 'Loading...' : isEnd ? 'No More Data' : 'Load More Data'}
          </button>
          
          <button
            onClick={() => setIsDark(!isDark)}
            className={`font-bold py-2 px-4 rounded transition-colors ${
              isDark 
                ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400 border border-gray-600' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800 border border-gray-300'
            }`}
          >
            {isDark ? '☀️ Light' : '🌙 Dark'}
          </button>
          
          <div className={`text-sm px-3 py-2 rounded ${
            isDark ? 'text-gray-300 bg-gray-800' : 'text-gray-600 bg-white border border-gray-200'
          }`}>
            Page: {pageRef.current} / {totalPage.current || '?'}
          </div>
        </div>

        <div className={`w-full h-[50vh] rounded-lg p-4 shadow-lg transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        }`}>
          <canvas ref={chartRef} />
        </div>
        
        {mode === 'normal' && (
          <div className={`text-sm p-4 rounded-lg ${
            isDark ? 'text-gray-300 bg-gray-800 border border-gray-700' : 'text-gray-600 bg-gray-50 border border-gray-200'
          }`}>
            <p><strong>Normal Mode:</strong> Shows inflow (positive) and outflow (negative) for each category</p>
            <p><strong>Total Flow Lines:</strong> Available in legend - Total Inflow and Total Outflow across all categories</p>
            <p><strong>EMA Lines:</strong> Available in legend - click to show/hide exponential moving averages (solid lines for inflow, dashed for outflow)</p>
          </div>
        )}
        
        {mode === 'netflow' && (
          <div className={`text-sm p-4 rounded-lg ${
            isDark ? 'text-gray-300 bg-gray-800 border border-gray-700' : 'text-gray-600 bg-gray-50 border border-gray-200'
          }`}>
            <p><strong>Netflow Mode:</strong> Shows net flow (inflow - outflow) for each category</p>
            <p><strong>Total Netflow:</strong> Combined netflow across all categories (whale + shark + retail) - shown as the first bar</p>
            <p>Green/Blue/Purple = Positive netflow, Red/Pink/Yellow = Negative netflow</p>
            <p><strong>EMA Lines:</strong> Available in legend - click to show/hide exponential moving averages for netflow trend analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}