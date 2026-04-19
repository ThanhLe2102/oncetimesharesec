# Design: OneTime Secret Share

This document describes the security model, data flow, and deployment shape of the application.

## Goals

- **One-time retrieval**: After a recipient successfully loads the ciphertext once, the server marks the record consumed and refuses further reads (HTTP 410).
- **End-to-end encryption (E2EE)**: The plaintext secret and the passphrase never leave the client in recoverable form. The server stores **only** ciphertext metadata (salt, IV, ciphertext, version).
- **Passphrase as secondary secret**: The shared link carries the identifier; the passphrase must be communicated out of band (voice, in person, another channel).
- **Mobile-friendly entry**: A short-lived **pairing token** lets a phone open `/create?pair=…` so the sender can type the secret on mobile without trusting the desktop keyboard.
- **Vercel free tier**: Stateless API routes on Vercel; **PostgreSQL** is hosted externally (Neon, Supabase, Vercel Postgres, etc.).

## Threat model (brief)

- **Server compromise**: An attacker with database access learns ciphertext, salt, IV, and expiry—not the plaintext without the passphrase.
- **TLS**: Transport security depends on HTTPS; deploy behind TLS (Vercel provides this).
- **Passphrase strength**: Offline guessing is possible against the ciphertext; users must pick a strong passphrase.
- **Clipboard**: After decryption, the plaintext exists in the device clipboard until overwritten.

## Cryptography (client-side)

All encryption runs in the browser via the **Web Crypto API**.

| Parameter | Value |
|-----------|--------|
| KDF | PBKDF2 with SHA-256, **310,000** iterations |
| Salt | 16 random bytes (unique per secret) |
| Cipher | AES-256-GCM |
| IV | 12 random bytes |
| Format version | Integer `1` (`lib/crypto-version.ts`) |

Envelope sent to the API:

- `salt`, `iv`, `ciphertext` (Base64), `version`

The passphrase is used only inside `encryptSecret` / `decryptSecret` in `lib/crypto-client.ts`.

## Server responsibilities

- **POST `/api/pairing`**: Creates a `PairingSession` row with a random token and expiry (default **30 minutes**).
- **GET `/api/pairing?token=`**: Validates that a session exists, is not used, and is not expired (for UX on `/create`).
- **POST `/api/secrets`**: Validates payload size and shape; optionally accepts `pairingToken` to consume a pairing session in the same transaction as inserting the `Secret`.
- **GET `/api/secrets/[id]`**: In one transaction, returns the ciphertext bundle if the secret exists, is not consumed, and is not expired—then sets `consumedAt`. Subsequent requests get **410 Gone**.

The server **never** sees the passphrase or plaintext.

## Data model (Prisma / PostgreSQL)

- **`Secret`**: `id` (public token in URLs), `salt`, `iv`, `ciphertext`, `version`, `createdAt`, `expiresAt`, `consumedAt`.
- **`PairingSession`**: `token`, `expiresAt`, `usedAt` (set when a secret is created with that token).

## UX flows

### Sender (desktop or mobile)

1. Enter secret + passphrase + optional TTL.
2. Client encrypts; POST stores ciphertext.
3. UI shows recipient URL `/s/[id]` and a QR code for that URL.

### Sender (phone via QR)

1. On desktop, “Show QR for phone” creates a pairing session; QR encodes `/create?pair=[token]`.
2. Phone scans, opens create page; pairing token is validated via GET `/api/pairing`.
3. On submit, POST includes `pairingToken` so the server can mark the pairing session used once.

### Recipient

1. Open `/s/[id]` once; client fetches ciphertext (server then burns the row).
2. **Ctrl+C / ⌘C** (outside input fields) or “Decrypt and copy” opens a modal for the passphrase; decryption runs locally; plaintext is copied to the clipboard.

## Deployment (Vercel)

1. Create a PostgreSQL database (managed provider with a connection string).
2. Set `DATABASE_URL` in Vercel project settings.
3. Run migrations against production: `npx prisma migrate deploy` (CI or local with `DATABASE_URL` pointing at prod—protect credentials).
4. Connect GitLab to Vercel and deploy the default Next.js build.

**Build**: `npm run build` runs `prisma generate` then `next build`.

## GitLab

The repository is intended to live on GitLab.com; CI can mirror the same `lint` / `build` / `prisma migrate deploy` steps as needed. No vendor-specific code is required beyond environment variables.

## Future hardening (optional)

- Argon2id via WASM if PBKDF2 iteration counts become a concern on low-end phones.
- Rate limiting at the edge (Vercel Firewall, Upstash) for creation and read endpoints.
- Optional password-strength meter and minimum passphrase length (UX only; does not replace strong passphrases).
