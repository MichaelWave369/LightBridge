# Original source import: draft PR #4

**HOLD: do not merge yet.** This PR adds the local staging helper and import instructions. It does not yet contain the recovered optical application source.

## Source scope

- QR candidate: 77 original files from Parallax_LightBridge_v0.1.0_Candidate_Bundle.zip into apps/qr-transfer-v0.1/
- STACK-21 candidate: 10 original files from lightbridge-stack21-v0.2.zip into experiments/stack21-v0.2/
- RECOVERED-FILE-SHA256.json: an exact-byte recovery manifest
- Original ZIP files: stay untouched in the original download/archive locations

## Windows PowerShell

From your preferred new working folder, with both original ZIPs in Downloads:

~~~powershell
git clone https://github.com/MichaelWave369/LightBridge.git
cd LightBridge
git switch --track origin/recovery/import-original-sources
.\tools\stage_original_import.ps1
~~~

If the ZIPs are in a different directory, supply -SourceDirectory:

~~~powershell
.\tools\stage_original_import.ps1 -SourceDirectory "D:\MyArchives"
~~~

The script checks the repository branch and clean state, verifies both ZIP hashes, invokes the copy-only importer, confirms all 87 recovered output hashes and vendor notices, runs both original Node suites, and stages only the source trees and manifest.

**The helper never pushes to GitHub.** Inspect all 87 files, especially screenshots, logs and receipts. When approved for this **public** repository:

~~~powershell
git diff --cached --stat
git commit -m "recovery: import original optical candidates unchanged"
git push -u origin recovery/import-original-sources
~~~

The already-open draft PR #4 will update after that push.

## Review gate

- [ ] Source application directories and recovered manifest have been committed.
- [ ] CI actually runs both source software suites successfully.
- [ ] 87 original files match the hash manifest.
- [ ] Historical license notice and third-party QR notices are retained.
- [ ] Logs, images, sample receipts and other archival material are reviewed for public distribution.
- [ ] Mark PR ready for review only after all above checks pass.

A successful software test does not establish physical camera transfer, secure pairing, or PorchTalk interoperability.
