"""Offline tests for source recovery importer; no external source ZIP required."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from zipfile import ZipFile

S = importlib.util.spec_from_file_location("import_recovered", Path(__file__).parents[1] / "tools" / "import_recovered.py")
mod = importlib.util.module_from_spec(S)
S.loader.exec_module(mod)


def make_archive(path, root, files):
    with ZipFile(path, "w") as z:
        for filename, content in files.items():
            z.writestr(f"{root}/{filename}", content)


class ImporterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.qr = self.root / "qr.zip"
        self.stack = self.root / "stack.zip"
        self.work = self.root / "working"
        self.work.mkdir()
        make_archive(self.qr, "QR", {"index.html": b"hello"})
        make_archive(self.stack, "STACK", {"codec.js": b"42"})
        self.policies = {
            "qr": {"sha256": mod.archive_digest(self.qr), "source_root": "QR", "destination": "apps/qr-transfer-v0.1", "count": 1},
            "stack": {"sha256": mod.archive_digest(self.stack), "source_root": "STACK", "destination": "experiments/stack21-v0.2", "count": 1},
        }
        self.patch = patch.object(mod, "ARCHIVES", self.policies)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def test_copy_and_idempotent(self):
        result = mod.run(self.qr, self.stack, self.work)
        self.assertEqual(len(result["files"]), 2)
        self.assertEqual((self.work / "apps/qr-transfer-v0.1/index.html").read_bytes(), b"hello")
        mod.run(self.qr, self.stack, self.work)

    def test_dry_run_creates_nothing(self):
        mod.run(self.qr, self.stack, self.work, dry_run=True)
        self.assertEqual(list(self.work.iterdir()), [])

    def test_wrong_hash_rejected_without_writing(self):
        self.policies["stack"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "Wrong archive SHA-256"):
            mod.run(self.qr, self.stack, self.work)
        self.assertEqual(list(self.work.iterdir()), [])

    def test_unexpected_path_rejected(self):
        make_archive(self.qr, "EVIL", {"index.html": b"payload"})
        self.policies["qr"]["sha256"] = mod.archive_digest(self.qr)
        with self.assertRaisesRegex(ValueError, "Unexpected or unsafe"):
            mod.run(self.qr, self.stack, self.work)

    def test_duplicate_rejected(self):
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with ZipFile(self.qr, "w") as z:
                z.writestr("QR/index.html", b"a")
                z.writestr("QR/index.html", b"b")
        self.policies["qr"]["sha256"] = mod.archive_digest(self.qr)
        self.policies["qr"]["count"] = 2
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            mod.run(self.qr, self.stack, self.work)

    def test_preexisting_file_never_overwritten(self):
        dest = self.work / "apps/qr-transfer-v0.1/index.html"
        dest.parent.mkdir(parents=True)
        dest.write_text("modified")
        with self.assertRaisesRegex(ValueError, "Refusing to overwrite"):
            mod.run(self.qr, self.stack, self.work)
        self.assertEqual(dest.read_text(), "modified")

    def test_modified_manifest_rejected(self):
        mod.run(self.qr, self.stack, self.work)
        manifest = self.work / "RECOVERED-FILE-SHA256.json"
        manifest.write_text("changed")
        with self.assertRaisesRegex(ValueError, "manifest"):
            mod.run(self.qr, self.stack, self.work)


if __name__ == "__main__":
    unittest.main()
