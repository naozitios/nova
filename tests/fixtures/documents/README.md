# Test Fixtures for Business Context Tests

## Documents (Option B - user-provided real files)

Drop real business documents here for parser integration tests.

### Required files:

| File | Type | Purpose |
|------|------|---------|
| `sample-website.html` | HTML | Tests HTML parser against real webpage content |
| `sample-brand-deck.pdf` | PDF | Tests PDF parser (native + OCR fallback path) |
| `sample-product-doc.docx` | DOCX | Tests Word document parser |
| `sample-campaign-data.xlsx` | XLSX | Tests Excel parser with table data |
| `sample-presentation.pptx` | PPTX | Tests PowerPoint parser (slide-level evidence) |

### Optional (for edge cases):

- `scanned-document.pdf` — image-only PDF, tests OCR fallback
- `large-table.xlsx` — many rows/columns, tests performance
- `multi-language.html` — tests Unicode handling

## How tests use them:

Tests will be skipped if files are missing — so you can add them incrementally.

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
