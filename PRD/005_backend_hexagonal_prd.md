# PRD: Backend Infrastructure — Hexagonal Architecture, Meta & AI Integration

## 1. Objective

Build the backend infrastructure for Nova to support real Meta Ads API integration and real AI-powered campaign management, following hexagonal (ports & adapters) architecture.

The backend must replace the current mock-only data layer (`src/api/adClient.ts`, `src/lib/ai/engine.ts`) with production-grade adapters while keeping the existing domain logic intact.

---

## 2. Scope

### In Scope

* Define hexagonal architecture with clear domain core, ports, and adapters
* Implement Meta Ads API adapter (OAuth, campaign CRUD, insights, sync, drift detection)
* Implement LLM adapter (Groq) for AI-powered campaign management
* Create Next.js API route handlers as inbound adapters (campaign, AI, Meta, optimization, auth)
* Add persistence layer with Drizzle ORM (SQLite dev / Postgres prod, in-memory as fallback)
* Wire dependency injection container
* Move existing `src/lib/campaign-engine/` and `src/lib/ai/` into `src/core/` with port interfaces
* Replace `src/api/adClient.ts` mock with real Meta adapter
* Add account health auditor (tracking, attribution, UTM, naming checks) using real Meta data
* Add optimization copilot that generates recommendations from real performance data
* Add action center with approval workflow (review → approve/reject → execute)
* Add versioned execution plans with apply/sync capabilities
* Auth via NextAuth.js (Google OAuth, credentials)

### Out of Scope

* No frontend changes (existing pages remain untouched)
* No campaign table redesign
* No dashboard page changes
* No saved views or scheduled reports
* No Google Ads, TikTok, or LinkedIn integrations (architecture must support them)
* No real-time websocket connections (polling-based for MVP)
* No multi-tenant isolation (single ad account for MVP)
* No automatic execution without approval
* No billing/usage tracking
* No rate-limiting beyond API defaults

---

## 3. Hexagonal Architecture

