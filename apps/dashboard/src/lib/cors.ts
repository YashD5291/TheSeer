import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'chrome-extension://',
  'http://localhost:3000',
];

export function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get('origin') ?? '*';
  const isAllowed =
    origin === '*' ||
    ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed));

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function optionsResponse(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}
