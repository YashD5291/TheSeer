import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Job } from '@/lib/models/job';
import { corsHeaders, optionsResponse } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}

export async function POST(request: NextRequest) {
  await dbConnect();
  const body = await request.json();

  if (!body.jobId || !body.type) {
    return NextResponse.json(
      { error: 'jobId and type are required' },
      { status: 400, headers: corsHeaders(request) }
    );
  }

  const job = await Job.findByIdAndUpdate(
    body.jobId,
    {
      $push: {
        events: {
          type: body.type,
          timestamp: body.timestamp || new Date(),
          durationMs: body.durationMs,
          metadata: body.metadata,
        },
      },
    },
    { new: true, lean: true, projection: { _id: 1, events: { $slice: -1 } } }
  );

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404, headers: corsHeaders(request) }
    );
  }

  return NextResponse.json(
    { success: true },
    { status: 201, headers: corsHeaders(request) }
  );
}
