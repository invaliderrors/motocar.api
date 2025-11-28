-- AlterTable
ALTER TABLE "News" ADD COLUMN     "vehicleType" "VehicleType";

-- CreateIndex
CREATE INDEX "News_vehicleType_idx" ON "News"("vehicleType");
