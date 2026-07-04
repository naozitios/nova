import { NextRequest, NextResponse } from 'next/server';
import { ActionCenter } from '@/core/optimization/action-center';

let actionCenter: ActionCenter | null = null;

function getActionCenter(): ActionCenter {
  if (!actionCenter) actionCenter = new ActionCenter();
  return actionCenter;
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = getActionCenter().approve(id);
  if (!result) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Action not found or not in pending_review status' } }, { status: 404 });
  }
  return NextResponse.json({ status: result.status, action: result });
}
