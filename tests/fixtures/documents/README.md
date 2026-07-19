# Test Fixtures for Docling Integration Tests

## Owned Fixtures (known structure, stable for assertions)

| File | Type | Purpose |
|------|------|---------|
| `sample.html` | HTML | Full business document with headings, lists, table, and citation paragraph |
| `sample.pdf` | PDF | Same structure as sample.html — tests PDF parsing with headings, table, lists |
| `e2e-sample.html` | HTML | Minimal HTML for E2E smoke tests — headings and plain paragraphs only |

### Content structure (sample.html & sample.pdf)

Both files contain the same document:
- **H1** — "Product Overview" with paragraph description of Nova Platform
- **H2** — "Key Features" with bulleted list (analytics, reporting, AI insights)
- **H2** — "Pricing" with 3-column table (Plan / Price / Users)
- **H2** — "Customer Success" with paragraph containing citation phrase

Use these fixtures when you need to assert on parsed document structure — the
content is stable and the structure is well-defined.

### e2e-sample.html

Intentionally minimal — only headings and plain `<p>` tags. Use for E2E tests
that verify the pipeline end-to-end without depending on complex document
structure.

## How tests use them

Tests will be skipped if files are missing — add fixtures incrementally.

```typescript
const exists = await fs.access(filepath).then(() => true).catch(() => false);
const itFixture = exists ? it : it.skip;
```

## API Keys Required

Tests hit real external services. Set these env vars:

| Variable | Service | Sign up |
|----------|---------|---------|
| `FIRECRAWL_API_KEY` | Firecrawl (website scraping) | https://firecrawl.dev |
| `GROQ_API_KEY` | Groq (LLM extraction) | https://console.groq.com |

Tests skip gracefully if keys aren't set.
