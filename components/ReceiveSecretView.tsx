"use client";

import { useCallback, useEffect, useState } from "react";
import { decryptSecret } from "@/lib/crypto-client";
import { CRYPTO_VERSION } from "@/lib/crypto-version";

type Bundle = {
  salt: string;
  iv: string;
  ciphertext: string;
  version: number;
};

type Props = {
  secretId: string;
};

export function ReceiveSecretView({ secretId }: Props) {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/secrets/${secretId}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setPhase("error");
          setErrorMessage(
            typeof data.error === "string" ? data.error : "This link is no longer available.",
          );
          return;
        }
        setBundle(data as Bundle);
        setPhase("ready");
      } catch {
        if (!cancelled) {
          setPhase("error");
          setErrorMessage("Network error. Try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [secretId]);

  const runDecryptAndCopy = useCallback(async () => {
    if (!bundle) {
      return;
    }
    setDecryptError(null);
    setBusy(true);
    try {
      if (bundle.version !== CRYPTO_VERSION) {
        throw new Error("Unsupported message version.");
      }
      const plain = await decryptSecret(passphrase, {
        salt: bundle.salt,
        iv: bundle.iv,
        ciphertext: bundle.ciphertext,
        version: CRYPTO_VERSION,
      });
      await navigator.clipboard.writeText(plain);
      setModalOpen(false);
      setPassphrase("");
    } catch {
      setDecryptError("Wrong passphrase or corrupted data.");
    } finally {
      setBusy(false);
    }
  }, [bundle, passphrase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "ready" || !bundle) {
        return;
      }
      const isCopy = (e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C");
      if (!isCopy) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
      setModalOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, bundle]);

  if (phase === "loading") {
    return (
      <p className="text-sm text-[var(--muted)]" role="status">
        Loading encrypted payload…
      </p>
    );
  }

  if (phase === "error") {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <p className="text-[var(--danger)]">{errorMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-lg font-medium">Encrypted one-time secret</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This message can only be decrypted with the passphrase. After you copy it once, the ciphertext is removed
          from the server.
        </p>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-[var(--muted)]">
          <li>
            Press <kbd className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">Ctrl+C</kbd> (
            <kbd className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">⌘C</kbd> on Mac) to decrypt and copy.
          </li>
          <li>Or use the button below (same steps).</li>
        </ul>
        <button
          type="button"
          className="mt-6 rounded-md bg-[var(--accent-dim)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          onClick={() => setModalOpen(true)}
        >
          Decrypt and copy
        </button>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="decrypt-title"
        >
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
            <h3 id="decrypt-title" className="text-lg font-medium">
              Enter passphrase
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Your passphrase is used locally to decrypt. It is not sent to the server.
            </p>
            <input
              type="password"
              autoComplete="off"
              className="mt-4 w-full rounded-md border border-[var(--border)] bg-black/20 px-3 py-2 font-mono text-sm outline-none ring-[var(--accent)] focus:ring-2"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runDecryptAndCopy();
                }
              }}
              autoFocus
            />
            {decryptError && (
              <p className="mt-2 text-sm text-[var(--danger)]">{decryptError}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                onClick={() => {
                  setModalOpen(false);
                  setPassphrase("");
                  setDecryptError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !passphrase}
                className="rounded-md bg-[var(--accent-dim)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void runDecryptAndCopy()}
              >
                {busy ? "Decrypting…" : "Decrypt and copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
