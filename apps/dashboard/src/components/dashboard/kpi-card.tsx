import { Card, CardContent } from '@/components/ui/card';

interface KpiCardProps {
  title: string;
  value: number;
  delta?: number;
  description?: string;
}

export function KpiCard({ title, value, delta, description }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold">{value}</span>
          {delta !== undefined && delta !== 0 && (
            <span
              className={`text-sm font-medium ${
                delta > 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {delta > 0 ? '+' : ''}
              {delta} this week
            </span>
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
