import type { ServiceResult } from '@/core/business-context/types'
import type {
  CollectedSource,
  SourceAdapterPort,
} from '@/core/business-context/source-adapter.port'
import type { ContextSource, SourceType } from '@/core/business-context/types'

// ─── Supported source types ─────────────────────────────────────────────────

const MANUAL_SOURCE_TYPES: Set<string> = new Set([
  'user_answer',
  'system_inference',
])

// ─── Answer structure ───────────────────────────────────────────────────────

export interface ManualAnswer {
  factKey: string
  value: unknown
  confidence?: number
  note?: string
}

export interface ManualCorrection {
  factKey: string
  previousValue: unknown
  newValue: unknown
  reason: string
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class ManualSourceAdapter implements SourceAdapterPort {
  supports(sourceType: string): boolean {
    return MANUAL_SOURCE_TYPES.has(sourceType)
  }

  async collect(params: {
    workspaceId: string
    businessId: string
    source: ContextSource
  }): Promise<ServiceResult<CollectedSource>> {
    const { source } = params

    const content = source.metadata.content as string | undefined
    const answers = (source.metadata.answers as unknown) as ManualAnswer[] | undefined
    const corrections = (source.metadata.corrections as unknown) as ManualCorrection[] | undefined
    const questionId = source.metadata.questionId as string | undefined

    // Build content text from structured data
    const sections: string[] = []

    if (source.sourceType === 'user_answer' && answers?.length) {
      sections.push(this.formatAnswers(answers, questionId))
    }

    if (corrections?.length) {
      sections.push(this.formatCorrections(corrections))
    }

    if (content) {
      sections.push(content)
    }

    // If nothing provided, create minimal document
    if (sections.length === 0) {
      sections.push(this.createDefaultContent(source))
    }

    const contentText = sections.join('\n\n---\n\n')

    return {
      ok: true,
      data: {
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        externalReference: source.externalReference,
        metadata: {
          answeredAt: new Date().toISOString(),
          questionId: questionId ?? null,
          answerCount: answers?.length ?? 0,
          correctionCount: corrections?.length ?? 0,
          isUserVerified: source.sourceType === 'user_answer',
        },
        documents: [
          {
            title: source.sourceName,
            contentText,
            mimeType: 'text/markdown',
            metadata: {
              sourceType: source.sourceType,
              questionId: questionId ?? null,
            },
          },
        ],
      },
    }
  }

  // ─── Formatting ───────────────────────────────────────────────────────

  private formatAnswers(
    answers: ManualAnswer[],
    questionId?: string,
  ): string {
    const header = questionId
      ? `## User Answer (Question: ${questionId})\n\n`
      : '## User Answer\n\n'

    const lines = answers.map((a) => {
      const confidence = a.confidence != null
        ? ` (confidence: ${(a.confidence * 100).toFixed(0)}%)`
        : ''
      const note = a.note ? `\n  _Note: ${a.note}_` : ''
      return `- **${a.factKey}**: ${JSON.stringify(a.value)}${confidence}${note}`
    })

    return header + lines.join('\n')
  }

  private formatCorrections(corrections: ManualCorrection[]): string {
    const header = '## Manual Corrections\n\n'
    const lines = corrections.map(
      (c) =>
        `- **${c.factKey}**:\n` +
        `  - Previous: ${JSON.stringify(c.previousValue)}\n` +
        `  - Corrected: ${JSON.stringify(c.newValue)}\n` +
        `  - Reason: ${c.reason}`,
    )
    return header + lines.join('\n')
  }

  private createDefaultContent(source: ContextSource): string {
    const typeName = source.sourceType === 'user_answer'
      ? 'User Answer'
      : 'System Inference'

    return (
      `## ${typeName}\n\n` +
      `- **Source**: ${source.sourceName}\n` +
      `- **Type**: ${source.sourceType}\n` +
      `- **Submitted**: ${source.collectedAt.toISOString()}\n` +
      (source.externalReference
        ? `- **Reference**: ${source.externalReference}\n`
        : '')
    )
  }
}
