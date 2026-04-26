import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.secret.findUnique({ where: { id } });
    if (!row) {
      return { kind: "not_found" as const };
    }
    const now = new Date();
    if (row.consumedAt) {
      return { kind: "gone" as const };
    }
    if (row.expiresAt && row.expiresAt < now) {
      return { kind: "gone" as const };
    }

    await tx.secret.update({
      where: { id },
      data: { consumedAt: now },
    });

    return {
      kind: "ok" as const,
      bundle: {
        salt: row.salt,
        iv: row.iv,
        ciphertext: row.ciphertext,
        version: row.version,
      },
    };
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (result.kind === "gone") {
    return NextResponse.json({ error: "This secret was already viewed or has expired." }, { status: 410 });
  }

  return NextResponse.json(result.bundle);
}
