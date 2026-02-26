import { Badge } from '@/components/ui/badge';

interface Analysis {
  fitScore: number;
  confidence: number;
  recommendedBase: string;
  baseReasoning: string;
  keyMatches: string[];
  gaps: string[];
  gapMitigation: string[];
  tailoringPriorities: string[];
  atsKeywords: string[];
  redFlags: string[];
  estimatedCompetition: string;
  applyRecommendation: string;
}

export function AnalysisPanel({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4 text-center">
          <div className="text-sm text-muted-foreground">Fit Score</div>
          <div className="mt-1 text-4xl font-bold">{analysis.fitScore}</div>
          <div className="text-xs text-muted-foreground">
            {analysis.confidence}% confidence
          </div>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <div className="text-sm text-muted-foreground">Competition</div>
          <div className="mt-1 text-2xl font-semibold capitalize">
            {analysis.estimatedCompetition}
          </div>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <div className="text-sm text-muted-foreground">Recommended Base</div>
          <div className="mt-1 text-2xl font-semibold capitalize">
            {analysis.recommendedBase?.replace(/_/g, ' ')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {analysis.baseReasoning}
          </div>
        </div>
      </div>

      <Section title="Key Matches" color="emerald">
        {analysis.keyMatches?.map((m, i) => (
          <Badge key={i} className="bg-emerald-100 text-emerald-800">
            {m}
          </Badge>
        ))}
      </Section>

      <Section title="Gaps" color="red">
        {analysis.gaps?.map((g, i) => (
          <Badge key={i} className="bg-red-100 text-red-800">
            {g}
          </Badge>
        ))}
      </Section>

      <Section title="ATS Keywords" color="blue">
        {analysis.atsKeywords?.map((k, i) => (
          <Badge key={i} className="bg-blue-100 text-blue-800">
            {k}
          </Badge>
        ))}
      </Section>

      {analysis.gapMitigation?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Gap Mitigation</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            {analysis.gapMitigation.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.tailoringPriorities?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Tailoring Priorities</h3>
          <ul className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            {analysis.tailoringPriorities.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis.redFlags?.length > 0 && (
        <Section title="Red Flags" color="orange">
          {analysis.redFlags.map((f, i) => (
            <Badge key={i} className="bg-orange-100 text-orange-800">
              {f}
            </Badge>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
