# ERP Social Luz da Esperança

Domain glossary for the social assistance ERP of Luz da Esperança (`single-context` layout). Technical identifiers and documentation use the English canonical terms below; user-facing interface text in Brazilian Portuguese (`IU-01`) uses the indicated institutional terms.

## Core Assistance & Registration (`CAD` / `FIC`)

**Assisted Person** (_UI pt-BR_: `Pessoa assistida`):
An individual who participates in an activity or receives assistance directly or indirectly and is linked to a Family, identified by a mandatory, valid, unique personal CPF (`RN-01`, `RN-21`, `RN-22`). System operators, donors, and service professionals do not become Assisted Persons merely by performing those roles.
_Avoid_: Client, customer, patient, user, account

**Family** (_UI pt-BR_: `Família`):
The reference household unit for social accompaniment and assistance delivery, identified by a unique, stable family number (`RF-CAD-01`).
_Avoid_: Household account, group, cost center

**Family Link** (_UI pt-BR_: `Vínculo familiar`):
The time-bounded membership relationship (`[startDate, endDate)`) connecting an Assisted Person to a Family, used to determine active family composition and the historical family context on the date of any assistance fact (`RF-CAD-03`, `RF-CAD-05`).
_Avoid_: Static foreign key, permanent membership

**Family Reference Person** (_UI pt-BR_: `Titular` / `Referência familiar`):
An optional designated member representing the Family according to the institutional policy pending under `LAC-02` (`RF-CAD-04`). While `LAC-02` is pending, no Family Reference Person is required or automatically assigned.
_Avoid_: Mandatory head of household, primary account holder, legal guardian by default

**Minimum Registration** (_UI pt-BR_: `Cadastro mínimo`):
An atomic registration of an Assisted Person and their active Family Link requiring only full name, valid unique personal CPF, and Family at the point of service, flagging unknown birth date without blocking assistance (`RF-CAD-11`).
_Avoid_: Incomplete draft, anonymous registration, temporary record without CPF

**Social Assessment Record** (_UI pt-BR_: `Ficha social`):
A versioned snapshot of a Family's housing, socioeconomic composition, schooling, declared needs, and observed situation, preserving fact date, registration timestamp, author, and historical family context (`RF-FIC-01` to `RF-FIC-09`).
_Avoid_: Clinical record, medical chart, vulnerability score, mutable profile

**Situation Found** (_UI pt-BR_: `Situação encontrada`):
A restricted-access free-text observation recorded on a Social Assessment Record or Home Visit with date and author, excluding clinical diagnoses, prescriptions, or medical records (`RF-FIC-07`, `RES-05`).
_Avoid_: Clinical diagnosis, medical evolution, anamnesis

**Holder Acknowledgment** (_UI pt-BR_: `Ciência do titular`):
The record of how, when, and by whom a Social Assessment Record version was acknowledged, governed by `LAC-02` and `LAC-08`; absence of acknowledgment never implies consent (`RF-FIC-09`).
_Avoid_: Automatic consent, digital signature assumption

## Institutes, Projects & Activities (`ATV` / `FRQ`)

**Institute** (_UI pt-BR_: `Instituto`):
One of the institutional organizational areas of Luz da Esperança (Criança, Jovem, Esclarecimento e Família, Caridade, Divulgação, Mediunidade) (`RF-ATV-01`).
_Avoid_: Department, independent tenant, separate product

**Project** (_UI pt-BR_: `Projeto`):
A time-bounded grouping of Activities with status and validity period; its association with Institutes is governed by `LAC-04` and is not mandatory or exclusive while `LAC-04` remains pending (`RF-ATV-02`).
_Avoid_: Program, campaign, course

**Periodic Activity** (_UI pt-BR_: `Atividade periódica`):
An Activity within a Project that holds recurring Meetings and tracks Attendance Marks over time (`RF-ATV-03`, `RF-ATV-04`). Its nature is immutable once any record exists (`RF-ATV-06`).
_Avoid_: One-off service, appointment

**Point-in-Time Service Activity** (_UI pt-BR_: `Atividade de atendimento pontual`):
An Activity within a Project recorded per occurrence of service delivery (such as item donation, medical, psychological, physiotherapy, or home visit) without recurring roll call (`RF-ATV-03`, `RF-ATV-05`).
_Avoid_: Periodic class, recurring meeting

**Participation Period** (_UI pt-BR_: `Período de participação`):
The time-bounded enrollment interval (`[startDate, endDate)`) of an Assisted Person in a Periodic Activity (`RF-ATV-07`). Being enrolled does not constitute Presence or Eligibility.
_Avoid_: Attendance, presence, automatic eligibility

