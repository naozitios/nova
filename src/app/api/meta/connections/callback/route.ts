import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.redirect(
    new URL('/settings?meta_route_deprecated=1', request.url),
    { status: 303 },
  );
}
