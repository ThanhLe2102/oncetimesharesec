import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { PAIRING_TTL_MINUTES } from "@/lib/constants";

export async function POST() {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MINUTES * 60 * 1000);

  await prisma.pairingSession.create({
    data: { token, expiresAt },
  });

  return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const row = await prisma.pairingSession.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() },
    },
  });

  if (!row) {
    return NextResponse.json({ valid: false }, { status: 404 });
  }

  return NextResponse.json({
    valid: true,
    usable: row.usedAt === null,
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt ? row.usedAt.toISOString() : null,
    secretId: row.secretId ?? null,
  });
}
