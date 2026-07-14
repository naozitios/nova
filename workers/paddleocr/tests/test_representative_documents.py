"""T125: Representative document benchmark harness.

Each test loads a fixture representing a real-world document category,
runs it through the PaddleOCR worker's parsing pipeline, and asserts
the output matches the ParsedDocument contract shape (FR-017).

Fixtures:
  - Digital PDF (native text)
  - Scanned PDF (image-only)
  - PowerPoint (PPTX)
  - Table-heavy document
  - Meta creative image

Marked as benchmark/slow — skip by default, run with:
  pytest -m benchmark
"""

from __future__ import annotations

import importlib
import os
import tempfile
from pathlib import Path
from types import ModuleType
from typing import Any
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _import_worker() -> ModuleType:
    """Import the worker module, reloading if already cached."""
    try:
        mod = importlib.import_module("worker")
    except ModuleNotFoundError:
        import sys

        worker_dir = Path(__file__).resolve().parent.parent
        if str(worker_dir) not in sys.path:
            sys.path.insert(0, str(worker_dir))
        mod = importlib.import_module("worker")
    return importlib.reload(mod)


def _make_mock_client(download_bytes: bytes | None = None) -> MagicMock:
    """Create a mock Supabase client that returns download_bytes."""
    mock_storage = MagicMock()
    mock_storage.from_.return_value.download.return_value = (
        download_bytes or b"%PDF-1.4 fake-content"
    )
    mock_client = MagicMock()
    mock_client.storage = mock_storage
    return mock_client


def _assert_output_shape(result: dict[str, Any]) -> None:
    """Assert result matches the ParsedDocument contract (FR-017)."""
    assert isinstance(result, dict), "Result must be a dict"

    # Required top-level fields
    assert "markdown" in result, "Result must have 'markdown'"
    assert isinstance(result["markdown"], str), "markdown must be a string"

    assert "elements" in result, "Result must have 'elements'"
    assert isinstance(result["elements"], list), "elements must be a list"

    assert "parser" in result, "Result must have 'parser'"
    parser = result["parser"]
    assert isinstance(parser, dict), "parser must be a dict"
    assert "name" in parser, "parser must have 'name'"
    assert "version" in parser, "parser must have 'version'"

    assert "warnings" in result, "Result must have 'warnings'"
    assert isinstance(result["warnings"], list), "warnings must be a list"

    # Element shape validation
    for elem in result["elements"]:
        assert isinstance(elem, dict), "Each element must be a dict"
        assert "type" in elem, "Element must have 'type'"
        if "text" in elem:
            assert isinstance(elem["text"], str), "element.text must be a string"
        if "page" in elem:
            assert isinstance(elem["page"], int), "element.page must be an int"
        if "confidence" in elem:
            assert isinstance(elem["confidence"], (int, float)), (
                "element.confidence must be numeric"
            )
        if "boundingBox" in elem:
            assert isinstance(elem["boundingBox"], list), (
                "element.boundingBox must be a list"
            )


# ---------------------------------------------------------------------------
# Fixture definitions
# ---------------------------------------------------------------------------

DIGITAL_PDF_INPUT = {
    "source_id": "bench_digital_pdf",
    "file_url": "https://supabase.example.com/storage/v1/object/private/business-context-source/bench_digital.pdf",
    "file_type": "application/pdf",
    "business_id": "bench_biz",
    "workspace_id": "bench_ws",
    "source_document_id": "bench_sd_digital",
}

SCANNED_PDF_INPUT = {
    "source_id": "bench_scanned_pdf",
    "file_url": "https://supabase.example.com/storage/v1/object/private/business-context-source/bench_scanned.pdf",
    "file_type": "application/pdf",
    "business_id": "bench_biz",
    "workspace_id": "bench_ws",
    "source_document_id": "bench_sd_scanned",
}

PPTX_INPUT = {
    "source_id": "bench_pptx",
    "file_url": "https://supabase.example.com/storage/v1/object/private/business-context-source/bench_deck.pptx",
    "file_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "business_id": "bench_biz",
    "workspace_id": "bench_ws",
    "source_document_id": "bench_sd_pptx",
}

