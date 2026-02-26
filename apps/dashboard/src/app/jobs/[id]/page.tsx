import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AnalysisPanel } from '@/components/detail/analysis-panel';
import { Timeline } from '@/components/detail/timeline';
import { StatusUpdater } from '@/components/detail/status-updater';
import { ScoreBadge, RecommendationBadge } from '@/components/jobs/status-badge';

async function getJob(id: string) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/jobs/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <div className="mt-1 flex items-center gap-3 text-muted-foreground">
            <span className="font-medium text-foreground">{job.company}</span>
            {job.location && <span>{job.location}</span>}
            {job.salaryRange && <span>{job.salaryRange}</span>}
          </div>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-sm text-blue-600 hover:underline"
            >
              View original posting
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          {job.analysis?.fitScore !== undefined && (
            <ScoreBadge score={job.analysis.fitScore} />
          )}
          {job.analysis?.applyRecommendation && (
            <RecommendationBadge rec={job.analysis.applyRecommendation} />
          )}
        </div>
      </div>

      {/* Timing bar */}
      {job.timing?.totalMs && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {job.timing.extractionMs && (
            <span>Extract: {formatMs(job.timing.extractionMs)}</span>
          )}
          {job.timing.crawlMs && (
            <span>Crawl: {formatMs(job.timing.crawlMs)}</span>
          )}
          {job.timing.grokMs && (
            <span>Grok: {formatMs(job.timing.grokMs)}</span>
          )}
          {job.timing.claudeSubmitMs && (
            <span>Claude Submit: {formatMs(job.timing.claudeSubmitMs)}</span>
          )}
          {job.timing.claudeResponseMs && (
            <span>Claude Response: {formatMs(job.timing.claudeResponseMs)}</span>
          )}
          {job.timing.pdfMs && (
            <span>PDF: {formatMs(job.timing.pdfMs)}</span>
          )}
          <span className="font-medium text-foreground">
            Total: {formatMs(job.timing.totalMs)}
          </span>
        </div>
      )}

      {/* Models used */}
      {job.models && (
        <div className="flex gap-2">
          {job.models.grok && (
            <Badge variant="outline">Grok: {job.models.grok}</Badge>
          )}
          {job.models.claude && (
            <Badge variant="outline">Claude: {job.models.claude}</Badge>
          )}
          {job.models.claudeExtendedThinking && (
            <Badge variant="outline">Extended Thinking</Badge>
          )}
        </div>
      )}

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="analysis">
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="prompt">Prompt / Response</TabsTrigger>
          <TabsTrigger value="jd">Job Description</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="mt-4">
          {job.analysis ? (
            <AnalysisPanel analysis={job.analysis} />
          ) : (
            <div className="text-muted-foreground">No analysis data</div>
          )}
        </TabsContent>

        <TabsContent value="resume" className="mt-4">
          <div className="space-y-4">
            {job.resume ? (
              <>
                <div className="rounded-lg border overflow-hidden">
                  <iframe
                    src={`/api/pdf/${job._id}`}
                    className="h-[600px] w-full"
                    title="Resume PDF"
                  />
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/api/pdf/${job._id}`}
                    download
                    className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
                  >
                    Download PDF
                  </a>
                  {job.claudeChatUrl && (
                    <a
                      href={job.claudeChatUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Open in Claude
                    </a>
                  )}
                </div>
                {job.resume.latexSource && (
                  <details className="rounded-lg border">
                    <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
                      LaTeX Source
                    </summary>
                    <pre className="max-h-96 overflow-auto p-4 text-xs bg-muted">
                      {job.resume.latexSource}
                    </pre>
                  </details>
                )}
              </>
            ) : (
              <div className="text-muted-foreground">
                No resume generated yet
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="prompt" className="mt-4 space-y-6">
          {job.claudePrompt && (
            <Card>
              <CardHeader>
                <CardTitle>Claude Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                  {job.claudePrompt}
                </pre>
              </CardContent>
            </Card>
          )}
          {job.claudeResponse && (
            <Card>
              <CardHeader>
                <CardTitle>Claude Response</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                  {job.claudeResponse}
                </pre>
              </CardContent>
            </Card>
          )}
          {!job.claudePrompt && !job.claudeResponse && (
            <div className="text-muted-foreground">No prompt/response data</div>
          )}
        </TabsContent>

        <TabsContent value="jd" className="mt-4">
          {job.description ? (
            <Card>
              <CardContent className="pt-6">
                <pre className="whitespace-pre-wrap text-sm">{job.description}</pre>
              </CardContent>
            </Card>
          ) : (
            <div className="text-muted-foreground">No description</div>
          )}
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Bottom: Timeline + Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline events={job.events || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusUpdater
              jobId={job._id}
              currentStatus={job.status}
              currentNotes={job.notes || ''}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
