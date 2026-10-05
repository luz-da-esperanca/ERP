-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM_BOOTSTRAP');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'ACTIVATE', 'DEACTIVATE', 'PASSWORD_CHANGE', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "UserAccount" (
    "id" UUID NOT NULL,
    "login" VARCHAR(100) NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "authVersion" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "code" VARCHAR(40) NOT NULL,
    "label" VARCHAR(100) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "userId" UUID NOT NULL,
    "roleCode" VARCHAR(40) NOT NULL,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("userId","roleCode")
);

-- CreateTable
CREATE TABLE "OperationRecord" (
    "id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "key" UUID NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "fingerprintKeyId" VARCHAR(100),
    "requestFingerprint" VARCHAR(64) NOT NULL,
    "resultReference" JSONB,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OperationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurredAt" TIMESTAMPTZ(3),
    "before" JSONB,
    "after" JSONB NOT NULL,
    "reason" VARCHAR(2000),
    "classification" VARCHAR(100) NOT NULL,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureDecision" (
    "code" VARCHAR(100) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "decisionReference" VARCHAR(2000) NOT NULL,
    "decidedAt" TIMESTAMPTZ(3) NOT NULL,
    "decidedBy" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "FeatureDecision_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_login_key" ON "UserAccount"("login");

-- CreateIndex
CREATE UNIQUE INDEX "OperationRecord_type_key_key" ON "OperationRecord"("type", "key");

-- CreateIndex
CREATE INDEX "AuditEntry_entityType_recordedAt_id_idx" ON "AuditEntry"("entityType", "recordedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEntry_entityType_entityId_revision_key" ON "AuditEntry"("entityType", "entityId", "revision");

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_roleCode_fkey" FOREIGN KEY ("roleCode") REFERENCES "Role"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationRecord" ADD CONSTRAINT "OperationRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "OperationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureDecision" ADD CONSTRAINT "FeatureDecision_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database guarantees complement request validation and transaction guards.
ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_positive_versions" CHECK ("revision" > 0 AND "authVersion" > 0);
ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_normalized_login" CHECK ("login" ~ '^[a-z0-9._-]{3,100}$');
ALTER TABLE "Role" ADD CONSTRAINT "Role_fixed_catalog" CHECK ("code" IN ('COORDINATION', 'SOCIAL_ASSISTANCE', 'ACTIVITY_MANAGER', 'ADMINISTRATOR'));
ALTER TABLE "OperationRecord" ADD CONSTRAINT "OperationRecord_actor_identity" CHECK (
  ("actorType" = 'USER' AND "actorId" IS NOT NULL) OR
  ("actorType" = 'SYSTEM_BOOTSTRAP' AND "actorId" IS NULL AND "type" = 'accounts.bootstrap')
);
CREATE UNIQUE INDEX "OperationRecord_single_bootstrap" ON "OperationRecord" ("actorType") WHERE "actorType" = 'SYSTEM_BOOTSTRAP';
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actor_identity" CHECK (
  ("actorType" = 'USER' AND "actorId" IS NOT NULL) OR
  ("actorType" = 'SYSTEM_BOOTSTRAP' AND "actorId" IS NULL AND "action" = 'CREATE' AND "entityType" = 'UserAccount' AND "revision" = 1)
);
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_positive_revision" CHECK ("revision" > 0);
ALTER TABLE "FeatureDecision" ADD CONSTRAINT "FeatureDecision_documented_reference" CHECK (length(trim("decisionReference")) > 0 AND "revision" > 0);

CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit entries are immutable';
END;
$$;
CREATE TRIGGER "AuditEntry_immutable" BEFORE UPDATE OR DELETE ON "AuditEntry" FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
