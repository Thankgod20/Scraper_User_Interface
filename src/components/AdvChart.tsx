
import { useEffect, useRef } from 'react';
import { RawTradeData } from '@/app/types/TradingView';
import { CustomDataFeed } from '@/app/utils/CustomDataFeed';
import { ChartingLibraryWidgetOptions } from '../../public/static/charting_library/charting_library';

interface TVChartContainerProps {
  data: RawTradeData[];
  name: any;
  address: string;
  symbol: any;
  emojiData: { em_time: number; emoji: string }[];
  //holders: { amount: number; time: number }[];
}

function isTimestampIn15MinuteRange(
  timestamp: number, 
  referenceTimestamp: number
): boolean {
  const timestampInMs = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const referenceInMs = referenceTimestamp > 1e12 ? referenceTimestamp : referenceTimestamp * 1000;
  const rangeStart = referenceInMs - 5 * 60 * 1000; 
  const rangeEnd = referenceInMs + 5 * 60 * 1000;   
  return timestampInMs >= rangeStart && timestampInMs <= rangeEnd;
}

const TVChartContainer: React.FC<TVChartContainerProps> = ({
  data,
  name,
  address,
  symbol,
  emojiData,
  holders
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvWidgetRef = useRef<any>(null); // Store widget instance
  const chartRef = useRef<any>(null); // Store chart instance

  useEffect(() => {
    // Only initialize widget if data is loaded
    if (!data || data.length === 0) return;
    // Avoid reinitializing if already created
    if (tvWidgetRef.current) return;
  
    const customDataFeed = new CustomDataFeed(data, symbol, address);
    const widgetOptions: ChartingLibraryWidgetOptions = {
      symbol: symbol ?? 'AAPL',
      interval: '1',
      container: chartContainerRef.current as HTMLElement,
      library_path: '/static/charting_library/',
      datafeed: customDataFeed,
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
      overrides: {
        'mainSeriesProperties.style': 2,
        'paneProperties.vertGridProperties.color': 'rgba(0, 0, 0, 0)',
        'paneProperties.horzGridProperties.color': 'rgba(0, 0, 0, 0)',
      },
    };
  
    tvWidgetRef.current = new (window as any).TradingView.widget(widgetOptions);
    tvWidgetRef.current.onChartReady(() => {
      chartRef.current = tvWidgetRef.current.chart();
      // Optionally add shapes/markers here if needed
    });
    tvWidgetRef.current.onChartReady(() => {
      chartRef.current = tvWidgetRef.current.chart();

      // Convert raw data to chart-friendly format
      const chartData = data.map((entry) => ({
        time: new Date(entry.time).getTime(), // milliseconds
        open: entry.open,
        high: entry.high,
        low: entry.low,
        close: entry.close,
        volume: entry.volume,
      }));

      // Add initial emoji markers
      emojiData.forEach(({ em_time, emoji }) => {
        const emojiTime =
          typeof em_time === 'string'
            ? new Date(em_time).getTime()
            : em_time;
        // Find the closest candle for placement reference
        const closestData = chartData.find((dt) =>
          isTimestampIn15MinuteRange(emojiTime, dt.time)
        );
        if (closestData) {
          chartRef.current.createShape(
            { time: emojiTime / 1000, price: closestData.close },
            {
              shape: 'text',
              text: emoji,
              color: '#FF4500',
              size: 24,
              tooltip: `Emoji Marker: ${emoji}`,
              zOrder: 'top',
            }
          );
        }
      });

      // Optionally, you can add the holders rectangle here as well if needed
    });
    return () => {
      if (tvWidgetRef.current) {
        tvWidgetRef.current.remove();
        tvWidgetRef.current = null;
      }
    };
  }, [data, symbol, address]);

  // Separate effect to update emoji markers when emojiData changes
  useEffect(() => {
    if (!chartRef.current) return;
    // Convert raw data to chart-friendly data
    const datass = data.map((entry) => ({
      time: new Date(entry.time).getTime(),
      open: entry.open,
      high: entry.high,
      low: entry.low,
      close: entry.close,
      volume: entry.volume,
    }));
    //console.log("Load Data D",datass)
    emojiData.forEach(({ em_time, emoji }) => {
      const emojiTime = typeof em_time === 'string' ? new Date(em_time).getTime() : em_time;
      const closestData = datass.find((dt) =>
        isTimestampIn15MinuteRange(emojiTime, dt.time)
      );
      if (closestData) {
        chartRef.current.createShape(
          { time: emojiTime / 1000, price: closestData.close },
          {
            shape: 'text',
            text: emoji,
            color: '#FF4500',
            size: 24,
            tooltip: `Emoji Marker: ${emoji}`,
            zOrder: 'top',
          }
        );
      }
    });
  }, [emojiData, data]);

  // Similar effect for updating holders without reloading the chart
  useEffect(() => {
    if (!chartRef.current) return;
    const datass = data.map((entry) => ({
      time: new Date(entry.time).getTime(),
      open: entry.open,
      high: entry.high,
      low: entry.low,
      close: entry.close,
      volume: entry.volume,
    }));

    const lastCandleTime = datass.length
      ? datass[datass.length - 1].time
      : null;

    if (lastCandleTime) {
      /*holders.forEach((holder) => {
        const matchedCandle = datass.find((candle) =>
          isTimestampIn15MinuteRange(holder.time, candle.time)
        );
        if (!matchedCandle) return;
        let rgbaColor = '';
        if (holder.amount > 1_000_000_000) {
          rgbaColor = 'rgba(255, 0, 0, 0.0)';
        } else if (holder.amount > 100_000_000) {
          rgbaColor = 'rgba(128, 0, 128, 0.0)';
        } else if (holder.amount > 10_000_000) {
          rgbaColor = 'rgba(255, 165, 0, 0.0)';
        } else if (holder.amount > 1_000_000) {
          rgbaColor = 'rgba(255, 255, 0, 0.0)';
        } else {
          return;
        }
        chartRef.current.createMultipointShape(
          [
            {
              time: matchedCandle.time / 1000,
              price: matchedCandle.low,
            },
            {
              time: lastCandleTime / 1000,
              price: matchedCandle.high,
            },
          ],
          {
            shape: 'rectangle',
            lock: true,
            disableSelection: true,
            disableSave: true,
            overrides: {
              backgroundColor: rgbaColor,
              borderColor: rgbaColor,
              transparency: 100,
            },
            zOrder: 'below_main_series',
          }
        );
      });*/
    }
  }, [holders, data]);

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '500px' }} />
  );
};

