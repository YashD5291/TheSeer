import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GapChart,
  TimeSeriesChart,
  PhaseTimingChart,
  StatusFunnelChart,
} from '@/components/analytics/charts';
import { ScoreChart } from '@/components/dashboard/score-chart';

async function fetchAnalytics(type: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/analytics?type=${type}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function AnalyticsPage() {
  const [scoreDist, statusFunnel, timeSeries, commonGaps, phaseTiming] =
    await Promise.all([
      fetchAnalytics('score_distribution'),
      fetchAnalytics('status_funnel'),
      fetchAnalytics('time_series'),
      fetchAnalytics('common_gaps'),
      fetchAnalytics('phase_timing'),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Patterns, insights, and pipeline performance
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Application Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusFunnelChart data={statusFunnel || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fit Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreChart data={scoreDist || []} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jobs Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeSeriesChart data={timeSeries || []} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Common Skill Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <GapChart data={commonGaps || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline Phase Timing</CardTitle>
          </CardHeader>
          <CardContent>
            <PhaseTimingChart
              data={phaseTiming || { phases: [], avgTotal: 0, count: 0 }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
