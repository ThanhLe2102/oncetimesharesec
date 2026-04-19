import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { assertReasonablePayloadSize, createSecretBodySchema } from "@/lib/payload";
import { DEFAULT_TTL_HOURS } from "@/lib/constants";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSecretBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  try {
    assertReasonablePayloadSize(body);
  } catch {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const ttlHours = body.ttlHours ?? DEFAULT_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const id = nanoid(24);

  try {
    await prisma.$transaction(async (tx) => {
      if (body.pairingToken) {
        const pair = await tx.pairingSession.findFirst({
          where: {
            token: body.pairingToken,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (!pair) {
          throw new Error("PAIRING_INVALID");
        }
        await tx.pairingSession.update({
          where: { id: pair.id },
          data: { usedAt: new Date() },
        });
      }

      await tx.secret.create({
        data: {
          id,
          salt: body.salt,
          iv: body.iv,
          ciphertext: body.ciphertext,
          version: body.version,
          expiresAt,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "PAIRING_INVALID") {
      return NextResponse.json({ error: "Invalid or expired pairing session" }, { status: 400 });
    }
    throw e;
  }

  return NextResponse.json({ id, expiresAt: expiresAt.toISOString() });
}
