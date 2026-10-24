---
status: proposed
---

# 0002. Opaque Internal Identifiers, Scoped Operation Keys, and Composite External Keys

Every persisted entity uses a server-generated, immutable UUIDv7 internal identifier; every state-changing confirmation that creates facts or movements requires a client-generated UUID (`Idempotency-Key`, UUIDv4 or UUIDv7) scoped to the authenticated actor and operation type; and every record imported from Bússola Social is identified by the composite external key `(sourceSystem, recordType, externalId)` mapped to an internal UUIDv7 (`docs/contracts/common-identifiers.md`).

## Context and Trade-offs

The system must prevent duplicate meetings, attendances, stock entries, Bazar transfers, and deliveries under mobile network retries (`OP-02`, `RF-ENT-05`, `RF-BAZ-03`), allow repeatable imports without duplicating entities (`RF-MIG-04`, `RF-MIG-05`), and count unique people and families in reports without using CPF or mutable human-readable codes as identity keys (`RF-REL-03`, `VAL-02`).

## Considered Options

- **UUIDv7 internal IDs + scoped `Idempotency-Key` + `(sourceSystem, recordType, externalId)` mapping (chosen):** Time-ordered, globally unique internal keys in PostgreSQL `uuid` columns; safe client retries via standard Web Crypto UUIDs; lossless preservation of external source identifiers.
- **Sequential integer auto-increment IDs:** Rejected because sequential IDs are predictable across module boundaries and harder to generate safely before persistence in composite workflows.
- **Natural keys (CPF or family/catalog numbers) as primary/counting keys:** Rejected because `RF-REL-03` forbids using CPF as a counting key, exposing CPF in URLs/logs violates `RNF-SEG-04`, and catalog/external codes must never replace internal identity (`OP-08`).

## Consequences

- No module may define its own primary key format or retry-deduplication scheme.
- Replaying the same `Idempotency-Key` with identical normalized payload in the same scope returns the original result; reusing it with a different payload returns `409 IDEMPOTENCY_CONFLICT`.
- Pending ratification by Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`) under `C-01`.