**Meeting** (_UI pt-BR_: `Encontro`):
A specific dated occurrence of a Periodic Activity, with status (`planned`, `held`, or `canceled`) and a responsible person, on which roll call is taken (`RF-FRQ-01`).
_Avoid_: Class definition, event, appointment

**Attendance Mark** (_UI pt-BR_: `Marcação de chamada` / `Presença`):
The explicit record for an Assisted Person in a held Meeting indicating `present`, `absent`, or `uninformed` (`Não informada`), preserving the person's Family on the Meeting date (`RF-FRQ-02`). Uninformed fields never default to absence.
_Avoid_: Implicit absence, check-in

**Walk-in Presence** (_UI pt-BR_: `Presença avulsa` / `Pessoa fora da lista`):
A `present` Attendance Mark recorded in a held Meeting for an Assisted Person with a valid Family Link who is not currently on the Periodic Activity's participant list, without automatically enrolling them in future Meetings (`RF-FRQ-03`).
_Avoid_: Auto-enrollment, guest pass

## Family Eligibility (`APT`)

**Eligibility** (_UI pt-BR_: `Aptidão`):
The evaluated status of a Family on a reference date (`Eligible` / `Apta`, `Ineligible` / `Não apta`, or `Pending` / `Pendente`) indicating whether the Family may be considered for item Deliveries based on at least one member's Presence in a Periodic Activity under the active Eligibility Policy (`RF-APT-01`, `RN-02`, `RN-03`). Eligibility does not guarantee Delivery or establish Priority.
_Avoid_: Entitlement, guaranteed benefit, priority score, vulnerability rank

**Eligibility Policy** (_UI pt-BR_: `Política de aptidão` / `Critério de aptidão`):
A versioned, non-overlapping configuration of reference window, minimum attendance threshold, and qualifying Periodic Activities approved under `LAC-01` (`RF-APT-02`, `RF-APT-03`). There is no default policy; when unconfigured or inconclusive, Eligibility evaluates to `Pending` (`RN-18`).
_Avoid_: Hardcoded rule, 30-day default, automatic renewal

**Compatibility** (_UI pt-BR_: `Compatibilidade`):
The suitability of an Item's size or characteristics to the known measurements or declared needs of a Family's members (`RN-14`). Missing size data means unknown, not incompatible.
_Avoid_: Eligibility, automatic allocation

**Priority** (_UI pt-BR_: `Prioridade`):
The ordering among Eligible Families when distributing scarce items, subject to institutional criteria pending under `LAC-03` (`RN-03`, `RF-ENT-09`).
_Avoid_: Eligibility, automatic income ranking

## Point-in-Time Services, Social Stock & Deliveries (`ATD` / `EST` / `ENT` / `BAZ`)

**Attendance Record** (_UI pt-BR_: `Atendimento pontual`):
A recorded occurrence of a Point-in-Time Service Activity delivered to a Family (and optionally a specific Assisted Person linked on the fact date), identifying the executor and the recording operator (`RF-ATD-01`, `RF-ATD-08`). It never generates Periodic Activity Presence (`RF-ATD-04`).
_Avoid_: Clinical consultation record, medical chart, meeting presence

**Home Visit** (_UI pt-BR_: `Visita domiciliar`):
A family-directed Attendance Record capturing visit date, executor, and Situation Found without automatically overwriting the Family's Social Assessment Record (`RF-ATD-06`, `RN-20`).
_Avoid_: Automatic social record update, inspection

**Social Stock** (_UI pt-BR_: `Estoque social`):
The inventory of items designated for social assistance distribution, strictly separated from the commercial inventory of the Bazar (`RN-07`).
_Avoid_: Commercial stock, Bazar inventory

**Stock Origin** (_UI pt-BR_: `Origem de estoque`):
The catalog entry identifying where items entering Social Stock came from, either an external Donation Origin (individual donor, company donor, campaign, or explicitly unknown) or an internal Bazar Transfer. An internal transfer is never counted as a new external donation (`RF-EST-02`, `RF-EST-03`, `RF-BAZ-04`).
_Avoid_: Financial donor account, CRM contact, estimated value

**Donation Origin** (_UI pt-BR_: `Origem de doação`):
The external source of items entering Social Stock: individual donor (`doador pessoa física`), company donor (`doador empresa`), campaign (`campanha`), or explicitly unknown origin (`RF-EST-02`, `RF-EST-03`). Identifying an item donor does not create financial CRM records.
_Avoid_: Financial donor account, CRM contact, Bazar transfer

