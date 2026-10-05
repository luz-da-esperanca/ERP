-- CreateTable
CREATE TABLE "Family" (
    "id" UUID NOT NULL,
    "code" BIGSERIAL NOT NULL,
    "referenceName" VARCHAR(200),
    "address" VARCHAR(500),
    "neighborhood" VARCHAR(200),
    "postalCode" VARCHAR(8),
    "location" VARCHAR(10),
    "contactPhone" VARCHAR(50),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "mergedIntoId" UUID,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Family_code_key" ON "Family"("code");

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
