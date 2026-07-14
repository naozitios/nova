"""PaddleOCR worker — processes document images via PaddleOCR.

T078: Consumes OCR jobs from a queue (Supabase polling), downloads originals
from private Supabase Storage, runs PaddleOCR, writes parsed output, and
deletes temp files.

Runs outside the Next.js process as a standalone Python service.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────

PADDLEOCR_VERSION = "2.7.0.3"
DEFAULT_MODEL = "PP-StructureV3"
POLL_INTERVAL_SECONDS = 5
MAX_POLL_BATCH = 10
STORAGE_BUCKET = "business-context-source"


# ─── Data models ─────────────────────────────────────────────────────────────


@dataclass
class OcrJobInput:
    """Structured input for an OCR processing job."""

    source_id: str
    file_url: str
    file_type: str
    business_id: str = ""
    workspace_id: str = ""
    source_document_id: str = ""

    def __post_init__(self) -> None:
        if not self.source_id:
            raise ValueError("source_id is required")
        if not self.file_url:
            raise ValueError("file_url is required")
        if not self.file_type:
            raise ValueError("file_type is required")


@dataclass
class OcrElement:
    """A single OCR-detected element (text block, heading, table, etc.)."""

    type: str
    text: str = ""
    page: int | None = None
    bounding_box: list[float] | None = None
    confidence: float | None = None

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"type": self.type}
        if self.text:
            result["text"] = self.text
        if self.page is not None:
            result["page"] = self.page
        if self.bounding_box is not None:
            result["boundingBox"] = self.bounding_box
        if self.confidence is not None:
            result["confidence"] = self.confidence
        return result


@dataclass
class ParserMeta:
    """Parser identification metadata."""

    name: str = "paddleocr"
    version: str = PADDLEOCR_VERSION
    model: str = DEFAULT_MODEL


@dataclass
class OcrResult:
    """Parsed OCR output matching the ParsedDocument contract (FR-017)."""

    markdown: str = ""
    elements: list[OcrElement] = field(default_factory=list)
    parser: ParserMeta = field(default_factory=ParserMeta)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "markdown": self.markdown,
            "elements": [e.to_dict() for e in self.elements],
            "parser": {
                "name": self.parser.name,
                "version": self.parser.version,
                "model": self.parser.model,
            },
            "warnings": self.warnings,
        }


# ─── Supabase client factory ────────────────────────────────────────────────

_supabase_client: Any = None


def get_supabase_client() -> Any:
    """Return a Supabase client with service-role credentials.

    Must use service-role key to access private storage buckets (FR-016).
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    try:
        from supabase import create_client
    except ImportError:
        raise RuntimeError(
            "supabase-py is not installed. Install requirements from requirements.txt"
        )

    url = os.environ.get("SUPABASE_URL", "http://localhost:54321")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required")

    _supabase_client = create_client(url, key)
    return _supabase_client


# ─── File operations ─────────────────────────────────────────────────────────


def _download_file(file_url: str) -> str:
    """Download a file from Supabase Storage to a temp path.

    Returns the path to the downloaded file. Caller is responsible for cleanup.
    """
    client = get_supabase_client()
    # Extract storage path from the full URL
    # URL format: https://<project>.supabase.co/storage/v1/object/<bucket>/<path>
    storage_path = file_url
    if "/storage/v1/object/" in file_url:
        parts = file_url.split("/storage/v1/object/")[-1]
        # Remove 'private/' or 'public/' prefix if present
        if parts.startswith("private/"):
            parts = parts[len("private/"):]
        elif parts.startswith("public/"):
            parts = parts[len("public/"):]
        storage_path = parts

    # Download to temp file
    suffix = Path(storage_path).suffix or ".bin"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_path = tmp.name
    tmp.close()

    try:
        data = client.storage.from_(STORAGE_BUCKET).download(storage_path)
        with open(tmp_path, "wb") as f:
            f.write(data if isinstance(data, (bytes, bytearray)) else data.encode())
    except Exception:
        # Clean up on failure
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise

    return tmp_path


def _cleanup_file(path: str) -> None:
    """Remove a temp file if it exists."""
    try:
        if os.path.exists(path):
            os.unlink(path)
    except OSError as e:
        logger.warning("Failed to clean up temp file %s: %s", path, e)


# ─── OCR engine ──────────────────────────────────────────────────────────────


