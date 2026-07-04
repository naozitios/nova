import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/di/container';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = Container.getCampaignService();
  const entry = await service.get(id);

  if (!entry) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } }, { status: 404 });
  }

  return NextResponse.json(entry);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const service = Container.getCampaignService();
    const result = await service.update(id, body, body.authoredBy || 'api', body.commitMessage || 'Campaign updated via API');

    if (!result.config && result.errors.length > 0) {
      const status = result.errors.includes('Campaign not found') ? 404 : 400;
      return NextResponse.json({ error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message: result.errors.join(', ') } }, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = Container.getCampaignService();
  const success = await service.delete(id);

  if (!success) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
