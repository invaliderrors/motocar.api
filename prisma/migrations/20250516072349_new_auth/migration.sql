-- AlterTable
ALTER TABLE "Owners" ADD COLUMN     "lastAccess" TIMESTAMP(3),
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';
