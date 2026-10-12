# PorchTalk / Infinite Porch optical transport candidate

**Status: interface proposal only.** It is not implemented by LightBridge v0.1.0 or STACK-21 v0.2.

## Separation of responsibilities

| Layer | Responsibility | Never implied by it |
| --- | --- | --- |
| LightBridge | Transfer framed bytes over visible light; detect corruption | Identity, authorization, semantic truth, end-to-end reachability |
| Pairing protocol (future) | Bind explicit human-approved invitation to recipient, expiration, nonce and keys | Permission to perform unrelated operations |
| PorchTalk | Negotiate a connection with known peers and permitted transports | Automatic trust of camera-captured data |
| Infinite Porch | Apply owner's local policy to identity, memory and sharing | Public access to personal memory |
| Infinite Commons | Optional shared experience after both parties approve | Requirement for central cloud accounts |

## Candidate pairing envelope (design sketch)

```json
{
  "type": "porchtalk.pairing-invitation",
  "version": 1,
  "invitation_id": "random-id",
  "sender_public_key": "encoded-key",
  "recipient_hint": "optional",
  "created_at": "timestamp",
  "expires_at": "timestamp",
  "nonce": "random-nonce",
  "capabilities_requested": ["contact-exchange"],
  "signature": "signature-over-canonical-fields"
}
```

This is a **sketch**, not a canonical schema or compatible wire format. Never put private keys, personal memory, secrets, or bearer credentials into an unencrypted QR invitation.

## Mandatory acceptance gates before use

1. Canonical serialization and version negotiation; reject unknown critical fields.
2. Identity verification with a trusted out-of-band confirmation or other reviewed policy.
3. Real signatures from reviewed cryptographic primitives; sender public key alone is not authenticated.
4. Receiver-generated challenge or equivalent anti-replay handshake; enforce freshness and single-use invitation IDs.
5. Explicit per-capability human consent and clear revocation.
6. Encryption where confidentiality matters; assess shoulder-surfing and recording risks.
7. Typed local receipts recording what was transferred, with no assertion that the content is true or authorized unless separately witnessed.
8. Negative tests for malformed packets, hostile QR data, wrong peer, expired/replayed invites, camera loss, and mid-transfer interruption.

## Stage gates

**P0:** Recover original code and identify licenses.  
**P1:** Repeat software checks in CI.  
**P2:** Two-device optical file transfer under recorded light, distance and camera conditions.  
**P3:** Signed, human-confirmed, replay-resistant invitation prototype.  
**P4:** PorchTalk adapter behind a local feature flag.  
**P5:** Security and privacy review before wider deployment.

A passing checksum confirms bytes, not the sender or the instructions those bytes contain.
