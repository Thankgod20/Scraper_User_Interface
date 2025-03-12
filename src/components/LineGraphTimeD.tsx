// components/LineGraphTimeS.tsx
import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface LineGraphProps {
  data: { time: string; aggregatedSentiment: number }[];
  color?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#fff",
        padding: "5px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        fontSize: "12px",
        color: "black",
      }}>
        <p>{`Time: ${label}`}</p>
        <p>{`Aggregated Sentiment: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const LineGraphTimeD: React.FC<LineGraphProps> = ({ data, color = "#10B981" }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis 
          dataKey="time" 
          tickFormatter={(timeStr) => new Date(timeStr).toLocaleTimeString()} 
          label={{ value: 'Time', position: 'insideBottomRight', offset: -5 }}
        />
        <YAxis label={{ value: 'Aggregated Sentiment', angle: -90, position: 'insideLeft' }} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="aggregatedSentiment" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LineGraphTimeD;
