import { useEffect, useRef } from 'react';
import { RawTradeData } from '@/app/types/TradingView';
import { CustomDataFeed } from '@/app/utils/CustomDataFeed';
import { ChartingLibraryWidgetOptions } from '../../public/static/charting_library/charting_library';
interface TVChartContainerProps {
    data: RawTradeData[];
    name: any;
    symbol: any;
    emojiData: { em_time: number, emoji: string }[]
}
function isTimestampIn15MinuteRange(
    timestamp: number,         // Timestamp to check
    referenceTimestamp: number // Reference timestamp
): boolean {
    // Ensure both are in the same unit (e.g., milliseconds)
    const timestampInMs = timestamp > 1e12 ? timestamp : timestamp * 1000;
    const referenceInMs = referenceTimestamp > 1e12 ? referenceTimestamp : referenceTimestamp * 1000;
    //seconds

    // Calculate the start and end of the 15-minute range
    const rangeStart = referenceInMs - 5 * 60 * 1000; // 15 minutes before
    const rangeEnd = referenceInMs + 5 * 60 * 1000;   // 15 minutes after

    // Check if the timestamp falls within the range
    return timestampInMs >= rangeStart && timestampInMs <= rangeEnd;
}
const TVChartContainer: React.FC<TVChartContainerProps> = ({ data, name, symbol, emojiData }) => {
    const chartContainerRef = useRef(null);
    const data_x = data
    const customDataFeed = new CustomDataFeed(data, symbol);
    console.log("Datas", customDataFeed)
    //console.log("Emoji", emojiData)

    useEffect(() => {
        const widgetOptions = {
            symbol: symbol ?? "AAPL",
            interval: '1',
            container: chartContainerRef.current,
            library_path: '/static/charting_library/',
            datafeed: customDataFeed,//new (window as any).Datafeeds.UDFCompatibleDatafeed('https://demo_feed.tradingview.com'),
            locale: 'en',
            disabled_features: ['use_localstorage_for_settings'],
            enabled_features: ['study_templates'],
            charts_storage_url: 'https://saveload.tradingview.com',
            charts_storage_api_version: '1.1',
            client_id: 'tradingview.com',
            user_id: 'public_user_id',
            fullscreen: false,
            autosize: true,
            theme: 'Dark',
            studies_overrides: {},
        };

        const tvWidget = new window.TradingView.widget(widgetOptions);
        tvWidget.onChartReady(() => {
            const chart = tvWidget.chart();

            // Prepare data with the correct time format
            const datass = data_x.map((entry) => ({
                time: new Date(entry.Block.Timefield).getTime(), // Convert to Unix timestamp in milliseconds
                open: entry.Trade.open,
                high: entry.Trade.high,
                low: entry.Trade.low,
                close: entry.Trade.close,
                volume: parseFloat(entry.volume),
            }));

            // Get the visible range of the chart
            const visibleRange = chart.getVisibleRange();

            // Add emojis
            emojiData.forEach(({ em_time, emoji }) => {
                // Convert `em_time` to Unix timestamp in milliseconds if not already
                const emojiTime = typeof em_time === 'string' ? new Date(em_time).getTime() : em_time;

                // Ensure emoji time is within the visible range
                //if (emojiTime >= visibleRange.from * 1000 && emojiTime <= visibleRange.to * 1000) {
                // Find the closest data point in `datass` for this emoji
                const closestData = datass.find((dt) =>
                    isTimestampIn15MinuteRange(emojiTime, dt.time)
                );
                //console.log("Emoji visable range", emojiTime)
                if (closestData) {
                    chart.createShape(
                        { time: emojiTime / 1000, price: closestData.close }, // Ensure time is in seconds
                        {
                            shape: "text",
                            text: emoji,
                            color: "#FF4500", // Optional text color
                            size: 24, // Font size
                            tooltip: `Emoji Marker: ${emoji}`, // Tooltip when hovering
                            zOrder: "top", // Ensure it's visible on top
                        }
                    );
                }
                //}
            });
        });

        return () => {
            if (tvWidget) {
                tvWidget.remove();
            }
        };
    }, [data_x]);

    return <div ref={chartContainerRef} style={{ width: '100%', height: '500px' }} />;
};

export default TVChartContainer;
