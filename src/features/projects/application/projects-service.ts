import type {
  CommandContext,
  Principal,
} from '../../access/application/ports.js';
import { assertSessionDate } from '../../attendance/domain/frequency-rules.js';
import { AttendanceRuleError } from '../../attendance/domain/attendance-errors.js';
import {
  invalidateCoverage,
  changedCivilPeriods,
} from '../../attendance/application/coverage-invalidation.js';
import type { Capability } from '@erp/contracts/access';
import type { OperationFingerprints } from '../../access/application/account-transactions.js';
import {
  assertPermission,
  capabilitiesFor,
} from '../../access/domain/permissions.js';
import { PermissionDeniedError } from '../../access/domain/account-errors.js';
import { AuthenticationRequiredError } from '../../access/application/access-errors.js';
import {
  IdempotencyConflictError,
  ResourceNotFoundError,
} from '../../../core/application/errors.js';
import {
  ProjectsConflictError,
  ProjectsRevisionConflictError,
  ProjectsRuleError,
} from '../domain/project-errors.js';
import type {
  CatalogEntity,
  CatalogQuery,
  ProjectsResults,
  ProjectsResultKind,
  ProjectsSnapshot,
  ProjectsReference,
  ProjectsEntity,
} from '../domain/projects.js';
import type {
  ProjectsReader,
  ProjectsTransaction,
  ProjectsUnitOfWork,
} from './projects-ports.js';
import type {
  ProjectFields,
  ActivityFields,
  ProjectsQuery,
  ActivitiesQuery,
  Project,
  Activity,
  EnrollmentsQuery,
  Enrollment,
} from '../domain/projects.js';
import {
  assertEnrollmentInterval,
  assertEnrollmentAvailability,
  assertClosurePlan,
  assertProjectPeriod,
  assertActivityNature,
} from '../domain/activity-rules.js';

function referenceFor(
  kind: ProjectsResultKind,
  result: ProjectsResults[ProjectsResultKind],
): ProjectsReference {
  const reference = (entityType: ProjectsEntity, value: ProjectsSnapshot) => ({
    entityType,
    entityId: value.id,
    revision: value.revision,
  });
  if ('project' in result)
    return {
      kind,
      primary: reference('Project', result.project),
      activities: result.activities.map((item) => reference('Activity', item)),
      enrollments: result.enrollments.map((item) =>
        reference('ParticipantEnrollment', item),
      ),
    };
  if ('activity' in result)
    return {
      kind,
      primary: reference('Activity', result.activity),
      activities: [],
      enrollments: result.enrollments.map((item) =>
        reference('ParticipantEnrollment', item),
      ),
    };
  return {
    kind,
    primary: reference(kind as ProjectsEntity, result),
    activities: [],
    enrollments: [],
  };
}

export class ProjectsService {
  constructor(
    private readonly reader: ProjectsReader,
    private readonly unitOfWork: ProjectsUnitOfWork,
    private readonly fingerprints: OperationFingerprints,
    private readonly now: () => string,
    private readonly timeZone: string,
  ) {}

