-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "soatDueDate" TIMESTAMP(3),
ADD COLUMN     "technomechDueDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Vehicle_soatDueDate_idx" ON "Vehicle"("soatDueDate");

-- CreateIndex
CREATE INDEX "Vehicle_technomechDueDate_idx" ON "Vehicle"("technomechDueDate");
