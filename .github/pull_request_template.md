<!--
Write in English. Use a clear title such as type(scope): imperative summary.
Replace placeholders and remove unused prompts. Keep details proportional to the change.
-->

## Summary

<!-- State the concrete problem and resulting behavior in a few sentences or bullets.
Add a small flow, diff sketch, or file tree only when it clarifies the change. -->

**Related issue:** Refs #ISSUE_NUMBER <!-- Use N/A with a reason when no issue exists. -->

- [What changes and why.]

## Evidence

**Before:** [Reproduction, failing behavior test, or previous state.]
**After:** [Observed result that demonstrates the requirement is met.]

- **Tests:** [Commands and results; include regression/integration evidence when relevant.]
- **Quality checks:** [Typecheck, lint, and build actually executed, with results.]
- **Manual / CI:** [Verification steps, screenshot, or CI run link when applicable.]

<!-- Report N/A with a reason for inapplicable checks, and explain blocked checks.
Documentation-only changes need proportionate link/diff checks, not artificial application tests.
Never describe an unexecuted check as passed. Link long logs or design rationale instead of pasting them. -->

## Merge Danger

**Door:** [One-way or Two-way; can the previous version safely run after rollback?]
**Blast Radius:** [Local, Module, or Shared]
**Impact and rollback:** [Compatibility, migrations, configuration, security, and rollback steps relevant to this change; use None with a reason if appropriate.]
**Pending work:** [Dependencies, decisions, or limitations; use None if there are none.]

- [ ] The actual target branch follows Git Flow: feature PRs target `develop`; only releases/hotfixes target `main`.
- [ ] Relevant acceptance criteria, contracts, and documentation match the final diff.
- [ ] Verification results and any blockers above are accurate; no secrets or real personal data appear in the diff or evidence.
