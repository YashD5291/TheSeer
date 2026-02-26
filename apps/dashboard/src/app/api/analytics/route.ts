import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Job } from '@/lib/models/job';
import { corsHeaders, optionsResponse } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}

export async function GET(request: NextRequest) {
  await dbConnect();
  const type = request.nextUrl.searchParams.get('type') || 'overview';

  switch (type) {
    case 'overview':
      return NextResponse.json(await getOverview(), {
        headers: corsHeaders(request),
      });
    case 'score_distribution':
      return NextResponse.json(await getScoreDistribution(), {
        headers: corsHeaders(request),
      });
    case 'base_usage':
      return NextResponse.json(await getBaseUsage(), {
        headers: corsHeaders(request),
      });
    case 'status_funnel':
      return NextResponse.json(await getStatusFunnel(), {
        headers: corsHeaders(request),
      });
    case 'time_series':
      return NextResponse.json(await getTimeSeries(), {
        headers: corsHeaders(request),
      });
    case 'common_gaps':
      return NextResponse.json(await getCommonGaps(), {
        headers: corsHeaders(request),
      });
    case 'phase_timing':
      return NextResponse.json(await getPhaseTiming(), {
        headers: corsHeaders(request),
      });
    default:
      return NextResponse.json(
        { error: `Unknown analytics type: ${type}` },
        { status: 400, headers: corsHeaders(request) }
      );
  }
}

async function getOverview() {
  const [total, withResume, applied, interviews, offers, recentJobs] =
    await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ status: 'resume_created' }),
      Job.countDocuments({
        status: { $in: ['applied', 'phone_screen', 'technical', 'onsite', 'offer'] },
      }),
      Job.countDocuments({
        status: { $in: ['phone_screen', 'technical', 'onsite'] },
      }),
      Job.countDocuments({ status: 'offer' }),
      Job.find()
        .select('title company analysis.fitScore analysis.applyRecommendation status createdAt events')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

  // Week-over-week deltas
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [thisWeek, lastWeek] = await Promise.all([
    Job.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
    Job.countDocuments({
      createdAt: { $gte: twoWeeksAgo, $lt: oneWeekAgo },
    }),
  ]);

  return {
    total,
    withResume,
    applied,
    interviews,
    offers,
    thisWeek,
    lastWeek,
    recentJobs,
  };
}

async function getScoreDistribution() {
  const result = await Job.aggregate([
    { $match: { 'analysis.fitScore': { $exists: true } } },
    {
      $bucket: {
        groupBy: '$analysis.fitScore',
        boundaries: [0, 20, 40, 60, 80, 101],
        default: 'other',
        output: { count: { $sum: 1 } },
      },
    },
  ]);

  const labels = ['0-19', '20-39', '40-59', '60-79', '80-100'];
  return labels.map((label, i) => {
    const bucket = result.find(
      (r: { _id: number }) => r._id === [0, 20, 40, 60, 80][i]
    );
    return { range: label, count: bucket?.count ?? 0 };
  });
}

async function getBaseUsage() {
  const result = await Job.aggregate([
    { $match: { 'analysis.recommendedBase': { $exists: true } } },
    { $group: { _id: '$analysis.recommendedBase', count: { $sum: 1 } } },
  ]);

  return result.map((r: { _id: string; count: number }) => ({
    base: r._id,
    count: r.count,
  }));
}

async function getStatusFunnel() {
  const result = await Job.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return result.map((r: { _id: string; count: number }) => ({
    status: r._id,
    count: r.count,
  }));
}

async function getTimeSeries() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await Job.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        count: { $sum: 1 },
        avgScore: { $avg: '$analysis.fitScore' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return result.map((r: { _id: string; count: number; avgScore: number }) => ({
    date: r._id,
    count: r.count,
    avgScore: Math.round(r.avgScore || 0),
  }));
}

async function getCommonGaps() {
  const result = await Job.aggregate([
    { $unwind: '$analysis.gaps' },
    { $group: { _id: '$analysis.gaps', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 },
  ]);

  return result.map((r: { _id: string; count: number }) => ({
    gap: r._id,
    count: r.count,
  }));
}

async function getPhaseTiming() {
  const result = await Job.aggregate([
    { $match: { 'timing.totalMs': { $exists: true } } },
    {
      $group: {
        _id: null,
        avgExtraction: { $avg: '$timing.extractionMs' },
        avgCrawl: { $avg: '$timing.crawlMs' },
        avgGrok: { $avg: '$timing.grokMs' },
        avgClaudeSubmit: { $avg: '$timing.claudeSubmitMs' },
        avgClaudeResponse: { $avg: '$timing.claudeResponseMs' },
        avgPdf: { $avg: '$timing.pdfMs' },
        avgTotal: { $avg: '$timing.totalMs' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (result.length === 0) return { phases: [], count: 0 };

  const r = result[0];
  return {
    phases: [
      { phase: 'Extraction', avgMs: Math.round(r.avgExtraction || 0) },
      { phase: 'Crawl', avgMs: Math.round(r.avgCrawl || 0) },
      { phase: 'Grok Analysis', avgMs: Math.round(r.avgGrok || 0) },
      { phase: 'Claude Submit', avgMs: Math.round(r.avgClaudeSubmit || 0) },
      { phase: 'Claude Response', avgMs: Math.round(r.avgClaudeResponse || 0) },
      { phase: 'PDF Generation', avgMs: Math.round(r.avgPdf || 0) },
    ],
    avgTotal: Math.round(r.avgTotal || 0),
    count: r.count,
  };
}
