// Fixed CustomDataFeed.ts
import { CandleData, RawTradeData, } from "../types/TradingView";
import { LibrarySymbolInfo, ResolutionString} from "../../../public/static/charting_library/charting_library"
import type {
  SearchSymbolsCallback,
  SearchSymbolResultItem,
  ResolveCallback,
  ErrorCallback,
  PeriodParams,
  HistoryCallback,
  IBasicDataFeed,
} from "../../../public/static/charting_library/charting_library"

let data_: CandleData[];
let symbol_: string;
let address_: string;

interface TradingViewConfig {
  supported_resolutions: ResolutionString[];
}

interface SimulationInterval {
  simulationIntervalId: NodeJS.Timeout;
  minuteIntervalId: NodeJS.Timeout;
}

export class CustomDataFeed implements IBasicDataFeed {
  private data: CandleData[];
  private subscriptions: Record<string, SimulationInterval> = {};
  private lastBarTime: number = 0; // Track the last bar time to prevent violations

  constructor(rawData: RawTradeData[], symbol: string, address: string) {
    this.data = rawData.map((entry) => ({
      time: entry.time * 1000,
      open: entry.open,
      high: entry.high,
      low: entry.low,
      close: entry.close,
      volume: (entry.volume),
    }));
    
    // Sort data by time and set last bar time
    this.data.sort((a, b) => a.time - b.time);
    this.lastBarTime = this.data.length > 0 ? this.data[this.data.length - 1].time : 0;
    
    data_ = this.data;
    symbol_ = symbol + "/USDT";
    address_ = address;
  }

  // Helper method to ensure time consistency
  private isValidBarTime(newTime: number): boolean {
    return newTime > this.lastBarTime;
  }

  // Helper method to update last bar time
  private updateLastBarTime(time: number): void {
    if (time > this.lastBarTime) {
      this.lastBarTime = time;
    }
  }

