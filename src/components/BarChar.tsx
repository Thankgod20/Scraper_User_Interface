import React, { useEffect, useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface BarChartProps {
  data: { name: string; value: number;preval: number }[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const { name, value, previousValue, increase } = payload[0].payload;
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

// Custom formatter to filter out NaN values
const filterNaN = (value: any) => {
  return isNaN(value) || value === null ? null : value;
};

const BarGraph: React.FC<BarChartProps> = ({ data }) => {
  const prevDataRef = useRef<{[key: string]: number}>({});
  const increasesRef = useRef<{[key: string]: number}>({});
  const [chartData, setChartData] = useState<any[]>([]);
  data.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  useEffect(() => {
    // Process the incoming data to track previous values
    const newChartData = data.map((item) => {
      // Skip if current value is NaN
      if (isNaN(item.value)) {
        return {
          name: item.name,
          value: null,
          previousValue: null,
          increase: null
        };
      }
      
      const previousValue = item.preval;//prevDataRef.current[item.name];
      
      // Calculate increase only if we have a previous value
      let increase = 0;
      if (previousValue !== undefined) {
        increase = item.value - item.preval//previousValue;
        // Store the increase for this data point
        increasesRef.current[item.name] = increase;
      } else {
        // If no previous value exists, use the stored increase or default to 0
        increase = increasesRef.current[item.name] || 0;
      }
      
      // Store current value for next update
      //prevDataRef.current[item.name] = item.value;
      
      return {
        name: item.name,
        value: item.value,
        previousValue: item.preval,//previousValue !== undefined ? previousValue : item.value - increase,
        increase: !isNaN(increase) ? increase : null
      };
    });
    
    setChartData(newChartData);
  }, [data]);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" />
          
          <Tooltip content={<CustomTooltip />} />
          
          {/* Base bar (previous value) */}
          <Bar 
            dataKey={(entry) => filterNaN(entry.previousValue)} 
            fill="#F59E0B" 
            name="Previous Value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-previous-${index}`} fill="#F59E0B" />
            ))}
          </Bar>
          
          {/* Increase bar */}
          <Bar 
            dataKey={(entry) => filterNaN(entry.increase)} 
            fill="#EF4444" 
            name="Increase" 
            stackId="a"
          >
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