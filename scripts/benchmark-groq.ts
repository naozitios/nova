#!/usr/bin/env npx tsx
/**
 * Groq provider benchmark for Business Context extraction.
 *
 * Executes ONLY when:
 *   1. BUSINESS_CONTEXT_RUN_PROVIDER_TESTS=1
 *   2. GROQ_API_KEY is set and non-empty
 *
 * Otherwise emits a machine-readable skipped result (JSON) and exits 0.
 *
 * Output: JSON to stdout — safe for CI artifact consumption.
 * Exit code: 0 on skip or pass, 1 on failed benchmark or unexpected error.
 */

import Groq from 'groq-sdk'
import { validateOutput } from '../src/infrastructure/business-context/extraction/output-validator'
import type { ExtractionResult } from '../src/core/business-context/extraction.port'

// ─── Guard: required env vars ────────────────────────────────────────────────

const RUN_PROVIDER_TESTS = process.env.BUSINESS_CONTEXT_RUN_PROVIDER_TESTS === '1'
const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

if (!RUN_PROVIDER_TESTS || !GROQ_API_KEY) {
  const skipReasons: string[] = []
  if (!RUN_PROVIDER_TESTS) skipReasons.push('BUSINESS_CONTEXT_RUN_PROVIDER_TESTS != 1')
  if (!GROQ_API_KEY) skipReasons.push('GROQ_API_KEY not set')

  const skipped = {
    status: 'skipped',
    provider: 'groq',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    reason: skipReasons.join('; '),
    timestamp: new Date().toISOString(),
    results: [],
  }
  console.log(JSON.stringify(skipped, null, 2))
  process.exit(0)
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface BenchmarkResult {
  name: string
  ok: boolean
  latencyMs: number
  inputTokens: number
  outputTokens: number
  error?: string
}

interface BenchmarkReport {
  status: 'passed' | 'failed'
  provider: 'groq'
  model: string
  timestamp: string
  results: BenchmarkResult[]
  summary: {
    total: number
    passed: number
    failed: number
    avgLatencyMs: number
  }
}

// ─── Benchmarks ──────────────────────────────────────────────────────────────

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

const BENCHMARKS: Array<{
  name: string
  systemPrompt: string
  userMessage: string
  maxTokens: number
}> = [
  {
    name: 'extraction-brief',
    systemPrompt:
      'Extract structured business context facts. Return JSON: {"facts":[{"factKey":"key","value":"val","confidence":0.9}]}',
    userMessage:
      'Acme Corp sells enterprise SaaS for $99/mo. Target segment: mid-market B2B. Founded 2019, 50 employees.',
    maxTokens: 512,
  },
  {
    name: 'extraction-schema-constrained',
    systemPrompt:
      'Extract facts into JSON matching: {"facts":[{"factKey":"business.name","value":"Acme","confidence":1.0,"sourceExcerpt":"Acme Corp","evidenceLocator":null}],"conflicts":[],"warnings":[]}',
    userMessage:
      'Nova Agency manages Meta and Google ads. Monthly spend ~$50K across 12 campaigns. Primary KPI is ROAS.',
    maxTokens: 1024,
  },
  {
    name: 'extraction-structured-output',
    systemPrompt:
      'You are a business context extractor. Return ONLY valid JSON. Schema: {"facts":[],"conflicts":[],"warnings":[]}',
    userMessage:
      'The business has 3 product tiers: Starter ($29/mo), Pro ($99/mo), Enterprise ($299/mo). LTV is ~$2400. Churn rate 5% monthly.',
    maxTokens: 512,
  },
]

// ─── Runner ──────────────────────────────────────────────────────────────────

async function runBenchmark(
  client: Groq,
  bench: (typeof BENCHMARKS)[number],
): Promise<BenchmarkResult> {
  const start = performance.now()
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: bench.systemPrompt },
        { role: 'user', content: bench.userMessage },
      ],
      temperature: 0.1,
      max_tokens: bench.maxTokens,
      response_format: { type: 'json_object' },
    })

    const latencyMs = Math.round(performance.now() - start)
    const choice = completion.choices[0]
    const content = choice?.message?.content || ''

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return {
        name: bench.name,
        ok: false,
        latencyMs,
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
        error: 'Invalid JSON response',
      }
    }

    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as Record<string, unknown>).facts) &&
      Array.isArray((parsed as Record<string, unknown>).conflicts) &&
      Array.isArray((parsed as Record<string, unknown>).warnings)
    ) {
      const validation = validateOutput(parsed as ExtractionResult)

      return {
        name: bench.name,
        ok: validation.valid,
        latencyMs,
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
        error: validation.valid
          ? undefined
          : `Schema validation failed: ${validation.errors.map((e) => e.message).join('; ')}`,
      }
    }

    return {
      name: bench.name,
      ok: false,
      latencyMs,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      error: 'Output missing required fields (facts/conflicts/warnings)',
    }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    return {
      name: bench.name,
      ok: false,
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const client = new Groq({ apiKey: GROQ_API_KEY })

  const results: BenchmarkResult[] = []
  for (const bench of BENCHMARKS) {
    results.push(await runBenchmark(client, bench))
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  const totalLatency = results.reduce((sum, r) => sum + r.latencyMs, 0)

  const report: BenchmarkReport = {
    status: failed === 0 ? 'passed' : 'failed',
    provider: 'groq',
    model: MODEL,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed,
      failed,
      avgLatencyMs: Math.round(totalLatency / results.length),
    },
  }

  console.log(JSON.stringify(report, null, 2))

  if (report.status === 'failed') {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(JSON.stringify({
    status: 'error',
    provider: 'groq',
    error: err instanceof Error ? err.message : String(err),
    timestamp: new Date().toISOString(),
  }))
  process.exit(1)
})
