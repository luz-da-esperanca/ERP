# Agent Instructions

## Scope and priorities

This is the canonical development guide for the entire repository. `CLAUDE.md` points here; keep one owner for these rules.

- Follow explicit task requirements and these mandatory project rules. Apply subtree instructions within their scope. Skills provide supporting procedures and must not silently relax project requirements.
- Resolve conflicts using the current user direction and the authoritative source for the affected concern. Surface any unresolved conflict before implementing behavior that depends on it.
- Complete authorized inspection, edits, tests, and necessary refactoring through a reviewable result. Stay within task scope and preserve unrelated work. Actions requiring explicit authorization are listed under Git and delivery.

## Repository context and sources

The repository uses one npm package and lockfile. `src/client/` contains React; `src/server/` composes Fastify and infrastructure; `src/modules/` receives business modules as needed. `test/` is beside `src/`; Prisma schema and versioned migrations live in root `prisma/`. Read [README.md](README.md) for verified setup and scripts, [module boundaries](src/modules/README.md) for feature placement, and [the shared environment contract](docs/contracts/shared-environment.md) for bootstrap scope and acceptance evidence. Redis remains deferred until a justified cache use case exists. Current dependencies and commands are defined by `package.json`, `package-lock.json`, and their actual configurations.

| Concern | Source to consult when relevant |
| --- | --- |
| Product scope and business requirements | [Canonical product requirements](docs/PRD-ERP-Luz-da-Esperanca-v1.1.md) |
| Detailed behavior, validation, operation contracts, and acceptance | [Software requirements specification](<docs/ERS — ERP Social Luz da Esperança.md>) |
| Work decomposition and integration planning | [Product backlog](docs/team-docs/Product-Backlog-ERP-Geral.md) and [sprint planning](docs/team-docs/Sprint-Planning-ERP-Geral.md); relevant team documents under `docs/team-docs/` |
| GitHub Issues in `luz-da-esperanca/ERP` | Read [issue tracker instructions](docs/agents/issue-tracker.md) before consulting or publishing tickets |
| Issue classification | Read the five-label mapping in [triage labels](docs/agents/triage-labels.md) before classifying issues |
| Domain terminology and architecture decisions | Follow [domain documentation instructions](docs/agents/domain.md) before domain exploration |

- The domain layout is `single-context`: root `GLOSSARY.md` and `docs/adr/`. These are designated locations, not existing files. Read them when present; follow `GLOSSARY-MAP.md` if introduced. Explain any proposed departure from an applicable ADR.
- Read the requirements and acceptance criteria relevant to the task. Institutional decisions marked as pending remain pending; never invent policy thresholds, permissions, or approval. Required technical validation and integrity controls still apply.
- `.agents/skills/` contains agent guidance, examples, and helper scripts; it does not define application dependencies or tooling.
- Before running application commands, inspect the actual manifest, lockfile, scripts, and configurations. Do not invent a package manager, dependency version, command, or directory layout. Add missing setup only when required by the authorized task.
- For documentation-only changes, review the diff, verify referenced paths, and run `git diff --check`. Application tests are unnecessary when no behavior changes.

## Required stack

| Area | Required choice |
| --- | --- |
| Language | TypeScript with `strict: true` |
| Frontend | React |
| Backend | Fastify |
| Persistent storage | PostgreSQL through Prisma |
| Cache | Redis, only for a justified need |
| Unit and integration tests | Vitest |
| Version control and branching | Git with Git Flow |
| Deployment architecture | Monolith |

- Keep strict checking enabled in application and test TypeScript configurations. Prefer precise types and use `unknown` with validation for untrusted values.
- Avoid `any`, `@ts-ignore`, and unsafe type assertions. An unavoidable exception requires a documented reason at the usage site explaining the constraint and why the operation is safe.
- Reuse the existing stack and dependencies before adding libraries or tools. Introduce a dependency only for a concrete unmet requirement; explain its purpose and maintenance cost. Do not assume versions from skill examples.

## Architecture and design

Apply Clean Code, SOLID, Clean Architecture, DRY, KISS, YAGNI, Separation of Concerns, Dependency Inversion, Composition over Inheritance, and High Cohesion with Low Coupling as mandatory design constraints. Apply them proportionally: choose the simplest solution that meets the requirements, preserves boundaries, and allows justified evolution.

