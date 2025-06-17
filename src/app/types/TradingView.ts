export interface CandleData {
  time: number; // Timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/*export interface RawTradeData {
  Block: { Timefield: string };
  Trade: { open: number; high: number; low: number; close: number };
  volume: string;
}
*/
export interface RawTradeData {
  time: number;    // Timestamp (e.g., Unix time)
  open: number;    // Opening price
  high: number;    // Highest price
  low: number;     // Lowest price
  close: number;   // Closing price
  volume: number;  // Trading volume
}
export interface IDataFeed {
  onReady: (callback: (config: unknown) => void) => void;
  resolveSymbol: (
    symbolName: string,
    onSymbolResolvedCallback: (symbolInfo: unknown) => void,
    onResolveErrorCallback: (error: unknown) => void
  ) => void;
  getBars: (
    symbolInfo: string,
    resolution: string,
    periodParams: {
      from: number;
      to: number;
      countBack: number;
      firstDataRequest: boolean;
    },
    //from: number,
    //to: number,
    onHistoryCallback: (bars: CandleData[], meta: { noData: boolean }) => void,
    onErrorCallback: (error: unknown) => void
  ) => void;
  subscribeBars: (
    symbolInfo: string,
    resolution: string,
    onRealtimeCallback: (bar: CandleData) => void,
    subscribeUID: string,
    onResetCacheNeededCallback: () => void
  ) => void;
  unsubscribeBars: (subscriberUID: string) => void;
}
