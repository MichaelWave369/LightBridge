# LightBridge recovery ledger

**Recovery event:** 2026-10-12  
**Custody status:** Local conversation uploads, not imported to GitHub as of this ledger.  
**Authority:** Human-reviewed recovery and release only.

## Source archive inventory

| Source filename | SHA-256 of uploaded ZIP | Non-directory files | Uncompressed bytes |
| --- | --- | ---: | ---: |
| `Parallax_LightBridge_v0.1.0_Candidate_Bundle.zip` | `d8b8e905832347e0c4102fea1880b64d29edfbd7576c7e395229e6b6f437c103` | 77 | 1,995,091 |
| `lightbridge-stack21-v0.2.zip` | `3d6655d6aba417f71b020ac80d964321a268a94a9c4b54c88b9c21389098d89a` | 10 | 43,220 |

Hashes identify **these exact uploaded ZIP files**, not another archive with a similar name. The archives remain the source-of-record; any working tree should be compared with their contents.

## Observed local execution, 2026-10-12

- The extracted v0.1.0 candidate: `npm run check` returned exit 0 and **9 passing Node tests**. Covered loss/duplicate/order recovery, optional encryption, wrong passphrase, frame checksum, SHA-256 rejection, source hash, size guards, session isolation, and receipt sanitization.
- The extracted STACK-21 v0.2 candidate: `node tests.mjs` returned exit 0. It checked Walsh orthogonality, 16 optical symbols, packet framing/CRC, lane assignment, and a **stochastic** 100-iteration impairment simulation. One observed run yielded **99/100** recovered simulated packets. The test's acceptance threshold is **at least 95/100**, not a guaranteed 100/100.
- **No physical camera transfer** was performed in this recovery session.

These software checks are not security certification, optical throughput measurement, or device-compatibility evidence.

## Proposed original import locations

- `apps/qr-transfer-v0.1/` for the complete *unchanged* v0.1.0 bundle contents.
- `experiments/stack21-v0.2/` for the complete *unchanged* STACK-21 bundle contents.
- `research/` may later hold selected architecture documents only after separate publication review.

**Do not silently replace original source files, receipts, logs, or third-party licensing when importing.** Retain the v0.1 historical `LICENSE-NOTICE.md` unchanged, and add a pointer to the subsequent MIT decision. A copy in a repository is not the same as a verified device run.

## Release blockers

1. **MIT license decided** for authorized original LightBridge code on 2026-10-12; the recovered v0.1 notice is a historical record. Attribution review and application during code import remain outstanding. See [license decision](LICENSE-DECISION.md).
2. Third-party QR encoder notices and obligations require review.
3. `BarcodeDetector` varies by browser and device; no universal camera receiver is proven.
4. Identity binding, digital signatures, replay protection, permission review, and abuse handling are deferred.
5. No signed receipts, penetration test, two-device matrix, or reproducible physical throughput report.

## Next recovery gate

Import both original directories through a reviewable PR, verify representative file hashes against these ZIPs, add CI that **actually runs** both software suites, and preserve the original evidence directories as historical records.