- Organize cohesive business capabilities as modules when appropriate. Keep them within the monolith; do not introduce independently deployed services without an approved architecture change.
- Direct code dependencies inward: presentation, transport, and infrastructure depend on application contracts; application code depends on the domain. Domain rules must not import React, Fastify, Prisma, Redis clients, or other external frameworks, libraries, and persistence mechanisms.
- Keep business rules, use-case orchestration, presentation, and infrastructure responsibilities distinct. Prevent circular dependencies and access other modules through deliberate contracts rather than their internals.
- Use interfaces and abstractions where they provide real isolation, substitution, or testability. Define required dependency contracts inward and inject implementations from the composition boundary, using ordinary parameters or constructors where sufficient.
- Do not create interfaces, services, repositories, factories, generic frameworks, or design patterns solely to satisfy a template. Avoid premature abstraction, unnecessary generalization, and speculative features.
- Prefer composition to inheritance. Keep modules cohesive and minimize the responsibilities and dependencies exposed by each public interface.
- Keep React presentation components separate from business rules and infrastructure access where meaningful; use existing application boundaries for data access.
- Keep Fastify handlers and controllers thin: validate transport input, invoke the appropriate application behavior, and map results to responses. Business decisions belong outside handlers.

## Naming and language

| Element | Convention |
| --- | --- |
| Files and directories | `kebab-case` |
| Variables, functions, and methods | `camelCase` |
| Classes, interfaces, types, and enums | `PascalCase` |
| Truly immutable global constants | `UPPER_SNAKE_CASE` |
| Booleans | Prefer `is`, `has`, `can`, or `should` prefixes |

- Honor official framework and tool filenames, configuration files, and generated artifacts. Preserve existing document paths unless renaming them is part of the task.
- Write identifiers, comments, technical documentation, internal error messages, test descriptions, and commit messages in English. Apply this to new and edited engineering content without translating unrelated existing documents.
- Product interface text must follow the existing Brazilian Portuguese requirement (IU-01); keep internal identifiers and technical explanations in English. User communication may be in Portuguese.
- Use names that express responsibility and domain meaning. Avoid ambiguous abbreviations and generic identifiers.

## Code quality and change scope

- Write small, cohesive functions with one clear responsibility. Avoid long parameter lists; use early returns to limit nesting.
- Remove duplicated knowledge and logic when it represents the same responsibility. Do not combine unrelated concepts merely because their code looks similar.
- Keep side effects explicit and prefer immutable data where appropriate. Keep business decisions out of presentation and persistence code.
- Replace unexplained numbers and strings with meaningful names when they obscure intent. Favor readability over compressed expressions.
- Comment on non-obvious decisions, constraints, and relevant behavior; avoid comments that restate the code.
- Change only what the task needs. Preserve observable behavior during refactoring unless a behavior change is explicitly required. Remove temporary debugging code before completion.

## Development workflow and mandatory TDD

For every development task:

1. Understand the requirements and acceptance criteria; inspect relevant files, instructions, configurations, and existing patterns.
2. Identify affected business modules and layers, choose a simple compatible solution, and identify observable behaviors and failure cases to test.
3. **RED:** Before implementing each new behavior or bug fix, write a Vitest behavior test. Run it and confirm that it fails for the missing behavior, not a broken test environment. For a bug, reproduce the reported failure first.
4. **GREEN:** Implement only enough production code to make that test pass. Run it again and confirm success. Repeat the cycle for the remaining required behaviors.
5. **REFACTOR:** Improve clarity or maintainability where useful, preserve behavior, and keep tests passing.
6. Run the relevant test suites and applicable configured type, lint, and build checks. Resolve failures caused by the change and report unrelated failures accurately.
7. Review the diff for regressions, duplication, security issues, architecture violations, and unintended changes. Check the Definition of Done and report the result with a suggested commit.

Never implement a feature before its behavior tests. Documentation-only or configuration-only changes with no testable behavior do not require artificial tests; behavior-changing configuration still requires verification of that behavior.

### Test organization and design

- Use Vitest for unit and integration tests. Keep `test/` beside `src/` at the same directory level for the application or package being tested; mirror the source organization where useful. Do not invent package directories before they are needed.
- Use descriptive English test names. Verify observable behavior and contracts rather than private methods, incidental structure, or implementation details.
- Cover the main flows, meaningful edge cases, and relevant error paths. Include regression tests for fixes.
- Keep tests deterministic, independent, and reproducible. Control time, randomness, external state, and cleanup where relevant.
- Avoid unnecessary mocks. Use mocks or fakes to isolate external dependencies when appropriate; prefer real dependencies in isolated integration environments when feasible. Never point tests at production services or data.
- If essential tooling or services are missing, report the prerequisite; do not claim a RED or GREEN result without executing it. A missing test setup does not waive TDD.

## Persistence and cache

### PostgreSQL and Prisma