### Layer Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ API Routes   │  │ Meta         │  │ LLM (Groq)     │  │
│  │ (inbound)    │  │ Adapter      │  │ Adapter        │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                 │                   │            │
│         └─────────────────┼───────────────────┘            │
│                           │                                │
│                    ┌──────┴──────┐                          │
│                    │   PORTS     │                          │
│                    │ (Interfaces)│                          │
│                    └──────┬──────┘                          │
├───────────────────────────┼────────────────────────────────┤
│                       DOMAIN                                │
│                    ┌──────┴──────┐                          │
│                    │   CORE      │                          │
│                    │  Services   │                          │
│  ┌─────────────────┼─────────────┼────────────────────┐    │
│  │ CampaignService │  AIService  │ OptimizationService │    │
│  │ (create,update, │ (prompt →   │ (audit, recommend, │    │
│  │  plan,version,  │  action)    │  approve, execute) │    │
│  │  rollback,drift)│             │                    │    │
│  └───────┬─────────┴──────┬─────┴────────────────────┘    │
│          │                │                                │
│  ┌───────┴────────────────┴───────┐                        │
│  │     Domain Models & Logic      │                        │
│  │  CampaignConfig, Generator,    │                        │
│  │  Validator, Versioning,        │                        │
│  │  Planner, AIActionItem         │                        │
│  └────────────────────────────────┘                        │
└────────────────────────────────────────────────────────────┘
```

### Layer Rules

* **Core (`src/core/`)**: Zero external dependencies. Pure TypeScript. Contains domain models, services, and port interfaces.
* **Infrastructure (`src/infrastructure/`)**: Implements port interfaces. Depends on core. Contains SDK wrappers, DB adapters, HTTP clients.
* **API (`src/app/api/`)**: Inbound adapters. Depends on core services via DI container. Translates HTTP → domain calls.
* **DI (`src/di/`)**: Wires concrete adapters to port interfaces. Single composition root.

---

## 4. Directory Structure

```
src/
├── core/                              # Domain hexagon
│   ├── campaign/
│   │   ├── types.ts                   # CampaignConfig, AdSetConfig, CreativeConfig
│   │   ├── service.ts                 # CampaignService (orchestrates all ops)
│   │   ├── generator.ts               # FormInput → CampaignConfig
│   │   ├── validator.ts               # Validation rules
│   │   ├── versioning.ts              # Diff, version creation
│   │   ├── planner.ts                 # ExecutionPlan, drift detection
│   │   ├── repository.port.ts         # OUTBOUND PORT interface
│   │   └── seed.ts                    # Seed data
│   ├── ai/
│   │   ├── types.ts                   # AIActionItem, AIResponse, ChangePreview
│   │   ├── service.ts                 # AIService (processPrompt, applyAction)
│   │   └── llm-client.port.ts         # OUTBOUND PORT interface
│   ├── optimization/
│   │   ├── types.ts                   # AccountIssue, Recommendation, Action
│   │   ├── auditor.ts                 # Health check rules
│   │   ├── copilot.ts                 # Opportunity detection
│   │   ├── action-center.ts           # Approval workflow
│   │   ├── health.service.ts          # Health scoring
│   │   └── meta-client.port.ts        # OUTBOUND PORT interface
│   └── shared/
│       ├── types.ts                   # Shared domain types
│       └── errors.ts                  # Domain error hierarchy
│
├── infrastructure/                    # Adapters
│   ├── persistence/
│   │   └── campaign/
│   │       ├── in-memory.repository.ts
│   │       ├── drizzle.repository.ts
│   │       └── schema.ts
│   ├── meta/
│   │   ├── meta-api.adapter.ts
│   │   ├── meta-oauth.adapter.ts
│   │   ├── meta-mapper.ts
│   │   └── types.ts
│   ├── llm/
│   │   ├── groq.adapter.ts
│   │   ├── prompt-builder.ts
│   │   └── response-parser.ts
│   ├── auth/
│   │   └── next-auth.adapter.ts
│   └── config.ts
│
├── di/
│   └── container.ts                   # Dependency injection composition root
│
├── app/api/                           # Inbound adapters (Next.js route handlers)
│   ├── campaign/                      # Campaign CRUD + planning
│   ├── ai/                            # AI chat + action execution
│   ├── meta/                          # Meta OAuth + sync
│   ├── optimization/                  # Health, recommendations, actions
│   └── auth/                          # NextAuth.js
│
├── app/                               # Pages (unchanged)
├── components/                        # React components (unchanged)
├── hooks/                             # React hooks (unchanged)
├── context/                           # React context (unchanged)
│── lib/                               # DEPRECATED — migrate to core/
```

---

## 5. Outbound Port Interfaces

### 5.1 CampaignRepositoryPort

```typescript
interface CampaignRepositoryPort {
  save(config: CampaignConfig): string;
  get(id: string): CampaignEntry | undefined;
  list(): CampaignEntry[];
  update(id: string, config: CampaignConfig, diffs: ConfigDiff[]): CampaignEntry;
  delete(id: string): boolean;
}
```

### 5.2 MetaClientPort

```typescript
interface MetaClientPort {
  getAccounts(accessToken: string): Promise<MetaAccount[]>;
  getCampaigns(accountId: string, accessToken: string): Promise<MetaCampaignDTO[]>;
  getInsights(accountId: string, campaignIds: string[], since: string, until: string): Promise<MetaInsightDTO[]>;
  createCampaign(accountId: string, data: MetaCampaignInput, accessToken: string): Promise<MetaCampaignDTO>;
  updateCampaign(campaignId: string, data: Partial<MetaCampaignInput>, accessToken: string): Promise<MetaCampaignDTO>;
  pauseCampaign(campaignId: string, accessToken: string): Promise<void>;
  deleteCampaign(campaignId: string, accessToken: string): Promise<void>;
}
```

### 5.3 LlmClientPort

```typescript
interface LlmClientPort {
  chat(systemPrompt: string, userMessage: string): Promise<LLMResponse>;
  generateStructured<T>(prompt: string, schema: ZodType<T>): Promise<T>;
}
```

---

## 6. API Route Specifications

### 6.1 Campaign Endpoints

| Method | Path | Request | Response | Description |
|--------|------|---------|----------|-------------|
| POST | `/api/campaign` | `CampaignFormInput` | `{ id, config, errors, plan }` | Create campaign |
| GET | `/api/campaign` | — | `CampaignEntry[]` | List all campaigns |
| GET | `/api/campaign/[id]` | — | `CampaignEntry` | Get campaign detail |
| PUT | `/api/campaign/[id]` | `Partial<CampaignFormInput>` | `{ config, errors, plan }` | Update campaign |
| DELETE | `/api/campaign/[id]` | — | `{ success }` | Delete campaign |
| GET | `/api/campaign/[id]/plan` | — | `ExecutionPlan` | Get current execution plan |
| GET | `/api/campaign/[id]/versions` | — | `CampaignVersion[]` | Get version history |
| POST | `/api/campaign/[id]/rollback` | `{ version: number }` | `{ config, errors }` | Rollback to version |

### 6.2 AI Endpoints

| Method | Path | Request | Response | Description |
|--------|------|---------|----------|-------------|
| POST | `/api/ai/chat` | `{ prompt }` | `{ message, actions, requiresConfirmation }` | Process AI prompt |
| POST | `/api/ai/actions/apply` | `{ actionIds[] }` or `{ actions[] }` | `{ results[] }` | Apply selected/cached AI actions |

### 6.3 Meta Endpoints

| Method | Path | Request | Response | Description |
|--------|------|---------|----------|-------------|
| GET | `/api/meta/auth` | — | `{ url }` | Start Meta OAuth redirect |
| GET | `/api/meta/callback` | `?code=...&state=...` | Redirect to app | Handle OAuth callback |
| GET | `/api/meta/accounts` | — | `AdAccount[]` | List connected ad accounts |
| POST | `/api/meta/sync` | `{ accountId }` | `{ imported, updated, drifts }` | Pull campaigns from Meta |
| POST | `/api/meta/sync/[campaignId]` | — | `{ drift }` | Sync single campaign |
| POST | `/api/meta/apply/[campaignId]` | — | `{ results }` | Push execution plan to Meta |

### 6.4 Optimization Endpoints

| Method | Path | Request | Response | Description |
|--------|------|---------|----------|-------------|
| GET | `/api/optimization/health` | `?accountId=...` | `HealthSummary` | Run account health audit |
| GET | `/api/optimization/recommendations` | `?accountId=...&status=...` | `OptimizationRecommendation[]` | Get copilot recommendations |
| POST | `/api/optimization/recommendations/refresh` | `{ accountId }` | `{ generated }` | Regenerate recommendations |
| GET | `/api/optimization/actions` | `?status=...&category=...` | `OptimizationAction[]` | List optimization actions |
| POST | `/api/optimization/actions/[id]/approve` | — | `{ status, next }` | Approve action |
| POST | `/api/optimization/actions/[id]/reject` | — | `{ status }` | Reject action |
| POST | `/api/optimization/actions/[id]/execute` | — | `{ result }` | Execute approved action |

### 6.5 Auth Endpoints

Standard NextAuth.js routes at `api/auth/[...nextauth]` supporting:
- Google OAuth
- Credentials provider (email + password for dev)

---

## 7. Data Flow

### 7.1 Campaign Create → Meta

```
[Frontend Form] → POST /api/campaign
  → CampaignService.create()
    → Generator: CampaignForm → CampaignConfig
    → Validator: validate()
    → Repository.save()
    → Planner: generateExecutionPlan()
  ← { id, config, plan }

