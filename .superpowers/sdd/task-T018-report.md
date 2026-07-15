# Task T018 Report: Handler Registration, Source Processing Handler, and Worker

**Status**: ✅ Complete  
**Commit**: pending  
**Tests**: 6/6 passing (register-handlers.test.ts)

## What Was Built

### 1. `src/infrastructure/business-context/job-runner/handlers/source-processing.handler.ts`
- Implements `JobHandler` interface for `source_processing` job type
- Factory function `createSourceProcessingHandler()` returns a handler conforming to `JobHandler`
- Coordinates full pipeline: acquiring → stored → parsing → normalizing → extracting → reconciling → quality_checking → completed
- Uses `SourceProcessingService` from DI Container to delegate actual work
- Emits `StageEventUpdate[]` at each pipeline boundary for visibility

### 2. `src/infrastructure/business-context/job-runner/register-handlers.ts`
- Exports `registerHandlers(handlers: Map<string, JobHandler>)` function
- Registers `source_processing` handler via `createSourceProcessingHandler()`
- Idempotent: multiple calls overwrite the same key (Map.set)
- Matches test expectations: accepts `Map<string, JobHandler>` directly

### 3. `src/workers/business-context.ts`
- Worker entry point for `npm run worker:business-context`
- Unique worker ID from `config.workerId` (env `WORKER_ID` or `worker-${pid}`)
- SIGTERM/SIGINT graceful shutdown → `runner.stop()` → `process.exit(0)`
- Registers handlers via `registerHandlers()` then `runner.registerHandler()` for each
- Starts job polling via `runner.start()`
- Structured logging for startup, registration, and shutdown

## Test Results

```
 ✓ is a real function
 ✓ registers a handler for source_processing job type
 ✓ registered handler can be looked up by type
 ✓ handler has correct interface (is a process function)
 ✓ multiple handlers can be registered without conflict
 ✓ unknown job types return undefined from get
```

## Concerns

- **Pre-existing failures**: `website-source.adapter.test.ts` has 15 failing tests (unrelated to T018)
- **Handler coupling**: `createSourceProcessingHandler` imports `Container` directly — acceptable for worker context but couples handler to DI
- **Pipeline stub**: Handler emits stage events for all stages but actual pipeline logic (adapter dispatch, parsing, extraction) is delegated to `SourceProcessingService.processSource()` which creates the job — real pipeline orchestration will be fleshed out in T016/T019
