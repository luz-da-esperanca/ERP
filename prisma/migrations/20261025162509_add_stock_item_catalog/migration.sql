-- CreateTable
CREATE TABLE "stock_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_units" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "precision" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_sizes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_item_revisions" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category_id" UUID NOT NULL,
    "category_name" VARCHAR(150) NOT NULL,
    "unit_id" UUID NOT NULL,
    "unit_name" VARCHAR(150) NOT NULL,
    "unit_precision" INTEGER NOT NULL,
    "size_id" UUID,
    "size_name" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_item_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_categories_name_id_idx" ON "stock_categories"("name", "id");

-- CreateIndex
CREATE INDEX "stock_units_name_id_idx" ON "stock_units"("name", "id");

-- CreateIndex
CREATE INDEX "stock_sizes_name_id_idx" ON "stock_sizes"("name", "id");

-- CreateIndex
CREATE INDEX "stock_item_revisions_category_id_idx" ON "stock_item_revisions"("category_id");

-- CreateIndex
CREATE INDEX "stock_item_revisions_unit_id_idx" ON "stock_item_revisions"("unit_id");

-- CreateIndex
CREATE INDEX "stock_item_revisions_size_id_idx" ON "stock_item_revisions"("size_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_item_revisions_item_id_version_key" ON "stock_item_revisions"("item_id", "version");

-- AddForeignKey
ALTER TABLE "stock_item_revisions" ADD CONSTRAINT "stock_item_revisions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_item_revisions" ADD CONSTRAINT "stock_item_revisions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "stock_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_item_revisions" ADD CONSTRAINT "stock_item_revisions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "stock_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_item_revisions" ADD CONSTRAINT "stock_item_revisions_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "stock_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Technical integrity constraints; precision is explicitly configured, never seeded as policy.
ALTER TABLE "stock_categories" ADD CONSTRAINT "stock_categories_valid_fields"
    CHECK (length(btrim("name")) > 0 AND "version" > 0);
ALTER TABLE "stock_units" ADD CONSTRAINT "stock_units_valid_fields"
    CHECK (length(btrim("name")) > 0 AND "version" > 0 AND "precision" BETWEEN 0 AND 18);
ALTER TABLE "stock_sizes" ADD CONSTRAINT "stock_sizes_valid_fields"
    CHECK (length(btrim("name")) > 0 AND "version" > 0);
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_positive_version" CHECK ("version" > 0);
ALTER TABLE "stock_item_revisions" ADD CONSTRAINT "stock_item_revisions_valid_fields"
    CHECK (length(btrim("name")) > 0 AND "version" > 0
        AND "unit_precision" BETWEEN 0 AND 18
        AND (("size_id" IS NULL AND "size_name" IS NULL)
            OR ("size_id" IS NOT NULL AND "size_name" IS NOT NULL)));