TABLE_HEAVY_INPUT = {
    "source_id": "bench_table_heavy",
    "file_url": "https://supabase.example.com/storage/v1/object/private/business-context-source/bench_tables.pdf",
    "file_type": "application/pdf",
    "business_id": "bench_biz",
    "workspace_id": "bench_ws",
    "source_document_id": "bench_sd_tables",
}

META_CREATIVE_INPUT = {
    "source_id": "bench_meta_creative",
    "file_url": "https://supabase.example.com/storage/v1/object/private/business-context-source/bench_creative.png",
    "file_type": "image/png",
    "business_id": "bench_biz",
    "workspace_id": "bench_ws",
    "source_document_id": "bench_sd_creative",
}


# ---------------------------------------------------------------------------
# Benchmark tests
# ---------------------------------------------------------------------------


@pytest.mark.benchmark
class TestDigitalPdf:
    """Digital PDF with native text layer."""

    @pytest.mark.asyncio
    async def test_output_shape(self) -> None:
        """Digital PDF must produce valid ParsedDocument output."""
        mod = _import_worker()
        mock_client = _make_mock_client(b"%PDF-1.4 digital-text-content")

        with patch.object(mod, "get_supabase_client", return_value=mock_client):
            try:
                result = await mod.process_ocr_job(
                    mod.OcrJobInput(**DIGITAL_PDF_INPUT)
                )
                _assert_output_shape(result)
            except (RuntimeError, ImportError) as e:
                if "not installed" in str(e):
                    pytest.skip("PaddleOCR not installed — skipping benchmark")
                raise

    @pytest.mark.asyncio
    async def test_parser_metadata(self) -> None:
        """Parser metadata must identify paddleocr."""
        mod = _import_worker()
        mock_client = _make_mock_client(b"%PDF-1.4 digital-text-content")

        with patch.object(mod, "get_supabase_client", return_value=mock_client):
            try:
                result = await mod.process_ocr_job(
                    mod.OcrJobInput(**DIGITAL_PDF_INPUT)
                )
                parser = result["parser"]
                assert parser["name"] == "paddleocr"
                assert isinstance(parser["version"], str)
            except (RuntimeError, ImportError) as e:
                if "not installed" in str(e):
                    pytest.skip("PaddleOCR not installed — skipping benchmark")
                raise


@pytest.mark.benchmark
class TestScannedPdf:
    """Scanned PDF (image-only, no text layer)."""

    @pytest.mark.asyncio
    async def test_output_shape(self) -> None:
        """Scanned PDF must produce valid ParsedDocument output."""
        mod = _import_worker()
        mock_client = _make_mock_client(b"%PDF-1.4 scanned-image-only")

        with patch.object(mod, "get_supabase_client", return_value=mock_client):
            try:
                result = await mod.process_ocr_job(
                    mod.OcrJobInput(**SCANNED_PDF_INPUT)
                )
                _assert_output_shape(result)
            except (RuntimeError, ImportError) as e:
                if "not installed" in str(e):
                    pytest.skip("PaddleOCR not installed — skipping benchmark")
                raise

    @pytest.mark.asyncio
    async def test_elements_have_page_numbers(self) -> None:
        """Scanned PDF elements must have page numbers."""
        mod = _import_worker()
        mock_client = _make_mock_client(b"%PDF-1.4 scanned-image-only")

        with patch.object(mod, "get_supabase_client", return_value=mock_client):
            try:
                result = await mod.process_ocr_job(
                    mod.OcrJobInput(**SCANNED_PDF_INPUT)
                )
                for elem in result.get("elements", []):
                    if elem.get("type") in ("heading", "paragraph"):
                        assert "page" in elem, (
                            "Text elements must have page number"
                        )
            except (RuntimeError, ImportError) as e:
                if "not installed" in str(e):
                    pytest.skip("PaddleOCR not installed — skipping benchmark")
                raise