  // Helper method to get next valid timestamp
  private getNextValidTimestamp(): number {
    const now = Date.now();
    const nextMinute = Math.ceil(now / 60000) * 60000; // Round up to next minute
    return Math.max(nextMinute, this.lastBarTime + 60000);
  }

  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: SearchSymbolsCallback
  ): void {
    const results: SearchSymbolResultItem[] = [
      {
        symbol: symbol_,
        full_name: symbol_,
        description: `${symbol_} (${address_.slice(0, 6)}…)`,
        exchange: 'Custom',
        ticker: symbol_,
        type: 'crypto',
      },
    ];
    onResult(results);
  }
  
  onReady(callback: (config: TradingViewConfig) => void): void {
    setTimeout(
      () =>
        callback({ 
          supported_resolutions: ["1", "5", "15", "30", "60", "D"] as ResolutionString[]
        }),
      0
    );
  }

  resolveSymbol(
    symbolName: string,
    onSymbolResolvedCallback: ResolveCallback,
    onResolveErrorCallback: ErrorCallback,
    extension?: any
  ): void {
    try {
      setTimeout(() => {
        const symbolInfo: LibrarySymbolInfo = {
          name: symbolName,
          full_name: symbolName,
          description: symbol_ ?? "Custom crypto symbol",
          type: "crypto",
          session: "24x7",
          timezone: "Etc/UTC",
          ticker: symbolName,
          exchange: "CustomExchange",
          listed_exchange: "CustomExchange",
          format: "price",
          minmov: 1,
          pricescale: 1000000000,
          has_intraday: true,
          has_weekly_and_monthly: true,
          supported_resolutions: ["1", "5", "15", "30", "60", "D"] as ResolutionString[],
          volume_precision: 8,
          visible_plots_set: "ohlcv",
          data_status: "streaming",
        };
        
        onSymbolResolvedCallback(symbolInfo);
      }, 1000);
    } catch (error) {
      onResolveErrorCallback("Error:"+error);
    }
  }

  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onHistoryCallback: HistoryCallback,
    onErrorCallback: ErrorCallback
  ): void {
    const { from, to } = periodParams;
    const bars = data_.filter(
      (bar) => bar.time >= from * 1000 && bar.time <= to * 1000
    );

    if (bars.length) {
      onHistoryCallback(bars, { noData: false });
    } else {
      onHistoryCallback([], { noData: true });
    }
  }
  
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onRealtimeCallback: (bar: CandleData) => void,
    subscribeUID: string
  ): void {
    console.log("Subscribed to real-time data", subscribeUID);
  
    const waitForLastBar = (callback: () => void) => {
      const checkInterval = setInterval(() => {
        if (data_ && data_.length > 0) {
          clearInterval(checkInterval);
          callback();
        }
      }, 100);
    };
  
    waitForLastBar(() => {
      let completedBar = data_[data_.length - 1];
      
      // Ensure we have a valid next timestamp
      const nextValidTime = this.getNextValidTimestamp();
      
      let simulatedBar: CandleData = {
        time: nextValidTime,
        open: completedBar.close,
        high: completedBar.close,
        low: completedBar.close,
        close: completedBar.close,
        volume: 0,
      };

      // Update our tracking
      this.updateLastBarTime(simulatedBar.time);

      let basePrice = simulatedBar.open;
      let baseVolume = simulatedBar.volume;
      let t = 0;

      const priceAmplitude = Math.abs(completedBar.close - completedBar.open);
      const volumeAmplitude = completedBar.volume * 0.1;

      const startSimulation = () => {
        return setInterval(() => {
          t++;
          const osc = Math.sin(t);

          const newClose = +(basePrice + osc * priceAmplitude).toFixed(6);
          const newHigh = Math.max(simulatedBar.high, newClose);
          const newLow = Math.min(simulatedBar.low, newClose);
          const newVolume = +(baseVolume + osc * volumeAmplitude).toFixed(2);

          simulatedBar = {
            ...simulatedBar,
            close: newClose,
            high: newHigh,
            low: newLow,
            volume: newVolume,
          };

          onRealtimeCallback(simulatedBar);
        }, 1000);
      };

      let simulationIntervalId = startSimulation();

      const minuteIntervalId = setInterval(() => {
        fetch('/api/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: address_ }),
        })
          .then((response) => response.json())
          .then((result) => {
            const ohlcvList = result.data.attributes.ohlcv_list;
            if (ohlcvList && ohlcvList.length >= 2) {
              // Sort by timestamp
              ohlcvList.sort((a: number[], b: number[]) => a[0] - b[0]);
              
              const prevData = ohlcvList[ohlcvList.length - 2];
              const currData = ohlcvList[ohlcvList.length - 1];

              const replacedBar: CandleData = {
                time: prevData[0] * 1000,
                open: prevData[1],
                high: prevData[2],
                low: prevData[3],
                close: prevData[4],
                volume: prevData[5],
              };

              const fetchedNewBar: CandleData = {
                time: currData[0] * 1000,
                open: currData[1],
                high: currData[2],
                low: currData[3],
                close: currData[4],
                volume: currData[5],
              };

              // CRITICAL FIX: Only add bars if they have valid timestamps
              const currentTime = Date.now();
              
              // Filter out bars that are too old or have invalid timestamps
              const validBars: CandleData[] = [];
              
              if (this.isValidBarTime(replacedBar.time) && replacedBar.time <= currentTime) {
                validBars.push(replacedBar);
              }
              
              if (this.isValidBarTime(fetchedNewBar.time) && fetchedNewBar.time <= currentTime) {
                validBars.push(fetchedNewBar);
              }

              if (validBars.length === 0) {
                console.warn("No valid bars to add - timestamps are invalid");
                return;
              }

              // Clear simulation
              clearInterval(simulationIntervalId);

              // Add valid bars in order
              validBars.forEach(bar => {
                console.log(`Adding bar with time: ${new Date(bar.time).toISOString()}`);
                onRealtimeCallback(bar);
                this.updateLastBarTime(bar.time);
              });

              // Update internal data
              validBars.forEach(bar => {
                const existingIndex = data_.findIndex(d => d.time === bar.time);
                if (existingIndex >= 0) {
                  data_[existingIndex] = bar; // Update existing
                } else {
                  data_.push(bar); // Add new
                }
              });

              // Sort and deduplicate
              data_ = data_
                .sort((a, b) => a.time - b.time)
                .reduce((acc: CandleData[], cur) => {
                  if (acc.length === 0 || acc[acc.length - 1].time !== cur.time) {
                    acc.push(cur);
                  }
                  return acc;
                }, []);

              // Set up next simulation bar
              const latestBar = validBars[validBars.length - 1];
              const nextSimTime = this.getNextValidTimestamp();
              
              simulatedBar = {
                time: nextSimTime,
                open: latestBar.close,
                high: latestBar.close,
                low: latestBar.close,
                close: latestBar.close,
                volume: 0,
              };

              this.updateLastBarTime(simulatedBar.time);
              basePrice = simulatedBar.open;
              baseVolume = simulatedBar.volume;
              t = 0;
              completedBar = latestBar;

              simulationIntervalId = startSimulation();
            }
          })
          .catch((error) => {
            console.error("Error fetching new bars:", error);
          });
      }, 60000);

      this.subscriptions[subscribeUID] = { 
        simulationIntervalId, 
        minuteIntervalId 
      };
    });
  }
  
  unsubscribeBars(subscribeUID: string): void {
    console.log("Unsubscribed from real-time data", subscribeUID);
    const intervals = this.subscriptions[subscribeUID];
    if (intervals) {
      clearInterval(intervals.simulationIntervalId);
      clearInterval(intervals.minuteIntervalId);
      delete this.subscriptions[subscribeUID];
    }
  }
}