# Optical Channel Lab: Synthetic Evidence, Not an Optical Claim

## Purpose
The \`Optical Lab\` tab uses the **existing PLB1 encoder, Receiver, and finalizeTransfer** to simulate missing frames, repeated camera observations, short loss bursts and bounded arrival reordering. The sample is generated locally. No network or camera is involved.

This lab answers a limited engineering question: **does PLB1 reconstruct and verify original bytes across repeatable simulated frame schedules?** It does not measure optical throughput, light intensity, distance, hardware reliability, physical energy transfer, sender identity or security of the channel.

## Method
- Each run prepares a deterministic 512-, 2,048-, or 8,192-byte local test file, unencrypted (no passphrases).
- The model schedules up to 10 × the PLB1 block count in frame opportunities (capped at 4,096); generated frames use the existing systematic/parity formula.
- \`dropStartPct\` means the probability that a frame starts a loss burst of \`burstLength\` scheduled frames. **It is not the final loss rate.**
- \`duplicatePct\` means a surviving frame appears twice in the receive observation queue.
- \`reorderWindow\` shuffles only small windows of observations. It models limited arrival reorder; it does not simulate camera exposure or clock drift.
- Each trial gets a distinct deterministic seed and a fresh Receiver. A trial counts as verified **only after finalizeTransfer passes SHA-256 checks**.
- All failures remain in the local report. JSON exports omit payload bytes, private keys, passwords and credentials. The report is unsigned and editable.

## Interpretation and gates
- A clean-channel pass is a regression guard on code behavior, not optical validation.
- A seeded noisy-channel pass proves only the outcome of that modeled impairment.
- A failed test is evidence of an incomplete transfer under that particular schedule, not evidence of a broken physical link.
- **No modeled loss percentage may be called a measured optical packet-loss rate.**
- Never equate this lab's pass percentage with hardware reliability or with STACK-21's 99/100 **physical** packet recovery threshold.
- Physical tests should follow [PHYSICAL-TEST-GATES.md](PHYSICAL-TEST-GATES.md). A separate open PR (#6) adds operator-entered sender and receiver field logs for that phase.

## Next experiments
1. Preserve and review the independent original source archives; do not silently replace them.
2. Test real devices with sender/receiver receipts and record actual conditions.
3. Compare real-device observed-frame statistics to model distributions. Tune or replace the synthetic impairment model based on physical results.
4. Evaluate one hardware adapter at a time (QR/camera first, optional LED/photodiode later). Conventional optical links do not transmit entanglement or cool atoms.

## Run
\`\`\`bash
cd site
npm install
npm run check
\`\`\`
