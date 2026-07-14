import { z } from 'zod'

import {
  JsonValueSchema,
  SourceTypeSchema,
  UuidSchema,
} from './common'
import { ExtractedFactSchema } from './fact'

export const ExtractionInputSchema = z.object({
  sourceDocumentId: UuidSchema,
  sourceId: UuidSchema,
  businessId: UuidSchema,
  contentText: z.string(),
  sourceType: SourceTypeSchema,
  parserName: z.string(),
})

export const ExtractionOutputSchema = z.object({
  facts: z.array(ExtractedFactSchema),
  warnings: z.array(z.string()),
  conflicts: z.array(
    z.object({
      factKey: z.string(),
      values: z.array(JsonValueSchema),
    }),
  ),
})
