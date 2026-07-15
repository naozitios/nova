# OpenCode Model Routing Design

## Goal

Keep the primary OpenCode agent on the model selected for the current session while routing routine subagent work to the lower-cost MiMo model available through OpenCode Go.

## Configuration

- Do not set the top-level `model` field. The primary agent continues to inherit the session-selected model.
- Override the built-in `general` agent with `opencode-go/mimo-v2.5`.
- Override the built-in `explore` agent with `opencode-go/mimo-v2.5`.
- Set `cavecrew-builder` to `opencode-go/mimo-v2.5` in its agent frontmatter.
- Leave `cavecrew-investigator` and `cavecrew-reviewer` unchanged.

## Files

- `~/.config/opencode/opencode.json`: add model overrides for `general` and `explore`.
- `~/.config/opencode/agents/cavecrew-builder.md`: add the explicit MiMo model.

## Verification

Validate the JSON configuration, confirm `opencode-go/mimo-v2.5` remains listed by `opencode models`, restart OpenCode, then spawn each overridden subagent and inspect its reported model.

## Constraints

OpenCode loads configuration at startup. Existing sessions retain their loaded agent definitions until OpenCode restarts.
