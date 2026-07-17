import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: 'META_ROUTE_DEPRECATED',
        message: 'This endpoint is deprecated. Use /api/meta/oauth/start instead.',
        replacement: '/api/meta/oauth/start',
      },
    },
    { status: 410 },
  );
}
