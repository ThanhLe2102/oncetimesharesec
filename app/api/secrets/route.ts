import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { assertReasonablePayloadSize, createSecretBodySchema } from "@/lib/payload";
import { DEFAULT_TTL_HOURS } from "@/lib/constants";
import { Prisma } from "@prisma/client";

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
          data: { usedAt: new Date(), secretId: id },
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
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // Common dev mistake: code changed but DB wasn't migrated (missing table/column).
      if (e.code === "P2021" || e.code === "P2022") {
        return NextResponse.json(
          {
            error:
              "Database schema is out of date. Run `npx prisma migrate deploy` (or `npx prisma migrate dev`) and try again.",
            code: e.code,
          },
          { status: 500 },
        );
      }
    }
    // Ensure the client always gets JSON (mobile otherwise sees "Could not store secret").
    console.error("Failed to store secret", e);
    return NextResponse.json({ error: "Internal error storing secret" }, { status: 500 });
  }

  return NextResponse.json({ id, expiresAt: expiresAt.toISOString() });
}
