import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface StochPoint {
  name: string;
  k: number;
  d?: number;
}

interface StochRSIChartProps {
  data: StochPoint[];           // Precomputed StochRSI data
  title?: string;
  theme?: 'light' | 'dark';
  colorK?: string;             // %K line color
  colorD?: string;             // %D line color (smoothed)
  overboughtLevel?: number;    // default 80
  oversoldLevel?: number;      // default 20
}

const DefaultTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const point = payload[0].payload;
    return (
      <div style={{
        background: '#000',
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: 4,
        fontSize: 12,
      }}>
        <div><strong>Time:</strong> {point.name}</div>
        <div><strong>%K:</strong> {point.k.toFixed(2)}</div>
        {point.d !== undefined && <div><strong>%D:</strong> {point.d.toFixed(2)}</div>}
      </div>
    );
  }
  return null;
};

const StochRSIChart: React.FC<StochRSIChartProps> = ({
  data,
  colorK = '#6366F1',
  colorD = '#F59E0B',
  overboughtLevel = 80,
  oversoldLevel = 20,
}) => {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart
        data={data}
        margin={{ top: 16, right: 24, bottom: 16, left: 0 }}
      >
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} minTickGap={20} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />

        {/* Overbought/Oversold reference lines */}
        <ReferenceLine
          y={overboughtLevel}
          stroke={colorD}
          strokeDasharray="4 4"
          label={{ value: String(overboughtLevel), position: 'right', fontSize: 10, fill: colorD }}
        />
        <ReferenceLine
          y={oversoldLevel}
          stroke={colorK}
          strokeDasharray="4 4"
          label={{ value: String(oversoldLevel), position: 'right', fontSize: 10, fill: colorK }}
        />

        <Tooltip content={<DefaultTooltip />} />
        <Legend verticalAlign="top" height={24} />

        {/* %K line */}
        <Line
          type="monotone"
          dataKey="k"
          name="%K"
          stroke={colorK}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />

        {/* %D line, dashed */}
        <Line
          type="monotone"
          dataKey="d"
          name="%D"
          stroke={colorD}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default StochRSIChart;
