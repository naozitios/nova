# nova Constitution
<!-- Project: Nova — Cross-channel ad command center for marketing agencies -->

This constitution codifies the conventions already established in this codebase. It is **evidence-based**: every rule below is a pattern Noah Teo has already shipped in `src/`. AI agents and new contributors MUST follow it. Amendments require a PR, explicit approval, and a migration plan.

---

## I. Hexagonal Architecture (NON-NEGOTIABLE)

The backend is hexagonal (ports & adapters). The boundary is enforced by *what is allowed to import what*:

| Layer | Path | Allowed to import | NOT allowed to import |
|---|---|---|---|
| Domain | `src/core/<domain>/` | Sibling `core/` types and ports **only** | `next/*`, `groq-sdk`, `drizzle-orm`, `stripe`, `next-auth`, anything in `infrastructure/` |
| Adapters | `src/infrastructure/<provider>/` | `core/<domain>/*.port.ts`, external SDKs, `core/<domain>/*.ts` for types | `app/`, `di/`, `lib/` |
| Inbound | `src/app/api/<domain>/route.ts` | `core/<domain>/service.ts`, `di/container.ts` | `infrastructure/` directly (no `new SomeAdapter()` at the route level) |
| Composition root | `src/di/container.ts` | `core/` and `infrastructure/` | nothing else imports both |
| UI | `src/app/**/page.tsx`, `src/components/**` | `core/<domain>/types.ts` (type-only), `@/types/` (legacy), `app/api/*` (data fetching) | `infrastructure/`, `core/<domain>/service.ts` (must go through API) |

**Enforcement rules:**
- A service receives its dependencies via constructor injection: `constructor(private repo: CampaignRepositoryPort) {}`. Services never `new` an adapter.
- Port interfaces are named `<Entity>Port` (`CampaignRepositoryPort`, `LlmClientPort`, `MetaClientPort`, `BillingPort`, `BillingStorePort`).
- DTOs are named `<Provider><Entity>DTO` (`MetaCampaignDTO`, `MetaInsightDTO`).
- All services are resolved through `Container.getXxx()`. The only exceptions are documented adapter-singleton test hooks (`Container.useInMemory()`, `Container.useDrizzle()`, `Container.setLlmClient()`, `Container.reset()`).

**Why:** the codebase already mixes these layers inconsistently — `/api/optimization/*` and `/api/analytics/*` instantiate adapters directly, and `core/ai/service.ts` and `core/optimization/auditor.ts` reach into infrastructure for DTO types. New work MUST go through the container; fixing the existing leaks is a tracked migration item, not a license to repeat them.

---

## II. Declarative Single-Source-of-Truth Configuration

`CampaignConfig` (defined in `src/core/campaign/types.ts`) is the **only** canonical representation of a campaign. Everything else — UI forms, AI prompts, Meta API payloads, version history, drift reports — is derived from it.

**Rules:**
- The raw config is **never** sent to the client. The frontend always gets derived data (DTOs, form-shaped input, summary views).
- New persistence that touches campaign shape MUST go through `CampaignConfig`, not a parallel model.
- Every save creates a versioned snapshot with this shape (Git-like commit):
  ```ts
  { diffs, timestamp, authoredBy, commitMessage }
  ```
  See `core/campaign/versioning.ts:63-83` for the exact pattern.
- Drift detection compares the five top-level keys (`name`, `totalBudget`, `startDate`, `endDate`, `objective`) via JSON.stringify equality (`core/campaign/planner.ts:84-115`). New top-level keys MUST extend the drift set.
- Validation is a pure function returning `ValidationError[]` with dot-path `field` strings (e.g. `adSets[0].targeting.countries`). Service layers map these to plain `string[]` for transport.

**Why:** PRD 001 defines the "AWS Console backed by Terraform" philosophy. PRD 005 inherits it. The hidden declarative JSON is the architectural spine — losing it collapses the entire product.

---

## III. Ports & Adapters Discipline

Every external dependency has a port interface; the port is the contract the service depends on.

