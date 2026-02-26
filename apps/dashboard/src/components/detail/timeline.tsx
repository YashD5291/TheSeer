interface TimelineEvent {
  type: string;
  timestamp: string;
  durationMs?: number;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

const EVENT_ICONS: Record<string, string> = {
  analyzed: '🔍',
  claude_submitted: '📝',
  claude_responded: '✅',
  pdf_generated: '📄',
  applied: '📨',
  status_change: '🔄',
  phone_screen: '📞',
  technical: '💻',
  onsite: '🏢',
  offer: '🎉',
  rejected: '❌',
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events || events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No events recorded yet</div>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />

      {sorted.map((event, i) => (
        <div key={i} className="relative flex items-start gap-3">
          <div className="absolute -left-3.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-xs">
            {EVENT_ICONS[event.type] || '•'}
          </div>
          <div className="flex-1 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium capitalize">
                {event.type.replace(/_/g, ' ')}
              </span>
              {event.durationMs && (
                <span className="text-xs text-muted-foreground">
                  ({formatMs(event.durationMs)})
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(event.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
