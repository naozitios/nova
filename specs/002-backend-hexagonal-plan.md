# Backend Architecture Plan: Hexagonal + Meta + AI

## 1. Current State Assessment

The project already has the **inner hexagon (domain)** partially built:

| Layer | Status | Files |
|-------|--------|-------|
| **Domain model** | ✅ Exists | `src/lib/campaign-engine/types.ts`, `src/types/advertising.ts`, `src/types/optimization.ts` |
| **Domain services** | ✅ Exists | `campaign-engine/store.ts` (config store, versioning, rollback), `planner.ts`, `validator.ts`, `generator.ts` |
| **AI domain** | ⚠️ Stub | `src/lib/ai/engine.ts` — rule-based, no real LLM |
| **Meta adapter (outbound)** | ❌ Missing | `src/api/adClient.ts` is mock-only |
| **AI adapter (outbound)** | ❌ Missing | No real LLM SDK integration |
| **API layer (inbound)** | ❌ Missing | No Next.js API routes / REST endpoints |
| **Persistence** | ❌ Missing | In-memory Map in `store.ts` |
| **Auth** | ⚠️ Placeholder | `src/context/AuthContext.tsx` exists, no real backend auth |

## 2. Hexagonal Architecture Map

```
┌──────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE                            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Next.js API  │  │ Next.js App  │  │ CLI / Scripts      │  │
│  │ Routes       │  │ (React)      │  │ (future)           │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘  │
│         │                 │                     │              │
│         └─────────────────┴─────────────────────┘              │
│                            │                                   │
│                    ┌───────┴────────┐                          │
│                    │  INBOUND PORTS  │                          │
│                    │  (Interfaces)   │                          │
│                    └───────┬────────┘                          │
├────────────────────────────┼──────────────────────────────────┤
│                      DOMAIN                                   │
│                    ┌───────┴────────┐                          │
│                    │  Application    │                          │
│                    │  Services       │                          │
│                    │                 │                          │
│  ┌─────────────────┼─────────────────┼────────────────────┐   │
│  │ CampaignService │ AIService       │ OptimizationService│   │
│  │ .create()       │ .processPrompt()│ .runAudit()        │   │
│  │ .update()       │ .generate()     │ .detectIssues()    │   │
│  │ .plan()         │ .apply()        │ .recommend()       │   │
│  │ .version()      │                 │ .approveAction()   │   │
│  │ .rollback()     │                 │                    │   │
│  └───────┬─────────┴─────────┬───────┴────────────────────┘   │
│          │                   │                                 │
│  ┌───────┴───────────────────┴────────┐                        │
│  │        Domain Models / Types        │                        │
│  │  CampaignConfig, ExecutionPlan,     │                        │
│  │  AIActionItem, AccountIssue, etc.   │                        │
│  └────────────────────────────────────┘                        │
│          │                   │                                 │
│  ┌───────┴───────────────────┴────────┐                        │
│  │       OUTBOUND PORTS               │                        │
│  │  (Interfaces / Ports)              │                        │
│  │  CampaignRepository                │                        │
│  │  MetaApiClient                     │                        │
│  │  LlmClient                         │                        │
│  │  AuthProvider                      │                        │
│  └───────┬───────────────────┬────────┘                        │
├──────────┼───────────────────┼────────────────────────────────┤
│   ADAPTERS (INFRASTRUCTURE)                                    │
│  ┌───────┴────────┐  ┌──────┴────────┐  ┌──────────────────┐ │
│  │ MetaApiAdapter  │  │ LLMAdapter     │  │ RepositoryAdapter│ │
│  │ (Meta SDK)      │  │ (OpenAI SDK)   │  │ (Postgres/File)  │ │
│  └────────────────┘  └───────────────┘  └──────────────────┘ │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │ Meta Graph API  │  │ OpenAI /        │  │ SQLite /         │ │
│  │ (OAuth, fetch)  │  │ Anthropic API   │  │ JSON File / S3   │ │
│  └────────────────┘  └────────────────┘  └──────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## 3. Directory Structure

```
src/
├── api/                          # Inbound adapters (Next.js API routes)
│   ├── campaign/
│   │   ├── route.ts              # POST /api/campaign
│   │   ├── [id]/
│   │   │   ├── route.ts          # GET/PUT/DELETE /api/campaign/[id]
│   │   │   └── plan/route.ts     # GET /api/campaign/[id]/plan
│   │   │   └── versions/route.ts # GET /api/campaign/[id]/versions
│   │   │   └── rollback/route.ts # POST /api/campaign/[id]/rollback
│   │   └── list/route.ts         # GET /api/campaign/list
│   ├── ai/
│   │   ├── chat/route.ts         # POST /api/ai/chat
│   │   └── actions/route.ts      # POST /api/ai/actions/apply
│   ├── meta/
│   │   ├── auth/route.ts         # GET /api/meta/auth
│   │   ├── callback/route.ts     # GET /api/meta/callback
│   │   ├── accounts/route.ts     # GET /api/meta/accounts
│   │   └── sync/route.ts         # POST /api/meta/sync
│   ├── optimization/
│   │   ├── health/route.ts       # GET /api/optimization/health
│   │   ├── recommendations/route.ts # GET /api/optimization/recommendations
│   │   └── actions/route.ts      # GET/POST /api/optimization/actions
│   └── auth/
│       └── [...nextauth]/route.ts # NextAuth.js
│
├── core/                         # Domain hexagon (pure logic, zero deps)
│   ├── campaign/
│   │   ├── types.ts              # CampaignConfig, AdSetConfig, CreativeConfig
│   │   ├── service.ts            # CampaignService (orchestrates domain ops)
│   │   ├── generator.ts          # FormInput → CampaignConfig
│   │   ├── validator.ts          # Config validation rules
│   │   ├── versioning.ts         # Diff computation, version creation
│   │   ├── planner.ts            # ExecutionPlan generation, drift detection
│   │   └── repository.port.ts    # OUTBOUND PORT interface
│   ├── ai/
│   │   ├── types.ts              # AIActionItem, AIResponse, ChangePreview
│   │   ├── service.ts            # AIService (prompt processing, action execution)
│   │   └── llm-client.port.ts    # OUTBOUND PORT interface
│   ├── optimization/
│   │   ├── types.ts              # AccountIssue, Recommendation, Action
│   │   ├── auditor.ts            # Health checks, issue detection rules
│   │   ├── copilot.ts            # Opportunity detection, recommendation engine
│   │   ├── action-center.ts      # Approval workflow, action execution
│   │   ├── health.service.ts     # Account health scoring
│   │   └── meta-client.port.ts   # OUTBOUND PORT (for fetching meta data)
│   └── shared/
│       ├── types.ts              # Platform, CampaignStatus, etc.
│       └── errors.ts             # Domain error types
│
├── infrastructure/               # Adapters (outer hexagon implementation)
│   ├── persistence/
│   │   ├── campaign/
│   │   │   ├── in-memory.repository.ts  # Current Map-based store
│   │   │   ├── drizzle.repository.ts    # Drizzle ORM → Postgres
│   │   │   └── schema.ts                # DB schema
│   │   └── index.ts
│   ├── meta/
│   │   ├── meta-api.adapter.ts   # Meta Ads API wrapper (real SDK calls)
│   │   ├── meta-oauth.adapter.ts # OAuth flow handler
│   │   ├── meta-mapper.ts        # Meta API DTO ↔ Domain model
│   │   └── types.ts              # Meta-specific DTOs
│   ├── llm/
│   │   ├── groq.adapter.ts       # Groq SDK wrapper
│   │   ├── prompt-builder.ts     # System prompts, context assembly
│   │   └── response-parser.ts    # LLM response → Domain types
│   ├── auth/
│   │   └── next-auth.adapter.ts  # NextAuth.js configuration
│   └── config.ts                 # Env vars, secrets management
│
├── di/                           # Dependency injection wiring
│   └── container.ts              # Compose all layers together
│
├── app/                          # Next.js App Router pages (unchanged from current)
├── components/                   # React components (unchanged)
├── hooks/                        # React hooks (unchanged)
├── context/                      # React context (unchanged)
│── lib/                          # DEPRECATED — migrate to core/ + infrastructure/
```

## 4. Layer-by-Layer Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Move existing domain into `core/` + define ports:**
- Move `src/lib/campaign-engine/` → `src/core/campaign/` (rename files: `service.ts`, `repository.port.ts`)
- Define `CampaignRepositoryPort` (outbound port interface)
- Define `MetaApiClientPort` (outbound port — `fetchCampaigns`, `fetchInsights`, `createCampaign`, `updateCampaign`)
- Define `LlmClientPort` (outbound port — `generate`, `chat`)
- Create `src/infrastructure/persistence/campaign/in-memory.repository.ts` (existing Map store as adapter)
- Move `src/lib/ai/` → `src/core/ai/`
- Wire DI container

**Key interfaces (ports):**

```typescript
// src/core/campaign/repository.port.ts
export interface CampaignRepositoryPort {
  save(config: CampaignConfig): string;
  get(id: string): CampaignEntry | undefined;
  list(): CampaignEntry[];
  update(id: string, config: CampaignConfig, diffs: ConfigDiff[]): CampaignEntry;
  delete(id: string): boolean;
}

