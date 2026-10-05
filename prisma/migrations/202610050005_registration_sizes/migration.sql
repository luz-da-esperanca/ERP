-- CreateTable
CREATE TABLE "SizeProfile" (
    "personId" UUID NOT NULL,
    "shoeSize" VARCHAR(30),
    "clothingSize" VARCHAR(30),
    "informedOn" DATE,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SizeProfile_pkey" PRIMARY KEY ("personId")
);

-- AddForeignKey
ALTER TABLE "SizeProfile" ADD CONSTRAINT "SizeProfile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