- Centralize persistence access in the appropriate infrastructure adapters or repositories. Expose application/domain contracts, and avoid coupling domain models to Prisma persistence models.
- Version schema changes through Prisma migrations. Review their data impact and consistency requirements. Never change production data or schema directly without an approved procedure.
- Use transactions when operations must be atomic. Preserve database constraints and translate integrity violations and persistence failures into consistent application errors.
- Avoid N+1 queries and unnecessary loading. Select required fields and add indexes according to actual query patterns rather than speculation.
- Store only data required by the product; do not persist credentials or sensitive information unnecessarily.

### Redis

- Introduce caching only for a demonstrated benefit. Keep Redis access behind the relevant infrastructure boundary.
- Define the key scope, TTL, and invalidation conditions for each cache. Persistent business data must retain PostgreSQL as its source of truth.
- Define and verify behavior during connection failures and unavailability. Cache failures must not silently corrupt or alter business decisions.

## Security, errors, and product integrity

- Validate untrusted input at application boundaries and enforce business invariants in the responsible inner layer. Use secure mechanisms provided by the existing frameworks and libraries.
- Handle errors explicitly and consistently. Public responses must not expose stack traces, credentials, or internal implementation details; keep actionable diagnostics in appropriately protected logs.
- Never commit secrets, tokens, or passwords. Use environment variables for sensitive configuration and apply least privilege to service accounts and data access. Redact sensitive values from logs and test artifacts.
- Authenticate protected operations and enforce authorization on the server, including searches, reports, and exports. Interface visibility is not an access-control boundary.
- Follow the documented restrictions on personal and sensitive data. Until the relevant institutional decisions are approved, keep restricted health/religion fields disabled and use synthetic development and test data.
- When changing registration, preserve the requirement for a person's own valid, unique CPF from creation. Missing information must not silently become zero, false, absence, or an adverse eligibility decision.
- When changing eligibility, preserve the specified pending state when policy or evidence is insufficient. Do not equate eligibility with priority or a guaranteed delivery.
- When changing stock, deliveries, or reversals, preserve atomicity, nonnegative stock, safe retries, and concurrency controls. Preserve authorship and historical context for corrections; do not silently overwrite prior facts. Read the relevant validation and operation contracts in the requirements specification.
- Respect product scope: financial donations/CRM, Bazar sales and commercial inventory, school administration, and clinical records are outside the current ERP scope. Do not add them as incidental extensions.

## Git and delivery

### Git Flow

| Branch | Purpose and integration |
| --- | --- |
| `main` | Stable production versions |
| `develop` | Integration of completed features |
| `feature/<feature-name>` | Start from `develop`; integrate into `develop` through a pull request |
| `release/<version>` | Start from `develop`; prepare a release, integrate into `main`, and synchronize `develop` |
| `hotfix/<fix-name>` | Start from `main`; deliver an urgent production fix and synchronize `main` and `develop` |

- Use the specified branch prefixes and kebab-case descriptive names. Verify available branches before starting branch work; if `develop` is absent, report the prerequisite instead of silently substituting `main` or bootstrapping a new workflow.
- Prefer small, cohesive changes that are easy to review. Preserve existing user changes.
- Do not push, merge, perform destructive rebases, or delete branches without explicit authorization. Never force-push shared branches.
- Do not create commits automatically; explicit authorization is required. Finishing implementation never authorizes production promotion or deployment.

### Conventional Commits

Use `type(scope): message`, with an English imperative description and a scope identifying the affected module or area.

Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, `ci`, `style`. Use `refactor` for behavior-preserving restructuring and `style` for formatting-only changes. Avoid generic messages such as `fix stuff`, `update code`, or `changes`.

Suggest a suitable commit after each implementation; for this guide, an example is `docs(agents): define project development rules`.

## Definition of Done and completion report

Consider an implementation complete only when:

- Requirements and acceptance criteria are met, and relevant architecture, security, and naming rules are respected.
- Required behavior and regression tests exist; all relevant executable tests pass.
- Applicable configured type, lint, and build checks pass. If a required check is blocked or fails, report the exact limitation and do not claim full verification or completion.
- The change introduces no known errors, unnecessary temporary/debugging code, exposed secrets, or sensitive data.
- The diff is limited to the task and consistent with project conventions.

Finish each task with these concise fields (explanations may be in Portuguese):

1. **Summary:** What changed and which requirement it satisfies.
2. **Files changed:** Relevant modified files.
3. **Tests:** Tests added, checks actually executed, and their results. Explain skipped or blocked checks and why.
4. **Notes:** Important decisions, limitations, risks, or remaining work.
5. **Suggested commit:** An English Conventional Commit message; do not create the commit without authorization.

Never state that a test, build, or check ran unless it actually ran. For changes without testable behavior, report proportionate documentation or configuration checks instead.
