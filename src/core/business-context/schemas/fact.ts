import { z } from 'zod'

import {
  ConfidenceSchema,
  EvidenceLocatorSchema,
  JsonValueSchema,
  TimestampSchema,
  UuidSchema,
  VerificationStatusSchema,
} from './common'

export const ContextFactSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  factKey: z.string().min(1),
  value: JsonValueSchema,
  sourceId: UuidSchema,
  sourceDocumentId: UuidSchema.nullable(),
  sourceExcerpt: z.string().nullable(),
  evidenceLocator: EvidenceLocatorSchema.nullable(),
  confidence: ConfidenceSchema,
  verificationStatus: VerificationStatusSchema,
  supersedesFactId: UuidSchema.nullable(),
  validFrom: TimestampSchema,
  validTo: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  createdBy: z.string().min(1),
})

export const ExtractedFactSchema = z.object({
  factKey: z.string().min(1),
  value: JsonValueSchema,
  confidence: ConfidenceSchema,
  sourceExcerpt: z.string().nullable(),
  evidenceLocator: EvidenceLocatorSchema.nullable(),
})
