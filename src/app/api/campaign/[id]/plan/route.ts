import { NextResponse } from 'next/server';
import { Container } from '@/di/container';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = Container.getCampaignService();
  const entry = await service.get(id);

  if (!entry) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } }, { status: 404 });
  }

  const plan = await service.getExecutionPlan(id);
  return NextResponse.json({ plan });
}
