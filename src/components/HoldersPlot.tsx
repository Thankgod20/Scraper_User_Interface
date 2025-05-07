import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export interface OrderData {
  amount: number;
  time: string;
  price: number;
}

export interface HolderStats {
  time: string;
  holders: number;
  nonHolders: number;
}

export function computeHolderStats(data: OrderData[]): HolderStats[] {
  const map = new Map<string, { holders: number; nonHolders: number }>();

  data.forEach(({ time, amount }) => {
    if (!map.has(time)) {
      map.set(time, { holders: 0, nonHolders: 0 });
    }
    const bucket = map.get(time)!;
    if (amount > 0) {
      bucket.holders++;
    } else {
      bucket.nonHolders++;
    }
  });

  return Array.from(map.entries())
    .map(([time, counts]) => ({ time, ...counts }))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

interface HolderStatsCardProps {
  data: OrderData[];
  title?: string;
  theme?: 'light' | 'dark';
}

const HolderStatsCard: React.FC<HolderStatsCardProps> = ({
  data,
  title = 'Holders vs Non-Holders',
  theme = 'light',
}) => {
  const stats = computeHolderStats(data);

  const isDark = theme === 'dark';

  const containerStyle: React.CSSProperties = {
    border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '1rem',
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    color: isDark ? '#f3f4f6' : '#111827',
  };

  const gridStroke = isDark ? '#4b5563' : '#e0e0e0';

  return (
    <div style={containerStyle}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>{title}</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={stats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="5 5" />
          <XAxis dataKey="time" tick={{ fontSize: 12, fill: isDark ? '#d1d5db' : '#374151' }} />
          <YAxis tick={{ fontSize: 12, fill: isDark ? '#d1d5db' : '#374151' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? '#374151' : '#ffffff',
              borderColor: isDark ? '#4b5563' : '#e5e7eb',
              color: isDark ? '#f3f4f6' : '#111827',
            }}
          />
          <Legend verticalAlign="top" wrapperStyle={{ color: isDark ? '#f3f4f6' : '#111827' }} />
          <Line
            type="monotone"
            dataKey="holders"
            name="Holders"
            stroke="#10B981"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="nonHolders"
            name="Non-Holders"
            stroke="#EF4444"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HolderStatsCard;
