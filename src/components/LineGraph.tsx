import React, { useState, useRef, useEffect, useMemo } from "react";
import { createChart, ColorType, LineData, HistogramData, Time, IChartApi, ISeriesApi } from "lightweight-charts";

type ZoomReport = {
    totalpage: number;
    currentpage: number;
};

type SimpleData = { name: string; value: number };

type DetailedImpression = {
    name: string;
    value: number;              // QAI
    posImpressions: number;     // views from tweets with engagement
    negImpressions: number;     // views from tweets without engagement
    engagementRate?: number;    // Optional: pos / total
};

interface LineGraphProps {
    data: SimpleData[] | DetailedImpression[];
    color?: string;
    funtype: string;
    onZoomOrPan?: (page: number, funtype: string) => Promise<ZoomReport>;
}

const LineGraph: React.FC<LineGraphProps> = ({ 
    data, 
    color = "#2563EB", 
    funtype, 
    onZoomOrPan 
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const barSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const negBarSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const [isLoaded, setIsLoaded] = useState(true);
    const [isEnd, setIsEnd] = useState(false);
    const [showEMA, setShowEMA] = useState(false);
    const [emaPeriod, setEmaPeriod] = useState(20);
    const [showValueLine, setShowValueLine] = useState(true);
    const [showHistogram, setShowHistogram] = useState(true);
    const [showEMASettings, setShowEMASettings] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [removeOutliers, setRemoveOutliers] = useState(false);
    const [outlierThreshold, setOutlierThreshold] = useState(2); // Standard deviations
    const [showOutlierSettings, setShowOutlierSettings] = useState(false);
    const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const pageRef = useRef(1);
    const totalPage = useRef(0);
    const throttleRef = useRef(false);

    // Type guard to check if data is DetailedImpression
    const isDetailedData = (item: SimpleData | DetailedImpression): item is DetailedImpression => {
        return 'posImpressions' in item && 'negImpressions' in item;
    };

    // Check if all data items are DetailedImpression type
    const hasDetailedData = data.length > 0 && isDetailedData(data[0]);

    // Enhanced outlier detection function using Z-score method
    const detectOutliers = (values: number[]): boolean[] => {
        if (values.length < 3) return new Array(values.length).fill(false);
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev === 0) return new Array(values.length).fill(false);
        
        return values.map(value => {
            const zScore = Math.abs((value - mean) / stdDev);
            return zScore > outlierThreshold;
        });
    };

    // Filter data to remove outliers from all relevant fields
    const filteredData = useMemo(() => {
        if (!removeOutliers) return data;
        
        if (hasDetailedData) {
            const detailedData = data as DetailedImpression[];
            // Detect outliers in all three fields: value, posImpressions, negImpressions
            const valueOutliers = detectOutliers(detailedData.map(d => d.value));
            const posOutliers = detectOutliers(detailedData.map(d => d.posImpressions));
            const negOutliers = detectOutliers(detailedData.map(d => d.negImpressions));
            
            // Remove items that are outliers in ANY of the three fields
            return detailedData.filter((_, index) => 
                !valueOutliers[index] && !posOutliers[index] && !negOutliers[index]
            );
        } else {
            // For simple data, only check value field
            const valueOutliers = detectOutliers(data.map(d => d.value));
            return data.filter((_, index) => !valueOutliers[index]);
        }
    }, [data, removeOutliers, outlierThreshold, hasDetailedData]);

    // Get outlier statistics
    const outlierStats = useMemo(() => {
        if (!removeOutliers) return { count: 0, percentage: 0 };
        
        const outlierCount = data.length - filteredData.length;
        const percentage = data.length > 0 ? (outlierCount / data.length * 100) : 0;
        
        return { count: outlierCount, percentage };
    }, [data, filteredData, removeOutliers]);

    // Sort data by time
    const sortedData = [...filteredData].sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

    // Convert data to lightweight-charts format
    const chartData: LineData[] = sortedData.map(item => ({
        time: Math.floor(new Date(item.name).getTime() / 1000) as Time,
        value: item.value
    }));

    // Calculate bar chart data based on data type
    const { positiveBarData, negativeBarData } = useMemo(() => {
        if (hasDetailedData) {
            // For DetailedImpression data, show positive and negative impressions
            const posData: HistogramData[] = (sortedData as DetailedImpression[]).map(item => ({
                time: Math.floor(new Date(item.name).getTime() / 1000) as Time,
                value: item.posImpressions * 0.3, // Scale down for visibility
                color: '#2563ec' // Blue for positive impressions
            }));
            
            const negData: HistogramData[] = (sortedData as DetailedImpression[]).map(item => ({
                time: Math.floor(new Date(item.name).getTime() / 1000) as Time,
                value: -item.negImpressions * 0.3, // Negative values for bottom bars
                color: '#EF4444' // Red for negative impressions
            }));
            
            return { positiveBarData: posData, negativeBarData: negData };
        } else {
            // For simple data, calculate net changes as before
            const changeData: HistogramData[] = chartData.slice(1).map((item, index) => {
                const change = item.value - chartData[index].value;
                return {
                    time: item.time,
                    value: change * 0.3,
                    color: change >= 0 ? '#2563ec' : '#EF4444'
                };
            });
            
            return { positiveBarData: changeData, negativeBarData: [] };
        }
    }, [sortedData, chartData, hasDetailedData]);

    // EMA calculation function
    const calculateEMA = (data: number[], period: number): number[] => {
        const multiplier = 2 / (period + 1);
        const ema: number[] = [];
        
        for (let i = 0; i < data.length; i++) {
            if (i === 0) {
                ema[i] = data[i];
            } else {
                ema[i] = (data[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
            }
        }
        return ema;
    };

    // Calculate EMA data
    const emaData: LineData[] = useMemo(() => {
        if (!showEMA || chartData.length === 0) return [];
        
        const values = chartData.map(item => item.value);
        const emaValues = calculateEMA(values, emaPeriod);
        
        return chartData.map((item, index) => ({
            time: item.time,
            value: emaValues[index]
        }));
    }, [chartData, emaPeriod, showEMA]);

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#ffffff',
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false, color: '#E5E7EB' },
            },
            crosshair: {
                mode: 1,
            },
            rightPriceScale: {
                visible: true,
                borderVisible: false,
                textColor: '#ffffff', 
            },
            leftPriceScale: {
                visible: true,
                borderVisible: false,
                textColor: '#ffffff', 
            },
            timeScale: {
                visible: true,
                borderVisible: false,
            },
            handleScroll: {
                mouseWheel: false,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
            },
            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true,  
            },
        });

        // Add histogram series on the left price scale
        const barSeries = chart.addHistogramSeries({
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: 'left',
            base: 0,
        });

        // Add second histogram series for negative data (if needed)
        let negBarSeries = null;
        if (hasDetailedData) {
            negBarSeries = chart.addHistogramSeries({
                priceFormat: {
                    type: 'volume',
                },
                priceScaleId: 'left',
                base: 0,
            });
        }

        // Add line series on the right price scale
        const lineSeries = chart.addLineSeries({
            color: '#2563EB',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 3,
            priceScaleId: 'right',
        });

        // Add EMA series
        const emaSeries = chart.addLineSeries({
            color: '#FF6B35',
            lineWidth: 1,
            lineStyle: 2,
            crosshairMarkerVisible: false,
            priceScaleId: 'right',
            visible: showEMA,
        });
        
        // Set data
        barSeries.setData(positiveBarData);
        if (negBarSeries && negativeBarData.length > 0) {
            negBarSeries.setData(negativeBarData);
        }
        lineSeries.setData(chartData);
        
        // Update refs
        chartRef.current = chart;
        barSeriesRef.current = barSeries;
        negBarSeriesRef.current = negBarSeries;
        lineSeriesRef.current = lineSeries;
        emaSeriesRef.current = emaSeries;

        // Set initial visible range
        if (chartData.length > 5) {
            const startIndex = pageRef.current === totalPage.current ? 0 : Math.max(0, chartData.length - (chartData.length - 5));
            const endIndex = chartData.length - 1;
            
            if (startIndex < chartData.length && endIndex < chartData.length) {
                chart.timeScale().setVisibleRange({
                    from: chartData[startIndex].time,
                    to: chartData[endIndex].time,
                });
            }
        }

        // Handle visible range changes
        chart.timeScale().subscribeVisibleTimeRangeChange(async (newVisibleTimeRange) => {
            if (!newVisibleTimeRange || !onZoomOrPan || isEnd || !isLoaded || throttleRef.current || isPaused) {
                return;
            }

            const startTime = newVisibleTimeRange.from as number;
            const startIndex = chartData.findIndex(point => (point.time as number) >= startTime);
            
            if (startIndex < 2 && startIndex >= 0) {
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
                        
                        setTimeout(() => {
                            setIsLoaded(true);
                            throttleRef.current = false;
                        }, 1000);
                    } else {
                        setIsLoaded(true);
                        setTimeout(() => {
                            throttleRef.current = false;
                        }, 500);
                    }
                } catch (error) {
                    console.error('Error in onZoomOrPan:', error);
                    setIsLoaded(true);
                    setTimeout(() => {
                        throttleRef.current = false;
                    }, 500);
                }
            }
        });

        // Handle resize
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== chartContainerRef.current) {
                return;
            }
            const newRect = entries[0].contentRect;
            chart.applyOptions({ width: newRect.width });
        });

        if (chartContainerRef.current) {
            resizeObserver.observe(chartContainerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, []);

    // Update charts when data changes
    useEffect(() => {
        if (lineSeriesRef.current && chartData.length > 0) {
            const currentVisibleRange = chartRef.current?.timeScale().getVisibleRange();
            lineSeriesRef.current.setData(chartData);
            lineSeriesRef.current.applyOptions({ visible: showValueLine });
            if (currentVisibleRange && chartData.length > 0) {
                setTimeout(() => {
                    if (chartRef.current && !isPaused) {
                        chartRef.current.timeScale().fitContent();
                    }
                }, 50);
            }
        }

        if (barSeriesRef.current && positiveBarData.length > 0) {
            barSeriesRef.current.setData(positiveBarData);
            barSeriesRef.current.applyOptions({ visible: showHistogram });
        }

        if (negBarSeriesRef.current && negativeBarData.length > 0) {
            negBarSeriesRef.current.setData(negativeBarData);
            negBarSeriesRef.current.applyOptions({ visible: showHistogram });
        }

        if (emaSeriesRef.current) {
            if (showEMA && emaData.length > 0) {
                emaSeriesRef.current.setData(emaData);
                emaSeriesRef.current.applyOptions({ visible: true });
            } else {
                emaSeriesRef.current.applyOptions({ visible: false });
            }
        }
    }, [filteredData, chartData, positiveBarData, negativeBarData, emaData, showValueLine, showHistogram, showEMA]);

    // Reset pagination state when data changes significantly
    useEffect(() => {
        if (filteredData.length < 10) {
            pageRef.current = 1;
            totalPage.current = 0;
            setIsEnd(false);
        }
    }, [filteredData.length]);

    // Update line chart color when color prop changes
    useEffect(() => {
        if (lineSeriesRef.current) {
            lineSeriesRef.current.applyOptions({ color: color });
        }
    }, [color]);

    // Add tooltips for the combined chart
    useEffect(() => {
        if (!chartRef.current || !chartContainerRef.current) return;

        const container = chartContainerRef.current;
        let tooltip: HTMLDivElement | null = null;

        const createTooltip = () => {
            tooltip = document.createElement('div');
            tooltip.style.cssText = `
                position: absolute;
                display: none;
                padding: 8px 12px;
                background: white;
                border: 1px solid #ccc;
                border-radius: 6px;
                font-size: 11px;
                color: black;
                pointer-events: none;
                z-index: 1000;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;
            container.appendChild(tooltip);
        };

        const showTooltip = (param: any) => {
            if (!tooltip) createTooltip();
            if (!tooltip || !param.time || !param.seriesData.size) {
                if (tooltip) tooltip.style.display = 'none';
                return;
            }
          
            const lineData = showValueLine ? param.seriesData.get(lineSeriesRef.current) : null;
            const barData = showHistogram ? param.seriesData.get(barSeriesRef.current) : null;
            const negBarData = showHistogram && negBarSeriesRef.current ? param.seriesData.get(negBarSeriesRef.current) : null;
            const emaDataPoint = showEMA ? param.seriesData.get(emaSeriesRef.current) : null;
            
            if (!lineData && !barData && !negBarData && !emaDataPoint) {
                tooltip.style.display = 'none';
                return;
            }
          
            const time = new Date((param.time as number) * 1000);
            let content = `<div><strong>Time: ${time.toISOString()}</strong></div>`;
            
            if (lineData && showValueLine) {
                content += `<div style="color: ${color};">Value: ${lineData.value.toFixed(2)}</div>`;
            }
            
            if (emaDataPoint && showEMA) {
                content += `<div style="color: #FF6B35;">EMA(${emaPeriod}): ${emaDataPoint.value.toFixed(2)}</div>`;
            }
            
            if (showHistogram) {
                if (hasDetailedData) {
                    // Show positive and negative impressions
                    if (barData) {
                        const actualPositive = barData.value / 0.3;
                        content += `<div style="color: #2563ec;">Positive Impressions: ${Math.abs(actualPositive).toFixed(0)}</div>`;
                    }
                    if (negBarData) {
                        const actualNegative = Math.abs(negBarData.value / 0.3);
                        content += `<div style="color: #EF4444;">Negative Impressions: ${actualNegative.toFixed(0)}</div>`;
                    }
                } else {
                    // Show net change for simple data
                    if (barData) {
                        const actualChange = barData.value / 0.3;
                        const changeType = actualChange >= 0 ? 'Increase' : 'Decrease';
                        const changeColor = actualChange >= 0 ? '#2563ec' : '#EF4444';
                        content += `<div style="color: ${changeColor};">${changeType}: ${Math.abs(actualChange).toFixed(2)}</div>`;
                    }
                }
            }
            
            tooltip.innerHTML = content;
            tooltip.style.display = 'block';
            tooltip.style.left = param.point?.x + 10 + 'px';
            tooltip.style.top = param.point?.y - 60 + 'px';
        };

        const hideTooltip = () => {
            if (tooltip) tooltip.style.display = 'none';
        };

        chartRef.current.subscribeCrosshairMove(showTooltip);
        container.addEventListener('mouseleave', hideTooltip);

        return () => {
            if (tooltip && container.contains(tooltip)) {
                container.removeChild(tooltip);
            }
            container.removeEventListener('mouseleave', hideTooltip);
        };
    }, [chartRef.current, color, hasDetailedData, emaPeriod, showValueLine, showHistogram, showEMA]);

    return (
        <div style={{ width: '100%' }}>
            {/* Data Info Banner */}
            {removeOutliers && (
                <div style={{
                    marginBottom: '10px',
                    padding: '8px 12px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#d1d5db'
                }}>
                    <strong>Outlier Removal Active:</strong> Removed {outlierStats.count} outliers ({outlierStats.percentage.toFixed(1)}%) 
                    | Showing {filteredData.length} of {data.length} data points
                    | Threshold: {outlierThreshold}σ
                    {hasDetailedData && " | Applied to Value, Positive & Negative Impressions"}
                </div>
            )}

            {/* Combined Chart */}
            <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
                    {hasDetailedData ? 'Value & Impressions Over Time' : 'Value & Net Change Over Time'}
                </h3>
                <div 
                    ref={chartContainerRef} 
                    style={{ 
                        width: '100%', 
                        height: '400px',
                        position: 'relative',
                        border: '1px solid #E5E7EB',
                        borderRadius: '4px'
                    }} 
                />
            </div>

            {/* Enhanced Legend with toggles for all series */}
            <div style={{ 
                marginTop: '10px', 
                fontSize: '12px', 
                display: 'flex', 
                gap: '15px',
                justifyContent: 'center',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                {/* Value Line Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                        type="checkbox"
                        checked={showValueLine}
                        onChange={(e) => setShowValueLine(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <div style={{ 
                        width: '16px', 
                        height: '2px', 
                        backgroundColor: showValueLine ? color : '#ccc',
                        borderRadius: '1px'
                    }}></div>
                    <span style={{ color: showValueLine ? 'inherit' : '#ccc' }}>
                        Value (Right Axis)
                    </span>
                </div>
                
                {/* EMA Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                        type="checkbox"
                        checked={showEMA}
                        onChange={(e) => setShowEMA(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <div style={{ 
                        width: '16px', 
                        height: '1px', 
                        backgroundColor: showEMA ? '#FF6B35' : '#ccc',
                        borderRadius: '1px',
                        borderTop: showEMA ? '1px dashed #FF6B35' : '1px dashed #ccc'
                    }}></div>
                    <span style={{ color: showEMA ? '#FF6B35' : '#ccc' }}>
                        EMA({emaPeriod})
                    </span>
                    {showEMA && (
                        <button
                            onClick={() => setShowEMASettings(!showEMASettings)}
                            style={{
                                marginLeft: '5px',
                                padding: '2px 6px',
                                fontSize: '10px',
                                background: 'transparent',
                                border: '1px solid #ccc',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                        >
                            ⚙️
                        </button>
                    )}
                </div>
                
                {/* Histogram Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                        type="checkbox"
                        checked={showHistogram}
                        onChange={(e) => setShowHistogram(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <span style={{ color: showHistogram ? 'inherit' : '#ccc' }}>
                        {hasDetailedData ? 'Impressions (Left Axis)' : 'Net Change (Left Axis)'}
                    </span>
                </div>

                {/* Outlier Removal Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input
                        type="checkbox"
                        checked={removeOutliers}
                        onChange={(e) => setRemoveOutliers(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <span style={{ color: removeOutliers ? '#10B981' : '#ccc' }}>
                        Remove Outliers
                    </span>
                    {removeOutliers && (
                        <button
                            onClick={() => setShowOutlierSettings(!showOutlierSettings)}
                            style={{
                                marginLeft: '5px',
                                padding: '2px 6px',
                                fontSize: '10px',
                                background: 'transparent',
                                border: '1px solid #ccc',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                        >
                            ⚙️
                        </button>
                    )}
                </div>

                {/* Pause Data Fetching */}
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

                {/* Bar Chart Legend - conditional based on data type */}
                {showHistogram && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ 
                                width: '12px', 
                                height: '12px', 
                                backgroundColor: '#2563ec',
                                borderRadius: '2px'
                            }}></div>
                            <span>{hasDetailedData ? 'Positive Impressions' : 'Positive Change'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div style={{ 
                                width: '12px', 
                                height: '12px', 
                                backgroundColor: '#EF4444',
                                borderRadius: '2px'
                            }}></div>
                            <span>{hasDetailedData ? 'Negative Impressions' : 'Negative Change'}</span>
                        </div>
                    </>
                )}
            </div>

            {/* EMA Settings Panel */}
            {showEMASettings && showEMA && (
                <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: '#151c25',
                    fontSize: '12px',
                    maxWidth: '200px',
                    margin: '10px auto 0 auto'
                }}>
                    <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>EMA Settings</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Period:
                        <input
                            type="number"
                            min="2"
                            max="200"
                            value={emaPeriod}
                            onChange={(e) => {
                                const value = parseInt(e.target.value);
                                if (value && value >= 2 && value <= 200) {
                                    setEmaPeriod(value);
                                }
                            }}
                            style={{
                                width: '60px',
                                padding: '4px 6px',
                                background: '#1f2937',
                                border: '1px solid #ccc',
                                borderRadius: '3px',
                                fontSize: '12px'
                            }}
                        />
                    </label>
                    <button
                        onClick={() => setShowEMASettings(false)}
                        style={{
                            marginTop: '8px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            background: '#1f2937',
                            border: '1px solid #ccc',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            float: 'right'
                        }}
                    >
                        Close
                    </button>
                    <div style={{ clear: 'both' }}></div>
                </div>
            )}

            {/* Outlier Settings Panel */}
            {showOutlierSettings && removeOutliers && (
                <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    backgroundColor: '#151c25',
                    fontSize: '12px',
                    maxWidth: '300px',
                    margin: '10px auto 0 auto'
                }}>
                    <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Outlier Detection Settings</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        Standard Deviations:
                        <input
                            type="number"
                            min="0.5"
                            max="5"
                            step="0.1"
                            value={outlierThreshold}
                            onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (value && value >= 0.5 && value <= 5) {
                                    setOutlierThreshold(value);
                                }
                            }}
                            style={{
                                width: '60px',
                                padding: '4px 6px',
                                background: '#1f2937',
                                border: '1px solid #ccc',
                                borderRadius: '3px',
                                fontSize: '12px'
                            }}
                        />
                    </label>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>
                        Higher values = fewer outliers removed<br/>
                        Lower values = more outliers removed<br/>
                        Recommended: 2.0-3.0
                    </div>
                    <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '8px' }}>
                        Current: {outlierStats.count} outliers ({outlierStats.percentage.toFixed(1)}%)
                    </div>
                    <button
                        onClick={() => setShowOutlierSettings(false)}
                        style={{
                            marginTop: '8px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            background: '#1f2937',
                            border: '1px solid #ccc',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            float: 'right'
                        }}
                    >
                        Close
                    </button>
                    <div style={{ clear: 'both' }}></div>
                </div>
            )}

            {/* Loading and Status Indicators */}
            {!isLoaded && (
                <div style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#d1d5db',
                    textAlign: 'center'
                }}>
                    Loading more data...
                </div>
            )}

            {isEnd && (
                <div style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#d1d5db',
                    textAlign: 'center'
                }}>
                    All data loaded
                </div>
            )}
        </div>
    );
};

export default LineGraph;