import React, { useState } from 'react';
import FullPsychologyReport from './FullPsychologyReport'; // <-- IMPORT the new component
import { BehavioralAnalysisResult } from '../app/lib/analysisTypes'; // <-- Make sure to import the full type
import { Bot, BarChart ,AlertCircle} from 'lucide-react';

// This is a type guard to check if the response is valid
const isAnalysisResult = (data: any): data is BehavioralAnalysisResult => {
  return data && data.marketMoodDiagnosis && data.recommendation && data.analysisBreakdown;
}
interface SentimentAnalyzerProps {
    address_: any ,
    symbol_:any,
    timeframe_:any,
  }

const SentimentAnalyzer: React.FC<SentimentAnalyzerProps> = ({ address_,symbol_,timeframe_ }) => {
  const [address, setAddress] = useState(address_ || '3JeFdFTF7JLTUEYsTiDXvebGuJ3EMfiFgEgdPhyxbonk');
  const [symbol, setSymbol] = useState(symbol_ || 'BORING GUY');
  const [timeframe, setTimeframe] = useState(timeframe_ || '12:17 to 12:30');
  const [mc, setMCap] = useState('70K');
  // State to hold the full analysis result
  const [analysisResult, setAnalysisResult] = useState<BehavioralAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !symbol) {
      setError("Address and Symbol are required.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    const queryParams = new URLSearchParams({
      address,
      symbol,
      timeframe,
      mc,
      page: '1',
      limit: '2000',
    });

    try {
      const response = await fetch(`/api/narrator?${queryParams.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An unknown error occurred.');
      }
      
      // Use the type guard to validate the response shape
      if (isAnalysisResult(data)) {
        setAnalysisResult(data);
      } else {
        throw new Error("Received invalid data structure from API.");
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-500/10 p-2 rounded-full">
            <Bot className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100">Crowd Psychology Analyzer</h1>
        </div>
        <p className="text-gray-400 mb-6 text-sm">
          Enter a contract address and symbol to fetch real-time sentiment data and generate a behavioral analysis report.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
           {/* Form inputs are the same as before */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="address" className="block text-xs font-medium text-gray-400 mb-1">Contract Address</label>
              <input
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                placeholder="e.g., 7v6py...iYHpump"
              />
            </div>
            <div>
              <label htmlFor="symbol" className="block text-xs font-medium text-gray-400 mb-1">Symbol</label>
              <input
                type="text"
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                placeholder="e.g., pumpaura"
              />
            </div>
            <div>
              <label htmlFor="symbol" className="block text-xs font-medium text-gray-400 mb-1">MCap</label>
              <input
                type="text"
                id="mc"
                value={mc}
                onChange={(e) => setMCap(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                placeholder="e.g., 70K"
              />
            </div>
          </div>
          <div>
            <label htmlFor="timeframe" className="block text-xs font-medium text-gray-400 mb-1">Timeframe (Optional)</label>
            <input
              type="text"
              id="timeframe"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
              placeholder="e.g., 12:17 - 12:30"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-blue-400/50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Analyzing...
              </>
            ) : (
             <>
                <BarChart className="w-5 h-5" />
                Generate Report
             </>
            )}
          </button>
        </form>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto bg-red-900/20 border border-red-500/30 rounded-xl p-4 my-6 flex items-start gap-3">
           <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
           <div>
            <h3 className="font-semibold text-red-300">Analysis Error</h3>
            <p className="text-red-400 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}
      
      {/* Conditionally render the new report component */}
      {analysisResult && <FullPsychologyReport analysis={analysisResult} />}
    </div>
  );
};

export default SentimentAnalyzer;