"""Tests for Docling convert.py."""

import json
import subprocess
import sys
from pathlib import Path

CONVERT_PY = Path(__file__).resolve().parent.parent / "convert.py"

HTML_FIXTURE = """\
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
<h1>Product</h1>
<p>This is a test document with <strong>bold</strong> content.</p>
<ul>
  <li>Item A</li>
  <li>Item B</li>
</ul>
</body>
</html>
"""


def test_valid_html_conversion(tmp_path: Path) -> None:
    """Valid HTML produces expected JSON structure on stdout."""
    fixture = tmp_path / "test.html"
    fixture.write_text(HTML_FIXTURE)

    result = subprocess.run(
        [sys.executable, str(CONVERT_PY), str(fixture)],
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, f"Expected exit 0, got {result.returncode}. stderr: {result.stderr}"
    payload = json.loads(result.stdout)
    assert "# Product" in payload["contentText"]
    assert payload["parserName"] == "docling"
    assert payload["warnings"] == []
    assert payload["pageOrSlideCount"] >= 0


def test_nonexistent_file_exits_nonzero() -> None:
    """Non-existent input file exits non-zero."""
    result = subprocess.run(
        [sys.executable, str(CONVERT_PY), "/tmp/this_file_should_not_exist_ever.html"],
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert result.stdout.strip() == ""