// src/core/optimization/meta-client.port.ts
export interface MetaClientPort {
  getAccounts(accessToken: string): Promise<AdAccount[]>;
  getCampaigns(accountId: string, accessToken: string): Promise<MetaCampaignDTO[]>;
  getInsights(accountId: string, campaignIds: string[], since: string, until: string): Promise<MetaInsightDTO[]>;
  getAdCreatives(adId: string, accessToken: string): Promise<MetaCreativeDTO[]>;
}

// src/core/ai/llm-client.port.ts
export interface LlmClientPort {
  chat(systemPrompt: string, userMessage: string): Promise<LLMResponse>;
  generateStructured<T>(prompt: string, schema: ZodType<T>): Promise<T>;
}
```

### Phase 2: Meta Integration (Week 3-4)

**Build Meta adapter (`src/infrastructure/meta/`):**
- OAuth flow: redirect → Meta Login → callback → store `access_token`, `ad_account_id`
- Implement `MetaApiAdapter` using `graph.facebook.com/v22.0` API
- Implement `MetaMapper` to convert Meta DTOs → domain models
- Create sync endpoint: `POST /api/meta/sync` — pull campaigns from Meta → store in `CampaignRepositoryPort`
- Add drift detection: after sync, compare Meta state vs internal config, flag drifts

**Files:**
```
src/infrastructure/meta/
├── meta-api.adapter.ts          # Fetch wrapper for Meta Graph API
├── meta-oauth.adapter.ts        # OAuth token management
├── meta-mapper.ts                # DTO ↔ Domain
├── types.ts                      # Meta API response types
└── index.ts                      # Re-exports
```

### Phase 3: AI Integration (Week 3-4, parallel)

**Build LLM adapter (`src/infrastructure/llm/`):**
- Implement `GroqAdapter` using `groq-sdk` npm package
- Build `PromptBuilder` — constructs system prompts with campaign context, available actions, constraints
- Build `ResponseParser` — validates LLM response matches `AIActionItem[]` schema (use Zod)
- Wire through `AIService` which calls `LlmClientPort.chat()` then parses + validates result

**Files:**
```
src/infrastructure/llm/
├── groq.adapter.ts               # Groq SDK wrapper
├── prompt-builder.ts             # System prompt assembly
├── response-parser.ts            # Structured output parsing
└── index.ts
```

### Phase 4: API Routes (Week 5)

**Build inbound adapters (Next.js route handlers):**

| Route | Purpose | Depends On |
|-------|---------|------------|
| `POST /api/campaign` | Create campaign | CampaignService |
| `GET /api/campaign` | List campaigns | CampaignService |
| `GET /api/campaign/[id]` | Get campaign detail | CampaignService |
| `PUT /api/campaign/[id]` | Update campaign | CampaignService |
| `DELETE /api/campaign/[id]` | Delete campaign | CampaignService |
| `GET /api/campaign/[id]/plan` | Get execution plan | CampaignService |
| `GET /api/campaign/[id]/versions` | Version history | CampaignService |
| `POST /api/campaign/[id]/rollback` | Rollback to version | CampaignService |
| `POST /api/ai/chat` | Process AI prompt | AIService |
| `POST /api/ai/actions/apply` | Apply AI actions | AIService |
| `GET /api/meta/auth` | Start Meta OAuth | MetaAdapter |
| `GET /api/meta/callback` | Handle Meta OAuth callback | MetaAdapter |
| `POST /api/meta/sync` | Sync campaigns from Meta | MetaAdapter + CampaignService |
| `GET /api/optimization/health` | Account health check | OptimizationService |
| `GET /api/optimization/recommendations` | Get recommendations | OptimizationService |
| `GET /api/optimization/actions` | List optimization actions | OptimizationService |
| `POST /api/optimization/actions/[id]/approve` | Approve action | OptimizationService |
| `POST /api/optimization/actions/[id]/reject` | Reject action | OptimizationService |
| `POST /api/optimization/actions/[id]/execute` | Execute action | OptimizationService |

### Phase 5: Persistence (Week 5-6, parallel)

**Replace in-memory store with database:**
- Add `drizzle-orm`, `@libsql/client` (SQLite for dev, pg for prod)
- Define schema in `src/infrastructure/persistence/campaign/schema.ts`
- Implement `DrizzleCampaignRepository`
- Migration scripts
- Service Layer switch via DI container

### Phase 6: Optimization Backend (Week 6-7)

**Move optimization rules from frontend/src/types to backend services:**
- `AuditorService`: runs health checks against real Meta data
- `CopilotService`: detects opportunities based on real metrics
- `ActionCenterService`: manages approval workflow, audit log

### Phase 7: Testing & Hardening (Week 8)

- Unit tests for domain services (core/)
- Integration tests for adapters (infrastructure/)
- API route tests
- E2E flow: Meta OAuth → Sync → AI Prompt → Action → Approval → Execute

## 5. Dependency Injection Strategy

Use a simple manual DI container (no framework-heavy IoC):

```typescript
// src/di/container.ts
import type { CampaignRepositoryPort } from '@/core/campaign/repository.port';
import type { MetaClientPort } from '@/core/optimization/meta-client.port';
import type { LlmClientPort } from '@/core/ai/llm-client.port';
import { InMemoryCampaignRepository } from '@/infrastructure/persistence/campaign/in-memory.repository';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';
import { GroqAdapter } from '@/infrastructure/llm/groq.adapter';

