export interface CandleData {
  time: number; // Timestamp in milliseconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RawTradeData {
  Block: { Timefield: string };
  Trade: { open: number; high: number; low: number; close: number };
  volume: string;
}

export interface IDataFeed {
  onReady: (callback: (config: any) => void) => void;
  resolveSymbol: (
    symbolName: string,
    onSymbolResolvedCallback: (symbolInfo: any) => void,
    onResolveErrorCallback: (error: any) => void
  ) => void;
  getBars: (
    symbolInfo: any,
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
    onErrorCallback: (error: any) => void
  ) => void;
  subscribeBars: (
    symbolInfo: any,
    resolution: string,
    onRealtimeCallback: (bar: CandleData) => void,
    subscribeUID: string,
    onResetCacheNeededCallback: () => void
  ) => void;
  unsubscribeBars: (subscriberUID: string) => void;
}