[Later: User clicks "Publish"] → POST /api/meta/apply/[id]
  → CampaignService.getExecutionPlan(id)
  → For each PlatformAction:
    MetaClientPort.createCampaign() / updateCampaign() / pauseCampaign()
  → Repository.update() with applied status
  ← { results, drifts }
```

### 7.2 Meta Sync → Internal

```
[Scheduler or Manual] → POST /api/meta/sync
  → MetaClientPort.getCampaigns(accountId)
  → MetaMapper → CampaignConfig[]
  → For each Meta campaign:
    if new: Repository.save()
    if exists: compare → detectDrift() → flag drifts
  ← { imported: N, updated: M, drifts: [...] }
```

### 7.3 AI Chat → Action

```
[User Message] → POST /api/ai/chat
  → AIService.processPrompt()
    → PromptBuilder.build(campaignContext)
    → LlmClientPort.chat(systemPrompt, userMessage)
    → ResponseParser.parse() → AIActionItem[]
  ← { message, actions, requiresConfirmation: true }

[User clicks Approve] → POST /api/ai/actions/apply
  → AIService.applyAllActions(actions)
    → For each action:
      CampaignService.update() → Repository.save() → Versioning → Plan
  ← { results: [{ id, success, message }] }
```

### 7.4 Optimization Flow

```
[On demand or periodic] → GET /api/optimization/health
  → MetaClientPort.getAccounts()
  → MetaClientPort.getCampaigns()
  → MetaClientPort.getInsights()
  → Auditor.runChecks() → AccountIssue[]
  → HealthService.score() → HealthSummary
  ← { score, criticalCount, issues }

