import { z } from 'zod'

import {
  UploadIntentStatus,
  SourceType,
  DocumentClass,
  MalwareScanStatus,
  IdempotencyOperation,
  IdempotencyState,
  MetaConnectionStatus,
} from '../types/remediation-entities'

import { UuidSchema, TimestampSchema } from './common'

// ─── Enum value tuples for z.enum() ─────────────────────────────────────────

const UploadIntentStatusValues = Object.values(UploadIntentStatus)
const SourceTypeValues = Object.values(SourceType)
const DocumentClassValues = Object.values(DocumentClass)
const MalwareScanStatusValues = Object.values(MalwareScanStatus)
const IdempotencyOperationValues = Object.values(IdempotencyOperation)
const IdempotencyStateValues = Object.values(IdempotencyState)
const MetaConnectionStatusValues = Object.values(MetaConnectionStatus)

// ─── Enum schemas ────────────────────────────────────────────────────────────

export const UploadIntentStatusSchema = z.enum(
  UploadIntentStatusValues as [string, ...string[]],
)
export const SourceTypeSchema = z.enum(SourceTypeValues as [string, ...string[]])
export const DocumentClassSchema = z.enum(
  DocumentClassValues as [string, ...string[]],
)
export const MalwareScanStatusSchema = z.enum(
  MalwareScanStatusValues as [string, ...string[]],
)
export const IdempotencyOperationSchema = z.enum(
  IdempotencyOperationValues as [string, ...string[]],
)
export const IdempotencyStateSchema = z.enum(
  IdempotencyStateValues as [string, ...string[]],
)
export const MetaConnectionStatusSchema = z.enum(
  MetaConnectionStatusValues as [string, ...string[]],
)

// ─── Entity Schemas ──────────────────────────────────────────────────────────

export const uploadIntentSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  sourceId: UuidSchema.nullable(),
  sourceType: SourceTypeSchema,
  sourceName: z.string().min(1),
  documentClass: DocumentClassSchema,
  classificationSource: z.string().min(1),
  fileName: z.string().min(1),
  declaredMimeType: z.string().min(1),
  expectedSizeBytes: z.number().int().positive(),
  storagePath: z.string().min(1),
  createdBy: UuidSchema,
  status: UploadIntentStatusSchema,
  malwareScanStatus: MalwareScanStatusSchema,
  malwareScanCode: z.number().int().nullable(),
  malwareScannedAt: TimestampSchema.nullable(),
  expiresAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
})

export const idempotencyRecordSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  operation: IdempotencyOperationSchema,
  idempotencyKey: z.string().min(1),
  requestFingerprint: z.string().min(1),
  state: IdempotencyStateSchema,
  resourceType: z.string().nullable(),
  resourceId: UuidSchema.nullable(),
  responseStatus: z.number().int().nullable(),
  responseBody: z.record(z.string(), z.unknown()).nullable(),
  expiresAt: TimestampSchema,
  createdAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
})

export const metaConnectionSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  connectedBy: UuidSchema,
  metaUserId: z.string().min(1),
  encryptedAccessToken: z.string().min(1),
  tokenExpiresAt: TimestampSchema.nullable(),
  selectedAdAccountId: z.string().nullable(),
  accountMetadata: z.record(z.string(), z.unknown()),
  status: MetaConnectionStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})

export const metaOAuthStateSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  createdBy: UuidSchema,
  stateNonceHash: z.string().min(1),
  returnPath: z.string().min(1),
  expiresAt: TimestampSchema,
  consumedAt: TimestampSchema.nullable(),
  providerCodeHash: z.string().nullable(),
  createdAt: TimestampSchema,
})

export const metaProviderCodeHashSchema = z.object({
  id: UuidSchema,
  oauthStateId: UuidSchema,
  providerCodeHash: z.string().min(1),
  createdAt: TimestampSchema,
})

// ─── Input Schemas ───────────────────────────────────────────────────────────

export const createUploadIntentInputSchema = z.object({
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  sourceName: z.string().min(1),
  documentClass: DocumentClassSchema,
  declaredMimeType: z.string().min(1),
  expectedSizeBytes: z.number().int().positive(),
  fileName: z.string().min(1),
})

export const idempotencyCheckInputSchema = z.object({
  workspaceId: UuidSchema,
  operation: IdempotencyOperationSchema,
  idempotencyKey: z.string().min(1),
  requestFingerprint: z.string().min(1),
})

export const metaOAuthCallbackInputSchema = z.object({
  workspaceId: UuidSchema,
  state: z.string().min(1),
  code: z.string().min(1),
})
