/*
  Warnings:

  - You are about to drop the column `motorcycleId` on the `Loan` table. All the data in the column will be lost.
  - You are about to drop the `Motorcycle` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `vehicleId` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('MOTORCYCLE', 'CAR', 'TRUCK', 'VAN', 'ATV', 'OTHER');

-- DropForeignKey
ALTER TABLE "public"."Loan" DROP CONSTRAINT "Loan_motorcycleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Motorcycle" DROP CONSTRAINT "Motorcycle_providerId_fkey";

-- AlterTable
ALTER TABLE "Loan" DROP COLUMN "motorcycleId",
ADD COLUMN     "vehicleId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."Motorcycle";

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'MOTORCYCLE',
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "engine" TEXT,
    "chassis" TEXT,
    "color" TEXT,
    "cc" INTEGER,
    "gps" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
