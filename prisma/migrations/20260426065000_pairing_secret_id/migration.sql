-- AlterTable
ALTER TABLE "PairingSession" ADD COLUMN "secretId" TEXT;

-- CreateIndex
CREATE INDEX "PairingSession_secretId_idx" ON "PairingSession"("secretId");

