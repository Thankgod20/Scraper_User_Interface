import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  Bar,
  CartesianGrid,
} from "recharts";

interface MACDPoint {
  name: string;       // timestamp label, e.g. "10:00"
  macd: number;       // MACD line value
  signal: number;     // Signal line value
  histogram: number;  // Histogram bar value
}

interface MACDChartProps {
  data: MACDPoint[];
  macdColor?: string;
  signalColor?: string;
  histColor?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "",
          padding: "4px 8px",
          border: "1px solid #ccc",
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        <p>{`Time: ${payload[0].payload.name}`}</p>
        {payload.map((entry: any, idx: number) => (
          <p key={idx} style={{ color: entry.stroke || entry.fill }}>
            {`${entry.name}: ${entry.value.toFixed(2)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const MACDChart: React.FC<MACDChartProps> = ({
  data,
  macdColor = "#8884d8",
  signalColor = "#82ca9d",
  histColor = "#ffc658",
}) => {
  data.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data}>
        <CartesianGrid stroke="#f5f5f5" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="top" height={24} />
        
        {/* Histogram bars */}
        <Bar
          yAxisId="left"
          dataKey="histogram"
          name="Histogram"
          fill={histColor}
          barSize={8}
        />

        {/* MACD and Signal lines */}
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="macd"
          name="MACD"
          stroke={macdColor}
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="signal"
          name="Signal"
          stroke={signalColor}
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default MACDChart;
