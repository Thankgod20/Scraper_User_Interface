// components/HoldersChart.tsx
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface TimeSeriesOutput {
  time: string;
  holders: number;
  growthRate?: number;
  firstDifference?: number;
  rollingMean?: number;
  rollingStdDev?: number;
}

interface SummaryStats {
  mean: number;
  median: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
}

interface AnalysisResult {
  summary: SummaryStats;
  timeSeries: TimeSeriesOutput[];
}

interface Props {
  data: AnalysisResult;
}

const HoldersMeanChart: React.FC<Props> = ({ data }) => {
  const { summary, timeSeries } = data;

  return (
    <div className="bg-gray-900 text-white rounded-xl p-6 shadow-lg w-full">
      <h2 className="text-xl font-semibold mb-4">Holder Trend Analysis</h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 text-sm">
        <div>📊 Mean: {summary.mean.toFixed(2)}</div>
        <div>📈 Median: {summary.median.toFixed(2)}</div>
        <div>📉 Std Dev: {summary.stdDev.toFixed(2)}</div>
        <div>↔️ Skewness: {summary.skewness.toFixed(2)}</div>
        <div>🎯 Kurtosis: {summary.kurtosis.toFixed(2)}</div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={timeSeries}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="time" stroke="#ccc" />
          <YAxis stroke="#ccc" />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
          <Legend />
          <Line type="monotone" dataKey="holders" stroke="#38bdf8" name="Holders" dot={false} />
          <Line type="monotone" dataKey="rollingMean" stroke="#22c55e" name="Rolling Mean" dot={false} />
          <Line type="monotone" dataKey="rollingStdDev" stroke="#f97316" name="Rolling Std Dev" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HoldersMeanChart;
