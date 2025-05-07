import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Impression {
  name: string;
  value: number;
}

interface RSIChartProps {
  rsiData: Impression[];    // Precomputed RSI data
  title?: string;
  theme?: 'light' | 'dark';
  color?: string;           // Line color (default provided)
  buffer?: number;          // padding around min/max for Y-axis
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#000",
        padding: "8px",
        border: "1px solid #ccc",
        borderRadius: 4,
        fontSize: 12,
      }}>
        <div><strong>Time:</strong> {payload[0].payload.name}</div>
        <div><strong>RSI:</strong> {payload[0].value.toFixed(2)}</div>
      </div>
    );
  }
  return null;
};

const RSIChart: React.FC<RSIChartProps> = ({
  rsiData,
  color = "#6366F1",
  buffer = 5,
}) => {
  // derive dynamic min/max
  const values = rsiData.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={rsiData} margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} minTickGap={20} />

        {/* Y-axis dynamically based on data range + buffer */}
        <YAxis
          domain={[minVal - buffer, maxVal + buffer]}
          tick={{ fontSize: 10 }}
        />

        {/* Overbought/oversold reference lines still at fixed 70/30 */}
        <ReferenceLine
          y={70}
          stroke="#F59E0B"
          strokeDasharray="4 4"
          label={{ position: 'right', value: '70', fill: '#F59E0B', fontSize: 10 }}
        />
        <ReferenceLine
          y={30}
          stroke="#10B981"
          strokeDasharray="4 4"
          label={{ position: 'right', value: '30', fill: '#10B981', fontSize: 10 }}
        />

        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default RSIChart;