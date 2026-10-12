# Import recovered source archives (after MIT licensing decision)

**Status:** This PR adds a local, copy-only importer and its unit tests. It does **not** itself contain the recovered application source. The README and license decision remain controlling.

## Original ZIPs

The two exact source files are required locally:

- Parallax_LightBridge_v0.1.0_Candidate_Bundle.zip
- lightbridge-stack21-v0.2.zip

The importer requires their exact SHA-256 hashes recorded in [the recovery ledger](RECOVERY-LEDGER.md). It refuses a changed archive, unexpected or unsafe ZIP paths, duplicate entries, and nonidentical pre-existing files.

## Windows PowerShell

From a local clone of \`MichaelWave369/LightBridge\` after this PR is merged, place the recovered ZIPs in your **Downloads** folder:

\`\`\`powershell
git switch -c recovery/import-original-sources
python tools/import_recovered.py --qr "$env:USERPROFILE\Downloads\Parallax_LightBridge_v0.1.0_Candidate_Bundle.zip" --stack "$env:USERPROFILE\Downloads\lightbridge-stack21-v0.2.zip" --dry-run
python tools/import_recovered.py --qr "$env:USERPROFILE\Downloads\Parallax_LightBridge_v0.1.0_Candidate_Bundle.zip" --stack "$env:USERPROFILE\Downloads\lightbridge-stack21-v0.2.zip"
cd apps/qr-transfer-v0.1
npm run check
cd ../../experiments/stack21-v0.2
node tests.mjs
cd ../..
git add apps/qr-transfer-v0.1 experiments/stack21-v0.2 RECOVERED-FILE-SHA256.json
git commit -m "recovery: import original optical candidates unchanged"
git push -u origin recovery/import-original-sources
\`\`\`

Then open a PR to \`main\` and review the historical logs, screenshots, and spec artifacts before making them public.

## Rights and receipts

The root MIT license applies to authorized original LightBridge code. Preserve the recovered QR candidate's historically accurate original \`LICENSE-NOTICE.md\`, plus \`THIRD_PARTY_NOTICES.md\`, the vendored Apache-2.0 license, and upstream MIT notices. Source ZIPs remain untouched.

Importer success proves the bytes match the known uploaded archives, not that LightBridge is secure, physically validated, or ready to deploy. Once source is committed, the runtime CI executes the original Node checks.

A GitHub green badge on the importer-only PR means **only the importer was tested**. Runtime checks explicitly report that source has not been committed yet.
