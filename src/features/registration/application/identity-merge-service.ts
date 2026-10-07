import type {
  CommandContext,
  Principal,
} from '../../access/application/ports.js';
import type { OperationFingerprints } from '../../access/application/account-transactions.js';
import { AuthenticationRequiredError } from '../../access/application/access-errors.js';
import { assertPermission } from '../../access/domain/permissions.js';
import {
  IdempotencyConflictError,
  ResourceNotFoundError,
} from '../../../core/application/errors.js';
import {
  changedCivilPeriods,
  invalidateCoverage,
} from '../../attendance/application/coverage-invalidation.js';
import type { Attendance } from '../../attendance/domain/attendance.js';
import { reconcileMissingData } from './missing-data.js';
import {
  attendanceConflicts,
  fieldDifferences,
  intervalConflicts,
  resolveAttendances,
  resolveIntervals,
  selectFields,
} from '../domain/identity-merge-rules.js';
import type {
  FamilyMergeSources,
  IntervalRow,
  MergeCommand,
  MergeIdentities,
  MergePreview,
  MergeResolutionSummary,
  MergeResult,
  MergeSources,
  PersonMergeSources,
} from '../domain/identity-merge.js';
import {
  assertMembershipPlan,
  isMembershipCurrent,
} from '../domain/membership-rules.js';
import {
  RegistrationConflictError,
  RegistrationRevisionConflictError,
  RegistrationRuleError,
} from '../domain/registration-errors.js';
import type { RegisteredMembership } from '../domain/registration.js';
import type {
  IdentityMergeReader,
  IdentityMergeTransaction,
  IdentityMergeUnitOfWork,
} from './identity-merge-ports.js';

const personKeys = [
  'name',
  'birthDate',
  'sex',
  'cpf',
  'rg',
  'occupation',
  'educationLevel',
  'contactPhone',
] as const;
const familyKeys = [
  'referenceName',
  'address',
  'neighborhood',
  'postalCode',
  'location',
  'contactPhone',
] as const;
const operationType = 'registration.identities.merge';
type AttendanceChanges = Parameters<
  IdentityMergeTransaction['updateAttendance']
>[1];

