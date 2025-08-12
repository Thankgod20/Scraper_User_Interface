
import { useEffect, useRef } from 'react';
import { RawTradeData } from '@/app/types/TradingView';
import { CustomDataFeed } from '@/app/utils/CustomDataFeed';
import { ChartingLibraryWidgetOptions,widget } from '../../public/static/charting_library/charting_library';

interface TVChartContainerProps {
  data: RawTradeData[];
  name: any;
  address: string;
  symbol: any;
  emojiData: { em_time: number; emoji: string }[];
  //holders: { amount: number; time: number }[];
}
type ResolutionString = '1' | '3' | '5' | '15' | '30' | '60' | '120' | '180' | '240' | 'D' | 'W' | 'M';

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
function toResolutionString(value: string): TradingView.ResolutionString {
  return value as unknown as TradingView.ResolutionString;
}

const TVChartContainer: React.FC<TVChartContainerProps> = ({
  data,
  name,
  address,
  symbol,
  emojiData,
  //holders
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
      interval: toResolutionString('1'),
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
   /* emojiData.forEach(({ em_time, emoji }) => {
      const emojiTime = typeof em_time === 'string' ? new Date(em_time).getTime() : em_time;
      const closestData = datass.find((dt) =>
        isTimestampIn15MinuteRange(emojiTime, dt.time)
      );
     
      if (!chartRef.current) {
        console.error("❌ chartRef.current is null");
      } else if (!('createShape' in chartRef.current)) {
        console.error("❌ chartRef.current does not have 'createShape' method", chartRef.current);
      } else if (typeof chartRef.current.createShape !== 'function') {
        console.error("❌ chartRef.current.createShape is not a function", chartRef.current.createShape);
      } else if (!closestData) {
        console.error("❌ closestData is null or undefined");
      } else if (!emojiTime) {
        console.error("❌ Emoji is null or undefined");
      }else {
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
    });*/
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
  }, [/*holders,*/ data]);

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
  );
};

export default TVChartContainer;

