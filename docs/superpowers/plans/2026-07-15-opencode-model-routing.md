# OpenCode Model Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route routine `general`, `explore`, and `cavecrew-builder` subagent work to `opencode-go/mimo-v2.5` while leaving the primary agent on the session-selected model.

**Architecture:** Keep the global top-level `model` unset so primary-agent model selection remains session-controlled. Add explicit model overrides only to the two built-in subagents and the existing file-defined builder agent.

**Tech Stack:** OpenCode JSON configuration and Markdown agent frontmatter

## Global Constraints

- Do not add a top-level `model` field.
- Use exact model ID `opencode-go/mimo-v2.5`.
- Leave `cavecrew-investigator` and `cavecrew-reviewer` unchanged.
- Restart OpenCode after editing because configuration is loaded only at startup.
- Global OpenCode config directory is not a Git repository, so no config commit is possible.

---

### Task 1: Configure Low-Cost Subagent Routing

**Files:**
- Modify: `/home/adminhermes/.config/opencode/opencode.json:1-6`
- Modify: `/home/adminhermes/.config/opencode/agents/cavecrew-builder.md:1-9`

**Interfaces:**
- Consumes: OpenCode built-in agent names `general` and `explore`; installed model ID `opencode-go/mimo-v2.5`
- Produces: model overrides loaded by OpenCode at next startup

- [ ] **Step 1: Confirm the target model is available**

Run:

```bash
rtk opencode models
```

Expected: output contains `opencode-go/mimo-v2.5`.

- [ ] **Step 2: Add built-in subagent overrides**

Update `/home/adminhermes/.config/opencode/opencode.json` to exactly:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "./plugins/caveman/plugin.js"
  ],
  "agent": {
    "general": {
      "model": "opencode-go/mimo-v2.5"
    },
    "explore": {
      "model": "opencode-go/mimo-v2.5"
    }
  }
}
```

- [ ] **Step 3: Pin the builder subagent**

Add this frontmatter field after the existing `description` block in `/home/adminhermes/.config/opencode/agents/cavecrew-builder.md`:

```yaml
model: opencode-go/mimo-v2.5
```

- [ ] **Step 4: Validate JSON syntax**

Run:

```bash
rtk node -e "JSON.parse(require('fs').readFileSync('/home/adminhermes/.config/opencode/opencode.json', 'utf8')); console.log('valid')"
```

Expected: `valid`.

- [ ] **Step 5: Verify intended routing without changing primary model**

Run:

```bash
rtk node -e "const fs=require('fs'),a=require('assert'); const c=JSON.parse(fs.readFileSync('/home/adminhermes/.config/opencode/opencode.json','utf8')); const b=fs.readFileSync('/home/adminhermes/.config/opencode/agents/cavecrew-builder.md','utf8'); a(!Object.hasOwn(c,'model')); a.equal(c.agent.general.model,'opencode-go/mimo-v2.5'); a.equal(c.agent.explore.model,'opencode-go/mimo-v2.5'); a(/^model: opencode-go\/mimo-v2\.5$/m.test(b)); console.log('routing valid')"
```

Expected: `routing valid`.

- [ ] **Step 6: Restart and smoke-test**

Quit and restart OpenCode. Start a session with any primary model, dispatch `general`, `explore`, and `cavecrew-builder`, and confirm each reports `opencode-go/mimo-v2.5`; confirm primary agent still reports the session-selected model.
