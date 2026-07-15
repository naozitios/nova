// ─── LLM extraction adapter (T093) ─────────────────────────────────────────
//
// Implements ExtractionPort using an LLM client for schema-constrained
// fact extraction. Includes one repair attempt for invalid JSON output.
// No partial persistence on failed repair — atomic success or failure.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ExtractionPort,
  ExtractionRequest,
  ExtractionResult,
  ReconciliationRequest,
  ReconciliationResult,
} from '@/core/business-context/extraction.port'
import type { ServiceResult, JsonValue, EvidenceLocator } from '@/core/business-context/types'
import { resolveFacts } from '../../core/business-context/resolver'

// ─── LLM client interface ──────────────────────────────────────────────────

export interface LlmClient {
  complete(request: {
    schema: ExtractionSchema
    content: string
    systemPrompt: string
    temperature?: number
    maxTokens?: number
  }): Promise<JsonValue>
}

export interface ExtractionSchema {
  type: 'object'
  properties: Record<string, unknown>
  required: string[]
}

// ─── Schema definition ──────────────────────────────────────────────────────

const EXTRACTION_SCHEMA: ExtractionSchema = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          factKey: { type: 'string' },
          value: {},
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          sourceExcerpt: { type: ['string', 'null'] },
          evidenceLocator: { type: ['object', 'null'] },
        },
        required: ['factKey', 'value', 'confidence'],
      },
    },
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          factKey: { type: 'string' },
          values: { type: 'array' },
        },
        required: ['factKey', 'values'],
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['facts', 'conflicts', 'warnings'],
}

// ─── System prompt ──────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT =
  `Extract structured business context facts from the provided content.\n` +
  `Return JSON matching this schema:\n` +
  `{"facts":[{"factKey":"dot.separated.key","value":<any>,"confidence":<0-1>,"sourceExcerpt":"<text or null>","evidenceLocator":{}|null}],"conflicts":[{"factKey":"...","values":[<different>]}],"warnings":["issues"]}\n` +
  `Fact keys: business.name, offers.primary, customers.target_segment, brand.tone, economics.ltv, etc.\n` +
  `Only extract facts with confidence >= 0.5.`

// ─── Validation ─────────────────────────────────────────────────────────────

interface LlmFact {
  factKey: string
  value: JsonValue
  confidence: number
  sourceExcerpt: string | null
  evidenceLocator: JsonValue | null
}

interface LlmExtractionOutput {
  facts: LlmFact[]
  conflicts: Array<{ factKey: string; values: JsonValue[] }>
  warnings: string[]
}

function isValidOutput(data: unknown): data is LlmExtractionOutput {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (!Array.isArray(obj.facts)) return false
  if (!Array.isArray(obj.conflicts)) return false
  if (!Array.isArray(obj.warnings)) return false
  for (const fact of obj.facts) {
    if (!fact || typeof fact !== 'object') return false
    const f = fact as Record<string, unknown>
    if (typeof f.factKey !== 'string') return false
    if (typeof f.confidence !== 'number') return false
    if (f.confidence < 0 || f.confidence > 1) return false
  }
  return true
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class LlmExtractionAdapter implements ExtractionPort {
  private client: LlmClient

  constructor(client: LlmClient) {
    this.client = client
  }

  async extractFacts(
    request: ExtractionRequest,
  ): Promise<ServiceResult<ExtractionResult>> {
    try {
      const raw = await this.client.complete({
        schema: EXTRACTION_SCHEMA,
        content: request.contentText,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        temperature: 0.1,
        maxTokens: 4096,
      })

      if (isValidOutput(raw)) {
        return { ok: true, data: mapOutput(raw) }
      }

      // Repair attempt
      const repairInput = typeof raw === 'string' ? raw : JSON.stringify(raw)
      const repaired = await this.client.complete({
        schema: EXTRACTION_SCHEMA,
        content: `Fix invalid JSON. Return ONLY valid JSON.\n${repairInput}`,
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        temperature: 0.0,
        maxTokens: 4096,
      })

      if (isValidOutput(repaired)) {
        const result = mapOutput(repaired)
        result.warnings.push('Output required repair')
        return { ok: true, data: result }
      }

      return {
        ok: false,
        error: { code: 'EXTRACTION_FAILED', message: 'LLM output invalid after repair attempt' },
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'LLM_ERROR',
          message: error instanceof Error ? error.message : 'Unknown LLM error',
        },
      }
    }
  }

  async reconcileFacts(
    request: ReconciliationRequest,
  ): Promise<ServiceResult<ReconciliationResult>> {
    const resolution = resolveFacts(
      request.existingFacts.map((f) => ({
        ...f,
        id: f.id,
        workspaceId: request.workspaceId,
        businessId: request.businessId,
        factKey: request.factKey,
        sourceId: '',
        sourceDocumentId: null,
        sourceExcerpt: null,
        evidenceLocator: null,
        supersedesFactId: null,
        validTo: null,
        createdAt: new Date(),
        createdBy: 'system',
      })),
      request.newFacts,
    )

    return {
      ok: true,
      data: {
        superseded: resolution.superseded.map((s) => ({
          oldFactId: s.oldFactId,
          newFactId: '',
        })),
        conflicts: resolution.conflicts.map((c) => ({
          factKey: c.factKey,
          values: c.values,
        })),
        toCreate: resolution.toCreate,
        toUpdate: resolution.toUpdate,
      },
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MIN_CONFIDENCE = 0.5

function mapOutput(raw: LlmExtractionOutput): ExtractionResult {
  const filteredFacts = raw.facts.filter((f) => f.confidence >= MIN_CONFIDENCE)
  const warnings = [
    ...raw.warnings,
    ...raw.facts
      .filter((f) => f.confidence < MIN_CONFIDENCE)
      .map((f) => `Fact "${f.factKey}" dropped: confidence ${f.confidence} < ${MIN_CONFIDENCE}`),
  ]

  return {
    facts: filteredFacts.map((f) => ({
      factKey: f.factKey,
      value: f.value,
      confidence: f.confidence,
      sourceExcerpt: f.sourceExcerpt ?? null,
      evidenceLocator: (f.evidenceLocator as EvidenceLocator | null) ?? null,
    })),
    conflicts: raw.conflicts.map((c) => ({
      factKey: c.factKey,
      values: c.values,
    })),
    warnings,
  }
}
