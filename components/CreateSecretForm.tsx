"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { encryptSecret } from "@/lib/crypto-client";
import { CRYPTO_VERSION } from "@/lib/crypto-version";
import { MAX_SECRET_CHARS } from "@/lib/constants";

type Props = {
  initialPairingToken?: string;
};

/** Who should see the recipient link + QR after a secret is created. */
type SuccessMode = "localForm" | "desktopWaitingPoll" | "pairedPhoneInput";

export function CreateSecretForm({ initialPairingToken }: Props) {
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [ttlHours, setTtlHours] = useState(168);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; viewUrl: string } | null>(null);
  const [successMode, setSuccessMode] = useState<SuccessMode | null>(null);
  const [webCryptoOk, setWebCryptoOk] = useState(true);

  /** Only set when this page was opened from a phone QR (`/create?pair=…`). Desktop QR must not send this. */
  const [mobilePairingToken] = useState<string | null>(initialPairingToken ?? null);
  const [desktopPairingToken, setDesktopPairingToken] = useState<string | null>(null);
  const [pairingQrUrl, setPairingQrUrl] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingPolling, setPairingPolling] = useState(false);

  const [pairValid, setPairValid] = useState<boolean | null>(initialPairingToken ? null : true);

  useEffect(() => {
    const ok = Boolean(globalThis.isSecureContext && globalThis.crypto?.subtle);
    setWebCryptoOk(ok);
  }, []);

  useEffect(() => {
    if (!initialPairingToken) {
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/pairing?token=${encodeURIComponent(initialPairingToken)}`);
      if (cancelled) {
        return;
      }
      if (!res.ok) {
        setPairValid(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { usable?: boolean };
      setPairValid(data.usable === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPairingToken]);

  const startPhoneSession = useCallback(async () => {
    setPairingLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pairing", { method: "POST" });
      if (!res.ok) {
        throw new Error("Could not start phone session");
      }
      const data = (await res.json()) as { token: string };
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/create?pair=${encodeURIComponent(data.token)}`;
      setDesktopPairingToken(data.token);
      setPairingQrUrl(url);
    } catch {
      setError("Could not start phone session. Try again.");
    } finally {
      setPairingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!desktopPairingToken || success) {
      return;
    }
    let cancelled = false;
    setPairingPolling(true);

    const tick = async () => {
      try {
        const res = await fetch(`/api/pairing?token=${encodeURIComponent(desktopPairingToken)}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          valid?: boolean;
          secretId?: string | null;
          expiresAt?: string;
        };

        if (cancelled) {
          return;
        }

        if (!res.ok || data.valid !== true) {
          // Session expired/invalid.
          setPairingPolling(false);
          return;
        }

        if (data.secretId) {
          const origin = window.location.origin;
          setSuccessMode("desktopWaitingPoll");
          setSuccess({ id: data.secretId, viewUrl: `${origin}/s/${data.secretId}` });
          setPairingPolling(false);
        }
      } catch {
        // transient; keep polling
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [desktopPairingToken, success]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const bundle = await encryptSecret(secret, passphrase);
      if (bundle.version !== CRYPTO_VERSION) {
        throw new Error("Unexpected crypto version");
      }
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salt: bundle.salt,
          iv: bundle.iv,
          ciphertext: bundle.ciphertext,
          version: bundle.version,
          ttlHours,
          ...(mobilePairingToken ? { pairingToken: mobilePairingToken } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const apiError = data && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : null;
        if (apiError) {
          throw new Error(apiError);
        }
        const fallbackText = await res.text().catch(() => "");
        throw new Error(
          `Could not store secret (HTTP ${res.status}). ${fallbackText ? `Response: ${fallbackText}` : ""}`.trim(),
        );
      }
      const id = data.id as string;
      const origin = window.location.origin;
      if (mobilePairingToken) {
        setSuccessMode("pairedPhoneInput");
        setSuccess({ id, viewUrl: "" });
      } else {
        setSuccessMode("localForm");
        setSuccess({ id, viewUrl: `${origin}/s/${id}` });
      }
      setSecret("");
      setPassphrase("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success && successMode) {
    if (successMode === "pairedPhoneInput") {
      return (
        <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-lg font-medium">Encrypted secret sent</h2>
          <p className="text-sm text-[var(--muted)]">
            Your encrypted message was stored. The device that showed the QR code will display the one-time{" "}
            <span className="font-medium text-[var(--foreground)]">recipient link</span> for you to forward.
          </p>
          <p className="text-xs text-[var(--muted)]">
            The passphrase was only used on this device to encrypt. Share it with the final recipient through a
            separate trusted channel, just like when you create a link on a single device.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-medium">Secret stored</h2>
        <p className="text-sm text-[var(--muted)]">
          {successMode === "desktopWaitingPoll"
            ? "The other device finished encrypting. Send this one-time link to the recipient. It disappears after the first successful view."
            : "Send this one-time link to the recipient. It disappears after the first successful view."}
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="rounded-md bg-black/30 p-3">
            <QRCodeSVG value={success.viewUrl} size={160} level="M" includeMargin />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Recipient link
            </label>
            <div className="break-all rounded border border-[var(--border)] bg-black/20 px-3 py-2 font-mono text-sm">
              {success.viewUrl}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-[var(--accent-dim)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                onClick={() => void navigator.clipboard.writeText(success.viewUrl)}
              >
                Copy link
              </button>
              <a
                className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-3 py-2 text-sm font-medium hover:bg-white/5"
                href={success.viewUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open link
              </a>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Share the passphrase with the recipient separately (for example in person or via a trusted channel).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 text-lg font-medium">Share from this device</h2>
        {!webCryptoOk && (
          <p className="mb-4 rounded border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            Encryption is unavailable because this page is not in a secure context. Open it using{" "}
            <span className="font-mono">https://</span> (or <span className="font-mono">http://localhost</span> on the
            same machine).
          </p>
        )}
        {initialPairingToken && pairValid === false && (
          <p className="mb-4 rounded border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            This phone link is invalid or expired. Open a new phone session from the desktop page.
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="secret" className="mb-1 block text-sm font-medium">
              Secret
            </label>
            <textarea
              id="secret"
              required
              rows={6}
              maxLength={MAX_SECRET_CHARS}
              className="w-full rounded-md border border-[var(--border)] bg-black/20 px-3 py-2 font-mono text-sm outline-none ring-[var(--accent)] focus:ring-2"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Password, API key, recovery phrase…"
              disabled={pairValid === false}
            />
          </div>
          <div>
            <label htmlFor="pass" className="mb-1 block text-sm font-medium">
              Passphrase (secondary password)
            </label>
            <input
              id="pass"
              type="password"
              required
              autoComplete="off"
              className="w-full rounded-md border border-[var(--border)] bg-black/20 px-3 py-2 font-mono text-sm outline-none ring-[var(--accent)] focus:ring-2"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              disabled={pairValid === false}
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Used only in your browser to encrypt. Never uploaded.
            </p>
          </div>
          <div>
            <label htmlFor="ttl" className="mb-1 block text-sm font-medium">
              Expires after (hours, if not viewed)
            </label>
            <input
              id="ttl"
              type="number"
              min={1}
              max={720}
              className="w-full max-w-xs rounded-md border border-[var(--border)] bg-black/20 px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
              value={ttlHours}
              onChange={(e) => setTtlHours(Number(e.target.value))}
              disabled={pairValid === false}
            />
          </div>
          {error && (
            <p className="rounded border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || pairValid === false || !webCryptoOk}
            className="rounded-md bg-[var(--accent-dim)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Encrypting…" : "Create one-time link"}
          </button>
        </form>
      </section>

      {!initialPairingToken && (
        <section className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)]/60 p-6">
          <h2 className="mb-2 text-lg font-medium">Share from your phone</h2>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Start a session, then scan the QR code with your phone to open this same create page with a valid pairing
            token. Enter the secret and passphrase on the phone if you prefer not to type them on the desktop.
          </p>
          {!pairingQrUrl ? (
            <button
              type="button"
              onClick={() => void startPhoneSession()}
              disabled={pairingLoading}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-50"
            >
              {pairingLoading ? "Starting…" : "Show QR for phone"}
            </button>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="rounded-md bg-black/30 p-3">
                <QRCodeSVG value={pairingQrUrl} size={160} level="M" includeMargin />
              </div>
              <div className="min-w-0 text-sm text-[var(--muted)]">
                <p className="mb-2 font-medium text-[var(--foreground)]">Scan to open on mobile</p>
                <p className="break-all font-mono text-xs">{pairingQrUrl}</p>
                <div className="mt-3">
                  {pairingPolling ? (
                    <p className="text-xs text-[var(--muted)]" role="status">
                      Waiting for your phone to submit the encrypted secret…
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">
                      After you submit on the phone, this page will automatically show the share link.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
