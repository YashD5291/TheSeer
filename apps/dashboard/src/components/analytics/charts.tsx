'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

interface GapData {
  gap: string;
  count: number;
}

export function GapChart({ data }: { data: GapData[] }) {
  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="gap"
          width={110}
          className="text-xs"
          tick={{ fontSize: 11 }}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface TimeSeriesData {
  date: string;
  count: number;
  avgScore: number;
}

export function TimeSeriesChart({ data }: { data: TimeSeriesData[] }) {
  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" className="text-xs" />
        <YAxis yAxisId="left" allowDecimals={false} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="count"
          stroke="#6366f1"
          strokeWidth={2}
          name="Jobs"
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="avgScore"
          stroke="#10b981"
          strokeWidth={2}
          name="Avg Score"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface PhaseData {
  phase: string;
  avgMs: number;
}

const PHASE_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#f59e0b',
  '#3b82f6',
  '#10b981',
  '#ef4444',
];

export function PhaseTimingChart({
  data,
}: {
  data: { phases: PhaseData[]; avgTotal: number; count: number };
}) {
  if (!data || !data.phases || data.phases.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.phases}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="phase" className="text-xs" />
          <YAxis className="text-xs" />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(val) => {
              const v = Number(val) || 0;
              const label = v < 1000
                ? `${v}ms`
                : v < 60000
                  ? `${(v / 1000).toFixed(1)}s`
                  : `${(v / 60000).toFixed(1)}m`;
              return [label, 'Avg Time'];
            }}
          />
          <Bar dataKey="avgMs" radius={[4, 4, 0, 0]}>
            {data.phases.map((_, i) => (
              <Cell key={i} fill={PHASE_COLORS[i % PHASE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="text-center text-sm text-muted-foreground">
        Average total: {data.avgTotal < 60000
          ? `${(data.avgTotal / 1000).toFixed(1)}s`
          : `${(data.avgTotal / 60000).toFixed(1)}m`}
        {' '}across {data.count} jobs
      </div>
    </div>
  );
}

interface FunnelData {
  status: string;
  count: number;
}

export function StatusFunnelChart({ data }: { data: FunnelData[] }) {
  if (!data || data.length === 0) {
    return <EmptyState />;
  }

  const ordered = [
    'analyzed',
    'resume_created',
    'applied',
    'phone_screen',
    'technical',
    'onsite',
    'offer',
    'rejected',
    'withdrawn',
    'ghosted',
  ];

  const chartData = ordered
    .map((s) => ({
      status: s.replace(/_/g, ' '),
      count: data.find((d) => d.status === s)?.count || 0,
    }))
    .filter((d) => d.count > 0);

  const FUNNEL_COLORS: Record<string, string> = {
    analyzed: '#3b82f6',
    'resume created': '#6366f1',
    applied: '#eab308',
    'phone screen': '#8b5cf6',
    technical: '#a855f7',
    onsite: '#d946ef',
    offer: '#10b981',
    rejected: '#ef4444',
    withdrawn: '#6b7280',
    ghosted: '#9ca3af',
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="status" className="text-xs" />
        <YAxis allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={FUNNEL_COLORS[entry.status] || '#94a3b8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      Not enough data yet
    </div>
  );
}
