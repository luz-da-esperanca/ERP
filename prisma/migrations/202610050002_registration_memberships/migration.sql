-- CreateTable
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "birthDate" DATE,
    "sex" VARCHAR(100),
    "cpf" VARCHAR(11),
    "rg" VARCHAR(30),
    "occupation" VARCHAR(100),
    "educationLevel" VARCHAR(100),
    "contactPhone" VARCHAR(50),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "mergedIntoId" UUID,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMembership" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "relationshipToReference" VARCHAR(100),
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMPTZ(3) NOT NULL,
    "validUntil" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersededById" UUID,

    CONSTRAINT "FamilyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_cpf_idx" ON "Person"("cpf");

-- CreateIndex
CREATE INDEX "FamilyMembership_personId_validFrom_idx" ON "FamilyMembership"("personId", "validFrom");

-- CreateIndex
CREATE INDEX "FamilyMembership_familyId_validFrom_idx" ON "FamilyMembership"("familyId", "validFrom");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMembership" ADD CONSTRAINT "FamilyMembership_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "FamilyMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
