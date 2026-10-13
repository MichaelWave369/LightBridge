#!/usr/bin/env python3
"""Copy recovered LightBridge ZIP content into versioned repository folders.

Source ZIPs are never modified. Exact SHA-256 hashes, entry count and paths
must match the original recovery record. Changed destination files are never
overwritten. This tool does not grant release approval.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
from zipfile import ZipFile, BadZipFile

ARCHIVES = {
    "qr": {
        "filename": "Parallax_LightBridge_v0.1.0_Candidate_Bundle.zip",
        "sha256": "d8b8e905832347e0c4102fea1880b64d29edfbd7576c7e395229e6b6f437c103",
        "source_root": "Parallax_LightBridge_v0.1.0",
        "destination": "apps/qr-transfer-v0.1",
        "count": 77,
    },
    "stack": {
        "filename": "lightbridge-stack21-v0.2.zip",
        "sha256": "3d6655d6aba417f71b020ac80d964321a268a94a9c4b54c88b9c21389098d89a",
        "source_root": "lightbridge-stack21-v0.2",
        "destination": "experiments/stack21-v0.2",
        "count": 10,
    },
}
MAX_UNCOMPRESSED = 16 * 1024 * 1024
MAX_FILES = 500


def digest(data):
    return hashlib.sha256(data).hexdigest()


def archive_digest(path):
    h = hashlib.sha256()
    with path.open("rb") as inp:
        for chunk in iter(lambda: inp.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def validate_entries(z, policy):
    entries, seen, total_size = [], set(), 0
    for info in z.infolist():
        if info.is_dir():
            continue
        if (info.external_attr >> 16) & 0o170000 == stat.S_IFLNK:
            raise ValueError(f"Symlink entry rejected: {info.filename}")
        parts = PurePosixPath(info.filename).parts
        if (not parts or parts[0] != policy["source_root"] or len(parts) < 2
                or info.filename.startswith("/") or "\\" in info.filename
                or any(p in ("", ".", "..") for p in parts)
                or ":" in info.filename):
            raise ValueError(f"Unexpected or unsafe archive path: {info.filename}")
        normalized = "/".join(parts[1:])
        if normalized in seen:
            raise ValueError(f"Duplicate archive member: {normalized}")
        seen.add(normalized)
        total_size += info.file_size
        if total_size > MAX_UNCOMPRESSED or len(seen) > MAX_FILES:
            raise ValueError("Archive exceeds import safety limits")
        entries.append((info, normalized))
    if len(entries) != policy["count"]:
        raise ValueError(f"Expected {policy['count']} files, found {len(entries)}")
    return entries


def plan_one(path, policy, repo_root):
    path = Path(path).expanduser().resolve()
    if not path.is_file():
        raise ValueError(f"Missing source archive: {path}")
    got = archive_digest(path)
    if got != policy["sha256"]:
        raise ValueError(f"Wrong archive SHA-256 for {path.name}: {got}")
    planned = []
    with ZipFile(path) as z:
        for info, rel in validate_entries(z, policy):
            target = repo_root / policy["destination"] / rel
            node = target
            while node != repo_root:
                if node.is_symlink():
                    raise ValueError(f"Symlink destination rejected: {node}")
                node = node.parent
            data = z.read(info)
            if len(data) != info.file_size:
                raise ValueError(f"Size mismatch: {info.filename}")
            if target.exists() and target.read_bytes() != data:
                raise ValueError(f"Refusing to overwrite changed file: {target}")
            planned.append((target, data))
    return planned


def run(qr, stack, root, dry_run=False):
    root = Path(root).resolve()
    if not root.is_dir():
        raise ValueError(f"Repository directory does not exist: {root}")
    plan = plan_one(qr, ARCHIVES["qr"], root) + plan_one(stack, ARCHIVES["stack"], root)
    entries = {}
    for target, data in plan:
        entries[target.relative_to(root).as_posix()] = digest(data)
    manifest = {
        "format": "lightbridge.recovered-file-sha256.v1",
        "archive_sha256": {k: p["sha256"] for k, p in ARCHIVES.items()},
        "files": dict(sorted(entries.items())),
    }
    manifest_path = root / "RECOVERED-FILE-SHA256.json"
    encoded = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
    if manifest_path.exists() and manifest_path.read_bytes() != encoded:
        raise ValueError(f"Refusing to overwrite existing nonmatching manifest: {manifest_path}")
    if not dry_run:
        for target, data in plan:
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                target.write_bytes(data)
        if not manifest_path.exists():
            manifest_path.write_bytes(encoded)
    print(f"{'DRY RUN' if dry_run else 'COPIED'}: {len(entries)} verified original files; manifest {manifest_path}")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--qr", required=True, help="Path to original QR v0.1 ZIP")
    parser.add_argument("--stack", required=True, help="Path to original STACK-21 v0.2 ZIP")
    parser.add_argument("--root", default=str(Path(__file__).resolve().parent.parent),
                        help="Repository root")
    parser.add_argument("--dry-run", action="store_true",
                        help="Verify original archives without writing")
    args = parser.parse_args()
    try:
        run(args.qr, args.stack, args.root, args.dry_run)
    except (ValueError, BadZipFile, OSError, RuntimeError) as exc:
        parser.exit(1, f"IMPORT FAILED: {exc}\n")


if __name__ == "__main__":
    main()
