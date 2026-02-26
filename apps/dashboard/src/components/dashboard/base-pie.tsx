'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface BaseData {
  base: string;
  count: number;
}

const COLORS: Record<string, string> = {
  gen_ai: '#6366f1',
  mle: '#f59e0b',
  mix: '#10b981',
};

const LABELS: Record<string, string> = {
  gen_ai: 'Gen AI',
  mle: 'MLE',
  mix: 'Mix',
};

export function BasePie({ data }: { data: BaseData[] }) {
  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No base resume data yet
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: LABELS[d.base] || d.base,
    value: d.count,
    fill: COLORS[d.base] || '#94a3b8',
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
