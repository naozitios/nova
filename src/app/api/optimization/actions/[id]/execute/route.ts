import { NextRequest, NextResponse } from 'next/server';
import { ActionCenter } from '@/core/optimization/action-center';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';

let actionCenter: ActionCenter | null = null;

function getActionCenter(): ActionCenter {
  if (!actionCenter) actionCenter = new ActionCenter();
  return actionCenter;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accessToken = request.cookies.get('meta_access_token')?.value;

  try {
    const center = getActionCenter();
    const action = center.get(id);

    if (!action) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Action not found' } }, { status: 404 });
    }

    if (action.status !== 'approved') {
      return NextResponse.json({ error: { code: 'INVALID_STATUS', message: `Action must be approved before execution (current: ${action.status})` } }, { status: 400 });
    }

    const result = center.execute(id);
    return NextResponse.json({ status: result?.status, action: result });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Execution failed' } }, { status: 500 });
  }
}
