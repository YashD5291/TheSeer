import { Badge } from '@/components/ui/badge';

const STATUS_STYLES: Record<string, string> = {
  analyzed: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
  resume_created: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
  applied: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  phone_screen: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
  technical: 'bg-violet-100 text-violet-800 hover:bg-violet-200',
  onsite: 'bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-200',
  offer: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
  rejected: 'bg-red-100 text-red-800 hover:bg-red-200',
  withdrawn: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
  ghosted: 'bg-gray-100 text-gray-500 hover:bg-gray-200',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={STATUS_STYLES[status] || 'bg-gray-100 text-gray-800'}
    >
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-emerald-100 text-emerald-800'
      : score >= 60
        ? 'bg-green-100 text-green-800'
        : score >= 40
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-red-100 text-red-800';

  return (
    <Badge variant="secondary" className={color}>
      {score}
    </Badge>
  );
}

export function RecommendationBadge({ rec }: { rec: string }) {
  const styles: Record<string, string> = {
    strong_yes: 'bg-emerald-100 text-emerald-800',
    yes: 'bg-green-100 text-green-800',
    maybe: 'bg-yellow-100 text-yellow-800',
    no: 'bg-red-100 text-red-800',
  };

  return (
    <Badge variant="secondary" className={styles[rec] || ''}>
      {rec.replace(/_/g, ' ')}
    </Badge>
  );
}
