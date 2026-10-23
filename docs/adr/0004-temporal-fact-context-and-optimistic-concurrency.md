---
status: proposed
---

# 0004. Bi-Temporal Fact Context, Immutable Versions, and Optimistic Concurrency

Every operational fact and versioned record stores both the civil date of the event (`factDate`, `YYYY-MM-DD`) and the server registration timestamp (`recordedAt`, UTC ISO 8601), snapshots the historical Family Link and policy version active on `factDate`, and enforces optimistic concurrency control (`409 STALE_VERSION`) on mutable resources (`RF-ACS-05`, `OP-03`, `OP-04`).

## Context and Trade-offs

The institution operates paper contingency workflows (`RNF-DIS-02`) requiring retroactive data entry days after a meeting or delivery occurred (`AC-18`), while family membership, address, social records (`RF-FIC-08`), and eligibility policies (`RF-APT-03`) change over time. Silently using current family links or overwriting records with last-write-wins would corrupt historical accountability (`RN-09`, `OP-03`, `OP-04`).

## Considered Options

- **Explicit `factDate` + `recordedAt`, `[startDate, endDate)` validity intervals, immutable versions, and version-checked updates (chosen):** Retroactive entries resolve family membership and activity/policy validity as of `factDate`; social records and eligibility policies create new versions rather than mutating history; concurrent edits require a known version (`If-Match` / `version`) and fail with `409 STALE_VERSION` when stale.
- **Single `createdAt` timestamp and mutable in-place updates (last-write-wins):** Rejected because it violates `RF-ACS-05`, `RF-FIC-08`, `RF-APT-03`, `OP-03`, and `OP-04`.

## Consequences

- Changing a person's Family Link or updating a Family's Social Assessment Record never reattributes past Attendance Marks, Attendance Records, or Deliveries (`RN-09`).
- Delivery confirmation re-verifies the official Eligibility evaluation, active Family Link, lot validity, and available stock within the same protected transaction (`OP-03`).
- Pending ratification by Fabricio (`@Fabricio-Fontenele`) and Gabriel (lead) (`@Gabriel-afk-9`) under `C-01`.