[After health check] → POST /api/optimization/recommendations/refresh
  → Copilot.detectOpportunities(metrics) → OptimizationRecommendation[]
  → ActionCenter.createActions(recommendations) → OptimizationAction[]
  ← { generated: N }

[User action in UI] → POST /api/optimization/actions/[id]/approve
  → ActionCenter.approve(id)
  ← { status: 'approved' }

[User action in UI] → POST /api/optimization/actions/[id]/execute
  → ActionCenter.execute(id)
    → MetaClientPort.updateCampaign() / pauseCampaign() / etc.
    → ActionCenter.markExecuted(id)
  ← { status: 'executed', result }
```

---

## 8. Dependency Changes

### Add to `package.json`

```
groq-sdk                 # LLM adapter (Groq)
next-auth                # Authentication
drizzle-orm              # ORM
@libsql/client           # SQLite driver (dev)
postgres                 # Postgres driver (prod)
drizzle-kit              # Migrations (dev dependency)
```

### Keep (already present)

```
zod                      # Schema validation (critical for LLM structured output)
@tanstack/react-query    # Frontend data fetching (unchanged)
```

---

## 9. Implementation Phases

### Phase 1 — Foundation (Week 1-2)

* Create `src/core/` directory structure
* Move `src/lib/campaign-engine/` → `src/core/campaign/`
* Define `CampaignRepositoryPort` interface
* Implement `InMemoryCampaignRepository` adapter (move existing store logic)
* Define `LlmClientPort` and `MetaClientPort` interfaces
* Create `src/di/container.ts`
* Move `src/lib/ai/` → `src/core/ai/` with port dependency
* Verify existing frontend still works with new core through adapter

**Files created:** ~15 | **Files moved:** ~10

### Phase 2 — Meta Adapter (Week 3-4)

* Implement `MetaOAuthAdapter` (redirect, callback, token storage)
* Implement `MetaApiAdapter` (Graph API v22.0 wrapper)
* Implement `MetaMapper` (DTO ↔ Domain)
* Create Meta API routes (`auth`, `callback`, `accounts`, `sync`, `apply`)
* Wire through DI container
* Test with real Meta sandbox account

**Key SDK endpoints used:**
- `GET /{api-version}/{act_ad_account}/campaigns`
- `GET /{api-version}/{campaign_id}/insights`
- `POST /{api-version}/{act_ad_account}/campaigns`
- `POST /{api-version}/{campaign_id}` (update)
- `GET /{api-version}/{ad_id}/creatives`

### Phase 3 — LLM Adapter (Week 3-4, parallel)

* Implement `GroqAdapter` with structured output via `response_format` + Zod (uses `groq-sdk`)
* Build `PromptBuilder` with campaign context injection
* Build `ResponseParser` with Zod validation
* Refactor `AIService` to use `LlmClientPort` instead of hardcoded rules
* Create AI API routes (`chat`, `actions/apply`)

**AI prompt structure:**
```
System: You are a campaign management AI. You have access to these campaigns:
        [campaign context JSON]. You can perform these actions: [action list].
        Always respond in this JSON schema: [Zod schema].

