# E2E chat — Signal Protocol (X3DH + Double Ratchet)

**Status:** wired into the app. Server stores ciphertext only.

## What runs where

| Piece | File | Notes |
|---|---|---|
| Primitives | `lib/encryption/primitives.ts` | X25519 + Ed25519 (tweetnacl), HKDF/HMAC-SHA256 + ChaCha20-Poly1305 (@noble) |
| X3DH | `lib/encryption/x3dh.ts` | identity key, signed pre-key (Ed25519-signed), one-time pre-keys, safety-number fingerprint |
| Double Ratchet | `lib/encryption/signal-protocol.ts` | spec-faithful: DH ratchet, symmetric chains, skipped keys (bounded), header as AAD, immutable state |
| Key store | `lib/encryption/signal-store.ts` | IndexedDB `piroka-signal`: identity, pre-keys, sessions, local plaintext cache |
| Sessions | `lib/encryption/signal-session.ts` | `encryptForConversation` / `decryptFromConversation`; first messages carry the X3DH init header |
| Wire format | `lib/chat/envelope.ts` | JSON envelope → UTF-8 → `bytea` hex in `dm_messages.ciphertext` |
| Key server | `app/api/keys/{publish,bundle,status}` | public bundles in `signal_identities` / `signal_one_time_prekeys`; `claim_one_time_prekey()` hands out OPKs atomically |
| Bootstrap | `components/chat/signal-bootstrap.tsx` | on app load: create identity if missing, rotate signed pre-key weekly, top up one-time keys |
| UI | `components/chat/signal-chat.tsx`, `conversation-list.tsx` | realtime via Supabase, typing presence, safety number |

## Guarantees

- Forward secrecy and post-compromise security (per-message keys, DH ratchet every turn).
- Authenticated: identity keys bound into the AAD; signed pre-keys verified before use.
- Out-of-order delivery: up to 1000 skipped keys per chain.
- Private keys never leave the browser; **Sign out** wipes the store (`clearSignalStore`).
- Message history is cached locally after decryption because ratchet keys are one-shot — a new device
  shows earlier messages as "sent from another device", exactly like Signal.

## Verified

`scratchpad/signal-test.mts` (run with `npx tsx`) checks: X3DH secret equality on both sides, out-of-order
decrypt, ratchet steps in both directions, tamper rejection. All pass.

## Known limits

- Simultaneous first-messages from both sides: the lower user id keeps its session; the other side's
  pre-reply messages show as undecryptable and it re-syncs on the next message.
- Single-device identity per browser profile; multi-device linking is not implemented.
