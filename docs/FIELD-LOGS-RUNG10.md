# Rung 10: Device-to-device optical field logs

**Development status:** The console can record browser event logs for real camera testing, but the project maintainers have not claimed a completed two-device optical field experiment. Logs are unsigned, user-editable and self-reported. They never certify hardware or peer identity.

## Human-operated test

1. Open the LightBridge React console on a sending display (HTTPS or localhost for camera access on receiver). Prepare a small file and export the sender receipt. Select a reasonable QR frame rate, typically 1–2 fps for first tests.
2. On an independent phone or other receiving device, open LightBridge Receive, fill optional receiver setup labels (distance, lighting, device, notes) and start the camera.
3. Start the sender's animated QR. Keep the QR fully visible, steady and in focus. Note actual distance and brightness outside the software. A sender event records successful QR generation, **not guaranteed physical visibility**.
4. On the receiver observe progress. Run Verify & recover file after capture completes. Export the recovered file, receiver receipt and receiver field log. Export failed/incomplete receiver logs too.
5. Export the sender field log. Preserve original file SHA-256 and both logs. Repeat across distances, lighting levels, frame rates, and interrupted runs, retaining failures.

## Export schema

Both sides emit JSON with schema "lightbridge-field-log-v1", role "sender" or "receiver" and the PLB1 session ID. Fields include a UTC session-start label, per-device monotonic elapsed milliseconds, bounded event list, counters, and optional sanitized user-entered conditions.

Sender event "qr_generated_for_display": elapsedMs, sequence. Receiver event "frame_observed": elapsedMs, sequence, method "camera" or "manual", duplicate flag, solved blocks. Receiver also logs rejected frames, camera-start/stop, verification success/failure, captured camera scan attempt counts and local verified original SHA-256/byte count. No raw frame text, payload bytes or passphrases are placed in logs.

The logs cap stored events at 20,000; excess events increment droppedEvents. Scan attempt counts are aggregate-only to avoid filling storage.

## Interpretation

A browser camera capture path event can be a genuine user-operated optical observation, but the JSON is **not independent physical proof**: it can be forged and does not certify a second device. Sender generation events aren't proof that the QR reached the receiver. Monotonic event times cannot be subtracted across unsynchronized devices to derive one-way latency.

Use PoWE Rung 10 to analyze pairs and compare sequence membership, receiver reconstruction claims and optional sender/receiver receipts. Do not call missing sequence numbers physical channel loss because sender frame production time, screen refresh, camera scanning and parity all affect capture coverage.

No user identity, consent-based pairing, electrical energy, photovoltaic efficiency, or physical power-control permissions are authenticated by these field logs.
