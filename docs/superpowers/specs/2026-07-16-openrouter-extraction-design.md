# OpenRouter Extraction Provider Design

## Goal

Run provider-backed Business Context extraction checks through OpenRouter using
`deepseek/deepseek-v4-flash`, without changing campaign AI behavior.

## Configuration

- `OPENROUTER_API_KEY` is server-only and required for provider checks.
- `OPENROUTER_MODEL` selects the model and is set to
  `deepseek/deepseek-v4-flash` locally.
- Groq configuration remains unchanged for existing campaign runtime paths.

## Provider Boundary

- Add an OpenRouter implementation of the existing Business Context `LlmClient`
  interface.
- Send requests to OpenRouter's OpenAI-compatible chat-completions endpoint.
- Request JSON-schema output using the extraction schema already owned by
  `LlmExtractionAdapter`.
- Parse the returned message content as JSON before returning it to the
  extraction adapter.

## Error Handling

- Preserve actionable provider errors for invalid credentials (`401`), rate
  limits (`429`), and temporary provider/model failures (`503`).
- Do not silently fall back to Groq; provider-backed checks must identify which
  provider failed.

## Scope

- Update only Business Context extraction composition and provider-backed tests.
- Do not modify campaign AI composition, API contracts, persistence, or browser
  configuration.

## Verification

- Unit-test request construction, JSON parsing, and provider error mapping with
  mocked HTTP.
- Run provider-backed extraction and full pipeline tests with configured
  OpenRouter credentials.
- Run TypeScript check and complete Vitest suite.
