-- CreateEnum
CREATE TYPE "NewsType" AS ENUM ('LOAN_SPECIFIC', 'STORE_WIDE');

-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('WORKSHOP', 'MAINTENANCE', 'ACCIDENT', 'THEFT', 'DAY_OFF', 'HOLIDAY', 'SYSTEM_MAINTENANCE', 'OTHER');

-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL,
    "type" "NewsType" NOT NULL,
    "category" "NewsCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoCalculateInstallments" BOOLEAN NOT NULL DEFAULT false,
    "daysUnavailable" INTEGER,
    "installmentsToSubtract" INTEGER,
    "storeId" TEXT NOT NULL,
    "loanId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "News_storeId_idx" ON "News"("storeId");

-- CreateIndex
CREATE INDEX "News_loanId_idx" ON "News"("loanId");

-- CreateIndex
CREATE INDEX "News_type_idx" ON "News"("type");

-- CreateIndex
CREATE INDEX "News_category_idx" ON "News"("category");

-- CreateIndex
CREATE INDEX "News_isActive_idx" ON "News"("isActive");

-- CreateIndex
CREATE INDEX "News_startDate_idx" ON "News"("startDate");

-- CreateIndex
CREATE INDEX "News_endDate_idx" ON "News"("endDate");

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