export class Container {
  private static _campaignRepo: CampaignRepositoryPort;
  private static _metaClient: MetaClientPort;
  private static _llmClient: LlmClientPort;

  static getCampaignRepository(): CampaignRepositoryPort {
    if (!this._campaignRepo) {
      this._campaignRepo = new InMemoryCampaignRepository();
    }
    return this._campaignRepo;
  }

  static getMetaClient(): MetaClientPort {
    if (!this._metaClient) {
      this._metaClient = new MetaApiAdapter();
    }
    return this._metaClient;
  }

  static getLlmClient(): LlmClientPort {
    if (!this._llmClient) {
      this._llmClient = new GroqAdapter();
    }
    return this._llmClient;
  }

  static getCampaignService(): CampaignService {
    return new CampaignService(this.getCampaignRepository());
  }

  static getAIService(): AIService {
    return new AIService(this.getCampaignRepository(), this.getLlmClient());
  }
}
```

## 6. Data Flow Examples

### Flow A: Create Campaign → Meta

```
User fills form → POST /api/campaign
  → CampaignService.create(formInput)
    → Generator: formInput → CampaignConfig
    → Validator: validate(CampaignConfig)
    → RepositoryPort.save(CampaignConfig)
    → Planner: generateExecutionPlan()
    → Returns { id, config, plan }
    
