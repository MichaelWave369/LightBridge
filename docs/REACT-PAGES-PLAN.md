# React Pages delivery gate

**Target:** https://michaelwave369.github.io/LightBridge/

## Architecture

- `site/`: new React/Vite frontend, PLB1 sender/receiver and optional AES-GCM protection
- `site/src/protocol.js`: separate, reviewed new implementation of the recovered PLB1 framing and length-prefixed manifests
- `site/tests/`: deterministic software tests for frame checks, encrypted/unencrypted file reconstruction, parity loss recovery, session isolation
- GitHub Actions: pull-request test/build and `main` Pages publish
- Experimental STACK-21 receives an informational view **only**, not a fake optical receiver.

## Expected test stages

1. `npm run test`: local protocol software tests (not original archive's tests).
2. `npm run build`: production Vite bundle.
3. GitHub Pages deployment after owner enables Pages Actions source in repository Settings.
4. Two physical devices: camera capture under recorded test conditions with a small harmless file.
5. Compatibility gate against both original recovered ZIP implementations, separately from same-app round trips.

## Honest release status

This user-interface deployment is a *research candidate*. Without real device receipts, do not assert physical transfers are validated. Without signed identities and explicit permission controls, do not label a successful checksum "trusted peer" or "PorchTalk pairing".

If old recovered archives are later imported, preserve their original hashes and directory structure; don't replace them with the React implementation.
