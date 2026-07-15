# Data Model: Business Context Pipeline Remediation

Migration: `supabase/migrations/202607150001_business_context_remediation.sql`. Changes are additive and preserve PRD 006 rows.

## `context_upload_intents`

Required fields: `id`, `workspace_id`, `business_id`, nullable `source_id`, `source_type`, `source_name`, `document_class`, `classification_source`, `file_name`, `declared_mime_type`, `expected_size_bytes`, unique `storage_path`, `created_by`, `status`, `malware_scan_status`, nullable `malware_scan_code`, nullable `malware_scanned_at`, `expires_at`, nullable `completed_at`, `created_at`.

Statuses: `pending | uploaded | completed | expired | rejected`. Malware statuses: `pending | clean | infected | suspicious | unavailable | failed`. Size constraint: 1 through 52,428,800 bytes. Indexes: business/status, expiry, unique path. Authenticated clients cannot directly insert/update/finalize; server service owns transitions. Only `clean` may queue parsing; all other terminal scan outcomes create zero facts. Sanitized status/code is returned through API.

## `context_idempotency_records`

Required fields: `id`, `workspace_id`, `operation`, `idempotency_key`, `request_fingerprint`, `state`, nullable `resource_type/resource_id/response_status/response_body`, `expires_at`, `created_at`, nullable `completed_at`.

Unique `(workspace_id, operation, idempotency_key)`. Same fingerprint replays existing result; different fingerprint returns `IDEMPOTENCY_KEY_REUSED`.

## `business_context_meta_connections`

Required fields: `id`, `workspace_id`, `connected_by`, `meta_user_id`, `encrypted_access_token`, nullable `token_expires_at`, nullable `selected_ad_account_id`, sanitized `account_metadata`, `status`, `created_at`, `updated_at`.

Statuses: `connected | expired | disconnected | error`. One connected row per workspace. No direct authenticated select policy exposes encrypted credentials. Server API returns status/account labels only. Token envelope stores AES-GCM nonce, ciphertext, and authentication tag; encryption key remains server-only.

## `business_context_meta_oauth_states`

Required fields: `id`, `workspace_id`, `created_by`, unique `state_nonce_hash`, `return_path`, `expires_at`, nullable `consumed_at`, nullable unique `provider_code_hash`, `created_at`.

OAuth start inserts one signed-state reservation. Callback atomically consumes one unexpired nonce and records the provider-code hash before token exchange. Reused nonce or code returns `OAUTH_CALLBACK_REPLAYED`; cleanup may delete expired consumed rows after the security retention window.

## Existing Table Changes

### `onboarding_sessions`

Add `mode initial|update`, nullable `base_profile_version_id`, nullable `draft_profile_version_id`. Add partial unique index on `business_id` for active statuses: `created`, `scanning`, `extracting`, `awaiting_review`, `awaiting_answers`, `ready_for_approval`.

### `onboarding_questions`

Add `generation_kind required_gap|uncertainty|conflict`, backend-authored `prompt`, `control_type`, typed `options`, `allows_unknown`, nullable `answer_is_unknown`, nullable `conflict_id`, nullable `resulting_fact_id`, deterministic `generation_key`, nullable `dismissed_at`. Add partial unique `(session_id, generation_key)` where open.

### `business_profile_versions`

Add nullable `base_version_id`, `onboarding_session_id`, `approved_by`, `approved_at`, and `change_summary`. Add partial unique draft-per-session index. Approval locks business versions, verifies expected base, and atomically publishes or returns stale error.

### Existing Constraints/Indexes

- One open `context_conflicts` row per business/normalized fact key.
- Workspace/job-type/idempotency uniqueness replaces global job key uniqueness after duplicate check.
- Runnable job index on status/next run/created time.
- Source polling index on workspace/business/status/stage.
- Active-fact index on workspace/business/key/verification/validity.
- Run index on workspace/source/start time.
- Question index on workspace/session/status/priority.

## Storage Path

`workspaces/{workspaceId}/businesses/{businessId}/uploads/{uploadIntentId}/{safeFileName}`

Server generates path and signed target. Finalization verifies exact match. Archive does not delete object.

## Classification Proposal Token

Stateless signed payload: `proposal_id`, proposed `document_class`, normalized filename, declared MIME, workspace/business binding, issued time, and expiry. Upload creation verifies signature/binding/expiry and persists `classification_source = system_proposed`; direct class selection persists `user_selected`. Client input never sets classification provenance. No token contains file contents or credentials.

## Readiness Projection

Computed from sources, jobs, questions, conflicts, quality gates, active facts, current/draft versions, and Meta status. Returns session mode/status/step, source counts, active job summaries, ordered questions, blockers, section readiness, approval readiness, current/draft/base IDs, and one route stage: `business | sources | review | context | complete`. Required fact keys and explicit-unknown handling follow `spec.md`'s deterministic readiness matrix.
