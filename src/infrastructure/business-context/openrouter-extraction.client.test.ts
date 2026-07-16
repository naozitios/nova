import { describe, expect, it, vi } from 'vitest'
import { OpenRouterExtractionClient } from './openrouter-extraction.client'

const schema = { type: 'object' as const, properties: {}, required: [] }

describe('OpenRouterExtractionClient', () => {
  it('sends the configured model and parses JSON content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"facts":[]}' } }] }), { status: 200 }),
    )
    const client = new OpenRouterExtractionClient('key', 'deepseek/deepseek-v4-flash', fetchImpl)

    await expect(client.complete({ schema, content: 'content', systemPrompt: 'system' })).resolves.toEqual({ facts: [] })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer key' }),
        body: expect.stringContaining('deepseek/deepseek-v4-flash'),
      }),
    )
  })

  it('preserves provider status in errors', async () => {
    const client = new OpenRouterExtractionClient(
      'key',
      'deepseek/deepseek-v4-flash',
      vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 })),
    )

    await expect(client.complete({ schema, content: 'content', systemPrompt: 'system' })).rejects.toThrow('OpenRouter API 429')
  })
})
