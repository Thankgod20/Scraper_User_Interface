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
        <p>{`Time: ${payload[0].payload.time}`}</p>
        <p>{`Aggregated Sentiment: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const LineGraphTimeS: React.FC<LineGraphProps> = ({ data, color = "#10B981" }) => {
  data.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
       
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="aggregatedSentiment" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LineGraphTimeS;
