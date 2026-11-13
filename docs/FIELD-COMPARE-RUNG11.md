# LightBridge Rung 11: Local Field Compare

Field Compare combines the existing **Rung 10 field-event logs** with the **Optical Lab synthetic results** without changing PLB1, camera capture, encryption, receiver integrity checks, or archived recovery sources.

## Use

1. Follow the human-operated real-device procedure in [FIELD-LOGS-RUNG10.md](FIELD-LOGS-RUNG10.md).
2. Export both the sender field log and receiver field log. Keep logs from failed or incomplete sessions as well.
3. Open the **Field Compare** tab. Select both local JSON files and, optionally, a synthetic-channel JSON export from Optical Lab.
4. Compare matching session IDs and inspect unique sequences, camera/manual paths, log truncation, warnings, and any local receiver verification claim.
5. Export the derived JSON summary. Retain original logs separately for evidence review.

## Evidence boundaries

- The logged sender event means **QR generated for display**. It does not prove screen emission, sufficient display duration, or that a remote camera could see it.
- A camera-path receive event is a **browser-local claim**, not independent hardware attestation. A manually pasted frame is not a camera observation.
- **Recorded camera overlap** means distinct camera-observed frame sequence IDs also found among the sender's logged generated sequence IDs, divided by the sender's unique generated sequence count. It is NOT measured optical frame loss, physical delivery rate, or throughput.
- Frames observed but absent from the sender log can reflect missing/truncated logs, protocol timing, or inconsistent self-reported data; they are not proof of tampering.
- Independent device monotonic clocks are not synchronized. Do not derive one-way latency by subtracting their timestamps.
- A receiver's stored verification event claims that its local byte hash check succeeded. This analyzer does not independently rerun SHA-256 on source or received file bytes.
- Synthetic modelled drops and observed camera sequence overlap are different metrics, displayed separately and never combined into a physical-channel estimate.
- JSON logs and reports are unsigned and editable. There is no sender identity, pairing authorization, user consent attestation, quantum networking, atomic cooling, or proof of delivered optical/electrical power.

## Privacy and limits

Files are parsed locally in the browser and are not sent to any server by Field Compare. Each import must be JSON no larger than 4 MiB. Invalid schemas, malformed events and mismatched nonempty session IDs are refused. The summary includes only derived counts, warnings, and bounded metadata, not payload frames, passphrases, private keys, free-form user notes or camera images.

## Verification

Run from the repository: cd site && npm run check. Automated tests cover camera/manual separation, duplicate observations, incomplete sessions, mismatched sessions, missing sender sequence evidence, truncated logs, invalid inputs and optional synthetic-report consistency.

Physical evidence gates remain in [PHYSICAL-TEST-GATES.md](PHYSICAL-TEST-GATES.md). This software analysis feature does not establish a completed physical transfer.
