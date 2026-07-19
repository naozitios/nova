import { NextRequest, NextResponse } from 'next/server';
import { ActionCenter } from '@/core/optimization/action-center';
import type { ActionStatus } from '@/core/optimization/types';

let actionCenter: ActionCenter | null = null;

function getActionCenter(): ActionCenter {
  if (!actionCenter) actionCenter = new ActionCenter();
  return actionCenter;
}

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status') as ActionStatus | null;
  const actions = getActionCenter().list(status ?? undefined);
  return NextResponse.json(actions);
}
