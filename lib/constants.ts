/** Max UTF-8 length for plaintext secret before encryption (defense in depth). */
export const MAX_SECRET_CHARS = 100_000;

/** Default hours until an unconsumed secret expires (optional TTL). */
export const DEFAULT_TTL_HOURS = 168; // 7 days

/** Pairing session lifetime (minutes). */
export const PAIRING_TTL_MINUTES = 30;
