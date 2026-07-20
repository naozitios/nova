#!/usr/bin/env python3
"""Docling document converter. Reads a file, outputs JSON to stdout."""

import json
import sys
from pathlib import Path

try:
    from docling.document_converter import DocumentConverter
    from importlib.metadata import version as pkg_version
except ImportError as e:
    sys.stderr.write(f"Missing dependency: {e}\n")
    sys.exit(1)


def main() -> None:
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: convert.py <file_path>\n")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    if not input_path.is_file():
        sys.stderr.write(f"File not found: {input_path}\n")
        sys.exit(1)

    try:
        converter = DocumentConverter()
        result = converter.convert(input_path)
        doc = result.document

        payload = {
            "contentText": doc.export_to_markdown(),
            "parserName": "docling",
            "parserVersion": pkg_version("docling"),
            "pageOrSlideCount": len(doc.pages) if doc.pages else 0,
            "warnings": [],
            "metadata": {},
        }

        print(json.dumps(payload))

    except Exception as e:
        sys.stderr.write(f"Conversion failed: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
