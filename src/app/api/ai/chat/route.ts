import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/di/container';

/** Handles AI chat prompts: accepts a prompt string, processes it through the AI service, and returns actions. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'prompt is required' } }, { status: 400 });
    }

    await Container.getCampaignSeed().ensure();
    const aiService = Container.getAIService();
    const response = await aiService.processPrompt(prompt);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } }, { status: 500 });
  }
}
