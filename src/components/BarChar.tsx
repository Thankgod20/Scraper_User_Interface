
import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface BarChartProps {
  data: { name: string; value: number }[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const { name, value, previousValue } = payload[0].payload;
    const increase = previousValue !== undefined ? value - previousValue : 0;
    
    return (
      <div className="bg-white p-2 border border-gray-200 rounded-md text-xs text-black">
        <p className="font-bold">{`Time: ${name}`}</p>
        <p>{`Total Value: ${value}`}</p>
        {previousValue !== undefined && (
          <>
            <p>{`Previous Value: ${previousValue}`}</p>
            <p className="font-semibold">{`Increase: ${increase}`}</p>
          </>
        )}
      </div>
    );
  }
  return null;
};

const BarGraph: React.FC<BarChartProps> = ({ data }) => {
  const [chartData, setChartData] = useState<any[]>([]);
  
  useEffect(() => {
    // Process the incoming data to track previous values
    const newChartData = data.map((item, index) => {
      const existingItem = chartData.find(chartItem => chartItem.name === item.name);
      return {
        name: item.name,
        value: item.value,
        previousValue: existingItem ? existingItem.value : undefined
      };
    });
    
    setChartData(newChartData);
  }, [data]);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} height={20}>
          <XAxis dataKey="name" />
          <YAxis/>
          <Tooltip content={<CustomTooltip />} />
          {/* Render the original value in yellow */}
          <Bar dataKey="previousValue" fill="#F59E0B" name="Previous Value">
            {chartData.map((entry, index) => (
              <Cell key={`cell-previous-${index}`} fill="#F59E0B" />
            ))}
          </Bar>
          {/* Render the difference in red */}
          <Bar dataKey={(entry) => entry.previousValue !== undefined ? entry.value - entry.previousValue : entry.value} 
               fill="#EF4444" 
               name="Increase"
               stackId="a">
            {chartData.map((entry, index) => (
              <Cell key={`cell-increase-${index}`} fill="#EF4444" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarGraph;
