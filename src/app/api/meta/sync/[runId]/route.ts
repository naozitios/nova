import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'META_ROUTE_DEPRECATED',
        message: 'This route is deprecated. Use /api/meta/sync.',
      },
    },
    { status: 410 },
  );
}
