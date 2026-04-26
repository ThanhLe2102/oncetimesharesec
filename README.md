# OneTime Secret Share

One-time encrypted secret sharing built with **Next.js**, **TypeScript**, **Prisma**, and **PostgreSQL**. Plaintext and passphrases are encrypted in the browser; the server stores ciphertext only.

## Features

- **E2EE**: PBKDF2 (SHA-256, 310k iterations) + AES-256-GCM in the Web Crypto API.
- **One-time link**: `/s/[id]` returns the ciphertext once, then the row is marked consumed.
- **QR for mobile entry**: Desktop can show a QR that opens `/create?pair=…` on a phone for paired submission.
- **Recipient UX**: Ctrl+C / ⌘C (or a button) opens a passphrase modal, then decrypts and copies locally.

## Prerequisites

- Node.js 20+ and npm (for local development without Docker).
- A PostgreSQL database and `DATABASE_URL` (for local dev without Docker), or Docker Desktop (see below).

## Setup (Node on the host)

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL

npm install
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Setup (Docker Compose)

Use this when you want PostgreSQL and the app in containers. On **Windows**, [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) typically runs the Linux engine via **WSL2**; you do not need to install Node on the host—only Docker.

### Install Docker on Windows

1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
2. During setup, enable **Use the WSL 2 based engine** (recommended).
3. If prompted, install or update [WSL2](https://learn.microsoft.com/windows/wsl/install) and a Linux distribution (for example Ubuntu) from the Microsoft Store.
4. In Docker Desktop **Settings → Resources → WSL integration**, enable your distro so CLI commands work from WSL terminals too.

You can run the commands below from **PowerShell**, **Command Prompt**, or a **WSL** shell. Docker Desktop must be running.

### Build and run

From the repository root (the folder that contains `docker-compose.yml`):

```bash
docker compose up --build
```

- **App:** [http://localhost:3000](http://localhost:3000)
- **PostgreSQL (host access):** `localhost:5432` — user `postgres`, password `postgres`, database `onetimesecretshare` (for GUI clients or debugging).

The `app` container runs `prisma migrate deploy` before `next start`, so tables are created automatically on first boot.

### Troubleshooting: “Internal error storing secret” (mobile / pairing flow)

If desktop “Share from this device” works but phone submission fails with **“Internal error storing secret”**, your database is usually **missing the latest migration** (for example the `PairingSession.secretId` column used by the phone pairing flow).

- **Fix (recommended):** run migrations:

```bash
npx prisma migrate deploy
```

- If you’re using Docker Compose and want a clean slate, wipe the volume and restart:

```bash
docker compose down -v
docker compose up --build
```

### Accessing from another device on your LAN (important for WebCrypto)

This app uses the browser **Web Crypto API** (`crypto.subtle`) for end-to-end encryption/decryption. Most browsers only expose `crypto.subtle` in a **secure context**:

- ✅ `https://...` (recommended)
- ✅ `http://localhost:3000` (same machine only)
- ❌ `http://<LAN-IP>:3000` (often blocked; `crypto.subtle` will be `undefined`)

For cross-device testing, use HTTPS (for example a local reverse proxy with a trusted dev cert, or a tunnel such as Cloudflare Tunnel / ngrok).

### Stop and cleanup

```bash
# Stop containers (Ctrl+C, or from another terminal:)
docker compose down

# Stop and remove the database volume (wipes local DB data)
docker compose down -v
```

### Paths: Windows drive vs WSL filesystem

Docker Desktop mounts Windows paths through a translation layer. For better file-watch and I/O performance, some teams keep the **clone inside the WSL Linux filesystem** (for example `\\wsl$\Ubuntu\home\<you>\projects\onetimesecretshare`) instead of only under `C:\Users\...`. Both work; use whichever matches how you open the project in your editor.

### Environment overrides

`docker-compose.yml` sets `DATABASE_URL` for the `app` service to point at the `db` service. To customize credentials or ports, edit `docker-compose.yml` or add a `docker-compose.override.yml` (not committed) with your changes.

## Deploying on Vercel

1. Push this repository to GitLab (or GitHub).
2. Import the project in Vercel.
3. Add the `DATABASE_URL` environment variable (e.g. Neon or Vercel Postgres).
4. Run migrations against production once:

   ```bash
   DATABASE_URL="postgresql://…" npx prisma migrate deploy
   ```

5. Deploy. The default Next.js preset runs `npm run build`.

## Documentation

- [docs/DESIGN.md](./docs/DESIGN.md) — security model, API, and data flow.

## License

MIT (add a `LICENSE` file if you need a formal declaration).
