ALTER TYPE "AuditAction" ADD VALUE 'MERGE';

-- CreateTable
CREATE TABLE "IdentityMerge" (
    "id" UUID NOT NULL,
    "entityType" VARCHAR(20) NOT NULL,
    "sourceId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "operationId" UUID NOT NULL,
    "resolution" JSONB NOT NULL,

    CONSTRAINT "IdentityMerge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdentityMerge_sourceId_key" ON "IdentityMerge"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityMerge_operationId_key" ON "IdentityMerge"("operationId");

-- CreateIndex
CREATE INDEX "IdentityMerge_targetId_idx" ON "IdentityMerge"("targetId");

-- AddForeignKey
ALTER TABLE "IdentityMerge" ADD CONSTRAINT "IdentityMerge_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityMerge" ADD CONSTRAINT "IdentityMerge_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "OperationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IdentityMerge"
  ADD CONSTRAINT "IdentityMerge_valid_entity" CHECK ("entityType" IN ('PERSON', 'FAMILY')),
  ADD CONSTRAINT "IdentityMerge_distinct_identities" CHECK ("sourceId" <> "targetId");
-- A merged identity never becomes canonical again nor points to itself.
ALTER TABLE "Person" ADD CONSTRAINT "Person_not_merged_into_itself" CHECK ("mergedIntoId" IS NULL OR "mergedIntoId" <> id);
ALTER TABLE "Family" ADD CONSTRAINT "Family_not_merged_into_itself" CHECK ("mergedIntoId" IS NULL OR "mergedIntoId" <> id);

CREATE FUNCTION reject_identity_merge_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Identity merges are immutable';
END;
$$;
CREATE TRIGGER "IdentityMerge_immutable" BEFORE UPDATE OR DELETE ON "IdentityMerge" FOR EACH ROW EXECUTE FUNCTION reject_identity_merge_mutation();
