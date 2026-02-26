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
    .select('resume.pdfBinary resume.folderName title company')
    .lean();

  if (!job?.resume?.pdfBinary) {
    return NextResponse.json(
      { error: 'PDF not found' },
      { status: 404, headers: corsHeaders(request) }
    );
  }

  const filename = `${job.resume.folderName || `${job.company} - ${job.title}`}.pdf`;

  return new NextResponse(job.resume.pdfBinary, {
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': String(job.resume.pdfBinary.length),
    },
  });
}