export default TVChartContainer;


/*import { useEffect, useRef } from 'react';
import { RawTradeData } from '@/app/types/TradingView';
import { CustomDataFeed } from '@/app/utils/CustomDataFeed';
import { ChartingLibraryWidgetOptions } from '../../public/static/charting_library/charting_library';

interface TVChartContainerProps {
  data: RawTradeData[];
  name: any;
  address: string;
  symbol: any;
  emojiData: { em_time: number; emoji: string }[];
  holders: { amount: number; time: number }[];
}

function isTimestampIn15MinuteRange(
  timestamp: number, 
  referenceTimestamp: number
): boolean {
  const timestampInMs = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const referenceInMs = referenceTimestamp > 1e12 ? referenceTimestamp : referenceTimestamp * 1000;
  const rangeStart = referenceInMs - 5 * 60 * 1000; 
  const rangeEnd = referenceInMs + 5 * 60 * 1000;   
  return timestampInMs >= rangeStart && timestampInMs <= rangeEnd;
}

const TVChartContainer: React.FC<TVChartContainerProps> = ({
  data,
  name,
  address,
  symbol,
  emojiData,
  holders
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const data_x = data;
  const customDataFeed = new CustomDataFeed(data, symbol,address);
console.log("holders",customDataFeed)
  useEffect(() => {
    const widgetOptions = {
      symbol: symbol ?? 'AAPL',
      interval: '1',
      container: chartContainerRef.current as HTMLElement,
      library_path: '/static/charting_library/',
      datafeed: customDataFeed,
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
    
      // Add the "overrides" section to switch to line chart and hide gridlines.
      overrides: {
        // 1 = Line chart, 3 = Candles, 2 = Area, etc.
        'mainSeriesProperties.style': 2,
    
        // Hide vertical/horizontal grid lines
        'paneProperties.vertGridProperties.color': 'rgba(0, 0, 0, 0)',
        'paneProperties.horzGridProperties.color': 'rgba(0, 0, 0, 0)',
      },
    };
    

    const tvWidget = new (window as any).TradingView.widget(widgetOptions);

    tvWidget.onChartReady(() => {
      const chart = tvWidget.chart();

      // Convert your raw data to a more convenient array
      const datass = data_x.map((entry) => ({
        time: new Date(entry.time).getTime(), // ms
        open: entry.open,
        high: entry.high,
        low: entry.low,
        close: entry.close,
        volume: entry.volume,//parseFloat(entry.volume),
      }));

      console.log("Load Data D",datass)
      // Get the last candle's time (in ms) so we can stretch rectangles to the latest candle
      const lastCandleTime = datass.length
        ? datass[datass.length - 1].time
        : null;

      // === 1) Add Emojis ===
      emojiData.forEach(({ em_time, emoji }) => {
        const emojiTime =
          typeof em_time === 'string' ? new Date(em_time).getTime() : em_time;

        // Find the closest data point in `datass` for this emoji
        const closestData = datass.find((dt) =>
          isTimestampIn15MinuteRange(emojiTime, dt.time)
        );

        if (closestData) {
          chart.createShape(
            { time: emojiTime / 1000, price: closestData.close },
            {
              shape: 'text',
              text: emoji,
              color: '#FF4500',
              size: 24,
              tooltip: `Emoji Marker: ${emoji}`,
              zOrder: 'top',
            }
          );
        }
      });

      // === 2) Draw Heatmap Rectangles for Holders, stretched to last candle ===
    /*  if (lastCandleTime) {
        holders.forEach((holder) => {
          // Find matching candle for this holder
          const matchedCandle = datass.find((candle) =>
            isTimestampIn15MinuteRange(holder.time, candle.time)
          );
          if (!matchedCandle) return;

          // Determine color based on holder.amount
          let rgbaColor = '';
          if (holder.amount > 1_000_000_000) {
            rgbaColor = 'rgba(255, 0, 0, 0.0)'; // red, 15% opacity
          } else if (holder.amount > 100_000_000) {
            rgbaColor = 'rgba(128, 0, 128, 0.0)'; // purple
          } else if (holder.amount > 10_000_000) {
            rgbaColor = 'rgba(255, 165, 0, 0.0)'; // orange
          } else if (holder.amount > 1_000_000) {
            rgbaColor = 'rgba(255, 255, 0, 0.0)'; // yellow
          } else {
            return;
          }

          // Create rectangle from the matched candle’s time to the last candle’s time
          chart.createMultipointShape(
            [
              {
                time: matchedCandle.time / 1000,
                price: matchedCandle.low,
              },
              {
                time: lastCandleTime / 1000,
                price: matchedCandle.high,
              },
            ],
            {
              shape: 'rectangle',
              lock: true,
              disableSelection: true,
              disableSave: true,
              overrides: {
                backgroundColor: rgbaColor,
                borderColor: rgbaColor,
                // 0 -> fully opaque, 100 -> fully transparent
                transparency: 100,
              },
              zOrder: 'below_main_series',
            }
          );
        });
      }*/
   /* });

    return () => {
      if (tvWidget) {
        tvWidget.remove();
      }
    };
  }, [data_x, symbol, emojiData, holders]);

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '500px' }} />
  );
};

export default TVChartContainer;
*/