export class IdentityMergeService {
  constructor(
    private readonly reader: IdentityMergeReader,
    private readonly unitOfWork: IdentityMergeUnitOfWork,
    private readonly fingerprints: OperationFingerprints,
    private readonly now: () => string,
    private readonly timeZone: string,
  ) {}
  private identities(input: MergeIdentities): MergeIdentities {
    if (input.sourceId === input.targetId)
      throw new RegistrationRuleError('MERGE_SAME_IDENTITY');
    return {
      entityType: input.entityType,
      sourceId: input.sourceId,
      targetId: input.targetId,
    };
  }
  private membershipRows(sources: MergeSources): IntervalRow[] {
    return sources.memberships.map((row) => ({
      id: row.id,
      group: row.familyId,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
    }));
  }
  private enrollmentRows(sources: PersonMergeSources): IntervalRow[] {
    return sources.enrollments.map((row) => ({
      id: row.id,
      group: row.activityId,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
    }));
  }
  private referenceConflicts(sources: FamilyMergeSources) {
    const references = sources.memberships.filter((row) => row.isReference);
    return references.flatMap((first, index) =>
      references
        .slice(index + 1)
        .filter(
          (second) =>
            first.familyId !== second.familyId &&
            Date.parse(first.validFrom) <
              (second.validUntil === null
                ? Infinity
                : Date.parse(second.validUntil)) &&
            Date.parse(second.validFrom) <
              (first.validUntil === null
                ? Infinity
                : Date.parse(first.validUntil)),
        )
        .map((second) => ({ membershipIds: [first.id, second.id].sort() })),
    );
  }
  private build(sources: MergeSources): MergePreview {
    const identities: MergeIdentities = {
      entityType: sources.entityType,
      sourceId: sources.source.id,
      targetId: sources.target.id,
    };
    const versions = (rows: readonly { id: string; revision: number }[]) =>
      rows.map((row) => [row.id, row.revision]).sort();
    const person = sources.entityType === 'PERSON' ? sources : null;
    const fields =
      sources.entityType === 'PERSON'
        ? fieldDifferences(sources.source, sources.target, personKeys)
        : fieldDifferences(sources.source, sources.target, familyKeys);
    const of = <T extends { personId: string }>(rows: T[], id: string) =>
      rows.filter((row) => row.personId === id);
    const marks = person
      ? attendanceConflicts(
          of(person.attendances, identities.sourceId),
          of(person.attendances, identities.targetId),
        )
      : [];
    const conflicting = new Set(marks.flatMap((row) => row.attendanceIds));
    const split = (rows: IntervalRow[], sourceIds: Set<string>) =>
      [
        rows.filter((row) => sourceIds.has(row.id)),
        rows.filter((row) => !sourceIds.has(row.id)),
      ] as const;
    const sourceIds = (rows: readonly { id: string; personId: string }[]) =>
      new Set(of([...rows], identities.sourceId).map((row) => row.id));
    const sizes = person?.sizeProfiles;
    return {
      ...identities,
      expectedSourceRevision: sources.source.revision,
      expectedTargetRevision: sources.target.revision,
      sourceFingerprint: this.fingerprints.calculate(
        {
          ...identities,
          revisions: [sources.source.revision, sources.target.revision],
          memberships: versions(sources.memberships),
          attendances: versions(sources.attendances),
          sessions: versions(sources.sessions),
          issues: versions(sources.issues),
          enrollments: versions(person?.enrollments ?? []),
          families: versions(person?.families ?? []),
          sizes: [
            sizes?.source?.revision ?? null,
            sizes?.target?.revision ?? null,
          ],
          preserved: sources.preserved,
        },
        null,
      ),
      fieldConflicts: fields.conflicts,
      adoptedFields: fields.adopted,
      membershipConflicts: person
        ? intervalConflicts(
            ...split(
              this.membershipRows(person),
              sourceIds(person.memberships),
            ),
            false,
          )
        : [],
      referenceConflicts:
        sources.entityType === 'FAMILY' ? this.referenceConflicts(sources) : [],
      enrollmentConflicts: person
        ? intervalConflicts(
            ...split(
              this.enrollmentRows(person),
              sourceIds(person.enrollments),
            ),
            true,
          )
        : [],
      attendanceConflicts: marks,
      sizeProfileConflict:
        sizes?.source && sizes.target
          ? { source: sizes.source, target: sizes.target }
          : null,
      memberships: sources.memberships,
      enrollments: person?.enrollments ?? [],
      attendances: sources.attendances.filter((row) => conflicting.has(row.id)),
      issueIds: sources.issues.map((row) => row.id).sort(),
      preserved: sources.preserved,
    };
  }
  async preview(actor: Principal, input: MergeIdentities) {
    assertPermission(
      actor.user.roleCodes,
      actor.user.mustChangePassword,
      'registration.merge',
    );
    const identities = this.identities(input);
    return this.reader.read(async (ports) => {
      const sources = await ports.sources(identities);
      if (!sources) throw new ResourceNotFoundError();
      return this.build(sources);
    });
  }
  merge(context: CommandContext, command: MergeCommand): Promise<MergeResult> {
    const identities = this.identities(command);
    return this.unitOfWork.run(
      context.actor.user.id,
      identities,
      async (tx) => {
        const actor = await tx.actor(context.actor.user.id);
        if (
          !actor?.user.active ||
          actor.authVersion !== context.actor.authVersion
        )
          throw new AuthenticationRequiredError();
        assertPermission(
          actor.user.roleCodes,
          actor.user.mustChangePassword,
          'registration.merge',
        );
        const fingerprint = this.fingerprints.calculate(
          { type: operationType, input: command },
          null,
        );
        const existing = await tx.operation(operationType, context.key);
        if (existing) {
          if (
            existing.actorId !== actor.user.id ||
            !this.fingerprints.matches(fingerprint, existing.fingerprint)
          )
            throw new IdempotencyConflictError();
          return tx.restore(existing.reference);
        }
        const sources = await tx.sources(identities);
        if (!sources) throw new ResourceNotFoundError();
        const preview = this.build(sources);
        if (sources.source.revision !== command.expectedSourceRevision)
          throw new RegistrationRevisionConflictError(sources.source.revision);
        if (sources.target.revision !== command.expectedTargetRevision)
          throw new RegistrationRevisionConflictError(sources.target.revision);
        // The confirmation is only valid for the histories the operator reviewed.
        if (preview.sourceFingerprint !== command.expectedSourceFingerprint)
          throw new RegistrationConflictError('MERGE_SOURCES_CHANGED');
        const apply =
          sources.entityType === 'PERSON'
            ? await this.planPerson(tx, sources, preview, command)
            : this.planFamily(sources, command);
        const operationId = await tx.createOperation(
          operationType,
          context.key,
          actor.user.id,
          fingerprint,
        );
        const audit = (
          classification: 'REGISTRATION' | 'PROJECTS' | 'ATTENDANCE',
          entityType: string,
          before: { id: string } | null,
          after: { id: string; revision: number },
          occurredAt?: string,
        ) =>
          tx.audit({
            operationId,
            actorId: actor.user.id,
            classification,
            entityType,
            entityId: after.id,
            revision: after.revision,
            before,
            after,
            reason: command.reason,
            occurredAt,
          });
        const summary = await apply(tx, operationId, actor.user.id, audit);
        // Retire the source before adopting its CPF under canonical uniqueness.
        await tx.markMerged(identities);
        const target = await tx.updateTarget(identities, summary.changes);
        const entityType =
          identities.entityType === 'PERSON' ? 'Person' : 'Family';
        await audit('REGISTRATION', entityType, sources.target, target);
        const resolvedIssueIds: string[] = [];
        for (const before of sources.issues) {
          const after = await tx.resolveIssue(
            before.id,
            actor.user.id,
            command.reason,
          );
          await audit('REGISTRATION', 'DataQualityIssue', before, after);
          resolvedIssueIds.push(after.id);
        }
        for (const issue of await tx.missingData.openIssues(
          identities.entityType,
          identities.sourceId,
        )) {
          await tx.missingData.closeIssue(
            operationId,
            actor.user.id,
            issue,
            'MERGED',
            command.reason,
          );
          resolvedIssueIds.push(issue.id);
        }
        await reconcileMissingData(
          tx.missingData,
          operationId,
          actor.user.id,
          identities.entityType,
          target.id,
          target,
        );
        const merge = await tx.createMerge({
          ...identities,
          recordedBy: actor.user.id,
          reason: command.reason,
          operationId,
          resolution: {
            fieldSelections: command.fieldSelections,
            adoptedFields: preview.adoptedFields,
            ...summary.resolution,
            resolvedIssueIds,
          },
        });
        await tx.audit({
          operationId,
          actorId: actor.user.id,
          classification: 'REGISTRATION',
          entityType: 'IdentityMerge',
          entityId: merge.id,
          revision: 1,
          before: null,
          after: merge,
          reason: command.reason,
        });
        await tx.completeOperation(operationId, {
          merge: { entityType: 'IdentityMerge', entityId: merge.id },
          target: {
            entityType,
            entityId: target.id,
            revision: target.revision,
          },
        });
        return { merge, target };
      },
    );
  }
  private planFamily(sources: FamilyMergeSources, command: MergeCommand) {
    const changes = selectFields(
      sources.source,
      sources.target,
      familyKeys,
      command.fieldSelections,
    );
    if (
      command.membershipResolutions.length ||
      command.enrollmentResolutions.length ||
      command.attendanceResolutions.length ||
      command.sizeProfileResolution
    )
      throw new RegistrationRuleError('MERGE_RESOLUTION_INVALID');
    try {
      // Unified, the two families may not have two references at the same instant.
      assertMembershipPlan(
        sources.memberships.map((row) => ({
          ...row,
          familyId: sources.target.id,
        })),
        this.now(),
      );
    } catch (error) {
      if (error instanceof RegistrationConflictError)
        throw new RegistrationConflictError(
          'MERGE_REFERENCE_CONFLICT',
          error.ids,
        );
      throw error;
    }
    return async (
      tx: IdentityMergeTransaction,
      _operationId: string,
      _actorId: string,
      audit: Audit,
    ): Promise<Applied> => {
      for (const before of sources.memberships.filter(
        (row) => row.familyId === sources.source.id,
      ))
        await audit(
          'REGISTRATION',
          'FamilyMembership',
          before,
          await tx.updateMembership(before.id, { familyId: sources.target.id }),
          before.validFrom,
        );
      await this.applyAttendances(
        tx,
        sources,
        new Map(
          sources.attendances.map((row) => [
            row.id,
            { familyId: sources.target.id },
          ]),
        ),
        audit,
      );
      return {
        changes,
        resolution: {
          supersededMemberships: [],
          supersededEnrollments: [],
          supersededAttendances: [],
          sizeProfile: null,
        },
      };
    };
  }
  private async applyAttendances(
    tx: IdentityMergeTransaction,
    sources: MergeSources,
    changes: Map<string, AttendanceChanges>,
    audit: Audit,
  ) {
    const sessions = new Set<string>();
    // Duplicates leave the effective set first: the unique effective marking
    // per session and person is checked immediately, not at commit.
    const ordered = [...sources.attendances].sort(
      (a, b) =>
        Number(!changes.get(a.id)?.supersededById) -
        Number(!changes.get(b.id)?.supersededById),
    );
    for (const before of ordered) {
      const change = changes.get(before.id);
      if (!change) continue;
      const session = sources.sessions.find(
        (row) => row.id === before.sessionId,
      );
      await audit(
        'ATTENDANCE',
        'Attendance',
        before,
        await tx.updateAttendance(before.id, change),
        session?.occurredAt,
      );
      sessions.add(before.sessionId);
    }
    // Any change to a call bumps its session, so concurrent edits are detected.
    for (const before of sources.sessions.filter((row) => sessions.has(row.id)))
      await audit(
        'ATTENDANCE',
        'ActivitySession',
        before,
        await tx.reviseSession(before.id),
        before.occurredAt,
      );
  }
  private async planPerson(
    tx: IdentityMergeTransaction,
    sources: PersonMergeSources,
    preview: MergePreview,
    command: MergeCommand,
  ) {
    const { source, target } = sources;
    const changes = selectFields(
      source,
      target,
      personKeys,
      command.fieldSelections,
    );
    const memberships = resolveIntervals(
      this.membershipRows(sources),
      command.membershipResolutions,
      false,
    );
    const enrollments = resolveIntervals(
      this.enrollmentRows(sources),
      command.enrollmentResolutions,
      true,
    );
    const duplicates = resolveAttendances(
      preview.attendanceConflicts,
      command.attendanceResolutions,
    );
    if (preview.sizeProfileConflict && !command.sizeProfileResolution)
      throw new RegistrationConflictError('MERGE_RESOLUTION_REQUIRED', [
        source.id,
        target.id,
      ]);
    if (!preview.sizeProfileConflict && command.sizeProfileResolution)
      throw new RegistrationRuleError('MERGE_RESOLUTION_INVALID');
    const supersededMarks = new Set(duplicates.map((row) => row.supersededId));
    // A trimmed membership may not leave an effective marking outside its interval.
    for (const row of memberships.filter(
      (item) => item.changed && item.supersededById === null,
    )) {
      const invalid = (await tx.membershipMarkings(row.id)).filter(
        (mark) =>
          !supersededMarks.has(mark.id) &&
          !isMembershipCurrent(row, mark.occurredAt),
      );
      if (invalid.length)
        throw new RegistrationConflictError(
          'MEMBERSHIP_ATTENDANCE_CONFLICT',
          invalid.map((mark) => mark.id),
        );
    }
    return async (
      ports: IdentityMergeTransaction,
      operationId: string,
      actorId: string,
      audit: Audit,
    ): Promise<Applied> => {
      const invalidate = async (
        before: { validFrom: string; validUntil: string | null },
        after: { validFrom: string; validUntil: string | null },
      ) => {
        for (const personId of [source.id, target.id])
          await invalidateCoverage(
            ports.coverage,
            await ports.personCoverage(personId),
            changedCivilPeriods(before, after, this.timeZone),
            operationId,
            actorId,
            this.now(),
            'IDENTITY_MERGED',
          );
      };
      const attendanceChanges = new Map<string, AttendanceChanges>();
      const change = (id: string, values: AttendanceChanges) =>
        attendanceChanges.set(id, { ...attendanceChanges.get(id), ...values });
      for (const row of duplicates)
        change(row.supersededId, { supersededById: row.effectiveId });
      for (const row of sources.attendances)
        if (row.personId === source.id && !supersededMarks.has(row.id))
          change(row.id, { personId: target.id });

      const kept = new Map<string, RegisteredMembership>();
      const families = new Set<string>();
      for (const plan of memberships.filter(
        (row) => row.supersededById === null,
      )) {
        const before = sources.memberships.find((row) => row.id === plan.id)!;
        const moved = before.personId === source.id;
        if (!plan.changed && !moved) {
          kept.set(before.id, before);
          continue;
        }
        const after = await ports.updateMembership(before.id, {
          ...(plan.changed
            ? { validFrom: plan.validFrom, validUntil: plan.validUntil }
            : {}),
          ...(moved ? { personId: target.id } : {}),
        });
        await audit('REGISTRATION', 'FamilyMembership', before, after);
        if (plan.changed) await invalidate(before, after);
        kept.set(after.id, after);
        families.add(after.familyId);
      }
      const supersededMemberships = [];
      for (const plan of memberships) {
        if (plan.supersededById === null) continue;
        const before = sources.memberships.find((row) => row.id === plan.id)!;
        const keeper = kept.get(plan.supersededById)!;
        await audit(
          'REGISTRATION',
          'FamilyMembership',
          before,
          await ports.updateMembership(before.id, {
            supersededById: keeper.id,
          }),
        );
        // Markings follow the interval that now represents the same stretch.
        for (const mark of sources.attendances.filter(
          (row: Attendance) => row.membershipId === before.id,
        ))
          if (!supersededMarks.has(mark.id))
            change(mark.id, {
              membershipId: keeper.id,
              membershipRevision: keeper.revision,
            });
        families.add(before.familyId);
        supersededMemberships.push({
          id: before.id,
          supersededById: keeper.id,
        });
      }
      const supersededEnrollments = [];
      for (const plan of enrollments) {
        const before = sources.enrollments.find((row) => row.id === plan.id)!;
        const superseded = plan.supersededById !== null;
        const moved = !superseded && before.personId === source.id;
        if (!plan.changed && !moved) continue;
        const after = await ports.updateEnrollment(
          before.id,
          superseded
            ? { supersededById: plan.supersededById }
            : {
                ...(plan.changed
                  ? { validFrom: plan.validFrom, validUntil: plan.validUntil }
                  : {}),
                ...(moved ? { personId: target.id } : {}),
              },
          actorId,
        );
        await audit('PROJECTS', 'ParticipantEnrollment', before, after);
        if (superseded)
          supersededEnrollments.push({
            id: before.id,
            supersededById: plan.supersededById!,
          });
        else if (plan.changed) await invalidate(before, after);
      }
      await this.applyAttendances(ports, sources, attendanceChanges, audit);
      for (const before of sources.families.filter((row) =>
        families.has(row.id),
      ))
        await audit(
          'REGISTRATION',
          'Family',
          before,
          await ports.reviseFamily(before.id),
        );
      const sizes = sources.sizeProfiles;
      const chosen = command.sizeProfileResolution?.keep ?? null;
      // The canonical person carries the chosen profile; the other history stays untouched.
      if (sizes.source && (!sizes.target || chosen === 'SOURCE')) {
        const after = await ports.saveSizes({
          ...sizes.source,
          personId: target.id,
          revision: (sizes.target?.revision ?? 0) + 1,
        });
        await ports.audit({
          operationId,
          actorId,
          classification: 'REGISTRATION',
          entityType: 'SizeProfile',
          entityId: target.id,
          revision: after.revision,
          before: sizes.target,
          after,
          reason: command.reason,
        });
      }
      return {
        changes,
        resolution: {
          supersededMemberships,
          supersededEnrollments,
          supersededAttendances: duplicates.map((row) => ({
            id: row.supersededId,
            supersededById: row.effectiveId,
          })),
          sizeProfile: chosen,
        },
      };
    };
  }
}
type Audit = (
  classification: 'REGISTRATION' | 'PROJECTS' | 'ATTENDANCE',
  entityType: string,
  before: { id: string } | null,
  after: { id: string; revision: number },
  occurredAt?: string,
) => Promise<void>;
interface Applied {
  changes: Record<string, string>;
  resolution: Omit<
    MergeResolutionSummary,
    'fieldSelections' | 'adoptedFields' | 'resolvedIssueIds'
  >;
}
