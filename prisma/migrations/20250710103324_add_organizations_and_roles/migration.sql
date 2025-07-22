-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING_APPROVAL', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DoctorVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'MLT';
ALTER TYPE "UserRole" ADD VALUE 'HOSPITAL_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'PHARMACY_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'LAB_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'INSURANCE_ADMIN';
ALTER TYPE "UserRole" ADD VALUE 'INSURANCE_AGENT';
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "doctor_profiles" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "verificationDocuments" TEXT[],
ADD COLUMN     "verificationStatus" "DoctorVerificationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hospitalId" TEXT,
ADD COLUMN     "insuranceId" TEXT,
ADD COLUMN     "laboratoryId" TEXT,
ADD COLUMN     "pharmacyId" TEXT;

-- CreateTable
CREATE TABLE "mlt_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "certifications" TEXT[],
    "specializations" TEXT[],
    "workingHours" JSONB,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mlt_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "description" TEXT,
    "specialties" TEXT[],
    "bedCount" INTEGER,
    "emergencyServices" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3),
    "accreditation" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "adminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "description" TEXT,
    "operatingHours" JSONB,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3),
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "adminUserId" TEXT,
    "hospitalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboratories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "description" TEXT,
    "testTypes" TEXT[],
    "operatingHours" JSONB,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3),
    "accreditation" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "adminUserId" TEXT,
    "hospitalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboratories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "description" TEXT,
    "coverageTypes" TEXT[],
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3),
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "adminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mlt_profiles_userId_key" ON "mlt_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mlt_profiles_licenseNumber_key" ON "mlt_profiles"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_registrationNumber_key" ON "hospitals"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_licenseNumber_key" ON "hospitals"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacies_registrationNumber_key" ON "pharmacies"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacies_licenseNumber_key" ON "pharmacies"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "laboratories_registrationNumber_key" ON "laboratories"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "laboratories_licenseNumber_key" ON "laboratories"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_companies_registrationNumber_key" ON "insurance_companies"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_companies_licenseNumber_key" ON "insurance_companies"("licenseNumber");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "pharmacies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "laboratories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "insurance_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mlt_profiles" ADD CONSTRAINT "mlt_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacies" ADD CONSTRAINT "pharmacies_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboratories" ADD CONSTRAINT "laboratories_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
