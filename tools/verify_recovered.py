#!/usr/bin/env python3
"""Verify original recovered files against the copy-only SHA-256 manifest."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent


def verify(root=ROOT):
    root = Path(root).resolve()
    manifest_path = root / "RECOVERED-FILE-SHA256.json"
    if not manifest_path.is_file():
        raise ValueError("Missing recovered-source hash manifest")
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("format") != "lightbridge.recovered-file-sha256.v1":
        raise ValueError("Unknown recovery manifest format")
    entries = manifest.get("files")
    if not isinstance(entries, dict) or len(entries) != 87:
        raise ValueError("Expected exactly 87 original file records")
    for name, expected in entries.items():
        if not (name.startswith("apps/qr-transfer-v0.1/") or name.startswith("experiments/stack21-v0.2/")):
            raise ValueError(f"Unexpected manifest location: {name}")
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Missing/unsafe original file: {name}")
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f"Original file changed: {name}")
    print("PASS: all 87 recovered files match the source-import manifest")


if __name__ == "__main__":
    try:
        verify()
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        sys.exit(f"RECOVERY VERIFY FAILED: {exc}")
