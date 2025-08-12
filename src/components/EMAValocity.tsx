import React, { useState, useRef, useEffect } from "react";
import { createChart, ColorType, LineData, Time, IChartApi, ISeriesApi } from "lightweight-charts";

export interface TierMetrics {
    impressions: number;
    engagement: number;
    volume: number;
}

export interface TieredInfluence {
    name: string;
    whale: TierMetrics;
    shark: TierMetrics;
    retail: TierMetrics;
}

type ZoomReport = {
    totalpage: number;
    currentpage: number;
};

interface EMAVelocityChartProps {
    data: TieredInfluence[];
    funtype: string;
    onZoomOrPan?: (page: number, funtype: string) => Promise<ZoomReport>;
}

const EMAVelocityChart: React.FC<EMAVelocityChartProps> = ({ 
    data, 
    funtype, 
    onZoomOrPan 
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const velocitySeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const zeroLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    
    const [isLoaded, setIsLoaded] = useState(true);
    const [isEnd, setIsEnd] = useState(false);
    const [showZeroLine, setShowZeroLine] = useState(true);
    const [emaPeriod, setEmaPeriod] = useState(14);
    const [velocityPeriod, setVelocityPeriod] = useState(3);
    const [showSettings, setShowSettings] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<'impressions' | 'engagement' | 'volume'>('impressions');
    const [showMetricSettings, setShowMetricSettings] = useState(false);
    const [colorMode, setColorMode] = useState<'gradient' | 'momentum' | 'solid'>('gradient');
    const pageRef = useRef(1);
    const totalPage = useRef(0);
    const throttleRef = useRef(false);

    // Calculate EMA
    const calculateEMA = (values: number[], period: number = 14): number[] => {
        const ema: number[] = [];
        const multiplier = 2 / (period + 1);
        
        if (values.length === 0) return ema;
        
        ema[0] = values[0];
        
        for (let i = 1; i < values.length; i++) {
            ema[i] = (values[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
        }
        
        return ema;
    };

    // Calculate EMA Velocity (rate of change)
    const calculateVelocity = (emaValues: number[], period: number = 3): number[] => {
        const velocity: number[] = [];
        
        for (let i = 0; i < emaValues.length; i++) {
            if (i < period) {
                velocity[i] = 0;
            } else {
                const change = emaValues[i] - emaValues[i - period];
                const timeSpan = period;
                velocity[i] = change / timeSpan;
            }
        }
        
        return velocity;
    };

    // Get color based on velocity value and mode
    const getVelocityColor = (velocity: number, mode: string) => {
        switch (mode) {
            case 'momentum':
                if (velocity > 0) return '#10B981'; // Green for positive
                if (velocity < 0) return '#EF4444'; // Red for negative
                return '#6B7280'; // Gray for zero
            case 'gradient':
                const intensity = Math.min(Math.abs(velocity) / 100, 1); // Normalize intensity
                if (velocity > 0) {
                    return `rgba(16, 185, 129, ${0.5 + intensity * 0.5})`; // Green gradient
                } else if (velocity < 0) {
                    return `rgba(239, 68, 68, ${0.5 + intensity * 0.5})`; // Red gradient
                }
                return '#6B7280';
            case 'solid':
            default:
                return '#8B5CF6'; // Purple
        }
    };

    // Process data for velocity calculation
    const processedData = React.useMemo(() => {
        const sortedData = [...data].sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
        
        const netChangeValues: number[] = [];
        const timeValues: Time[] = [];
        
        sortedData.forEach((item) => {
            const time = Math.floor(new Date(item.name).getTime() / 1000) as Time;
            const netTotal = item.whale[selectedMetric] + item.shark[selectedMetric] + item.retail[selectedMetric];
            
            netChangeValues.push(netTotal);
            timeValues.push(time);
        });

        // Calculate EMA for net change values
        const emaValues = calculateEMA(netChangeValues, emaPeriod);
        
        // Calculate velocity of EMA
        const velocityValues = calculateVelocity(emaValues, velocityPeriod);
        
        const velocityData: LineData[] = velocityValues.map((value, index) => ({
            time: timeValues[index],
            value
        }));

        // Create zero line data
        const zeroLineData: LineData[] = timeValues.map(time => ({
            time,
            value: 0
        }));
        
        return { velocityData, zeroLineData, velocityValues };
    }, [data, emaPeriod, velocityPeriod, selectedMetric]);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#fff',
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: true, color: '#374151', style: 2 },
            },
            crosshair: {
                mode: 1,
            },
            rightPriceScale: {
                visible: true,
                borderVisible: false,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
            timeScale: {
                visible: true,
                borderVisible: false,
                timeVisible: true,
                secondsVisible: false,
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

        // Create velocity line series
        const velocitySeries = chart.addLineSeries({
            color: getVelocityColor(0, colorMode),
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            lastValueVisible: true,
            priceLineVisible: false,
        });

        // Create zero line series
        const zeroLineSeries = chart.addLineSeries({
            color: '#6B7280',
            lineWidth: 1,
            lineStyle: 2, // Dashed line
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
            visible: showZeroLine,
        });

        // Set data
        if (processedData.velocityData.length > 0) {
            velocitySeries.setData(processedData.velocityData);
        }
        if (processedData.zeroLineData.length > 0) {
            zeroLineSeries.setData(processedData.zeroLineData);
        }

        // Store references
        chartRef.current = chart;
        velocitySeriesRef.current = velocitySeries;
        zeroLineSeriesRef.current = zeroLineSeries;

        // Set initial visible range
        if (processedData.velocityData.length > 5) {
            const startIndex = Math.max(0, processedData.velocityData.length - 20);
            const endIndex = processedData.velocityData.length - 1;
            
            if (startIndex < processedData.velocityData.length && endIndex < processedData.velocityData.length) {
                chart.timeScale().setVisibleRange({
                    from: processedData.velocityData[startIndex].time,
                    to: processedData.velocityData[endIndex].time,
                });
            }
        }

        // Handle visible range changes for pagination
        chart.timeScale().subscribeVisibleTimeRangeChange(async (newVisibleTimeRange) => {
            if (!newVisibleTimeRange || !onZoomOrPan || isEnd || !isLoaded || throttleRef.current || isPaused) {
                return;
            }

            const startTime = newVisibleTimeRange.from as number;
            const startIndex = processedData.velocityData.findIndex(point => (point.time as number) >= startTime);
            
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

    // Update chart data when props change
    useEffect(() => {
        if (velocitySeriesRef.current && zeroLineSeriesRef.current && processedData.velocityData.length > 0) {
            const currentVisibleRange = chartRef.current?.timeScale().getVisibleRange();
            
            velocitySeriesRef.current.setData(processedData.velocityData);
            zeroLineSeriesRef.current.setData(processedData.zeroLineData);
            
            if (currentVisibleRange && processedData.velocityData.length > 0) {
                setTimeout(() => {
                    if (chartRef.current && !isPaused) {
                        chartRef.current.timeScale().fitContent();
                    }
                }, 50);
            }
        }
    }, [data, processedData]);

    // Reset pagination state when data changes significantly
    useEffect(() => {
        if (data.length < 10) {
            pageRef.current = 1;
            totalPage.current = 0;
            setIsEnd(false);
        }
    }, [data.length]);

    // Toggle zero line visibility
    useEffect(() => {
        if (zeroLineSeriesRef.current) {
            zeroLineSeriesRef.current.applyOptions({ visible: showZeroLine });
        }
    }, [showZeroLine]);

    // Update line color when color mode changes
    useEffect(() => {
        if (velocitySeriesRef.current) {
            velocitySeriesRef.current.applyOptions({ 
                color: getVelocityColor(0, colorMode)
            });
        }
    }, [colorMode]);

    // Custom tooltip
    useEffect(() => {
        if (!chartRef.current || !chartContainerRef.current) return;

        const container = chartContainerRef.current;
        let tooltip: HTMLDivElement | null = null;

        const createTooltip = () => {
            tooltip = document.createElement('div');
            tooltip.style.cssText = `
                position: absolute;
                display: none;
                padding: 12px 16px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                border-radius: 8px;
                font-size: 13px;
                pointer-events: none;
                z-index: 1000;
                white-space: nowrap;
                max-width: 280px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            `;
            container.appendChild(tooltip);
        };

        const showTooltip = (param: any) => {
            if (!tooltip) createTooltip();
            if (!tooltip || !param.time || !param.seriesData.size) {
                if (tooltip) tooltip.style.display = 'none';
                return;
            }

            const velocityData = param.seriesData.get(velocitySeriesRef.current);
            const time = new Date((param.time as number) * 1000);
            
            if (velocityData) {
                const velocityValue = velocityData.value;
                const velocityDirection = velocityValue > 0 ? '↗️' : velocityValue < 0 ? '↘️' : '➡️';
                const velocityMagnitude = Math.abs(velocityValue);
                const velocityIntensity = velocityMagnitude < 1 ? 'Low' : 
                                        velocityMagnitude < 10 ? 'Medium' : 'High';
                
                let tooltipContent = `
                    <div style="margin-bottom: 8px; font-weight: bold; font-size: 14px;">
                        ${time.toISOString()}
                    </div>
                    <div style="margin-bottom: 6px; font-size: 11px; color: #9CA3AF;">
                        Metric: ${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
                    </div>
                    <div style="margin-bottom: 6px; font-size: 11px; color: #9CA3AF;">
                        EMA Period: ${emaPeriod} | Velocity Period: ${velocityPeriod}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <span style="font-size: 16px;">${velocityDirection}</span>
                        <span style="color: #8B5CF6; font-weight: bold;">
                            Velocity: ${velocityValue.toFixed(4)}
                        </span>
                    </div>
                    <div style="font-size: 11px; color: #9CA3AF;">
                        Intensity: ${velocityIntensity} | Magnitude: ${velocityMagnitude.toFixed(4)}
                    </div>
                `;
                
                tooltip.innerHTML = tooltipContent;
                tooltip.style.display = 'block';
                tooltip.style.left = Math.min(param.point.x + 15, container.clientWidth - 300) + 'px';
                tooltip.style.top = Math.max(param.point.y - 100, 10) + 'px';
            }
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
    }, [emaPeriod, velocityPeriod, selectedMetric]);

    const getMetricDescription = (metric: string) => {
        switch (metric) {
            case 'impressions':
                return 'Rate of change in total views velocity';
            case 'engagement':
                return 'Rate of change in engagement momentum';
            case 'volume':
                return 'Rate of change in tweet volume acceleration';
            default:
                return '';
        }
    };

    const getVelocityStats = () => {
        if (processedData.velocityValues.length === 0) return null;
        
        const values = processedData.velocityValues;
        const positive = values.filter(v => v > 0).length;
        const negative = values.filter(v => v < 0).length;
        const neutral = values.filter(v => v === 0).length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        
        return { positive, negative, neutral, max, min, avg, total: values.length };
    };

    const stats = getVelocityStats();

    return (
        <div style={{ width: '100%', height: '500px' }}>
            {/* Controls */}
            <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginBottom: '8px',
                padding: '12px',
                backgroundColor: '#1f2937',
                borderRadius: '8px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                {/* Basic Controls */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showZeroLine}
                        onChange={(e) => setShowZeroLine(e.target.checked)}
                    />
                    <span style={{ 
                        width: '16px', 
                        height: '1px', 
                        backgroundColor: '#6B7280', 
                        display: 'inline-block',
                        marginRight: '4px'
                    }}></span>
                    Zero Line
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
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
                    Pause Data
                </label>

                {/* Color Mode */}
                <select
                    value={colorMode}
                    onChange={(e) => setColorMode(e.target.value as typeof colorMode)}
                    style={{
                        background: '#374151',
                        border: '1px solid #4B5563',
                        color: '#D1D5DB',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px'
                    }}
                >
                    <option value="gradient">Gradient</option>
                    <option value="momentum">Momentum</option>
                    <option value="solid">Solid</option>
                </select>

                {/* Settings Buttons */}
                <button
                    onClick={() => setShowMetricSettings(!showMetricSettings)}
                    style={{
                        background: 'transparent',
                        border: '1px solid #374151',
                        color: '#D1D5DB',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    📊 {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
                </button>

                <button
                    onClick={() => setShowSettings(!showSettings)}
                    style={{
                        background: 'transparent',
                        border: '1px solid #374151',
                        color: '#D1D5DB',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    ⚙️ EMA ({emaPeriod},{velocityPeriod})
                </button>

                {/* Loading indicator */}
                {!isLoaded && (
                    <div style={{ 
                        marginLeft: 'auto',
                        fontSize: '12px',
                        color: '#6B7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            border: '2px solid #E5E7EB',
                            borderTop: '2px solid #8B5CF6',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        Loading...
                    </div>
                )}
            </div>

            {/* Velocity Stats */}
            {stats && (
                <div style={{
                    marginBottom: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#374151',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#D1D5DB',
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap'
                }}>
                    <span>↗️ Positive: {stats.positive} ({((stats.positive/stats.total)*100).toFixed(1)}%)</span>
                    <span>↘️ Negative: {stats.negative} ({((stats.negative/stats.total)*100).toFixed(1)}%)</span>
                    <span>➡️ Neutral: {stats.neutral}</span>
                    <span>📈 Max: {stats.max.toFixed(4)}</span>
                    <span>📉 Min: {stats.min.toFixed(4)}</span>
                    <span>📊 Avg: {stats.avg.toFixed(4)}</span>
                </div>
            )}

            {/* Metric Settings */}
            {showMetricSettings && (
                <div style={{
                    marginBottom: '8px',
                    padding: '12px',
                    backgroundColor: '#374151',
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap'
                    }}>
                        {(['impressions', 'engagement', 'volume'] as const).map(metric => (
                            <label key={metric} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                color: '#D1D5DB'
                            }}>
                                <input
                                    type="radio"
                                    name="metric"
                                    value={metric}
                                    checked={selectedMetric === metric}
                                    onChange={(e) => setSelectedMetric(e.target.value as typeof selectedMetric)}
                                />
                                {metric.charAt(0).toUpperCase() + metric.slice(1)}
                            </label>
                        ))}
                    </div>
                    <div style={{
                        fontSize: '11px',
                        color: '#9CA3AF',
                        fontStyle: 'italic'
                    }}>
                        {getMetricDescription(selectedMetric)}
                    </div>
                </div>
            )}

            {/* EMA Settings */}
            {showSettings && (
                <div style={{
                    marginBottom: '8px',
                    padding: '12px',
                    backgroundColor: '#374151',
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        flexWrap: 'wrap',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ color: '#D1D5DB', fontSize: '12px' }}>EMA Period:</label>
                            <input
                                type="number"
                                value={emaPeriod}
                                onChange={(e) => setEmaPeriod(Math.max(1, Math.min(200, parseInt(e.target.value) || 14)))}
                                style={{
                                    background: '#1F2937',
                                    border: '1px solid #4B5563',
                                    color: '#D1D5DB',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    width: '60px'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ color: '#D1D5DB', fontSize: '12px' }}>Velocity Period:</label>
                            <input
                                type="number"
                                value={velocityPeriod}
                                onChange={(e) => setVelocityPeriod(Math.max(1, Math.min(50, parseInt(e.target.value) || 3)))}
                                style={{
                                    background: '#1F2937',
                                    border: '1px solid #4B5563',
                                    color: '#D1D5DB',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    width: '60px'
                                }}
                            />
                        </div>
                    </div>
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={() => { setEmaPeriod(7); setVelocityPeriod(2); }}
                            style={{
                                background: '#1F2937',
                                border: '1px solid #4B5563',
                                color: '#D1D5DB',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer'
                            }}
                        >
                            Fast (7,2)
                        </button>
                        <button
                            onClick={() => { setEmaPeriod(14); setVelocityPeriod(3); }}
                            style={{
                                background: '#1F2937',
                                border: '1px solid #4B5563',
                                color: '#D1D5DB',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer'
                            }}
                        >
                            Medium (14,3)
                        </button>
                        <button
                            onClick={() => { setEmaPeriod(21); setVelocityPeriod(5); }}
                            style={{
                                background: '#1F2937',
                                border: '1px solid #4B5563',
                                color: '#D1D5DB',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer'
                            }}
                        >
                            Slow (21,5)
                        </button>
                    </div>
                </div>
            )}

            {/* Chart Container */}
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* CSS for animations */}
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}
            </style>
        </div>
    );
};

export default EMAVelocityChart;