  private authorize(actor: Principal, capabilities: readonly Capability[]) {
    if (actor.user.mustChangePassword)
      assertPermission(actor.user.roleCodes, true, capabilities[0]!);
    const available = capabilitiesFor(actor.user.roleCodes);
    if (!capabilities.some((capability) => available.includes(capability)))
      throw new PermissionDeniedError();
  }
  private command<K extends ProjectsResultKind>(
    kind: K,
    type: string,
    context: CommandContext,
    input: unknown,
    capabilities: readonly Capability[],
    work: (
      tx: ProjectsTransaction,
      operationId: string,
    ) => Promise<ProjectsResults[K]>,
  ) {
    return this.unitOfWork.run(context.actor.user.id, async (tx) => {
      const actor = await tx.findActor(context.actor.user.id);
      if (
        !actor?.user.active ||
        actor.authVersion !== context.actor.authVersion
      )
        throw new AuthenticationRequiredError();
      this.authorize(actor, capabilities);
      const fingerprint = this.fingerprints.calculate({ type, input }, null);
      const existing = await tx.findOperation(type, context.key);
      if (existing) {
        if (
          existing.actorId !== actor.user.id ||
          !this.fingerprints.matches(existing.fingerprint, fingerprint) ||
          existing.reference.kind !== kind
        )
          throw new IdempotencyConflictError();
        return tx.restore({ ...existing.reference, kind });
      }
      const operationId = await tx.createOperation(
        type,
        context.key,
        actor.user.id,
        fingerprint,
      );
      const result = await work(tx, operationId);
      await tx.completeOperation(operationId, referenceFor(kind, result));
      return result;
    });
  }
  private require<T>(record: T | null): T {
    if (!record) throw new ResourceNotFoundError();
    return record;
  }
  private revision(record: { revision: number }, expected: number) {
    if (record.revision !== expected)
      throw new ProjectsRevisionConflictError(record.revision);
  }
  catalogs(actor: Principal, entity: CatalogEntity, query: CatalogQuery) {
    this.authorize(actor, ['projects.read']);
    return this.reader.catalogs(entity, query);
  }
  createServiceType(
    context: CommandContext,
    input: { code: string; name: string },
  ) {
    return this.command(
      'ServiceType',
      'projects.serviceTypes.create',
      context,
      input,
      ['projects.write'],
      async (tx, operationId) => {
        if (await tx.findServiceTypeByCode(input.code))
          throw new ProjectsConflictError('CATALOG_CODE_EXISTS');
        const after = await tx.createServiceType(input);
        await tx.appendAudit({
          operationId,
          actorId: context.actor.user.id,
          entityType: 'ServiceType',
          before: null,
          after,
          action: 'CREATE',
        });
        return after;
      },
    );
  }
  updateCatalog(
    context: CommandContext,
    entity: CatalogEntity,
    id: string,
    input: {
      expectedRevision: number;
      name?: string;
      active?: boolean;
      reason: string;
    },
  ) {
    return this.command(
      entity,
      `projects.${entity}.update`,
      context,
      { id, ...input },
      ['projects.write'],
      async (tx, operationId) => {
        const before = this.require(await tx.findCatalog(entity, id));
        this.revision(before, input.expectedRevision);
        if (
          (input.name === undefined || input.name === before.name) &&
          (input.active === undefined || input.active === before.active)
        )
          return before;
        const after = await tx.updateCatalog(entity, id, {
          name: input.name,
          active: input.active,
        });
        await tx.appendAudit({
          operationId,
          actorId: context.actor.user.id,
          entityType: entity,
          before,
          after,
          action: 'UPDATE',
          reason: input.reason,
        });
        return after;
      },
    );
  }
  private async activeCatalog(
    tx: ProjectsTransaction,
    entity: CatalogEntity,
    id: string,
  ) {
    const record = this.require(await tx.findCatalog(entity, id));
    if (!record.active) throw new ProjectsRuleError('INACTIVE_CATALOG');
  }
  private async activityFields(
    tx: ProjectsTransaction,
    input: ActivityFields,
    before?: ActivityFields,
  ) {
    assertActivityNature(input.nature, input.serviceTypeId);
    if (
      input.serviceTypeId !== null &&
      input.serviceTypeId !== before?.serviceTypeId
    )
      await this.activeCatalog(tx, 'ServiceType', input.serviceTypeId);
    if (
      input.responsibleId !== null &&
      input.responsibleId !== before?.responsibleId &&
      !(await tx.accountExists(input.responsibleId))
    )
      throw new ResourceNotFoundError();
  }
  private changed(before: object, changes: object) {
    return Object.entries(changes).some(
      ([key, value]) =>
        value !== undefined &&
        value !== (before as Record<string, unknown>)[key],
    );
  }
  private async auditUpdate(
    tx: ProjectsTransaction,
    operationId: string,
    actorId: string,
    entityType: ProjectsEntity,
    before: ProjectsSnapshot,
    after: ProjectsSnapshot,
    reason?: string,
    occurredAt?: string,
    action: 'UPDATE' | 'CLOSE' | 'CORRECT' = 'UPDATE',
  ) {
    await tx.appendAudit({
      operationId,
      actorId,
      entityType,
      before,
      after,
      action,
      reason,
      occurredAt,
    });
  }
  private async reviseProject(
    tx: ProjectsTransaction,
    operationId: string,
    actorId: string,
    before: Project,
  ) {
    const after = await tx.updateProject(before.id, {}, actorId);
    await this.auditUpdate(tx, operationId, actorId, 'Project', before, after);
  }
  projects(actor: Principal, query: ProjectsQuery) {
    this.authorize(actor, ['projects.read']);
    return this.reader.projects(query);
  }
  activities(actor: Principal, query: ActivitiesQuery) {
    this.authorize(actor, ['projects.read']);
    return this.reader.activities(query);
  }
  async project(actor: Principal, id: string) {
    this.authorize(actor, ['projects.read']);
    return this.require(await this.reader.project(id));
  }
  async activity(actor: Principal, id: string, asOf = this.now()) {
    this.authorize(actor, ['projects.read']);
    return this.require(await this.reader.activity(id, asOf));
  }
  createProject(context: CommandContext, input: ProjectFields) {
    return this.command(
      'Project',
      'projects.projects.create',
      context,
      input,
      ['projects.write'],
      async (tx, operationId) => {
        assertProjectPeriod(input.startsOn, input.endsOn);
        await this.activeCatalog(tx, 'Institute', input.instituteId);
        const after = await tx.createProject(input, context.actor.user.id);
        await tx.appendAudit({
          operationId,
          actorId: context.actor.user.id,
          entityType: 'Project',
          before: null,
          after,
          action: 'CREATE',
        });
        return after;
      },
    );
  }
  updateProject(
    context: CommandContext,
    id: string,
    input: Partial<ProjectFields> & { expectedRevision: number },
  ) {
    return this.command(
      'Project',
      'projects.projects.update',
      context,
      { id, ...input },
      ['projects.write'],
      async (tx, operationId) => {
        const before = this.require(await tx.findProject(id));
        const { expectedRevision, ...changes } = input;
        this.revision(before, expectedRevision);
        const next = { ...before, ...changes };
        assertProjectPeriod(next.startsOn, next.endsOn);
        if (next.instituteId !== before.instituteId)
          await this.activeCatalog(tx, 'Institute', next.instituteId);
        if (
          next.startsOn !== before.startsOn ||
          next.endsOn !== before.endsOn
        ) {
          const conflicts: string[] = [];
          for (const activity of await tx.projectActivities(id)) {
            for (const session of await tx.activitySessions(activity.id)) {
              if (session.status === 'CANCELED') continue;
              try {
                assertSessionDate(
                  activity,
                  next,
                  session.occurredAt,
                  this.now(),
                  this.timeZone,
                );
              } catch (error) {
                if (!(error instanceof AttendanceRuleError)) throw error;
                conflicts.push(session.id);
              }
            }
            for (const enrollment of await tx.activityEnrollments(
              activity.id,
            )) {
              if (enrollment.supersededById !== null) continue;
              try {
                assertEnrollmentInterval(
                  activity,
                  next,
                  enrollment.validFrom,
                  enrollment.validUntil,
                  this.now(),
                  this.timeZone,
                );
              } catch (error) {
                if (!(error instanceof ProjectsRuleError)) throw error;
                conflicts.push(enrollment.id);
              }
            }
          }
          if (conflicts.length)
            throw new ProjectsConflictError(
              'PROJECT_PERIOD_CONFLICT',
              conflicts,
            );
        }
        if (!this.changed(before, changes)) return before;
        const after = await tx.updateProject(
          id,
          changes,
          context.actor.user.id,
        );
        await this.auditUpdate(
          tx,
          operationId,
          context.actor.user.id,
          'Project',
          before,
          after,
        );
        return after;
      },
    );
  }
  createActivity(
    context: CommandContext,
    projectId: string,
    input: ActivityFields & { expectedProjectRevision: number },
  ) {
    return this.command(
      'Activity',
      'projects.activities.create',
      context,
      { projectId, ...input },
      ['projects.write'],
      async (tx, operationId) => {
        const project = this.require(await tx.findProject(projectId));
        const { expectedProjectRevision, ...fields } = input;
        this.revision(project, expectedProjectRevision);
        if (project.status !== 'ACTIVE')
          throw new ProjectsRuleError('RECORD_CLOSED');
        await this.activityFields(tx, fields);
        const after = await tx.createActivity(
          projectId,
          fields,
          context.actor.user.id,
        );
        await tx.appendAudit({
          operationId,
          actorId: context.actor.user.id,
          entityType: 'Activity',
          before: null,
          after,
          action: 'CREATE',
        });
        await this.reviseProject(
          tx,
          operationId,
          context.actor.user.id,
          project,
        );
        return after;
      },
    );
  }
  updateActivity(
    context: CommandContext,
    id: string,
    input: Partial<ActivityFields> & {
      projectId?: string;
      expectedRevision: number;
    },
  ) {
    return this.command(
      'Activity',
      'projects.activities.update',
      context,
      { id, ...input },
      ['projects.write'],
      async (tx, operationId) => {
        const before = this.require(await tx.findActivity(id, input.projectId));
        const { expectedRevision, ...changes } = input;
        this.revision(before, expectedRevision);
        const next = { ...before, ...changes };
        if (
          next.nature !== before.nature ||
          next.projectId !== before.projectId
        ) {
          if (
            (await tx.activityEnrollments(id)).length ||
            (await tx.activitySessions(id)).length
          )
            throw new ProjectsConflictError('ACTIVITY_HAS_HISTORY', [id]);
          if (before.status !== 'ACTIVE')
            throw new ProjectsRuleError('RECORD_CLOSED');
        }
        await this.activityFields(tx, next, before);
        if (next.projectId !== before.projectId) {
          const project = this.require(await tx.findProject(next.projectId));
          if (project.status !== 'ACTIVE')
            throw new ProjectsRuleError('RECORD_CLOSED');
          await this.reviseProject(
            tx,
            operationId,
            context.actor.user.id,
            this.require(await tx.findProject(before.projectId)),
          );
          await this.reviseProject(
            tx,
            operationId,
            context.actor.user.id,
            project,
          );
        }
        if (!this.changed(before, changes)) return before;
        const after = await tx.updateActivity(
          id,
          changes,
          context.actor.user.id,
        );
        await this.auditUpdate(
          tx,
          operationId,
          context.actor.user.id,
          'Activity',
          before,
          after,
        );
        return after;
      },
    );
  }
  async enrollments(
    actor: Principal,
    activityId: string,
    query: EnrollmentsQuery,
  ) {
    this.authorize(actor, ['projects.read']);
    return this.require(await this.reader.enrollments(activityId, query));
  }
  private async reviseActivity(
    tx: ProjectsTransaction,
    operationId: string,
    actorId: string,
    before: Activity,
    reason?: string,
    occurredAt?: string,
  ) {
    const after = await tx.updateActivity(before.id, {}, actorId);
    await this.auditUpdate(
      tx,
      operationId,
      actorId,
      'Activity',
      before,
      after,
      reason,
      occurredAt,
    );
  }
  private async invalidateEnrollmentCoverage(
    tx: ProjectsTransaction,
    operationId: string,
    actorId: string,
    before: Enrollment | null,
    after: Enrollment,
  ) {
    await invalidateCoverage(
      tx.coverage,
      await tx.activityCoverage(after.activityId),
      changedCivilPeriods(before, after, this.timeZone),
      operationId,
      actorId,
      this.now(),
      'ENROLLMENT_CHANGED',
    );
  }
  createEnrollment(
    context: CommandContext,
    activityId: string,
    input: {
      expectedActivityRevision: number;
      personId: string;
      validFrom: string;
      validUntil: string | null;
    },
  ) {
    return this.command(
      'ParticipantEnrollment',
      'projects.enrollments.create',
      context,
      { activityId, ...input },
      ['attendance.write', 'projects.write'],
      async (tx, operationId) => {
        const activity = this.require(await tx.findActivity(activityId));
        this.revision(activity, input.expectedActivityRevision);
        const project = this.require(await tx.findProject(activity.projectId));
        assertEnrollmentInterval(
          activity,
          project,
          input.validFrom,
          input.validUntil,
          this.now(),
          this.timeZone,
        );
        if (!(await tx.personExists(input.personId)))
          throw new ResourceNotFoundError();
        if (!(await tx.hasFamilyMembership(input.personId, input.validFrom)))
          throw new ProjectsRuleError('PERSON_WITHOUT_MEMBERSHIP');
        assertEnrollmentAvailability(
          await tx.activityEnrollments(activityId),
          input.personId,
          input.validFrom,
          input.validUntil,
        );
        const after = await tx.createEnrollment(
          {
            activityId,
            personId: input.personId,
            validFrom: input.validFrom,
            validUntil: input.validUntil,
          },
          context.actor.user.id,
        );
        await tx.appendAudit({
          operationId,
          actorId: context.actor.user.id,
          entityType: 'ParticipantEnrollment',
          before: null,
          after,
          action: 'CREATE',
          occurredAt: input.validFrom,
        });
        await this.reviseActivity(
          tx,
          operationId,
          context.actor.user.id,
          activity,
          undefined,
          input.validFrom,
        );
        await this.invalidateEnrollmentCoverage(
          tx,
          operationId,
          context.actor.user.id,
          null,
          after,
        );
        return after;
      },
    );
  }
  correctEnrollment(
    context: CommandContext,
    id: string,
    input: {
      expectedRevision: number;
      validFrom?: string;
      validUntil?: string | null;
      reason: string;
    },
  ) {
    return this.changeEnrollment(context, id, input, 'CORRECT');
  }
  closeEnrollment(
    context: CommandContext,
    id: string,
    input: { expectedRevision: number; validUntil: string; reason: string },
  ) {
    return this.changeEnrollment(context, id, input, 'CLOSE');
  }
  private changeEnrollment(
    context: CommandContext,
    id: string,
    input: {
      expectedRevision: number;
      validFrom?: string;
      validUntil?: string | null;
      reason: string;
    },
    action: 'CORRECT' | 'CLOSE',
  ) {
    return this.command(
      'ParticipantEnrollment',
      `projects.enrollments.${action === 'CLOSE' ? 'close' : 'correct'}`,
      context,
      { id, ...input },
      ['attendance.write', 'projects.write'],
      async (tx, operationId) => {
        const before = this.require(await tx.findEnrollment(id));
        if (before.supersededById !== null)
          throw new ProjectsRuleError('RECORD_CLOSED');
        this.revision(before, input.expectedRevision);
        const activity = this.require(await tx.findActivity(before.activityId));
        const project = this.require(await tx.findProject(activity.projectId));
        const validFrom = input.validFrom ?? before.validFrom;
        const validUntil =
          input.validUntil === undefined ? before.validUntil : input.validUntil;
        if (action === 'CLOSE' && validUntil !== null) {
          if (Date.parse(validUntil) > Date.parse(this.now()))
            throw new ProjectsRuleError('FUTURE_EFFECTIVE_DATE');
          if (
            before.validUntil !== null &&
            Date.parse(validUntil) > Date.parse(before.validUntil)
          )
            throw new ProjectsRuleError('INVALID_ENROLLMENT_INTERVAL');
        }
        assertEnrollmentInterval(
          activity,
          project,
          validFrom,
          validUntil,
          this.now(),
          this.timeZone,
        );
        if (
          validFrom !== before.validFrom &&
          !(await tx.hasFamilyMembership(before.personId, validFrom))
        )
          throw new ProjectsRuleError('PERSON_WITHOUT_MEMBERSHIP');
        assertEnrollmentAvailability(
          await tx.activityEnrollments(activity.id),
          before.personId,
          validFrom,
          validUntil,
          id,
        );
        if (validFrom === before.validFrom && validUntil === before.validUntil)
          return before;
        const after = await tx.updateEnrollment(
          id,
          { validFrom, validUntil },
          context.actor.user.id,
        );
        const occurredAt = action === 'CLOSE' ? validUntil! : validFrom;
        await this.auditUpdate(
          tx,
          operationId,
          context.actor.user.id,
          'ParticipantEnrollment',
          before,
          after,
          input.reason,
          occurredAt,
          action,
        );
        await this.reviseActivity(
          tx,
          operationId,
          context.actor.user.id,
          activity,
          input.reason,
          occurredAt,
        );
        await this.invalidateEnrollmentCoverage(
          tx,
          operationId,
          context.actor.user.id,
          before,
          after,
        );
        return after;
      },
    );
  }
  private async closeEnrollmentIntervals(
    tx: ProjectsTransaction,
    operationId: string,
    actorId: string,
    rows: readonly Enrollment[],
    effectiveAt: string,
    reason: string,
  ) {
    const changes: Enrollment[] = [];
    for (const before of rows) {
      if (
        before.supersededById !== null ||
        (before.validUntil !== null &&
          Date.parse(before.validUntil) <= Date.parse(effectiveAt))
      )
        continue;
      const after = await tx.updateEnrollment(
        before.id,
        { validUntil: effectiveAt },
        actorId,
      );
      await this.auditUpdate(
        tx,
        operationId,
        actorId,
        'ParticipantEnrollment',
        before,
        after,
        reason,
        effectiveAt,
        'CLOSE',
      );
      changes.push(after);
      await this.invalidateEnrollmentCoverage(
        tx,
        operationId,
        actorId,
        before,
        after,
      );
    }
    return changes;
  }
  closeActivity(
    context: CommandContext,
    id: string,
    input: { expectedRevision: number; effectiveAt: string; reason: string },
  ) {
    return this.command(
      'ActivityClosure',
      'projects.activities.close',
      context,
      { id, ...input },
      ['projects.write'],
      async (tx, operationId) => {
        const before = this.require(await tx.findActivity(id));
        this.revision(before, input.expectedRevision);
        assertClosurePlan([], [], input.effectiveAt, this.now());
        if (before.status === 'CLOSED') {
          if (before.closedAt !== input.effectiveAt)
            throw new ProjectsRuleError('RECORD_CLOSED');
          return { activity: before, enrollments: [] };
        }
        const rows = await tx.activityEnrollments(id);
        assertClosurePlan(
          [],
          rows,
          input.effectiveAt,
          this.now(),
          await tx.activitySessions(id),
        );
        const enrollments = await this.closeEnrollmentIntervals(
          tx,
          operationId,
          context.actor.user.id,
          rows,
          input.effectiveAt,
          input.reason,
        );
        const activity = await tx.updateActivity(
          id,
          { status: 'CLOSED', closedAt: input.effectiveAt },
          context.actor.user.id,
        );
        await this.auditUpdate(
          tx,
          operationId,
          context.actor.user.id,
          'Activity',
          before,
          activity,
          input.reason,
          input.effectiveAt,
          'CLOSE',
        );
        return { activity, enrollments };
      },
    );
  }
  closeProject(
    context: CommandContext,
    id: string,
    input: { expectedRevision: number; effectiveAt: string; reason: string },
  ) {
    return this.command(
      'ProjectClosure',
      'projects.projects.close',
      context,
      { id, ...input },
      ['projects.write'],
      async (tx, operationId) => {
        const before = this.require(await tx.findProject(id));
        this.revision(before, input.expectedRevision);
        assertClosurePlan([], [], input.effectiveAt, this.now());
        if (before.status === 'CLOSED') {
          if (before.closedAt !== input.effectiveAt)
            throw new ProjectsRuleError('RECORD_CLOSED');
          return { project: before, activities: [], enrollments: [] };
        }
        const allActivities = await tx.projectActivities(id);
        const allEnrollments: Enrollment[] = [];
        const allSessions = [];
        for (const activity of allActivities)
          allEnrollments.push(...(await tx.activityEnrollments(activity.id)));
        for (const activity of allActivities)
          allSessions.push(...(await tx.activitySessions(activity.id)));
        assertClosurePlan(
          allActivities,
          allEnrollments,
          input.effectiveAt,
          this.now(),
          allSessions,
        );
        const activities: Activity[] = [];
        const enrollments: Enrollment[] = [];
        for (const previous of allActivities) {
          if (previous.status === 'CLOSED') continue;
          enrollments.push(
            ...(await this.closeEnrollmentIntervals(
              tx,
              operationId,
              context.actor.user.id,
              allEnrollments.filter((row) => row.activityId === previous.id),
              input.effectiveAt,
              input.reason,
            )),
          );
          const after = await tx.updateActivity(
            previous.id,
            { status: 'CLOSED', closedAt: input.effectiveAt },
            context.actor.user.id,
          );
          await this.auditUpdate(
            tx,
            operationId,
            context.actor.user.id,
            'Activity',
            previous,
            after,
            input.reason,
            input.effectiveAt,
            'CLOSE',
          );
          activities.push(after);
        }
        const project = await tx.updateProject(
          id,
          { status: 'CLOSED', closedAt: input.effectiveAt },
          context.actor.user.id,
        );
        await this.auditUpdate(
          tx,
          operationId,
          context.actor.user.id,
          'Project',
          before,
          project,
          input.reason,
          input.effectiveAt,
          'CLOSE',
        );
        return { project, activities, enrollments };
      },
    );
  }
}
