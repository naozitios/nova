When CodeGraph is installed and `.codegraph/` exists, use it first for code exploration, architecture questions, caller/callee tracing, and impact analysis. Prefer `codegraph explore` before grep/find/read. Use `codegraph status` after edits to confirm index freshness.

If agentmemory is installed for this workspace, use it to recover missing project context before editing and to save durable decisions when they matter. Treat it as the source for prior session history, architecture notes, and recurring preferences when repo files are not enough.

Safe agentmemory startup: do not run the long-lived agentmemory daemon inside an agent-managed background task because shell cleanup/SIGHUP can kill the iii engine and make MCP fall back to fragile local memory. Start it detached instead: `nohup agentmemory --verbose > /tmp/agentmemory-fresh.log 2>&1 & echo $! > /tmp/agentmemory-fresh.pid`. Before saving memories, verify real server health with `curl -fsS http://localhost:3111/agentmemory/livez`, `curl -fsS http://localhost:3111/agentmemory/health`, and `agentmemory status` showing `Health: ✓ healthy`. If MCP shows only fallback/local behavior or REST returns 404, stop all `agentmemory`, `agentmemory-mcp`, and `iii` processes, restart detached, and re-verify before trusting saves.

Always Use /"caveman full" skill to reduce verbose responses.
Always use RTK CLI for bash commands.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
