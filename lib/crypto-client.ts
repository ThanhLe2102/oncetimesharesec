/**
 * Browser-only E2EE helpers (Web Crypto).
 * Format version 1: PBKDF2-SHA256 (310k iter) → AES-256-GCM.
 */

import { CRYPTO_VERSION } from "@/lib/crypto-version";

export { CRYPTO_VERSION };
const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function assertWebCryptoAvailable(): void {
  // WebCrypto subtle is only available in secure contexts (HTTPS or localhost).
  if (!globalThis.isSecureContext) {
    throw new Error(
      "WebCrypto requires a secure context (HTTPS). Open this site via https:// or http://localhost.",
    );
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "WebCrypto is unavailable in this browser/context. Try a modern browser over HTTPS.",
    );
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  assertWebCryptoAvailable();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecret(
  plaintext: string,
  passphrase: string,
): Promise<{ salt: string; iv: string; ciphertext: string; version: number }> {
  assertWebCryptoAvailable();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(passphrase, salt);
  const enc = new TextEncoder();
  const buf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    enc.encode(plaintext),
  );
  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(buf)),
    version: CRYPTO_VERSION,
  };
}

export async function decryptSecret(
  passphrase: string,
  bundle: { salt: string; iv: string; ciphertext: string; version: number },
): Promise<string> {
  assertWebCryptoAvailable();
  if (bundle.version !== CRYPTO_VERSION) {
    throw new Error("Unsupported ciphertext version");
  }
  const salt = base64ToBytes(bundle.salt);
  const iv = base64ToBytes(bundle.iv);
  const ciphertext = base64ToBytes(bundle.ciphertext);
  const key = await deriveAesKey(passphrase, salt);
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new Uint8Array(ciphertext),
  );
  return new TextDecoder().decode(buf);
}
