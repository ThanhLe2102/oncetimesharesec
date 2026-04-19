import { z } from "zod";
import { CRYPTO_VERSION } from "@/lib/crypto-version";

export const encryptedBundleSchema = z.object({
  salt: z.string().min(1),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
  version: z.literal(CRYPTO_VERSION),
});

export type EncryptedBundle = z.infer<typeof encryptedBundleSchema>;

export function assertReasonablePayloadSize(bundle: EncryptedBundle): void {
  const total = bundle.salt.length + bundle.iv.length + bundle.ciphertext.length;
  if (total > 2_000_000) {
    throw new Error("Payload too large");
  }
}

export const createSecretBodySchema = z.object({
  salt: z.string().min(1),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
  version: z.literal(CRYPTO_VERSION),
  pairingToken: z.string().min(8).optional(),
  ttlHours: z.number().int().min(1).max(720).optional(),
});

export type CreateSecretBody = z.infer<typeof createSecretBodySchema>;
