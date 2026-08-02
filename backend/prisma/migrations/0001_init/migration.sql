-- Initial PostgreSQL schema. Existing MongoDB data requires an explicit migration plan.
CREATE TYPE "Role" AS ENUM ('CLIENT', 'PROFESSIONAL', 'ADMIN');
CREATE TYPE "PropertyType" AS ENUM ('BUY', 'RENT');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Profile" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleTitle" TEXT,
  "location" TEXT,
  "hourlyRate" DOUBLE PRECISION,
  "bio" TEXT,
  "rating" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "reviewsCount" INTEGER NOT NULL DEFAULT 0,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "tags" TEXT[] NOT NULL,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Property" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "type" "PropertyType" NOT NULL,
  "rooms" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "tags" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
CREATE INDEX "Property_type_price_idx" ON "Property"("type", "price");
CREATE INDEX "Property_location_idx" ON "Property"("location");
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");
CREATE INDEX "Booking_profileId_date_idx" ON "Booking"("profileId", "date");

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
