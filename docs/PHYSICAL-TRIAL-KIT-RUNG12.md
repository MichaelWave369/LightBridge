# Rung 12: Physical Link Trial Kit

This rung adds a public, deterministic 256-byte sample payload in the sender UI and a guided **Trial Kit** tab. It is an operator workflow, not a claim of a completed physical test.

## Quick baseline

1. Open LightBridge **Trial Kit** on your computer display and read the sender instructions.
2. Open **Transmit** and click **Load public 256-byte test packet**. This selects harmless synthetic text, disables encryption only for that specific public packet, clears the passphrase and sets animation to 1 frame/sec. It does not start sending automatically.
3. Click **Prepare transfer**, and save the sender receipt.
4. On an independent camera-equipped device, open **Receive** over HTTPS, enter the test conditions (device label, approximate distance and lighting), grant camera access and start camera scanning.
5. On the sender, click **Start frames**. Keep the complete QR clearly visible. Start around 30 cm at a comfortable angle. Capture progress or failure.
6. When reconstruction succeeds, use **Verify & recover file** on the receiver, save its receipt and verify the public text locally.
7. Export both sender and receiver field logs, even on failure. Use **Field Compare** to inspect sequence overlap, manual versus camera observations and warnings.
8. Repeat without changing conditions first, then change one variable at a time: distance, glare, angle, or a controlled interruption.

## Safety and evidence boundaries

- The sample file contains only fixed public synthetic text. Disabling encryption is appropriate **only for this intentionally public test packet**, not arbitrary user files.
- A transfer is called successful by the receiver when its existing PLB1 integrity verification succeeds, but unsigned local logs cannot prove remote device identity.
- QR generation does not certify optical emission, and absent receiver sequences do not establish physical light loss.
- No hardware latency or packet-loss percentage is independently measured. Device clocks are unsynchronized.
- This rung adds **no automatic camera permissions** and no network server. The sender and receiver still require user interaction.
- The physical test still needs to be performed by a human with devices; tests and CI validate only the software and interface build.

## Repeat runs

Start with a 30 cm baseline, repeat under unchanged conditions, vary one condition, then try an interruption. Keep failed and incomplete sessions as real evidence.

## Verify software

From the site directory, run npm run check. Tests cover deterministic sample bytes, exact lengths, invalid packet sizes and PLB1 reconstruction plus SHA-256 verification. Existing field-log and synthetic comparison tests continue to run.
