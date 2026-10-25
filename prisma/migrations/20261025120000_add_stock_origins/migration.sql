-- Stock origins catalog (G-02, RF-EST-02, RF-EST-03, RF-BAZ-04, TG-01-04)

CREATE TABLE "stock_origins" (
    "id" UUID NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_origins_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_origins_kind_check" CHECK (
        "kind" IN ('INDIVIDUAL_DONOR', 'COMPANY_DONOR', 'CAMPAIGN', 'UNKNOWN', 'BAZAR_TRANSFER')
    ),
    CONSTRAINT "stock_origins_name_not_blank_check" CHECK (char_length(btrim("name")) > 0),
    CONSTRAINT "stock_origins_name_length_check" CHECK (char_length("name") <= 150)
);

CREATE INDEX "stock_origins_kind_idx" ON "stock_origins"("kind");

-- Seed the two system-managed stock origins; the API cannot create them (RF-EST-03, RF-BAZ-04)
INSERT INTO "stock_origins" ("id", "kind", "name", "created_at") VALUES
    ('01963000-0000-7000-8000-000000000701', 'UNKNOWN', 'Origem desconhecida', NOW()),
    ('01963000-0000-7000-8000-000000000702', 'BAZAR_TRANSFER', 'Transferência do Bazar', NOW())
ON CONFLICT ("id") DO NOTHING;
