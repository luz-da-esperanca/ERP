-- Secret-bearing operation inputs use a salted verifier, never plaintext or a fast password digest.
ALTER TABLE "operation_confirmations" ADD COLUMN "secret_hash" TEXT;
