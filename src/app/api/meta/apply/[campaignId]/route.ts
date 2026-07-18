import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: 'META_ROUTE_DEPRECATED',
        message: 'Meta write actions are not supported by NOVA.',
      },
    },
    { status: 410 },
  );
}
