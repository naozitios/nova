# Research: Business Context Pipeline Remediation

## Decisions

### Separate Node Worker

Run `src/workers/business-context.ts` independently from Next.js. This avoids request timeouts and duplicate startup under web instances while preserving existing Supabase job machinery. Next.js instrumentation, synchronous processing, and a new workflow platform were rejected.

### Signed Private Upload Intents

Server creates expiring workspace/business-bound intent and signed Supabase Storage target; client uploads directly; authenticated completion verifies object then queues processing. This supports 50 MB files and per-file progress without public buckets or large Next.js request bodies.

### Server-Owned Classification Provenance

A stateless signed proposal token binds server-proposed document class to workspace, business, normalized filename, MIME, and expiry. Upload creation accepts either direct user selection or a valid proposal token and sets provenance server-side. Allowing clients to submit `classification_source = system_proposed` was rejected because it makes provenance forgeable.

### Fail-Closed Malware Scanning

Run a private ClamAV service behind `MalwareScannerPort`. Upload completion streams the private object to the scanner after signature checks and before parsing or extraction. Only a clean result may queue work; infected, suspicious, unavailable, and timed-out scans retain the private original, create zero facts, and expose sanitized stable codes. Extension/MIME/signature checks alone were rejected because PRD 006 explicitly requires malware scanning.

### Durable Idempotency

Persist workspace/operation/key plus canonical request fingerprint and prior result. Existing process-local `Map` and timestamp job keys fail across restart, concurrency, and multiple instances.

### One Source Orchestrator

Core `SourceProcessingService` coordinates adapters, parser, documents, extraction, reconciliation, quality, visibility, and terminal state. Routes only enqueue; job runner only owns lifecycle; adapters only collect/parse.

### Explicit OCR Deferral

Insufficient native text returns `OCR_REQUIRED`, retains original, recommends manual text, and permits later reconciliation. Repairing PaddleOCR or adding cloud OCR is outside approved scope.

### Explicit Legacy Office Deferral

DOC/PPT/XLS upload and retention remain available, but frozen stack cannot safely parse them. They return `LEGACY_FORMAT_UNSUPPORTED`. New converter/LibreOffice deployment needs separate approval.

### Versioned Extraction Corpus

Select prompt/taxonomy by document class. Benchmark marketing, business-plan, and financial fixtures against expected required keys and evidence. This measures useful recall instead of rewarding raw fact count.

### Derived Onboarding Readiness

Backend derives session status, route stage, blockers, and approval readiness from persisted sources/jobs/questions/conflicts/quality/versions. Client-supplied steps and universal questionnaires were rejected.

### One Active Session and Optimistic Approval

Enforce one active initial/update session per business. Update draft stores base profile version; approval compares expected base and rejects stale changes rather than last-write-wins.

### Minimal Persistent Meta Connection

OAuth callback validates signed workspace state, encrypts token server-side with AES-256-GCM using server-only key, stores sanitized account metadata, and exposes credentials to worker through a port. Global env tokens, browser-cookie worker access, and token source metadata were rejected.

OAuth start also persists a one-time state nonce. Callback atomically consumes that nonce and reserves a hash of the provider authorization code before exchange. Repeated state or code returns a stable replay conflict without another exchange or connection mutation. This replaces `Idempotency-Key` for provider redirects that cannot set custom headers.

### Real Auth and RLS Proof

HTTP E2E uses a real NextAuth server session and stable user-to-workspace mapping. Direct RLS tests separately use anon clients carrying real Supabase user JWTs. Service role only seeds and inspects because it bypasses RLS. `X-User-Id` and client `AuthContext` state never prove production authorization.

### Constitution Alignment Approved

Constitution v1.3.0 permits accepted `202`, bodyless validated OAuth redirect `303`, authorization `403`, idempotency/lifecycle/replay/stale `409`, stable typed domain codes, digest-pinned private ClamAV runtime, co-located unit tests, centralized real-boundary suites, and hybrid staged verification. Fixed JSON error envelopes, NextAuth route identity, role checks, JSDoc, and `Container` resolution remain mandatory.

### Hybrid Staged Execution Method

**Approach:** Bounded dependency waves with implementation and focused checks co-located within each wave; three progressive gates.

**Wave structure:** Group related tasks into waves of 1–3 tightly coupled tasks sharing a dependency boundary. Implement and run focused checks (unit, type-check) within the wave before proceeding. Maximum two small disjoint agents may work simultaneously; agents must not cross wave boundaries. Migrations, database resets, and hot files (e.g. shared ports, container, config) serialize across all waves.

**Gate progression:**
1. **Subsystem integration gate** — when a wave completes, run integration, contract, and RLS tests against the assembled subsystem. Fail closes affected wave blocks.
2. **User-story E2E gate** — when all subsystems for a story are green, run process-level Vitest E2E that owns backend app/worker lifecycle and covers the full user journey. Fail closes affected story blocks. PRD 007 adds Playwright for frontend browser flows later.
3. **Full release gate** — all subsystem + E2E suites pass; `npm run lint`, `npm run build`, and `npm run test` clean.

**Completion semantics:** A task is marked `[x]` only after its required passing gate runs. A failed gate reopens affected blocks in the task list for investigation and fix.

**Rationale:** Strict per-slice TDD (write failing test → implement → refactor per function) created excessive orchestration overhead and repeated expensive process startup for tightly coupled subsystems. Final-only testing creates an unmanageable failure pile where bugs compound across waves. The hybrid model preserves correctness through progressive gates while reducing coordination cost. This aligns with Constitution v1.3.0 §IX hybrid staged verification.
