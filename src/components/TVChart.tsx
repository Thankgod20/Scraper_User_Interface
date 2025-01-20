// components/Chart.tsx
import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, CandlestickData } from 'lightweight-charts';

interface ChartProps {
    data: CandlestickData[];
}

const TVChart: React.FC<ChartProps> = ({ data }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (chartContainerRef.current) {
            chartRef.current = createChart(chartContainerRef.current, {
                width: 800,
                height: 400,
            });

            const candlestickSeries = chartRef.current.addCandlestickSeries();
            candlestickSeries.setData(data);

            return () => chartRef.current?.remove();
        }
    }, [data]);

    return <div ref={chartContainerRef}></div>;
};

export default TVChart;
