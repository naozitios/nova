import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/di/container';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const versionNumber = body.version;
    if (typeof versionNumber !== 'number') {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'version must be a number' } }, { status: 400 });
    }

    const service = Container.getCampaignService();
    const result = await service.rollback(id, versionNumber, body.authoredBy || 'api');

    if (!result.config && result.errors.length > 0) {
      const status = result.errors.some(e => e.includes('not found')) ? 404 : 400;
      return NextResponse.json({ error: { code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR', message: result.errors.join(', ') } }, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } }, { status: 500 });
  }
}
