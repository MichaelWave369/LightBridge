# Parallax LightBridge

**Offline optical transfer research and recovery workspace**

LightBridge is a local-first, screen-to-camera communications project. Its recovered **v0.1.0 browser candidate** encodes bounded file transfers as animated QR frames with optional passphrase encryption, SHA-256 checks, packet recovery, and locally exportable receipts. The separate experimental **STACK-21 v0.2** prototype studies a multiplexed light-block transport.

> **Status: RECOVERY / NOT RELEASED.** A source archive has been recovered and independently inspected, but its original code has not yet been imported into this repository. No physical two-device test, security audit, compatible-device matrix, or production approval is claimed.

## Recovered artifacts

| Candidate | Function | Known limits |
| --- | --- | --- |
| Parallax LightBridge v0.1.0 | Animated QR sender/receiver, frame recovery, optional AES-GCM, SHA-256 and receipts | 2 MiB file cap; browser camera support varies; no identity signatures |
| LightBridge STACK-21 v0.2 | 20 logical payload lanes, one control lane, four Walsh-coded optical subchannels, single visible block | Experimental physical receiver; slow symbol rate; noisy simulation is stochastic |
| Related Parallax architecture documents | Mutual-Guard Light Fabric and MirrorField bridge integrations | Adjacent research, not direct proof of optical-link performance |

The source bundles will be kept **unchanged as recovery records**. Importing or modifying their contents requires explicit review of provenance, third-party notices, licensing, and release boundaries.

## Integration direction

LightBridge may implement an **offline transport adapter** for the Infinite Porch / PorchTalk ecosystem:

1. Obtain a narrowly scoped, user-approved pairing invitation.
2. Transfer the invitation across a visible optical channel.
3. Verify transport integrity and preserve the transfer receipt.
4. Independently verify identity, consent, and replay freshness before granting access.
5. Let PorchTalk choose subsequent authorized transports.

**Transport success is not identity proof, authorization, semantic truth, or a mesh-network claim.** The optical link works only when the screen-camera path and physical conditions allow it.

## Current priorities

- Document the recovered ZIP inventories and SHA-256 hashes.
- Import both candidates into clearly labeled legacy and experimental directories without changing the originals.
- Establish automated checks for both candidates.
- Perform documented real-device transfers and failure tests.
- Apply the approved MIT license to original code; preserve third-party licenses and attribution.
- Only then design a bounded PorchTalk pairing adapter.

## License and authority

The project owner selected the **[MIT License](LICENSE)** for original LightBridge project code on 2026-10-12. The recovered v0.1.0 bundle's older `LICENSE-NOTICE.md` remains unchanged as a historical record of its former undecided status. **Third-party code retains its own licensing and notices**, including the bundled QR encoder's Apache-2.0 and upstream MIT notices. See [the license decision and attribution boundaries](docs/LICENSE-DECISION.md). MIT licensing does not imply a security audit, hardware validation, or production release.
