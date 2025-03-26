import { IDataFeed, CandleData, RawTradeData } from "../types/TradingView";
let data_: CandleData[];
let symbol_: any;
let address_: string;
export class CustomDataFeed implements IDataFeed {
  private data: CandleData[];

  constructor(rawData: RawTradeData[], symbol: any,address: string) {
    this.data = rawData.map((entry) => ({
      time: entry.time * 1000,//new Date(entry.time).getTime(),
      open: entry.open,
      high: entry.high,
      low: entry.low,
      close: entry.close,
      volume: (entry.volume),
    }));
    data_ = this.data;
    console.log("Time Sampt",data_)
    symbol_ = symbol + "/USDT";
    address_ =address
  }

  onReady(callback: (config: any) => void): void {
    setTimeout(
      () =>
        callback({ supported_resolutions: ["1", "5", "15", "30", "60", "D"] }),
      0
    );
  }

  resolveSymbol(
    symbolName: string,
    onSymbolResolvedCallback: (symbolInfo: any) => void,
    onResolveErrorCallback: (error: any) => void
  ): void {
    try {
      setTimeout(() => {
        onSymbolResolvedCallback({
          name: symbolName,
          description: symbol_ ?? "Custom crypto symbol",
          type: "crypto",
          session: "24x7",
          timezone: "Etc/UTC",
          ticker: symbolName,
          exchange: "CustomExchange",
          minmov: 1,
          pricescale: 1000000000,
          has_intraday: true,
          //intraday_multipliers: ["1", "5", "15", "30", "60"],
          has_weekly_and_monthly: true,
          supported_resolutions: ["1", "5", "15", "30", "60", "D"],
          volume_precision: 8,
          visible_plots_set: "ohlcv",
          data_status: "streaming",
        });
        console.log();
      }, 1000);
    } catch (error) {
      onResolveErrorCallback(error);
    }

    console.log("symbolName", {
      name: symbolName,
    });
  }

  getBars(
    symbolInfo: any,
    resolution: string,
    periodParams: {
      from: number;
      to: number;
      countBack: number;
      firstDataRequest: boolean;
    },
    onHistoryCallback: (bars: CandleData[], meta: { noData: boolean }) => void,
    onErrorCallback: (error: any) => void
  ): void {
    const { from, to, countBack } = periodParams;
    const bars = data_.filter(
      (bar) => bar.time >= from  * 1000 && bar.time <= to * 1000
    );
    console.log("resolution", bars,bars.length); 
    //1742843517 
    //1742848740
    if (bars.length) {
      console.log("bars===", from, to);
      onHistoryCallback(bars, { noData: false });
    } else {
      console.log("bars x===", from, to);
      onHistoryCallback([], { noData: true });
    }
  }
  //1742901900
  //1742900520

