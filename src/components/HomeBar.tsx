'use client';
import React from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

interface BarGraphProps {
  data: {
    name: string;
    value: number;
    preval?: number;
  }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 text-white p-2 rounded border border-gray-700 text-xs">
        <p className="font-bold">{`Time: ${label}`}</p>
        <p>{`Views: ${payload[0].value.toLocaleString()}`}</p>
        {payload[0].payload.preval !== undefined && (
          <p>{`Previous: ${payload[0].payload.preval.toLocaleString()}`}</p>
        )}
      </div>
    );
  }
  return null;
};

const BarGraph: React.FC<BarGraphProps> = ({ data }) => {
  // Ensure data is sorted by name (which should be timestamp)
  const sortedData = [...data].sort((a, b) => {
    const timeA = parseInt(a.name);
    const timeB = parseInt(b.name);
    return isNaN(timeA) || isNaN(timeB) 
      ? a.name.localeCompare(b.name) 
      : timeA - timeB;
  });

  // Find the maximum value for proper scaling
  const maxValue = Math.max(...sortedData.map(item => item.value));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart
        data={sortedData}
        margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        barSize={6}
      >
        <XAxis 
          dataKey="name" 
          tick={false} 
          axisLine={{ stroke: '#666', strokeWidth: 0.5 }}
          tickLine={false}
        />
        <YAxis 
          hide={true}
          domain={[0, maxValue * 1.1]} // Add 10% padding to top
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {sortedData.map((entry, index) => {
            // Determine color based on growth
            let color = '#4ADE80'; // Default green for growth
            
            if (entry.preval !== undefined && entry.value < entry.preval) {
              color = '#EF4444'; // Red for decline
            }
            
            return <Cell key={`cell-${index}`} fill={color} />;
          })}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
};

export default BarGraph;