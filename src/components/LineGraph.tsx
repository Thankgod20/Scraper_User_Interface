import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface LineGraphProps {
    data: { name: string; value: number }[];
    color?: string;
}
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: "#fff",
                padding: "1px 1px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "10px",
                color: "black",

            }}>
                <p>{`Time: ${payload[0].payload.name}`}</p>
                <p>{`Value: ${payload[0].value}`}</p>
            </div>
        );
    }
    return null;
};
const LineGraph: React.FC<LineGraphProps> = ({ data, color = "#10B981" }) => {
    return (
        <ResponsiveContainer width="100%" height={64}>
            <LineChart data={data}>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default LineGraph;
