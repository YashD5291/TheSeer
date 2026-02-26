import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface RecentJob {
  _id: string;
  title: string;
  company: string;
  analysis?: { fitScore?: number; applyRecommendation?: string };
  status: string;
  createdAt: string;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusColor(status: string): string {
  const colors: Record<string, string> = {
    analyzed: 'bg-blue-100 text-blue-800',
    resume_created: 'bg-indigo-100 text-indigo-800',
    applied: 'bg-yellow-100 text-yellow-800',
    phone_screen: 'bg-purple-100 text-purple-800',
    technical: 'bg-purple-100 text-purple-800',
    onsite: 'bg-purple-100 text-purple-800',
    offer: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    withdrawn: 'bg-gray-100 text-gray-800',
    ghosted: 'bg-gray-100 text-gray-600',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function ActivityFeed({ jobs }: { jobs: RecentJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No jobs analyzed yet. Use the extension to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <Link
          key={job._id}
          href={`/jobs/${job._id}`}
          className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{job.title}</div>
            <div className="text-xs text-muted-foreground">{job.company}</div>
          </div>
          <div className="flex items-center gap-2">
            {job.analysis?.fitScore !== undefined && (
              <span
                className={`text-sm font-bold ${
                  job.analysis.fitScore >= 70
                    ? 'text-emerald-600'
                    : job.analysis.fitScore >= 40
                      ? 'text-yellow-600'
                      : 'text-red-500'
                }`}
              >
                {job.analysis.fitScore}
              </span>
            )}
            <Badge
              variant="secondary"
              className={statusColor(job.status)}
            >
              {job.status.replace(/_/g, ' ')}
            </Badge>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTimeAgo(job.createdAt)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
