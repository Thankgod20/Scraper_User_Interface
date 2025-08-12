import React, { useState, useRef, useEffect } from "react";
import { createChart, ColorType, LineData, Time, IChartApi, ISeriesApi } from "lightweight-charts";

export type TieredAccountCount = {
    name: string;     // Timestamp (formatted)
    whale: number;    // >10,000 followers
    shark: number;    // 1,000–10,000
    retail: number;   // <1,000
};

type ZoomReport = {
    totalpage: number;
    currentpage: number;
};

interface TieredAccountLineChartProps {
    data: TieredAccountCount[];
    funtype: string;
    onZoomOrPan?: (page: number, funtype: string) => Promise<ZoomReport>;
}

const TieredAccountLineChart: React.FC<TieredAccountLineChartProps> = ({ 
    data, 
    funtype, 
    onZoomOrPan 
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const whaleSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const sharkSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const retailSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    
    const [isLoaded, setIsLoaded] = useState(true);
    const [isEnd, setIsEnd] = useState(false);
    const [showWhale, setShowWhale] = useState(true);
    const [showShark, setShowShark] = useState(true);
    const [showRetail, setShowRetail] = useState(true);
    
    const pageRef = useRef(1);
    const totalPage = useRef(0);
    const throttleRef = useRef(false);

    // Process data for line charts
    const processedData = React.useMemo(() => {
        const sortedData = [...data].sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
        
        const whaleData: LineData[] = [];
        const sharkData: LineData[] = [];
        const retailData: LineData[] = [];

        sortedData.forEach((item) => {
            const time = Math.floor(new Date(item.name).getTime() / 1000) as Time;

            whaleData.push({
                time,
                value: item.whale
            });

            sharkData.push({
                time,
                value: item.shark
            });

            retailData.push({
                time,
                value: item.retail
            });
        });

        return { whaleData, sharkData, retailData };
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
                axisPressedMouseMove: false,
                mouseWheel: false,
                pinch: false,
            },
        });

        // Create whale line series
        const whaleSeries = chart.addLineSeries({
            color: '#3B82F6',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            visible: showWhale,
            priceFormat: {
                type: 'volume',
            },
        });

        // Create shark line series
        const sharkSeries = chart.addLineSeries({
            color: '#10B981',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            visible: showShark,
            priceFormat: {
                type: 'volume',
            },
        });

        // Create retail line series
        const retailSeries = chart.addLineSeries({
            color: '#F59E0B',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            visible: showRetail,
            priceFormat: {
                type: 'volume',
            },
        });

        // Set data
        if (processedData.whaleData.length > 0) {
            whaleSeries.setData(processedData.whaleData);
        }
        if (processedData.sharkData.length > 0) {
            sharkSeries.setData(processedData.sharkData);
        }
        if (processedData.retailData.length > 0) {
            retailSeries.setData(processedData.retailData);
        }

        // Store references
        chartRef.current = chart;
        whaleSeriesRef.current = whaleSeries;
        sharkSeriesRef.current = sharkSeries;
        retailSeriesRef.current = retailSeries;

        // Set initial visible range
        if (processedData.whaleData.length > 5) {
            const startIndex = Math.max(0, processedData.whaleData.length - 20);
            const endIndex = processedData.whaleData.length - 1;
            
            if (startIndex < processedData.whaleData.length && endIndex < processedData.whaleData.length) {
                chart.timeScale().setVisibleRange({
                    from: processedData.whaleData[startIndex].time,
                    to: processedData.whaleData[endIndex].time,
                });
            }
        }

        // Handle visible range changes for pagination
        chart.timeScale().subscribeVisibleTimeRangeChange(async (newVisibleTimeRange) => {
            if (!newVisibleTimeRange || !onZoomOrPan || isEnd || !isLoaded || throttleRef.current) {
                return;
            }

            const startTime = newVisibleTimeRange.from as number;
            const startIndex = processedData.whaleData.findIndex(point => (point.time as number) >= startTime);
            
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
        if (whaleSeriesRef.current && sharkSeriesRef.current && retailSeriesRef.current && processedData.whaleData.length > 0) {
            const currentVisibleRange = chartRef.current?.timeScale().getVisibleRange();
            
            whaleSeriesRef.current.setData(processedData.whaleData);
            sharkSeriesRef.current.setData(processedData.sharkData);
            retailSeriesRef.current.setData(processedData.retailData);
            
            if (currentVisibleRange && processedData.whaleData.length > 0) {
                setTimeout(() => {
                    if (chartRef.current) {
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
        if (whaleSeriesRef.current) {
            whaleSeriesRef.current.applyOptions({ visible: showWhale });
        }
    }, [showWhale]);

    useEffect(() => {
        if (sharkSeriesRef.current) {
            sharkSeriesRef.current.applyOptions({ visible: showShark });
        }
    }, [showShark]);

    useEffect(() => {
        if (retailSeriesRef.current) {
            retailSeriesRef.current.applyOptions({ visible: showRetail });
        }
    }, [showRetail]);

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
                max-width: 200px;
            `;
            container.appendChild(tooltip);
        };

        const showTooltip = (param: any) => {
            if (!tooltip) createTooltip();
            if (!tooltip || !param.time || !param.seriesData.size) {
                if (tooltip) tooltip.style.display = 'none';
                return;
            }

            const whaleData = param.seriesData.get(whaleSeriesRef.current);
            const sharkData = param.seriesData.get(sharkSeriesRef.current);
            const retailData = param.seriesData.get(retailSeriesRef.current);
            const time = new Date((param.time as number) * 1000);
            
            let tooltipContent = `<div style="margin-bottom: 4px;"><strong>${time.toLocaleString()}</strong></div>`;
            
            if (whaleData && showWhale) {
                tooltipContent += `<div style="color: #3B82F6;">Whale (>10K): ${whaleData.value.toLocaleString()}</div>`;
            }
            
            if (sharkData && showShark) {
                tooltipContent += `<div style="color: #10B981;">Shark (1K-10K): ${sharkData.value.toLocaleString()}</div>`;
            }
            
            if (retailData && showRetail) {
                tooltipContent += `<div style="color: #F59E0B;">Retail (<1K): ${retailData.value.toLocaleString()}</div>`;
            }
            
            // Calculate total
            const total = (whaleData?.value || 0) + (sharkData?.value || 0) + (retailData?.value || 0);
            if (total > 0) {
                tooltipContent += `<div style="color: #E5E7EB; margin-top: 4px; border-top: 1px solid #374151; padding-top: 4px;">Total: ${total.toLocaleString()}</div>`;
            }
            
            tooltip.innerHTML = tooltipContent;
            tooltip.style.display = 'block';
            tooltip.style.left = Math.min(param.point.x + 10, container.clientWidth - 220) + 'px';
            tooltip.style.top = Math.max(param.point.y - 80, 10) + 'px';
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
    }, [showWhale, showShark, showRetail]);

    return (
        <div style={{ width: '100%', height: '400px' }}>
            {/* Legend Controls */}
            <div style={{ 
                display: 'flex', 
                gap: '16px', 
                marginBottom: '8px',
                padding: '8px',
                backgroundColor: '#1f2937',
                borderRadius: '4px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showWhale}
                        onChange={(e) => setShowWhale(e.target.checked)}
                    />
                    <span style={{ 
                        width: '16px', 
                        height: '2px', 
                        backgroundColor: '#3B82F6', 
                        display: 'inline-block',
                        marginRight: '4px'
                    }}></span>
                    Whale (Greater than 10K followers)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showShark}
                        onChange={(e) => setShowShark(e.target.checked)}
                    />
                    <span style={{ 
                        width: '16px', 
                        height: '2px', 
                        backgroundColor: '#10B981', 
                        display: 'inline-block',
                        marginRight: '4px'
                    }}></span>
                    Shark (1K-10K followers)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={showRetail}
                        onChange={(e) => setShowRetail(e.target.checked)}
                    />
                    <span style={{ 
                        width: '16px', 
                        height: '2px', 
                        backgroundColor: '#F59E0B', 
                        display: 'inline-block',
                        marginRight: '4px'
                    }}></span>
                    Retail (1K or Less followers)
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
                    height: 'calc(100% - 60px)',
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

export default TieredAccountLineChart;