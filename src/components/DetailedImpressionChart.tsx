import React, { useState, useRef, useEffect } from "react";
import { createChart, ColorType, LineData, HistogramData, Time, IChartApi, ISeriesApi } from "lightweight-charts";

export type DetailedVImpression = {
    name: string; // Timestamp for the interval start
    posImpressions: number; // Portion of unique viewers from engaging content
    negImpressions: number; // Portion of unique viewers from non-engaging content
    engagementRate: number; // Total new engagements per new unique viewer
    newUniqueViewers: number;
    cumulativeUniqueViewers: number;
};

type ZoomReport = {
    totalpage: number;
    currentpage: number;
};

interface DetailedImpressionChartProps {
    data: DetailedVImpression[];
    funtype: string;
    onZoomOrPan?: (page: number, funtype: string) => Promise<ZoomReport>;
}

const DetailedImpressionChart: React.FC<DetailedImpressionChartProps> = ({ 
    data, 
    funtype, 
    onZoomOrPan 
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const posImpressionsSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const negImpressionsSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const engagementRateSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const newUniqueViewersSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const cumulativeUniqueViewersSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    
    const [isLoaded, setIsLoaded] = useState(true);
    const [isEnd, setIsEnd] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showPosImpressions, setShowPosImpressions] = useState(true);
    const [showNegImpressions, setShowNegImpressions] = useState(true);
    const [showEngagementRate, setShowEngagementRate] = useState(true);
    const [showNewUniqueViewers, setShowNewUniqueViewers] = useState(true);
    const [showCumulativeUniqueViewers, setShowCumulativeUniqueViewers] = useState(true);
    
    const pageRef = useRef(1);
    const totalPage = useRef(0);
    const throttleRef = useRef(false);

    // Process data for charts
    const processedData = React.useMemo(() => {
        const sortedData = [...data].sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
        
        const posImpressionsData: HistogramData[] = [];
        const negImpressionsData: HistogramData[] = [];
        const engagementRateData: LineData[] = [];
        const newUniqueViewersData: LineData[] = [];
        const cumulativeUniqueViewersData: LineData[] = [];

        sortedData.forEach((item) => {
            const time = Math.floor(new Date(item.name).getTime() / 1000) as Time;

            posImpressionsData.push({
                time,
                value: item.posImpressions,
                color: '#10B981' // Green for positive
            });

            negImpressionsData.push({
                time,
                value: -item.negImpressions, // Negative to show downward
                color: '#EF4444' // Red for negative
            });

            engagementRateData.push({
                time,
                value: item.engagementRate
            });

            newUniqueViewersData.push({
                time,
                value: item.newUniqueViewers
            });

            cumulativeUniqueViewersData.push({
                time,
                value: item.cumulativeUniqueViewers
            });
        });

        return { 
            posImpressionsData, 
            negImpressionsData, 
            engagementRateData, 
            newUniqueViewersData, 
            cumulativeUniqueViewersData 
        };
    }, [data]);

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
                horzLines: { visible: false, color: '#E5E7EB', style: 2 },
            },
            crosshair: {
                mode: 1,
            },
            rightPriceScale: {
                visible: true,
                borderVisible: false,
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

        // Create positive impressions histogram series
        const posImpressionsSeries = chart.addHistogramSeries({
            color: '#10B981',
            visible: showPosImpressions,
            priceFormat: {
                type: 'volume',
            },
        });

        // Create negative impressions histogram series
        const negImpressionsSeries = chart.addHistogramSeries({
            color: '#EF4444',
            visible: showNegImpressions,
            priceFormat: {
                type: 'volume',
            },
        });

        // Create engagement rate line series
        const engagementRateSeries = chart.addLineSeries({
            color: '#8B5CF6',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            visible: showEngagementRate,
            priceFormat: {
                type: 'percent',
                precision: 2,
            },
        });

        // Create new unique viewers line series
        const newUniqueViewersSeries = chart.addLineSeries({
            color: '#F59E0B',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            visible: showNewUniqueViewers,
            priceFormat: {
                type: 'volume',
            },
        });

        // Create cumulative unique viewers line series
        const cumulativeUniqueViewersSeries = chart.addLineSeries({
            color: '#3B82F6',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            visible: showCumulativeUniqueViewers,
            priceFormat: {
                type: 'volume',
            },
        });

        // Set data
        if (processedData.posImpressionsData.length > 0) {
            posImpressionsSeries.setData(processedData.posImpressionsData);
        }
        if (processedData.negImpressionsData.length > 0) {
            negImpressionsSeries.setData(processedData.negImpressionsData);
        }
        if (processedData.engagementRateData.length > 0) {
            engagementRateSeries.setData(processedData.engagementRateData);
        }
        if (processedData.newUniqueViewersData.length > 0) {
            newUniqueViewersSeries.setData(processedData.newUniqueViewersData);
        }
        if (processedData.cumulativeUniqueViewersData.length > 0) {
            cumulativeUniqueViewersSeries.setData(processedData.cumulativeUniqueViewersData);
        }

        // Store references
        chartRef.current = chart;
        posImpressionsSeriesRef.current = posImpressionsSeries;
        negImpressionsSeriesRef.current = negImpressionsSeries;
        engagementRateSeriesRef.current = engagementRateSeries;
        newUniqueViewersSeriesRef.current = newUniqueViewersSeries;
        cumulativeUniqueViewersSeriesRef.current = cumulativeUniqueViewersSeries;

        // Set initial visible range
        if (processedData.engagementRateData.length > 5) {
            const startIndex = Math.max(0, processedData.engagementRateData.length - 20);
            const endIndex = processedData.engagementRateData.length - 1;
            
            if (startIndex < processedData.engagementRateData.length && endIndex < processedData.engagementRateData.length) {
                chart.timeScale().setVisibleRange({
                    from: processedData.engagementRateData[startIndex].time,
                    to: processedData.engagementRateData[endIndex].time,
                });
            }
        }

        // Handle visible range changes for pagination
        chart.timeScale().subscribeVisibleTimeRangeChange(async (newVisibleTimeRange) => {
            if (!newVisibleTimeRange || !onZoomOrPan || isEnd || !isLoaded || throttleRef.current || isPaused) {
                return;
            }

            const startTime = newVisibleTimeRange.from as number;
            const startIndex = processedData.engagementRateData.findIndex(point => (point.time as number) >= startTime);
            
            if (startIndex < 2 && startIndex >= 0) {
                throttleRef.current = true;
                setIsLoaded(false);
                
                try {
                    console.log('Loading more data for page:', pageRef.current);
                    const report = await onZoomOrPan(pageRef.current, funtype);
                    console.log('Zoom/Pan report:', report);
                    
                    if (report.totalpage > 0) {
                        totalPage.current = report.totalpage;
                        if (report.totalpage > pageRef.current) {
                            pageRef.current = report.currentpage + 1;
                            console.log('Updated page to:', pageRef.current);
                        } else {
                            setIsEnd(true);
                            console.log('Reached end of data');
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
        if (posImpressionsSeriesRef.current && 
            negImpressionsSeriesRef.current && 
            engagementRateSeriesRef.current && 
            newUniqueViewersSeriesRef.current && 
            cumulativeUniqueViewersSeriesRef.current && 
            processedData.engagementRateData.length > 0) {
            
            const currentVisibleRange = chartRef.current?.timeScale().getVisibleRange();
            
            posImpressionsSeriesRef.current.setData(processedData.posImpressionsData);
            negImpressionsSeriesRef.current.setData(processedData.negImpressionsData);
            engagementRateSeriesRef.current.setData(processedData.engagementRateData);
            newUniqueViewersSeriesRef.current.setData(processedData.newUniqueViewersData);
            cumulativeUniqueViewersSeriesRef.current.setData(processedData.cumulativeUniqueViewersData);
            
            if (currentVisibleRange && processedData.engagementRateData.length > 0) {
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

    // Toggle series visibility
    useEffect(() => {
        if (posImpressionsSeriesRef.current) {
            posImpressionsSeriesRef.current.applyOptions({ visible: showPosImpressions });
        }
    }, [showPosImpressions]);

    useEffect(() => {
        if (negImpressionsSeriesRef.current) {
            negImpressionsSeriesRef.current.applyOptions({ visible: showNegImpressions });
        }
    }, [showNegImpressions]);

    useEffect(() => {
        if (engagementRateSeriesRef.current) {
            engagementRateSeriesRef.current.applyOptions({ visible: showEngagementRate });
        }
    }, [showEngagementRate]);

    useEffect(() => {
        if (newUniqueViewersSeriesRef.current) {
            newUniqueViewersSeriesRef.current.applyOptions({ visible: showNewUniqueViewers });
        }
    }, [showNewUniqueViewers]);

    useEffect(() => {
        if (cumulativeUniqueViewersSeriesRef.current) {
            cumulativeUniqueViewersSeriesRef.current.applyOptions({ visible: showCumulativeUniqueViewers });
        }
    }, [showCumulativeUniqueViewers]);

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
                padding: 8px 12px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none;
                z-index: 1000;
                white-space: nowrap;
                max-width: 300px;
            `;
            container.appendChild(tooltip);
        };

        const showTooltip = (param: any) => {
            if (!tooltip) createTooltip();
            if (!tooltip || !param.time || !param.seriesData.size) {
                if (tooltip) tooltip.style.display = 'none';
                return;
            }

            const posImpressionsData = param.seriesData.get(posImpressionsSeriesRef.current);
            const negImpressionsData = param.seriesData.get(negImpressionsSeriesRef.current);
            const engagementRateData = param.seriesData.get(engagementRateSeriesRef.current);
            const newUniqueViewersData = param.seriesData.get(newUniqueViewersSeriesRef.current);
            const cumulativeUniqueViewersData = param.seriesData.get(cumulativeUniqueViewersSeriesRef.current);
            const time = new Date((param.time as number) * 1000);
            
            let tooltipContent = `<div style="margin-bottom: 4px;"><strong>${time.toISOString()}</strong></div>`;
            
            if (posImpressionsData && showPosImpressions) {
                tooltipContent += `<div style="color: #10B981;">Positive Impressions: ${posImpressionsData.value.toLocaleString()}</div>`;
            }
            
            if (negImpressionsData && showNegImpressions) {
                tooltipContent += `<div style="color: #EF4444;">Negative Impressions: ${Math.abs(negImpressionsData.value).toLocaleString()}</div>`;
            }
            
            if (engagementRateData && showEngagementRate) {
                tooltipContent += `<div style="color: #8B5CF6;">Engagement Rate: ${(engagementRateData.value * 100).toFixed(2)}%</div>`;
            }
            
            if (newUniqueViewersData && showNewUniqueViewers) {
                tooltipContent += `<div style="color: #F59E0B;">New Unique Viewers: ${newUniqueViewersData.value.toLocaleString()}</div>`;
            }
            
            if (cumulativeUniqueViewersData && showCumulativeUniqueViewers) {
                tooltipContent += `<div style="color: #3B82F6;">Cumulative Unique Viewers: ${cumulativeUniqueViewersData.value.toLocaleString()}</div>`;
            }
            
            tooltip.innerHTML = tooltipContent;
            tooltip.style.display = 'block';
            tooltip.style.left = Math.min(param.point.x + 10, container.clientWidth - 320) + 'px';
            tooltip.style.top = Math.max(param.point.y - 100, 10) + 'px';
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
    }, [showPosImpressions, showNegImpressions, showEngagementRate, showNewUniqueViewers, showCumulativeUniqueViewers]);

    return (
        <div style={{ width: '100%', height: '400px' }}>
            {/* Legend Controls */}
            <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginBottom: '8px',
                padding: '8px',
                backgroundColor: '#1f2937',
                borderRadius: '4px',
                flexWrap: 'wrap',
                alignItems: 'center',
                fontSize: '13px'
            }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showPosImpressions}
                        onChange={(e) => setShowPosImpressions(e.target.checked)}
                    />
                    <span style={{ 
                        width: '16px', 
                        height: '12px', 
                        backgroundColor: '#10B981', 
                        display: 'inline-block',
                        marginRight: '4px'
                    }}></span>
                    Positive Impressions
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showNegImpressions}
                        onChange={(e) => setShowNegImpressions(e.target.checked)}
                    />
                    <span style={{ 
                        width: '16px', 
                        height: '12px', 
                        backgroundColor: '#EF4444', 
                        display: 'inline-block',
                        marginRight: '4px'
                    }}></span>
                    Negative Impressions
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showEngagementRate}
                        onChange={(e) => setShowEngagementRate(e.target.checked)}
                    />
                    <span style={{ 
                        width: '16px', 
                        height: '2px', 
                        backgroundColor: '#8B5CF6', 
                        display: 'inline-block',
                        marginRight: '4px'
                    }}></span>
                    Engagement Rate
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showNewUniqueViewers}
                        onChange={(e) => setShowNewUniqueViewers(e.target.checked)}
                    />
                    <span style={{ 
                        width: '16px', 
                        height: '2px', 
                        backgroundColor: '#F59E0B', 
                        display: 'inline-block',
                        marginRight: '4px'
                    }}></span>
                    New Unique Viewers
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showCumulativeUniqueViewers}
                        onChange={(e) => setShowCumulativeUniqueViewers(e.target.checked)}
                    />
                    <span style={{ 
                        width: '16px', 
                        height: '2px', 
                        backgroundColor: '#3B82F6', 
                        display: 'inline-block',
                        marginRight: '4px'
                    }}></span>
                    Cumulative Unique Viewers
                </label>
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
                            borderTop: '2px solid #3B82F6',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        Loading...
                    </div>
                )}
            </div>
            
            {/* Chart Container */}
            <div 
                ref={chartContainerRef} 
                style={{ 
                    width: '100%', 
                    height: 'calc(100% - 80px)',
                    position: 'relative',
                    border: '1px solid #E5E7EB',
                    borderRadius: '4px'
                }} 
            />
            
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};



export default DetailedImpressionChart;