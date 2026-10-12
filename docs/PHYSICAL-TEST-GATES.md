# Real-device proof plan

The recovered source archives include their own detailed test protocols. This short checklist separates executable software tests from the missing **physical** evidence.

## QR transfer v0.1

1. Serve over HTTPS for phones (or a valid secure context); confirm service worker pre-cache before disconnecting the network.
2. Use two real devices: a sender display and a camera-equipped receiver.
3. Transfer a harmless file; independently compare source and recovered SHA-256.
4. Record device/browser/OS, frame settings, light/distance/glare, dropped frames, time, transferred bytes and error conditions.
5. Repeat with optional passphrase encryption, wrong passphrase, interruption, stale/mixed sessions and manual-frame fallback.
6. Retain both local receipts, with screenshots/logs but **without secrets or private sample data**.

## STACK-21 v0.2

The recovered `TEST-PLAN.md` proposes chip durations **250, 200, 150, 100 ms**, measured distances **0.5 m, 1 m, 2 m**, **15° and 30°** viewing angles, and bright/dim/glare conditions.

Do not move from four to eight optical channels until one selected baseline configuration reaches:

- **99% or higher** valid packet recovery across 100 consecutive packet attempts.
- Zero false-positive successful receipts.
- Repeatable recovery after reload.
- Recorded device, distance, lighting, display/camera information, chip duration and results.

## Result classification

- `SOFTWARE_PASS`: local tests support only that modeled behavior.
- `OPTICAL_PASS`: measured transfers under declared physical conditions.
- `NO_VALID_PACKET`: no valid frame or failed integrity check.
- `UNTESTED`: a proposed feature without an execution receipt.
- `RELEASE_APPROVED`: a separate human decision, **never inferred** from software/optical success.

Keep all failed runs and environmental conditions as useful evidence.
