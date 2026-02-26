import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { ScoreChart } from '@/components/dashboard/score-chart';
import { BasePie } from '@/components/dashboard/base-pie';

async function fetchAnalytics(type: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/analytics?type=${type}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function CommandCenter() {
  const [overview, scoreDist, baseUsage] = await Promise.all([
    fetchAnalytics('overview'),
    fetchAnalytics('score_distribution'),
    fetchAnalytics('base_usage'),
  ]);

  const o = overview || {
    total: 0,
    applied: 0,
    interviews: 0,
    offers: 0,
    thisWeek: 0,
    lastWeek: 0,
    recentJobs: [],
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Command Center</h1>
        <p className="mt-1 text-muted-foreground">
          As told by The Seer
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Jobs Analyzed"
          value={o.total}
          delta={o.thisWeek}
          description="Total jobs processed"
        />
        <KpiCard
          title="Applied"
          value={o.applied}
          description="Applications submitted"
        />
        <KpiCard
          title="Interviews"
          value={o.interviews}
          description="Phone + technical + onsite"
        />
        <KpiCard
          title="Offers"
          value={o.offers}
          description="Offer stage or beyond"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed jobs={o.recentJobs} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fit Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreChart data={scoreDist || []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Base Resume Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <BasePie data={baseUsage || []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
