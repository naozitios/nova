import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/di/container';

/** Applies an array of AI-proposed actions (budget changes, duplicates, pauses) and returns per-action results. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const actions = body.actions || body.actionIds;

    if (!Array.isArray(actions)) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'actions or actionIds array is required' } }, { status: 400 });
    }

    const aiService = Container.getAIService();
    const results = await aiService.applyAllActions(actions);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } }, { status: 500 });
  }
}