def _run_ocr(file_path: str, file_type: str) -> OcrResult:
    """Run PaddleOCR on a file and return structured results.

    Supports PDF, images (PNG, JPG, TIFF), and Office documents via
    PaddleOCR's PP-StructureV3 model.
    """
    warnings: list[str] = []

    try:
        from paddleocr import PaddleOCR
    except ImportError:
        raise RuntimeError(
            "paddleocr is not installed. Install requirements from requirements.txt"
        )

    ocr_engine = PaddleOCR(
        use_angle_cls=True,
        lang="en",
        show_log=False,
    )

    # Run OCR
    result = ocr_engine.ocr(file_path, cls=True)

    elements: list[OcrElement] = []
    markdown_parts: list[str] = []
    page_num = 1

    if result is None:
        warnings.append("OCR returned no results")
        return OcrResult(
            markdown="",
            elements=[],
            warnings=warnings,
        )

    # Process results — PaddleOCR returns list of pages, each with lines
    for page_result in result:
        if page_result is None:
            page_num += 1
            continue

        for line in page_result:
            if line is None or len(line) < 2:
                continue

            bbox = line[0]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
            text_info = line[1]  # (text, confidence)

            if not isinstance(text_info, (list, tuple)) or len(text_info) < 2:
                continue

            text = str(text_info[0])
            confidence = float(text_info[1]) if text_info[1] is not None else None

            # Convert bbox to flat [x, y, w, h] format
            flat_bbox: list[float] = []
            if bbox and len(bbox) >= 4:
                xs = [p[0] for p in bbox if isinstance(p, (list, tuple)) and len(p) >= 1]
                ys = [p[1] for p in bbox if isinstance(p, (list, tuple)) and len(p) >= 2]
                if xs and ys:
                    min_x, max_x = min(xs), max(xs)
                    min_y, max_y = min(ys), max(ys)
                    flat_bbox = [min_x, min_y, max_x - min_x, max_y - min_y]

            # Determine element type heuristically
            elem_type = "paragraph"
            if confidence is not None and confidence > 0.95:
                # Heuristic: short uppercase text is likely a heading
                if len(text.split()) <= 6 and text.isupper():
                    elem_type = "heading"

            elements.append(
                OcrElement(
                    type=elem_type,
                    text=text,
                    page=page_num,
                    bounding_box=flat_bbox if flat_bbox else None,
                    confidence=confidence,
                )
            )
            markdown_parts.append(text)

        page_num += 1

    markdown = "\n\n".join(markdown_parts)

    return OcrResult(
        markdown=markdown,
        elements=elements,
        warnings=warnings,
    )


# ─── Main job processor ─────────────────────────────────────────────────────


async def process_ocr_job(job_input: OcrJobInput) -> dict[str, Any]:
    """Process an OCR job end-to-end.

    1. Download the file from Supabase Storage
    2. Run PaddleOCR
    3. Return parsed output
    4. Clean up temp files (always, even on failure)
    """
    tmp_path: str | None = None

    try:
        # FR-016: Download from private Supabase Storage
        tmp_path = _download_file(job_input.file_url)

        # Run OCR
        result = _run_ocr(tmp_path, job_input.file_type)

        return result.to_dict()

    finally:
        # FR-016: Always clean up temp files
        if tmp_path:
            _cleanup_file(tmp_path)


# ─── Queue poller (standalone mode) ─────────────────────────────────────────


async def _poll_loop() -> None:
    """Poll Supabase for OCR jobs and process them.

    Intended to run as a standalone process outside Next.js.
    """
    logger.info("Starting PaddleOCR worker poll loop")
    client = get_supabase_client()

    while True:
        try:
            # Poll for queued OCR jobs
            response = (
                client.table("context_jobs")
                .select("*")
                .eq("job_type", "ocr_paddleocr")
                .eq("status", "running")
                .is_("locked_by", None)
                .limit(MAX_POLL_BATCH)
                .execute()
            )

            jobs = response.data if response.data else []

            for job in jobs:
                job_id = job.get("id", "")
                workspace_id = job.get("workspace_id", "")
                input_data = job.get("input", {})

                try:
                    job_input = OcrJobInput(
                        source_id=input_data.get("source_id", ""),
                        file_url=input_data.get("file_url", ""),
                        file_type=input_data.get("file_type", ""),
                        business_id=input_data.get("business_id", ""),
                        workspace_id=workspace_id,
                        source_document_id=input_data.get("source_document_id", ""),
                    )

                    result = await process_ocr_job(job_input)

                    # Update job as succeeded
                    client.table("context_jobs").update(
                        {
                            "status": "succeeded",
                            "output": result,
                            "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        }
                    ).eq("id", job_id).execute()

                    logger.info("Job %s succeeded", job_id)

                except Exception as e:
                    logger.error("Job %s failed: %s", job_id, e)
                    client.table("context_jobs").update(
                        {
                            "status": "failed_retryable",
                            "error_class": "provider_timeout"
                            if "timeout" in str(e).lower()
                            else None,
                            "error": {"code": "OCR_FAILED", "message": str(e)},
                        }
                    ).eq("id", job_id).execute()

        except Exception as e:
            logger.error("Poll cycle error: %s", e)

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


def main() -> None:
    """Entry point for standalone worker mode."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    asyncio.run(_poll_loop())


if __name__ == "__main__":
    main()