Later → POST /api/meta/sync/:campaignId
  → CampaignService.getExecutionPlan()
  → MetaClientPort.forEach(platformAction):
    → MetaApiAdapter.createCampaign() | updateCampaign() | etc.
  → Mark plan as applied
  → DriftReport: { hasDrift: false }
```

### Flow B: AI Chat → Action

```
User types "Increase SG budgets 20%" → POST /api/ai/chat
  → AIService.processPrompt(prompt)
    → PromptBuilder: build system prompt with current campaigns
    → LlmClientPort.chat(systemPrompt, userMessage)
    → ResponseParser: raw LLM → AIActionItem[]
    → Returns { message, actions[], requiresConfirmation }
    
User clicks "Apply" → POST /api/ai/actions/apply
  → AIService.applyAllActions(actions)
    → For each action:
      → CampaignService.update(campaignId, newParams)
        → RepositoryPort.update()
        → Versioning: createVersion()
        → Planner: generateExecutionPlan()
    → Returns { results[] }
```

## 7. Key Dependencies to Add

```
npm install groq-sdk                       # LLM adapter (Groq)
npm install next-auth                       # Auth (prob already needed)
npm install drizzle-orm @libsql/client       # Persistence
npm install zod                              # Already present
```

## 8. Migration from Current `src/lib/` → New Structure

| Current File | Destination | Action |
|---|---|---|
| `src/lib/campaign-engine/types.ts` | `src/core/campaign/types.ts` | Move, add CampaignEntry type |
| `src/lib/campaign-engine/store.ts` | `src/core/campaign/service.ts` + `src/infrastructure/persistence/campaign/in-memory.repository.ts` | Split: service (orchestration) + repository (data access) |
| `src/lib/campaign-engine/generator.ts` | `src/core/campaign/generator.ts` | Move unchanged |
| `src/lib/campaign-engine/validator.ts` | `src/core/campaign/validator.ts` | Move unchanged |
| `src/lib/campaign-engine/versioning.ts` | `src/core/campaign/versioning.ts` | Move unchanged |
| `src/lib/campaign-engine/planner.ts` | `src/core/campaign/planner.ts` | Move unchanged |
| `src/lib/campaign-engine/seed.ts` | `src/core/campaign/seed.ts` | Move unchanged |
| `src/lib/campaign-engine/index.ts` | Remove, re-export via core barrel |
| `src/lib/ai/types.ts` | `src/core/ai/types.ts` | Move, add structured output types |
| `src/lib/ai/engine.ts` | `src/core/ai/service.ts` | Refactor to use LlmClientPort (port) instead of hardcoded rules |
| `src/lib/ai/index.ts` | Remove, re-export via core barrel |
| `src/api/adClient.ts` | Remove mock layer; replace with MetaAdapter + in-memory repo | Delete or keep as fallback |
