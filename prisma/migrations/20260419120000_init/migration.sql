-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PairingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Secret_createdAt_idx" ON "Secret"("createdAt");

-- CreateIndex
CREATE INDEX "Secret_expiresAt_idx" ON "Secret"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PairingSession_token_key" ON "PairingSession"("token");

-- CreateIndex
CREATE INDEX "PairingSession_expiresAt_idx" ON "PairingSession"("expiresAt");