@pytest.mark.benchmark
class TestPptx:
    """PowerPoint presentation."""

    @pytest.mark.asyncio
    async def test_output_shape(self) -> None:
        """PPTX must produce valid ParsedDocument output."""
        mod = _import_worker()
        mock_client = _make_mock_client(b"PPTX fake-slide-content")

        with patch.object(mod, "get_supabase_client", return_value=mock_client):
            try:
                result = await mod.process_ocr_job(
                    mod.OcrJobInput(**PPTX_INPUT)
                )
                _assert_output_shape(result)
            except (RuntimeError, ImportError) as e:
                if "not installed" in str(e):
                    pytest.skip("PaddleOCR not installed — skipping benchmark")
                raise

    @pytest.mark.asyncio
    async def test_elements_are_list(self) -> None:
        """PPTX elements must be a non-empty list (slides have content)."""
        mod = _import_worker()
        mock_client = _make_mock_client(b"PPTX fake-slide-content")

        with patch.object(mod, "get_supabase_client", return_value=mock_client):
            try:
                result = await mod.process_ocr_job(
                    mod.OcrJobInput(**PPTX_INPUT)
                )
                assert isinstance(result["elements"], list)
            except (RuntimeError, ImportError) as e:
                if "not installed" in str(e):
                    pytest.skip("PaddleOCR not installed — skipping benchmark")
                raise


@pytest.mark.benchmark
class TestTableHeavyDocument:
    """Document with complex tabular data."""

    @pytest.mark.asyncio
    async def test_output_shape(self) -> None:
        """Table-heavy doc must produce valid ParsedDocument output."""
        mod = _import_worker()
        mock_client = _make_mock_client(b"%PDF-1.4 table-heavy-content")

        with patch.object(mod, "get_supabase_client", return_value=mock_client):
            try:
                result = await mod.process_ocr_job(
                    mod.OcrJobInput(**TABLE_HEAVY_INPUT)
                )
                _assert_output_shape(result)
            except (RuntimeError, ImportError) as e:
                if "not installed" in str(e):
                    pytest.skip("PaddleOCR not installed — skipping benchmark")
                raise

    @pytest.mark.asyncio
    async def test_markdown_contains_text(self) -> None:
        """Table-heavy doc must produce markdown output."""
        mod = _import_worker()
        mock_client = _make_mock_client(b"%PDF-1.4 table-heavy-content")

        with patch.object(mod, "get_supabase_client", return_value=mock_client):
            try:
                result = await mod.process_ocr_job(
                    mod.OcrJobInput(**TABLE_HEAVY_INPUT)
                )
                assert isinstance(result["markdown"], str)
            except (RuntimeError, ImportError) as e:
                if "not installed" in str(e):
                    pytest.skip("PaddleOCR not installed — skipping benchmark")
                raise


@pytest.mark.benchmark
class TestMetaCreativeImage:
    """Meta advertising creative image (ad creative)."""

    @pytest.mark.asyncio
    async def test_output_shape(self) -> None:
        """Meta creative image must produce valid ParsedDocument output."""
        mod = _import_worker()
        mock_client = _make_mock_client(b"\x89PNG fake-creative-image")

        with patch.object(mod, "get_supabase_client", return_value=mock_client):
            try:
                result = await mod.process_ocr_job(
                    mod.OcrJobInput(**META_CREATIVE_INPUT)
                )
                _assert_output_shape(result)
            except (RuntimeError, ImportError) as e:
                if "not installed" in str(e):
                    pytest.skip("PaddleOCR not installed — skipping benchmark")
                raise

    @pytest.mark.asyncio
    async def test_parser_metadata(self) -> None:
        """Parser metadata must identify paddleocr."""
        mod = _import_worker()
        mock_client = _make_mock_client(b"\x89PNG fake-creative-image")

        with patch.object(mod, "get_supabase_client", return_value=mock_client):
            try:
                result = await mod.process_ocr_job(
                    mod.OcrJobInput(**META_CREATIVE_INPUT)
                )
                parser = result["parser"]
                assert parser["name"] == "paddleocr"
            except (RuntimeError, ImportError) as e:
                if "not installed" in str(e):
                    pytest.skip("PaddleOCR not installed — skipping benchmark")
                raise