User: [natural language instruction]
```

### Phase 4 — API Routes (Week 5)

* Create campaign CRUD routes
* Create campaign planning/versioning routes
* Create optimization routes (health, recommendations, actions)
* Wire all routes through DI container
* Add request validation (Zod schemas)
* Add error handling middleware

### Phase 5 — Persistence (Week 5-6, parallel)

* Set up Drizzle ORM schema
* Implement `DrizzleCampaignRepository`
* Write migration scripts
* Add connection pooling config
* Switch DI container to use Drizzle adapter in production, in-memory in dev/test

### Phase 6 — Optimization Backend (Week 6-7)

* Implement `Auditor` with real Meta data:
  * Tracking checks (Pixel, CAPI, event coverage, match quality)
  * Attribution checks (settings, domain verification)
  * UTM checks (missing, invalid, inconsistent)
  * Naming checks (campaign, ad set, ad naming)
* Implement `Copilot`:
  * Creative fatigue detection (frequency ↑ + CTR ↓ + CVR ↓)
  * Scaling opportunity detection (CPA ↓ + ROAS stable + trend ↑)
  * Budget waste detection (spend ↑ + conversions ↓ + CPA ↑)
  * Performance decline detection (CPA sudden ↑ + ROAS ↓ + CTR ↓)
* Implement `ActionCenter`:
  * Action queue with status lifecycle
  * Approval workflow (review → approve/reject → execute)
  * Audit logging

### Phase 7 — Auth & Hardening (Week 8)

* Configure NextAuth.js (Google OAuth + credentials)
* Protect API routes with session middleware
* Add rate limiting headers
* Write unit tests for all core services
* Write integration tests for all adapters
* Write E2E test for full Meta OAuth → Sync → AI → Action → Apply flow

---

## 10. Auth Requirements

### Meta OAuth

```
Frontend → /api/meta/auth → Redirect to Meta Login
  → User approves → Meta redirects to /api/meta/callback
  → Exchange code for access_token
  → Store token in session (NextAuth token or encrypted cookie)
  → Redirect to app
```

### App Auth

* NextAuth.js with Google OAuth for production
* Credentials provider for development
* Session stored in JWT (no DB required for MVP)
* Protected API routes via `getServerSession()`

---

## 11. Persistence Strategy

| Environment | Adapter | Rationale |
|-------------|---------|-----------|
| Development | InMemoryRepository | Fast iteration, no setup |
| Test | InMemoryRepository | Deterministic, fast |
| Production | DrizzleRepository + Postgres | Durable, scalable |

### Campaign Schema (Drizzle)

```typescript
campaigns: {
  id: text().primaryKey(),
  name: text().notNull(),
  config: jsonb().notNull(),          // CampaignConfig
  platform: text().array().notNull(),
  objective: text().notNull(),
  totalBudget: integer().notNull(),
  startDate: text().notNull(),
  endDate: text().notNull(),
  currentVersion: integer().notNull().default(1),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
}