**Established ports (do not duplicate):**
- `CampaignRepositoryPort` (`core/campaign/repository.port.ts`)
- `LlmClientPort` (`core/ai/llm-client.port.ts`)
- `MetaClientPort` (`core/optimization/meta-client.port.ts`)
- `BillingPort` (`core/billing/billing.port.ts`)
- `BillingStorePort` (`core/billing/billing.port.ts`)

**Adapters (one per port; alternate impls are explicit):**
- Repositories: `in-memory.repository.ts` (dev/test) and `drizzle.repository.ts` (prod) — selected via `Container.useInMemory()` / `Container.useDrizzle()`.
- Meta: `MetaApiAdapter` (Graph API v22.0; chunk campaign IDs in groups of 10).
- LLM: `GroqAdapter` (`llama-3.3-70b-versatile`, `temperature: 0.1`, `response_format: { type: 'json_object' }`).
- Billing: `StripeAdapter` (`apiVersion: '2026-06-24.dahlia'`).

**Rules:**
- New external integrations MUST follow the port → adapter pattern. No service may import an SDK directly.
- DTOs ↔ Domain mapping lives in `<provider>-mapper.ts`. Mappers handle unit conversion (Meta stores budgets in cents; divide/multiply by 100), date normalization (ISO datetime), and objective enums.
- Drizzle JSON columns are cast via `as unknown as <DomainType>` (pragmatic pattern, see `infrastructure/persistence/campaign/drizzle.repository.ts`). This is acceptable; do not introduce alternative typing schemes.
- LLM structured output MUST use Zod schemas. The current `GroqAdapter` delegates prompt building and response parsing to `PromptBuilder` / `ResponseParser` collaborators — follow that split, do not collapse them.

**Why:** the current port surface is small but consistent. Drift here (e.g. the `MetaOAuthAdapter`, `StripeWebhookParser`, `MetaMapper`, `PromptBuilder`, `ResponseParser` not being port-backed) is a tracked concern, not the default for new work.

---

## IV. TypeScript Strict, Domain-First

