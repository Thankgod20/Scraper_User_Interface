import React, { useState, useRef, useEffect } from "react";
import { createChart, ColorType, LineData, HistogramData, Time, IChartApi, ISeriesApi } from "lightweight-charts";

type ZoomReport = {
    totalpage: number;
    currentpage: number;
};

interface LineGraphProps {
    data: { name: string; value: number }[];
    color?: string;
    funtype: string;
    onZoomOrPan?: (page: number, funtype: string) => Promise<ZoomReport>;
}

const LineGraphWithChangeChart: React.FC<LineGraphProps> = ({ 
    data, 
    color = "#10B981", 
    funtype, 
    onZoomOrPan 
}) => {
    const lineChartContainerRef = useRef<HTMLDivElement>(null);
    const barChartContainerRef = useRef<HTMLDivElement>(null);
    const lineChartRef = useRef<IChartApi | null>(null);
    const barChartRef = useRef<IChartApi | null>(null);
    const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const barSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const [isLoaded, setIsLoaded] = useState(true);
    const [isEnd, setIsEnd] = useState(false);
    const pageRef = useRef(1);
    const totalPage = useRef(0);
    const throttleRef = useRef(false);

    // Sort data by time
    const sortedData = [...data].sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());

    // Convert data to lightweight-charts format
    const chartData: LineData[] = sortedData.map(item => ({
        time: Math.floor(new Date(item.name).getTime() / 1000) as Time,
        value: item.value
    }));

    // Calculate changes (net change between consecutive points)
    const changeData: HistogramData[] = chartData.slice(1).map((item, index) => {
        const change = item.value - chartData[index].value;
        return {
            time: item.time,
            value: change,
            color: change >= 0 ? '#10B981' : '#EF4444' // Green for positive, red for negative
        };
    });

    // Initialize line chart
    useEffect(() => {
        if (!lineChartContainerRef.current) return;

        const chart = createChart(lineChartContainerRef.current, {
            width: lineChartContainerRef.current.clientWidth,
            height: lineChartContainerRef.current.clientHeight,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#333',
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: false },
            },
            crosshair: {
                mode: 1,
            },
            rightPriceScale: {
                visible: true,
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
                axisPressedMouseMove: false,
                mouseWheel: false,
                pinch: false,
            },
        });

        const lineSeries = chart.addLineSeries({
            color: color,
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 3,
        });

        lineSeries.setData(chartData);
        lineChartRef.current = chart;
        lineSeriesRef.current = lineSeries;

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
            if (!newVisibleTimeRange || !onZoomOrPan || isEnd || !isLoaded || throttleRef.current) {
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

            // Sync bar chart visible range
            if (barChartRef.current && newVisibleTimeRange) {
                barChartRef.current.timeScale().setVisibleRange(newVisibleTimeRange);
            }
        });

        // Handle resize
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== lineChartContainerRef.current) {
                return;
            }
            const newRect = entries[0].contentRect;
            chart.applyOptions({ width: newRect.width });
        });

        if (lineChartContainerRef.current) {
            resizeObserver.observe(lineChartContainerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, []);

    // Initialize bar chart
    useEffect(() => {
        if (!barChartContainerRef.current) return;

        const chart = createChart(barChartContainerRef.current, {
            width: barChartContainerRef.current.clientWidth,
            height: barChartContainerRef.current.clientHeight,
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#333',
            },
            grid: {
                vertLines: { visible: false },
                horzLines: { visible: true, color: '#E5E7EB' },
            },
            crosshair: {
                mode: 1,
            },
            rightPriceScale: {
                visible: true,
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
                axisPressedMouseMove: false,
                mouseWheel: false,
                pinch: false,
            },
        });

        const barSeries = chart.addHistogramSeries({
            priceFormat: {
                type: 'volume',
            },
        });

        barSeries.setData(changeData);
        barChartRef.current = chart;
        barSeriesRef.current = barSeries;

        // Sync with line chart visible range changes
        chart.timeScale().subscribeVisibleTimeRangeChange((newVisibleTimeRange) => {
            if (lineChartRef.current && newVisibleTimeRange) {
                lineChartRef.current.timeScale().setVisibleRange(newVisibleTimeRange);
            }
        });

        // Handle resize
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== barChartContainerRef.current) {
                return;
            }
            const newRect = entries[0].contentRect;
            chart.applyOptions({ width: newRect.width });
        });

        if (barChartContainerRef.current) {
            resizeObserver.observe(barChartContainerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, []);

    // Update charts when data changes
    useEffect(() => {
        if (lineSeriesRef.current && chartData.length > 0) {
            const currentVisibleRange = lineChartRef.current?.timeScale().getVisibleRange();
            lineSeriesRef.current.setData(chartData);
            
            if (currentVisibleRange && chartData.length > 0) {
                setTimeout(() => {
                    if (lineChartRef.current) {
                        lineChartRef.current.timeScale().fitContent();
                    }
                }, 50);
            }
        }

        if (barSeriesRef.current && changeData.length > 0) {
            barSeriesRef.current.setData(changeData);
            
            setTimeout(() => {
                if (barChartRef.current) {
                    barChartRef.current.timeScale().fitContent();
                }
            }, 50);
        }
    }, [data, chartData, changeData]);

    // Reset pagination state when data changes significantly
    useEffect(() => {
        if (data.length < 10) {
            pageRef.current = 1;
            totalPage.current = 0;
            setIsEnd(false);
        }
    }, [data.length]);

    // Update line chart color when color prop changes
    useEffect(() => {
        if (lineSeriesRef.current) {
            lineSeriesRef.current.applyOptions({ color: color });
        }
    }, [color]);

    // Add tooltips for both charts
    useEffect(() => {
        if (!lineChartRef.current || !lineChartContainerRef.current) return;

        const container = lineChartContainerRef.current;
        let tooltip: HTMLDivElement | null = null;

        const createTooltip = () => {
            tooltip = document.createElement('div');
            tooltip.style.cssText = `
                position: absolute;
                display: none;
                padding: 4px 8px;
                background: white;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 10px;
                color: black;
                pointer-events: none;
                z-index: 1000;
                white-space: nowrap;
            `;
            container.appendChild(tooltip);
        };

        const showTooltip = (param: any) => {
            if (!tooltip) createTooltip();
            if (!tooltip || !param.time || !param.seriesData.size) {
                if (tooltip) tooltip.style.display = 'none';
                return;
            }

            const data = param.seriesData.get(lineSeriesRef.current);
            if (!data) {
                tooltip.style.display = 'none';
                return;
            }

            const time = new Date((param.time as number) * 1000);
            tooltip.innerHTML = `
                <div><strong>Line Chart</strong></div>
                <div>Time: ${time.toLocaleString()}</div>
                <div>Value: ${data.value.toFixed(2)}</div>
            `;
            
            tooltip.style.display = 'block';
            tooltip.style.left = param.point?.x + 10 + 'px';
            tooltip.style.top = param.point?.y - 50 + 'px';
        };

        const hideTooltip = () => {
            if (tooltip) tooltip.style.display = 'none';
        };

        lineChartRef.current.subscribeCrosshairMove(showTooltip);
        container.addEventListener('mouseleave', hideTooltip);

        return () => {
            if (tooltip && container.contains(tooltip)) {
                container.removeChild(tooltip);
            }
            container.removeEventListener('mouseleave', hideTooltip);
        };
    }, [lineChartRef.current]);

    // Add tooltip for bar chart
    useEffect(() => {
        if (!barChartRef.current || !barChartContainerRef.current) return;

        const container = barChartContainerRef.current;
        let tooltip: HTMLDivElement | null = null;

        const createTooltip = () => {
            tooltip = document.createElement('div');
            tooltip.style.cssText = `
                position: absolute;
                display: none;
                padding: 4px 8px;
                background: white;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 10px;
                color: black;
                pointer-events: none;
                z-index: 1000;
                white-space: nowrap;
            `;
            container.appendChild(tooltip);
        };

        const showTooltip = (param: any) => {
            if (!tooltip) createTooltip();
            if (!tooltip || !param.time || !param.seriesData.size) {
                if (tooltip) tooltip.style.display = 'none';
                return;
            }

            const data = param.seriesData.get(barSeriesRef.current);
            if (!data) {
                tooltip.style.display = 'none';
                return;
            }

            const time = new Date((param.time as number) * 1000);
            const changeType = data.value >= 0 ? 'Increase' : 'Decrease';
            const changeColor = data.value >= 0 ? '#10B981' : '#EF4444';
            
            tooltip.innerHTML = `
                <div><strong>Change Chart</strong></div>
                <div>Time: ${time.toLocaleString()}</div>
                <div style="color: ${changeColor};">${changeType}: ${Math.abs(data.value).toFixed(2)}</div>
            `;
            
            tooltip.style.display = 'block';
            tooltip.style.left = param.point?.x + 10 + 'px';
            tooltip.style.top = param.point?.y - 50 + 'px';
        };

        const hideTooltip = () => {
            if (tooltip) tooltip.style.display = 'none';
        };

        barChartRef.current.subscribeCrosshairMove(showTooltip);
        container.addEventListener('mouseleave', hideTooltip);

        return () => {
            if (tooltip && container.contains(tooltip)) {
                container.removeChild(tooltip);
            }
            container.removeEventListener('mouseleave', hideTooltip);
        };
    }, [barChartRef.current]);

    return (
        <div style={{ width: '100%' }}>
            {/* Line Chart */}
            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
                    Value Over Time
                </h3>
                <div 
                    ref={lineChartContainerRef} 
                    style={{ 
                        width: '100%', 
                        height: '240px',
                        position: 'relative',
                        border: '1px solid #E5E7EB',
                        borderRadius: '4px'
                    }} 
                />
            </div>

            {/* Change Bar Chart */}
            <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
                    Net Change (Positive Above, Negative Below)
                </h3>
                <div 
                    ref={barChartContainerRef} 
                    style={{ 
                        width: '100%', 
                        height: '200px',
                        position: 'relative',
                        border: '1px solid #E5E7EB',
                        borderRadius: '4px'
                    }} 
                />
            </div>

            {/* Legend */}
            <div style={{ 
                marginTop: '10px', 
                fontSize: '12px', 
                display: 'flex', 
                gap: '20px',
                justifyContent: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        backgroundColor: '#10B981',
                        borderRadius: '2px'
                    }}></div>
                    <span>Positive Change</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ 
                        width: '12px', 
                        height: '12px', 
                        backgroundColor: '#EF4444',
                        borderRadius: '2px'
                    }}></div>
                    <span>Negative Change</span>
                </div>
            </div>
        </div>
    );
};

export default LineGraphWithChangeChart;