campaign_versions: {
  id: text().primaryKey(),
  campaignId: text().references(() => campaigns.id),
  version: integer().notNull(),
  config: jsonb().notNull(),
  diffs: jsonb(),
  timestamp: text().notNull(),
  authoredBy: text().notNull(),
  commitMessage: text().notNull(),
}
```

---

## 12. Error Handling

### Domain Error Types

```typescript
class DomainError extends Error { code: string }
class ValidationError extends DomainError { fields: ValidationFieldError[] }
class NotFoundError extends DomainError { resourceType: string; resourceId: string }
class MetaApiError extends DomainError { statusCode: number; metaTraceId?: string }
class LlmError extends DomainError { provider: 'groq'; rawError: unknown }
class AuthError extends DomainError { reason: string }
```

### API Error Response Shape

```typescript
{
  error: {
    code: string,         // e.g. 'VALIDATION_ERROR', 'META_API_ERROR'
    message: string,      // Human-readable
    details?: unknown,    // Meta trace ID, validation fields, etc.
  }
}
```

---

## 13. Testing Strategy

| Layer | Test Type | Tool | What to Test |
|-------|-----------|------|-------------|
| Core | Unit | Vitest | Service logic, validation, versioning, planning |
| Ports | Unit with mocks | Vitest + Mock | Interface contracts |
| Adapters | Integration | Vitest | Real Meta API (sandbox), real Groq (test key) |
| API Routes | Integration | Vitest + supertest | Request parsing, response shape, error codes |
| E2E | E2E | Playwright | Full flow: OAuth → Sync → AI → Action → Apply |

---

## 14. Acceptance Criteria

### Architecture

* [ ] `src/core/` contains zero external imports (no `next/`, no `groq-sdk`, no `drizzle-orm`)
* [ ] All port interfaces are defined in `src/core/*/*.port.ts`
* [ ] All infrastructure adapters implement a port interface
* [ ] DI container composes all layers without circular dependencies
* [ ] Existing frontend works unchanged after migration

### Meta Integration

* [ ] User can connect Meta ad account via OAuth
* [ ] Connected accounts are listed and persist across sessions
* [ ] Campaigns are imported from Meta via sync endpoint
* [ ] Campaign config diff/drift is detected after sync
* [ ] Execution plans can be applied to Meta (create/update/pause campaigns)
* [ ] Errors from Meta API are surfaced with clear messages

### AI Integration

* [ ] User sends natural language prompt → receives structured actions
* [ ] AI response includes only valid action types
* [ ] AI can reference real campaign names and budgets
* [ ] Actions can be reviewed before applying
* [ ] Applied actions update campaign config and create version history

### Optimization

* [ ] Account health audit runs against real Meta data
* [ ] Health score is calculated and issues are categorized
* [ ] Optimization recommendations include finding, evidence, cause, action, impact, confidence
* [ ] Recommendations can be converted to actions
* [ ] Actions support approval workflow (review → approve/reject → execute)
* [ ] Executed actions update campaign state or execute via Meta API

### Persistence

* [ ] Campaigns persist across server restarts (Drizzle adapter)
* [ ] Version history is preserved and queryable
* [ ] Rollback restores previous config and creates new version entry

### API

* [ ] All routes return consistent error shape
* [ ] All mutation routes require authentication
* [ ] Campaign CRUD routes work end-to-end
* [ ] Optimization routes work with live data

---

## 15. Migration Plan

### Current → Target

| Step | Action | Impact |
|------|--------|--------|
| 1 | Create `src/core/campaign/` — copy domain files from `src/lib/campaign-engine/` | None — old files still work |
| 2 | Add port interfaces, DI container | None — not wired yet |
| 3 | Create `InMemoryCampaignRepository` adapter | None — drop-in replacement |
| 4 | Refactor frontend imports to point through DI | Breaks imports — one-time change |
| 5 | Remove old `src/lib/campaign-engine/` | Cleanup |
| 6 | Repeat for AI and optimization layers | Gradual migration |

### Frontend Consumer Migration

Existing React Query calls to `adClient` → new calls to API routes:

```typescript
// Before (mock)
const { data } = useQuery({ queryKey: ['campaigns'], queryFn: () => adClient.campaigns.list() });

// After (real API)
const { data } = useQuery({ queryKey: ['campaigns'], queryFn: () => fetch('/api/campaign').then(r => r.json()) });
```

This migration can happen incrementally — frontend stays on mock while backend is built, then switches to real API per feature.

---

## 16. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Meta API rate limits | Medium | High | Implement caching, debounce sync, queue writes |
| LLM hallucinates action params | Medium | High | Strict Zod schema validation, human-in-loop approval |
| OAuth token expiry | High | Medium | Refresh token handling, clear error messages |
| Breaking frontend during migration | Low | High | Keep mock layer until API is stable; feature flags |
| Meta API schema changes | Low | Medium | Version-pin API, map DTOs through typed adapter |
| Drizzle schema changes | Medium | Medium | Migration scripts, version-controlled schemas |