**Bazar Transfer** (_UI pt-BR_: `Transferência do Bazar`):
An internal transfer of items from the commercial Bazar to Social Stock identified by a unique reference, tracking informed, received, and accepted quantities (`RF-BAZ-01` to `RF-BAZ-04`, `RN-17`). It is never counted as new external donation fundraising.
_Avoid_: External donation, commercial sale

**Stock Lot** (_UI pt-BR_: `Lote de estoque`):
A tracked quantity of an Item from a specific receipt or opening balance, characterized by unit of measure, size (when applicable), usability condition, and expiration date for perishables (`RF-EST-01`, `RF-EST-05`, `RF-EST-09`).
_Avoid_: Untracked bulk counter, mutable balance field

**Triage** (_UI pt-BR_: `Triagem`):
The inspection of received items that partitions received quantity into accepted (`aceito`), discarded with reason (`descartado`), and pending triage (`pendente de triagem`), where `received = accepted + discarded + pending` (`RF-EST-04`, `VAL-08`).
_Avoid_: Silent quantity adjustment

**Controlled Physical Balance** (_UI pt-BR_: `Saldo físico controlado`):
The quantity of an Item accepted into Social Stock and not yet removed by an outbound Stock Movement, which may include expired or damaged lots awaiting write-off (`RF-EST-05`, `RNF-CON-04`).
_Avoid_: Available balance, uninspected receipt

**Available Balance** (_UI pt-BR_: `Saldo disponível`):
The portion of Controlled Physical Balance that is in usable condition and unexpired on the effective Delivery date (`RF-EST-05`, `RF-EST-09`).
_Avoid_: Physical balance, reserved quote

**Stock Movement** (_UI pt-BR_: `Movimentação de estoque`):
An immutable ledger entry recording an opening balance, accepted donation receipt, accepted Bazar Transfer, outbound Delivery, documented adjustment, post-acceptance discard, or Delivery Reversal (`RF-EST-06`, `RF-EST-10`). Balances are never edited directly.
_Avoid_: Direct balance overwrite

**Delivery** (_UI pt-BR_: `Entrega`):
An atomic operation that records the effective distribution of items to a Family, simultaneously creating a linked Attendance Record and the corresponding outbound Stock Movements (`RF-ENT-01`, `RF-ENT-03`, `RN-10`). In consolidated reports, a Delivery counts once as a Delivery and once as an Attendance Record, never doubled within the same metric (`RN-19`).
_Avoid_: Item reservation, draft selection, isolated stock exit

**Delivery Reversal** (_UI pt-BR_: `Estorno de entrega`):
An atomic, single-use reversal of an erroneously recorded Delivery with a mandatory reason, restoring the original Stock Lots (keeping expired lots in physical balance only) and reversing the linked Attendance Record while preserving the original records (`RF-ENT-07`, `OP-05`).
_Avoid_: Physical return of used goods, silent deletion, isolated attendance cancellation

## Cross-Cutting Governance, Audit & Migration (`ACS` / `REL` / `MIG`)

**Operator** (_UI pt-BR_: `Operador`):
An authenticated person with an individual login and explicit authorization profiles who uses the ERP (`RF-ACS-01`, `RF-ACS-02`).
_Avoid_: Shared account, assisted person

**Service Executor** (_UI pt-BR_: `Responsável pela execução` / `Executor`):
The person who actually performed an Attendance Record, Home Visit, or Meeting, identified by name and role even when they are not a system Operator (`RF-ATD-08`, `VAL-10`).
_Avoid_: System operator (when distinct from the person who recorded the entry)

**Fact Date vs. Registration Timestamp** (_UI pt-BR_: `Data do fato` vs. `Data/hora do lançamento`):
The distinction between the civil calendar date on which a real-world event occurred (`factDate`, used to resolve historical Family Links and active policies) and the server timestamp when the Operator recorded it (`recordedAt`), supporting identified retroactive entries (`RF-ACS-05`, `VAL-03`).
_Avoid_: Single `createdAt` timestamp used as business date

**Operation Confirmation** (_UI pt-BR_: `Confirmação de operação`):
A client-identified request (`Idempotency-Key`) to commit a state-changing fact or movement; repeating the same confirmation with identical normalized content in the same authorized scope returns the stored result without duplicating effects (`OP-02`).
_Avoid_: Unprotected POST, silent duplicate creation

**Institutional Gap** (_UI pt-BR_: `LACUNA` / `LAC-01`..`LAC-13`):
An open business or operational policy decision that only the institution can resolve (`RES-06`). Pending Institutional Gaps must remain parameterized or blocked, never invented in code.
_Avoid_: Developer assumption, hardcoded default policy

