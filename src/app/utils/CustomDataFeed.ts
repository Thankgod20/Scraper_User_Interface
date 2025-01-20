import { IDataFeed, CandleData, RawTradeData } from "../types/TradingView";
let data_: CandleData[];
let symbol_: any;
export class CustomDataFeed implements IDataFeed {
  private data: CandleData[];

  constructor(rawData: RawTradeData[], symbol: any) {
    this.data = rawData.map((entry) => ({
      time: new Date(entry.Block.Timefield).getTime(),
      open: entry.Trade.open,
      high: entry.Trade.high,
      low: entry.Trade.low,
      close: entry.Trade.close,
      volume: parseFloat(entry.volume),
    }));
    data_ = this.data;
    symbol_ = symbol + "/USDT";
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
      (bar) => bar.time >= from * 1000 && bar.time <= to * 1000
    );
    console.log("resolution", resolution);
    if (bars.length) {
      console.log("bars===", from, to);
      onHistoryCallback(bars, { noData: false });
    } else {
      onHistoryCallback([], { noData: true });
    }
  }

  subscribeBars(
    symbolInfo: any,
    resolution: string,
    onRealtimeCallback: (bar: CandleData) => void,
    subscribeUID: string,
    onResetCacheNeededCallback: () => void
  ): void {
    console.log("Subscribed to real-time data", subscribeUID);
    // Handle real-time updates here
  }

  unsubscribeBars(subscribeUID: string): void {
    console.log("Unsubscribed from real-time data", subscribeUID);
  }
}
