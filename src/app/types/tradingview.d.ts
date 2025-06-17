// In your ambient declarations (e.g. src/types/tradingview.d.ts)
declare module 'charting_library/charting_library' {
    // … other interfaces …
  
    // Minimal Datafeed interface:
    export interface Datafeed {
      onReady(callback: (config: DatafeedConfiguration) => void): void;
      searchSymbols(
        userInput: string,
        exchange: string,
        symbolType: string,
        onResult: (symbols: SymbolInfo[]) => void
      ): void;
      resolveSymbol(
        symbolName: string,
        onResolve: (symbolInfo: SymbolInfo) => void,
        onError: (reason: string) => void
      ): void;
      getBars(
        symbolInfo: SymbolInfo,
        resolution: string,
        from: number,
        to: number,
        onHistory: (bars: Bar[], meta: HistoryMetadata) => void,
        onError: (reason: string) => void,
        isFirstCall: boolean
      ): void;
      subscribeBars(
        symbolInfo: SymbolInfo,
        resolution: string,
        onRealtime: (bar: Bar) => void,
        subscriberUID: string
      ): void;
      unsubscribeBars(subscriberUID: string): void;
    }
  
    export interface DatafeedConfiguration {
      supported_resolutions: string[];
      exchanges?: Exchange[];
      // … etc
    }
  
    export interface SymbolInfo { /* … */ }
    export interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number }
    export interface HistoryMetadata { noData?: boolean }
    export interface Exchange { value: string; name: string; desc?: string }
  
    // Make widgetOptions.datafeed be this Datafeed
    export interface ChartingLibraryWidgetOptions {
      // … other props …
      datafeed: Datafeed;
      // …
    }
  }
  