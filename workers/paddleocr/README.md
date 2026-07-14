# PaddleOCR Worker

Standalone Python service that processes OCR jobs for Business Context source
documents. Runs outside the Next.js process (FR-035 repository boundary).

## Architecture

```
Next.js job-runner → Supabase context_jobs table → this worker polls → PaddleOCR → output
```

## Setup

```bash
cd workers/paddleocr
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | Yes | `http://localhost:54321` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Service-role key for private storage access |

## Usage

### Standalone poller

```bash
python worker.py
```

Polls `context_jobs` for `ocr_paddleocr` type jobs with status `running` and
no `locked_by`. Processes each job and updates status to `succeeded` or
`failed_retryable`.

### As a library

```python
from worker import OcrJobInput, process_ocr_job
import asyncio

result = asyncio.run(process_ocr_job(OcrJobInput(
    source_id="src_abc123",
    file_url="https://...",
    file_type="application/pdf",
)))
```

## Contract

The worker satisfies the contract tested in `tests/test_contract.py`:

- **`OcrJobInput`** — dataclass with validated fields (source_id, file_url, file_type)
- **`OcrResult`** — dataclass with markdown, elements, parser metadata, warnings
- **`process_ocr_job()`** — async function, downloads from private Supabase Storage,
  runs OCR, returns parsed output, always cleans temp files
- **`get_supabase_client()`** — mockable factory for storage access

## Output Shape

```json
{
  "markdown": "# Page 1\n\nExtracted text...",
  "elements": [
    {
      "type": "heading",
      "text": "Page 1",
      "page": 1,
      "boundingBox": [0, 0, 100, 20],
      "confidence": 0.98
    }
  ],
  "parser": {
    "name": "paddleocr",
    "version": "2.7.0.3",
    "model": "PP-StructureV3"
  },
  "warnings": []
}
```

## Error Handling

- OCR failures → job marked `failed_retryable` (retryable per FR-039)
- Missing required fields → `ValueError` raised before processing
- Temp files cleaned up in `finally` block (FR-016)
- Secrets redacted from error payloads (FR-034)

## Resource Limits

- Default: CPU mode (`PADDLEOCR_WORKER_MODE=cpu`)
- VL model optional (`PADDLEOCR_VL_ENABLED=true`)
- Temp files auto-cleaned after each job
