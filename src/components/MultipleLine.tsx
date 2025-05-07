import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type TimeAmount = { time: string; amount: number };

type HolderData = {
  address: string;
  data: TimeAmount[];
};

type MultiAddressLineChartProps = {
  data: HolderData[];
};

const mergeDataByTime = (holders: HolderData[]) => {
  const timeMap: Record<string, Record<string, any>> = {};

  holders.forEach(({ address, data }) => {
    data.forEach(({ time, amount }) => {
      if (!timeMap[time]) timeMap[time] = { time };
      timeMap[time][address] = amount;
    });
  });

  return Object.values(timeMap).sort((a, b) => a.time.localeCompare(b.time));
};

const shortenAddress = (addr: string) =>
  `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const getColor = (index: number) => {
  const palette = [
    "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#ff0000",
    "#00c49f", "#0088fe", "#a83279", "#6a0dad", "#bada55",
  ];
  return palette[index % palette.length];
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-dark border p-2 rounded shadow text-xs">
      <p><strong>Time:</strong> {label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {shortenAddress(entry.name)}: {entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const MultiAddressLineChart: React.FC<MultiAddressLineChartProps> = ({ data }) => {
  const chartData = mergeDataByTime(data);

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(val) => val.toLocaleString()} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(addr) => shortenAddress(String(addr))} />
          {data.map((holder, index) => (
            <Line
              key={holder.address}
              type="monotone"
              dataKey={holder.address}
              stroke={getColor(index)}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MultiAddressLineChart;