 /* subscribeBars(
    symbolInfo: any,
    resolution: string,
    onRealtimeCallback: (bar: CandleData) => void,
    subscribeUID: string,
    onResetCacheNeededCallback: () => void
  ): void {
    console.log("Subscribed to real-time data", subscribeUID);
  
    // Wait until data_ is populated
    const waitForLastBar = (callback: () => void) => {
      const checkInterval = setInterval(() => {
        if (data_ && data_.length > 0) {
          clearInterval(checkInterval);
          callback();
        }
      }, 100); // Check every 100 milliseconds
    };
  
    waitForLastBar(() => {
      // Initialize lastBar and base values
      let lastBar = data_[data_.length - 1];
      let basePrice = lastBar.close;
      let baseVolume = lastBar.volume;
      let t = 0; // time counter for oscillation
  
      // Define oscillation amplitudes
      const priceAmplitude = Math.abs(lastBar.close - lastBar.open);
      const volumeAmplitude = lastBar.volume * 0.1;
  
      // Start live candle animation every second using oscillatory movement
      const intervalId = setInterval(() => {
        t++; // Increment our time counter (in seconds)
        const oscillation = Math.sin(t); // Oscillates between -1 and 1
  
        // Calculate oscillated values based on base values
        const newClose = +(basePrice + oscillation * priceAmplitude).toFixed(6);
        const newHigh = +(basePrice + Math.abs(oscillation) * priceAmplitude).toFixed(6);
        const newLow = +(basePrice - Math.abs(oscillation) * priceAmplitude).toFixed(6);
        const newVolume = +(baseVolume + oscillation * volumeAmplitude).toFixed(2);
  
        // Build the updated bar (time and open remain constant)
        const updatedBar: CandleData = {
          time: lastBar.time, // keep same candle timestamp during its duration
          open: lastBar.open,
          high: newHigh,
          low: newLow,
          close: newClose,
          volume: newVolume,
        };
  
        lastBar = updatedBar;
        onRealtimeCallback(updatedBar);
      }, 1000); // update every second
   // Calculate delay for the next full minute based on lastBar.time
 
      // Fetch real candle every minute from /api/raydium and reset base values
      const minuteIntervalId = setInterval(() => {
        console.log("Fetching latest bar from Raydium API...");
        
        fetch('/api/live', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address: address_ }),
        })
          .then((response) => response.json())
          .then((result) => {
            const ohlcvList = result.data.attributes.ohlcv_list;
            if (ohlcvList && ohlcvList.length > 0) {
              const latest = ohlcvList[ohlcvList.length - 1];
              const newBar: CandleData = {
                time: latest[0] * 1000,
                open: latest[1],
                high: latest[2],
                low: latest[3],
                close: latest[4],
                volume: latest[5],
              };
  
              console.log("New bar fetched:", newBar);
              console.warn(
                "Fetched new bar is not newer than last bar. Ignoring it.",
                "lastBar.time:", lastBar.time,
                "newBar.time:", newBar.time
              );
              // Push new bar, then sort and remove duplicates by timestamp.
              data_.push(newBar);
              data_.sort((a, b) => a.time - b.time);
              data_ = data_.reduce((acc: CandleData[], cur) => {
                if (acc.length === 0 || acc[acc.length - 1].time !== cur.time) {
                  acc.push(cur);
                }
                return acc;
              }, []);
  
              // Update lastBar from the cleaned data
              lastBar = data_[data_.length - 1];
  
              // Reset our base values and oscillation counter for the new candle
              basePrice = lastBar.close;
              baseVolume = lastBar.volume;
              t = 0;
              console.warn(
                "Fetched new bar is not newer than last bar. Ignoring it.",
                "lastBar.time:", lastBar.time,
                "newBar.time:", newBar.time
              );
              
              // Push the new bar to the chart
              onRealtimeCallback(lastBar);
            }
          })
          .catch((error) => {
            console.error("Error fetching Raydium bar:", error);
          });
      }, 50*1000); // every 1 minute
  
      // Store intervals for cleanup
      (this as any)[subscribeUID] = { intervalId, minuteIntervalId };
    });
  }
  */
  subscribeBars(
    symbolInfo: any,
    resolution: string,
    onRealtimeCallback: (bar: CandleData) => void,
    subscribeUID: string,
    onResetCacheNeededCallback: () => void
  ): void {
    console.log("Subscribed to real-time data", subscribeUID);
  
    // Wait until data_ is populated
    const waitForLastBar = (callback: () => void) => {
      const checkInterval = setInterval(() => {
        if (data_ && data_.length > 0) {
          clearInterval(checkInterval);
          callback();
        }
      }, 100);
    };
  
    waitForLastBar(() => {
      // Get the last completed bar from history
      let completedBar = data_[data_.length - 1];
  
      // Create a new simulated candle for the next interval
      let simulatedBar: CandleData = {
        time: completedBar.time + 60000, // next minute timestamp
        open: completedBar.close,          // new candle opens at the last bar's close
        high: completedBar.close,
        low: completedBar.close,
        close: completedBar.close,
        volume: 0,                         // start at 0 volume (or adjust as needed)
      };
  
      // Set simulation base values from the new simulated candle
      let basePrice = simulatedBar.open;
      let baseVolume = simulatedBar.volume;
      let t = 0; // simulation time counter (seconds)
  
      // Use the amplitude of the previous candle as a rough estimate
      const priceAmplitude = Math.abs(completedBar.close - completedBar.open);
      const volumeAmplitude = completedBar.volume * 0.1; // adjust as needed
  
      // Function to start simulation (updates every second) for the new candle
      let simulationIntervalId: any;
      const startSimulation = () => {
        simulationIntervalId = setInterval(() => {
          t++; // increment simulation counter
          const osc = Math.sin(t); // oscillates between -1 and 1
  
          // Calculate new simulated values
          const newClose = +(basePrice + osc * priceAmplitude).toFixed(6);
          const newHigh = Math.max(simulatedBar.high, newClose);
          const newLow = Math.min(simulatedBar.low, newClose);
          // For volume, you might simulate accumulating volume (or oscillatory)
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
  
      // Start the simulation for the new candle
      startSimulation();
  
      // Minute update: fetch two bars from the API every minute
      const minuteIntervalId = setInterval(() => {
        console.log("Fetching latest bars from API...");
  
        fetch('/api/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: address_ }),
        })
          .then((response) => response.json())
          .then((result) => {
            const ohlcvList = result.data.attributes.ohlcv_list;
            if (ohlcvList && ohlcvList.length >= 2) {
              // Sort the fetched list by timestamp (index 0)
              ohlcvList.sort((a: number[], b: number[]) => a[0] - b[0]);
              // Extract the last two bars:
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
  
              console.log("Fetched replaced bar:", replacedBar);
              console.log("Fetched new bar:", fetchedNewBar);
  
              // Clear the simulation for the current new candle so it can be replaced
              clearInterval(simulationIntervalId);
  
              // Push the fetched replaced bar to override the simulated value
              onRealtimeCallback(replacedBar);
              // Then push the fetched new bar as the latest candle
              onRealtimeCallback(fetchedNewBar);
  
              // Update the internal data array
              data_.push(replacedBar, fetchedNewBar);
              data_ = data_
                .sort((a, b) => a.time - b.time)
                .reduce((acc: CandleData[], cur) => {
                  if (acc.length === 0 || acc[acc.length - 1].time !== cur.time) {
                    acc.push(cur);
                  }
                  return acc;
                }, []);
  
              // Set the new simulated candle for the next interval:
              simulatedBar = {
                time: fetchedNewBar.time + 60000,
                open: fetchedNewBar.close,
                high: fetchedNewBar.close,
                low: fetchedNewBar.close,
                close: fetchedNewBar.close,
                volume: 0,
              };
  
              // Update simulation base values
              basePrice = simulatedBar.open;
              baseVolume = simulatedBar.volume;
              t = 0;
  
              // Update lastBar (for logging or further reference) as fetchedNewBar
              completedBar = fetchedNewBar;
  
              // Restart simulation for the new candle
              startSimulation();
            }
          })
          .catch((error) => {
            console.error("Error fetching new bars:", error);
          });
      }, 60000); // every 1 minute
  
      // Store intervals for cleanup
      (this as any)[subscribeUID] = { simulationIntervalId, minuteIntervalId };
    });
  }
  
  

  unsubscribeBars(subscribeUID: string): void {
    console.log("Unsubscribed from real-time data", subscribeUID);
    const intervalId = (this as any)[subscribeUID];
    if (intervalId) {
      clearInterval(intervalId);
      delete (this as any)[subscribeUID];
    }
  }
}
