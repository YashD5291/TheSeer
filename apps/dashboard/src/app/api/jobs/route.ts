import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Job } from '@/lib/models/job';
import { corsHeaders, optionsResponse } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}

export async function GET(request: NextRequest) {
  await dbConnect();
  const { searchParams } = request.nextUrl;

  const status = searchParams.get('status');
  const company = searchParams.get('company');
  const search = searchParams.get('search');
  const minScore = searchParams.get('minScore');
  const maxScore = searchParams.get('maxScore');
  const base = searchParams.get('base');
  const sort = searchParams.get('sort') || 'createdAt';
  const order = searchParams.get('order') === 'asc' ? 1 : -1;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));

  const filter: Record<string, unknown> = {};

  if (status) filter.status = status;
  if (company) filter.company = { $regex: company, $options: 'i' };
  if (base) filter['analysis.recommendedBase'] = base;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
    ];
  }
  if (minScore || maxScore) {
    filter['analysis.fitScore'] = {};
    if (minScore) (filter['analysis.fitScore'] as Record<string, number>).$gte = parseInt(minScore);
    if (maxScore) (filter['analysis.fitScore'] as Record<string, number>).$lte = parseInt(maxScore);
  }

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .select('-resume.pdfBinary -claudePrompt -claudeResponse -description')
      .sort({ [sort]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Job.countDocuments(filter),
  ]);

  return NextResponse.json(
    { jobs, total, page, totalPages: Math.ceil(total / limit) },
    { headers: corsHeaders(request) }
  );
}

export async function POST(request: NextRequest) {
  await dbConnect();
  const body = await request.json();

  const job = await Job.findOneAndUpdate(
    { url: body.url },
    {
      $set: {
        title: body.title,
        company: body.company,
        url: body.url,
        location: body.location,
        salaryRange: body.salaryRange,
        jobType: body.jobType,
        description: body.description,
        requirements: body.requirements || [],
        niceToHaves: body.niceToHaves || [],
        platform: body.platform,
        extraction: body.extraction,
        analysis: body.analysis,
        models: body.models,
        timing: body.timing,
        claudePrompt: body.claudePrompt,
        status: body.status || 'analyzed',
      },
      $push: {
        events: {
          $each: body.events || [{ type: 'analyzed', timestamp: new Date() }],
        },
      },
    },
    { upsert: true, new: true, lean: true, projection: { _id: 1 } }
  );

  return NextResponse.json(
    { _id: job._id },
    { status: 201, headers: corsHeaders(request) }
  );
}
