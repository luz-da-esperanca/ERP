-- Access, Audit Trail, Idempotency, Institutes, and Projects schema (C-02, C-03, PB-12)

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "login" VARCHAR(120) NOT NULL,
    "display_name" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deactivated_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_status_check" CHECK ("status" IN ('ACTIVE', 'DEACTIVATED')),
    CONSTRAINT "users_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "users_login_key" ON "users"("login");
CREATE INDEX "users_status_idx" ON "users"("status");

CREATE TABLE "user_profile_assignments" (
    "user_id" UUID NOT NULL,
    "profile" VARCHAR(48) NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_profile_assignments_pkey" PRIMARY KEY ("user_id", "profile"),
    CONSTRAINT "user_profile_assignments_profile_check" CHECK (
        "profile" IN (
            'COORDINATOR',
            'SOCIAL_ASSISTANCE',
            'PERIODIC_ACTIVITY',
            'POINT_IN_TIME_SERVICE',
            'STOCK_DISTRIBUTION',
            'BAZAR',
            'ADMIN'
        )
    ),
    CONSTRAINT "user_profile_assignments_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "user_profile_assignments_profile_idx" ON "user_profile_assignments"("profile");

CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL,
    "idle_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sessions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

CREATE TABLE "login_attempt_states" (
    "login" VARCHAR(120) NOT NULL,
    "failed_attempts" INTEGER NOT NULL,
    "locked_until" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "login_attempt_states_pkey" PRIMARY KEY ("login"),
    CONSTRAINT "login_attempt_states_failed_attempts_check" CHECK ("failed_attempts" >= 0)
);

CREATE TABLE "institutes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "institutes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institutes_code_key" ON "institutes"("code");
CREATE UNIQUE INDEX "institutes_name_key" ON "institutes"("name");

CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(1000),
    "start_date" VARCHAR(10) NOT NULL,
    "end_date" VARCHAR(10),
    "status" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "projects_status_check" CHECK ("status" IN ('PLANNED', 'ACTIVE', 'CLOSED')),
    CONSTRAINT "projects_period_check" CHECK ("end_date" IS NULL OR "end_date" > "start_date"),
    CONSTRAINT "projects_version_check" CHECK ("version" >= 1)
);

CREATE INDEX "projects_status_idx" ON "projects"("status");
CREATE INDEX "projects_name_idx" ON "projects"("name");

CREATE TABLE "project_institutes" (
    "project_id" UUID NOT NULL,
    "institute_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "project_institutes_pkey" PRIMARY KEY ("project_id", "institute_id"),
    CONSTRAINT "project_institutes_project_id_fkey"
        FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_institutes_institute_id_fkey"
        FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "project_institutes_institute_id_idx" ON "project_institutes"("institute_id");

CREATE TABLE "audit_entries" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "fact_date" VARCHAR(10) NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(48) NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "reason" VARCHAR(1000),
    "operation_id" UUID,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_entries_entity_type_entity_id_idx" ON "audit_entries"("entity_type", "entity_id");
CREATE INDEX "audit_entries_actor_id_idx" ON "audit_entries"("actor_id");

CREATE TABLE "operation_confirmations" (
    "operation_type" VARCHAR(64) NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "payload_digest" VARCHAR(64) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "operation_confirmations_pkey" PRIMARY KEY ("operation_type", "actor_id", "operation_id")
);

-- Seed the 6 canonical Institutes (RF-ATV-01)
INSERT INTO "institutes" ("id", "code", "name", "description", "active") VALUES
    ('01963000-0000-7000-8000-000000000601', 'CRIANCA', 'Criança', 'Instituto da Criança', true),
    ('01963000-0000-7000-8000-000000000602', 'JOVEM', 'Jovem', 'Instituto do Jovem', true),
    ('01963000-0000-7000-8000-000000000603', 'ESCLARECIMENTO_E_FAMILIA', 'Esclarecimento e Família', 'Instituto do Esclarecimento e da Família', true),
    ('01963000-0000-7000-8000-000000000604', 'CARIDADE', 'Caridade', 'Instituto da Caridade', true),
    ('01963000-0000-7000-8000-000000000605', 'DIVULGACAO', 'Divulgação', 'Instituto da Divulgação', true),
    ('01963000-0000-7000-8000-000000000606', 'MEDIUNIDADE', 'Mediunidade', 'Instituto da Mediunidade', true)
ON CONFLICT ("id") DO NOTHING;

