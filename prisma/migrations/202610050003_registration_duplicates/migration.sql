-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "addressSearch" VARCHAR(500) NOT NULL DEFAULT '',
ADD COLUMN     "nameSearch" VARCHAR(200) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "nameSearch" VARCHAR(200) NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "DataQualityIssue" (
    "id" UUID NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "entityId" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "candidateIds" UUID[],
    "fieldKeys" TEXT[],
    "identifiedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolution" VARCHAR(20),
    "resolvedBy" UUID,
    "reason" VARCHAR(1000),
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataQualityIssue_entityType_entityId_kind_idx" ON "DataQualityIssue"("entityType", "entityId", "kind");

-- AddForeignKey
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
