import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Job } from '@/lib/models/job';
import { corsHeaders, optionsResponse } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return optionsResponse(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;

  const job = await Job.findById(id)
    .select('-resume.pdfBinary')
    .lean();

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404, headers: corsHeaders(request) }
    );
  }

  return NextResponse.json(job, { headers: corsHeaders(request) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};
  const push: Record<string, unknown> = {};

  // Direct field updates
  const allowedFields = [
    'status', 'notes', 'appliedAt', 'claudePrompt', 'claudeResponse',
    'claudeChatUrl',
  ];
  for (const field of allowedFields) {
    if (body[field] !== undefined) update[field] = body[field];
  }

  // Nested timing updates (merge, don't overwrite)
  if (body.timing) {
    for (const [key, val] of Object.entries(body.timing)) {
      update[`timing.${key}`] = val;
    }
  }

  // Nested models updates
  if (body.models) {
    for (const [key, val] of Object.entries(body.models)) {
      update[`models.${key}`] = val;
    }
  }

  // Resume data — convert base64 PDF to Buffer
  if (body.resume) {
    update['resume.latexSource'] = body.resume.latexSource;
    update['resume.pdfSizeBytes'] = body.resume.pdfSizeBytes;
    update['resume.folderName'] = body.resume.folderName;
    update['resume.generatedAt'] = new Date();
    if (body.resume.pdfBase64) {
      update['resume.pdfBinary'] = Buffer.from(body.resume.pdfBase64, 'base64');
    }
    // Also update status to resume_created if still analyzed
    if (!body.status) {
      update.$setOnInsert = undefined; // no-op
    }
  }

  // Events to append
  if (body.event) {
    push.events = { ...body.event, timestamp: body.event.timestamp || new Date() };
  }

  const updateOp: Record<string, unknown> = {};
  if (Object.keys(update).length > 0) updateOp.$set = update;
  if (Object.keys(push).length > 0) updateOp.$push = push;

  if (Object.keys(updateOp).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400, headers: corsHeaders(request) }
    );
  }

  const job = await Job.findByIdAndUpdate(id, updateOp, {
    new: true,
    lean: true,
    projection: { 'resume.pdfBinary': 0 },
  });

  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404, headers: corsHeaders(request) }
    );
  }

  return NextResponse.json(job, { headers: corsHeaders(request) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();
  const { id } = await params;

  const result = await Job.findByIdAndDelete(id);

  if (!result) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404, headers: corsHeaders(request) }
    );
  }

  return NextResponse.json(
    { deleted: true },
    { headers: corsHeaders(request) }
  );
}