- `tsconfig.json` is the source of truth: `strict: true`, `target: ES2017`, `module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, `isolatedModules: true`, `resolveJsonModule: true`.
- **No `any`** in new code. The only `any` usage that exists is in deprecated `src/lib/` (`lib/ai/engine.ts`, `lib/campaign-engine/store.ts`) and one search-params cast in `app/api/optimization/actions/route.ts`. New files MUST NOT introduce `any`.
- `interface` for entities and structural shapes; `type` for string-literal unions and aliases. **No `enum`** — use string-literal unions.
- Domain types live in `core/<domain>/types.ts`, not in `src/types/`. The `src/types/optimization.ts` file is a known duplicate of `core/optimization/types.ts`; new optimization work MUST import from `core/`, not `src/types/`.
- Path alias: `@/*` → `./src/*`. Use it for **all** imports; do not use relative `../../../` paths.
- Promise/await only. No `.then()` chains. Parallel reads via `Promise.all`.
- Repository return types may be union `T | Promise<T>` to support both sync in-memory and async Drizzle implementations behind the same port — keep this pattern.

---

## V. API Conventions (Next.js App Router)

- File per endpoint: `src/app/api/<domain>/<action>/route.ts`.
- Handler signature: `async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> })` — **`params` is `await`-ed** (Next 15+ pattern).
- All responses use `NextResponse.json(...)`.
- **Success body** is the domain DTO directly (no `{ data, success }` wrapper).
- **Error body** has a fixed shape:
  ```ts
  { error: { code: string, message: string, details?: unknown } }
  ```
- **Error codes** (canonical set — extend, do not invent):
  `VALIDATION_ERROR | AUTH_ERROR | NOT_FOUND | INTERNAL_ERROR | META_API_ERROR | WEBHOOK_ERROR`
- **Status codes** used: `400 | 401 | 404 | 500 | 502`.
- Every handler is wrapped in try/catch returning a 500 with `{ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }`.
- **Every handler has JSDoc** describing the endpoint.
- **All services via `Container.getXxx()`.** No `new MetaApiAdapter()` / `new HealthService()` / `new ActionCenter()` at the route level. The existing offenders in `/api/optimization/*` and `/api/analytics/*` are tracked for migration.
- Auth: routes that touch Meta or billing MUST check authentication. The current code gates Meta access by a cookie check (`request.cookies.get('meta_access_token')?.value`) — this is provisional; new auth work MUST use `getServerSession()` and the NextAuth adapter, with proper role enforcement (Admin / Media Buyer / Viewer per PRD 002).

---

## VI. Component Conventions (React 19, shadcn/ui, Tailwind v4)

- All UI components are **client components** (`'use client'` at the top of the file). Server components are not used in this codebase.
- **shadcn/ui** with these settings (from `components.json`): `style: "new-york"`, `baseColor: "slate"`, `cssVariables: true`, `iconLibrary: "lucide"`, `rsc: true`, `tsx: true`. Primitives live in `src/components/ui/`.
- **File naming**:
  - React components: **PascalCase** matching the exported component name (`CampaignsTable.tsx` exports `CampaignsTable`).
  - Non-component files: **kebab-case** (`ad-client.ts`, `use-mobile.ts`, `campaign-table-utils.ts`).
  - Domain classes exported from kebab-case files (`in-memory.repository.ts` exports `InMemoryCampaignRepository`).
- **Folder structure**:
  - `src/components/ui/<primitive>.tsx` — shadcn primitives.
  - `src/components/<feature>/<Component>.tsx` — feature components.
- **Props**: `interface <Component>Props { ... }` declared at the top of the file; destructured in the function signature. **No `React.FC`**. Use `export function Component({...}: Props) { ... }`.
- **Local sub-components** are defined in the same file (e.g. `StatusBadge`, `PlatformIndicator`, `SkeletonRow` inside `CampaignsTable.tsx`).
- **Animation**: `framer-motion` `motion.div` with `initial / animate / transition` is the default idiom. Staggered list reveals use `delay: i * 0.05` indices.
- **Forms**: target `react-hook-form` + `zod` + `@hookform/resolvers` (installed, not yet adopted). New form work MUST use them; legacy `useState` forms are tolerated only in `src/app/campaigns/new/page.tsx` and `src/app/campaigns/[id]/page.tsx` until those pages are refactored.
- **Toasts**: target `sonner` (installed, not yet adopted). New user-facing async feedback MUST use `sonner` rather than ad-hoc state.
- **Design tokens** (do not change without amending this constitution):
  - Neutrals: `stone-50/100/200/400/500/600/700/900`
  - Semantic: `green-*` success, `amber-*` warning, `red-*` critical, `blue-*` info, `purple-*` AI
  - Brand: `#E55A3C` (primary), `#D14A2E` (hover), `#FEF3E2` / `#FFDAB9` / `#F4A574` (peach gradient tiles)
  - Card chrome: `rounded-2xl` / `rounded-3xl`, light `stone-50/100` backgrounds

---

## VII. File & Naming Conventions (consolidated)

| What | Convention | Example |
|---|---|---|
| React component file | PascalCase | `CampaignsTable.tsx` |
| Non-component TS file | kebab-case | `ad-client.ts`, `in-memory.repository.ts` |
| Class | PascalCase, `export class` | `CampaignService`, `GroqAdapter` |
| Port interface | `<Entity>Port` | `CampaignRepositoryPort` |
| DTO | `<Provider><Entity>DTO` | `MetaCampaignDTO` |
| Function | camelCase | `generateConfig`, `computeDiff` |
| Constant | UPPER_SNAKE_CASE | `VALID_OBJECTIVES`, `PLATFORM_INDICATOR` |
| Boolean variable | `is` / `has` / `should` prefix | `isLoading`, `hasDrift`, `isLatest` |
| Type / Interface | PascalCase | `CampaignConfig`, `IssueSeverity` |
| String-literal union | `type` (no `enum`) | `type Platform = 'meta' \| 'google'` |
| DB table (TS) | camelCase | `currentVersion` |
| DB table (SQL) | snake_case | `current_version` |
| Path alias | `@/*` → `./src/*` | `import { ... } from '@/core/...'` |

**JSDoc** is required on: every public method of every class, every exported function, every public static method of `Container`, every route handler. Inline comments are sparse — reserved for non-obvious decisions.

**No `// TODO`, `// FIXME`, `// XXX`, or `// HACK` comments.** Work is tracked through the spec-kit workflow (`specs/NNN-feature/`), not in code.

---

## VIII. Frontend Data Flow

- **Sole data-fetching library**: `@tanstack/react-query` 5.90.16. No SWR, no Zustand, no Redux. The provider is `src/app/providers.tsx`.
- **Auth state**: `src/context/AuthContext.tsx` (currently a thin client wrapper; expansion tracked in PRD 005 phase 7).
- **Page-level data fetches** live in the page component with `useQuery` / `useEffect` for the bridge. Empty-data fallback is `[]`; failures either add a system message or render an error state.
- **Cross-page state**: lift to URL params or React Query cache. Do not introduce new context providers for one-off state.

---

## IX. Testing (when adopted)

Per PRD 005 §13 — **Vitest** for unit, **Playwright** for E2E. Neither is currently installed; adoption is a tracked migration item.

**When tests are introduced:**
- Test files are co-located: `*.test.ts` next to the source file.
- **Mock via port interfaces, never via concrete adapters.** `vi.mock('@/core/campaign/repository.port')` is correct; `vi.mock('@/infrastructure/persistence/campaign/drizzle.repository')` is not.
- TDD for new ports, new services, and new domain logic: tests written first, must fail before implementation.
- Existing `Container.useInMemory()` and `Container.reset()` hooks are the test seams — use them.

---

## X. Observability & Error Handling

- **API errors**: structured `{ error: { code, message, details? } }` with canonical error codes (see §V).
- **Adapter errors**: throw with a prefix so route handlers can classify: `throw new Error('Meta API error: ...')`, `throw new Error('Stripe webhook error: ...')`. Route handlers translate to the right status (502 for upstream-provider failures).
- **Domain errors**: PRD 005 promises a hierarchy (`DomainError`, `ValidationError`, `NotFoundError`, `MetaApiError`, `LlmError`, `AuthError`). It is not yet implemented. New work MAY introduce it incrementally — start with `DomainError` and add subclasses as needed; do not invent a parallel scheme.
- **Frontend**: `try/catch` on every fetch; surface failures via sonner toasts (once adopted) or inline error state.

---

## XI. Tech Stack (frozen)

Amend this list to add a dependency. Do not add dependencies casually.

- **Framework**: Next.js 16.1.1 (App Router), React 19.2.3
- **Language**: TypeScript ^5 (strict)
- **UI**: shadcn/ui (new-york / slate), Tailwind CSS v4, Radix UI, framer-motion, lucide-react
- **Forms** (target): react-hook-form + @hookform/resolvers + zod
- **Toasts** (target): sonner
- **DB**: drizzle-orm 0.45.2 + @libsql/client 0.17.4 (dev SQLite, prod Postgres target)
- **Auth**: next-auth 4.24.14 (Google OAuth + Credentials, JWT strategy)
- **Payments**: stripe 22.3.0 (`apiVersion: '2026-06-24.dahlia'`)
- **AI**: groq-sdk 1.3.0 (model `llama-3.3-70b-versatile`, `temperature: 0.1`, JSON output)
- **State / data**: @tanstack/react-query 5.90.16
- **Testing** (when adopted): Vitest + Playwright
- **Validation**: Zod 4

**Do not introduce** without amending this constitution: a new UI library, a new state library, a new ORM, a new auth provider, a new payments provider, a new LLM SDK, Tailwind alternatives (UnoCSS, etc.), CSS-in-JS.

---

## XII. Tracked Migrations & Tech Debt

These are known inconsistencies. New work MUST NOT add to them. When editing a file with a tracked issue, fix the issue in the same change.

1. **`app/api/optimization/*` and `app/api/analytics/*` instantiate adapters directly** — refactor to go through `Container`.
2. **`src/lib/campaign-engine/` and `src/lib/ai/` are deprecated** — refactor `app/campaigns/new/page.tsx`, `app/campaigns/[id]/page.tsx`, and `app/ai/page.tsx` to import from `@/core/...` directly.
3. **`src/api/adClient.ts` is a mock** — replace callers (`app/settings/page.tsx`, `app/campaigns/new/page.tsx`) with `/api/...` calls; delete `adClient.ts` once zero references remain.
4. **`src/types/optimization.ts` duplicates `core/optimization/types.ts`** — refactor frontend (`AccountHealth.tsx`, `OptimizationCopilot.tsx`, `ActionCenter.tsx`) to import from `@/core/optimization/types`.
5. **`app/campaigns/[id]/page.tsx:310` always renders "active"** regardless of status — bug.
6. **`app/campaigns/[id]/page.tsx:475` "Bid Amount" `<Input>` shows `form.ageMin`** — copy-paste bug.
7. **`app/campaigns/[id]/page.tsx:208-218` drift demo is non-functional** — `simulatedPlatformState` is constructed by copying internal config verbatim, so `checkDrift` always returns `hasDrift: false`.
8. **`app/api/campaign/route.ts:6-24` and `app/api/analytics/route.ts:7-12` use `config.meta.appSecret` as the access token** — security and correctness bug. Will 100% fail in production.
9. **`next.config.ts:5` has `domains: ['static.zara.net']`** — leftover from the original fashion version. Remove when next touching this file.
10. **`package.json:2` `name: "clarke"`** is wrong — should be `nova`. Fix in a one-line housekeeping PR.
11. **`README.md` has an unresolved merge conflict** — resolve to the `# nova / For marketing agencies` description.
12. **No tests anywhere** — install Vitest + Playwright per PRD 005 §13, add tests for ports and services.
13. **Drizzle has no migration files** — generate them; commit.
14. **Duplicate JSDoc lines** in `core/ai/service.ts:5-6`, `infrastructure/llm/groq.adapter.ts:7-8`, `infrastructure/meta/meta-api.adapter.ts:5-6`, `core/ai/llm-client.port.ts:6` — strip duplicates.
15. **`mapObjective` and `mapObjectiveReverse` in `infrastructure/meta/meta-mapper.ts:62-80` are byte-identical** — Meta's outcome enums (LEAD, SALES, etc.) are not handled. Either implement the reverse map or document the limitation.

---

## XIII. Development Workflow

- **Branch**: feature branches off `main`, named `NNN-feature-name` (e.g. `001-campaigns-meta-table`). Match the `specs/NNN-feature-name/` directory number.
- **Spec-driven**: every non-trivial change goes Spec → Plan → Tasks → Implement, using the spec-kit slash commands (`/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`).
- **One PR per spec**; PR description links the spec in `specs/NNN-feature-name/spec.md`.
- **PR review checks** (every PR):
  1. Compliance with §I–XII.
  2. New code paths are reachable; dead code is removed.
  3. No new `any`, no new TODO/FIXME.
  4. Adapter instantiation only in `di/container.ts` (or in tests via `Container.setXxx`).
  5. `npm run lint` clean; `npm run build` clean.

---

## XIV. Governance

- This constitution supersedes all other practices, including README guidance, PR review comments, and verbal agreements.
- **Amendments** require a PR that:
  1. Documents the change in the PR description (the *why*, not just the *what*).
  2. Has explicit approval (no silent merges).
  3. Includes a **migration plan** for any existing code that would violate the new rule.
  4. Updates the version line at the bottom.
- **Compliance verification**: every spec MUST include a "Constitution Compliance" section listing which §I–XII rules it adheres to. `/speckit.analyze` checks for missing sections.
- All PRs MUST reference a spec in `specs/`. A PR without a spec needs an explicit "out of scope" reason in the PR description.

**Version**: 1.0.0 | **Ratified**: 2026-07-14 | **Last Amended**: 2026-07-14
