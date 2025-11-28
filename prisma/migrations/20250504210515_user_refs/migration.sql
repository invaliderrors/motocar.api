/*
  Warnings:

  - Added the required column `refID` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refPhone` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "refID" TEXT NOT NULL,
ADD COLUMN     "refName" TEXT NOT NULL,
ADD COLUMN     "refPhone" TEXT NOT NULL;
