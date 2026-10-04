import {
  projectInputSchema,
  activityInputSchema,
} from '@erp/contracts/projects';
import {
  ApplicationError,
  idSchema,
  instantSchema,
} from '@erp/contracts/common';
import type { DemoRuntime } from '../../../demo/runtime';
import { requireFound, requireRevision } from '../../../demo/runtime';
import type { ProjectsGateway } from '../application/projects-gateway';
import { isWithin } from '../../../shared/time';
import { membershipAt } from '../../registration/domain/memberships';
import { validateActivityFact } from '../domain/activity-rules';

export function createDemoProjects(runtime: DemoRuntime): ProjectsGateway {
  return {
    async overview() {
      return runtime.read('projects.read', (s) => ({
        projects: s.projects,
        activities: s.activities,
        institutes: s.institutes,
        serviceTypes: s.serviceTypes,
      }));
    },
    async createProject(raw) {
      const input = projectInputSchema.parse(raw);
      return runtime.execute('projects.write', (s) => {
        requireFound(
          s.institutes.find((i) => i.id === input.instituteId && i.active),
        );
        const project = {
          ...input,
          id: runtime.id(),
          status: 'ACTIVE' as const,
          closedAt: null,
          revision: 1,
        };
        s.projects.push(project);
        return {
          result: project,
          change: {
            entityId: project.id,
            entityLabel: project.name,
            action: 'CREATE',
            occurredAt: null,
            reason: null,
            readCapability: 'projects.read',
            before: null,
            after: { ...project },
          },
        };
      });
    },
    async createActivity(raw) {
      const input = activityInputSchema.parse(raw);
      return runtime.execute('projects.write', (s) => {
        requireFound(
          s.projects.find(
            (p) => p.id === input.projectId && p.status === 'ACTIVE',
          ),
        );
        if (input.serviceTypeId)
          requireFound(
            s.serviceTypes.find(
              (t) => t.id === input.serviceTypeId && t.active,
            ),
          );
        const activity = {
          ...input,
          id: runtime.id(),
          status: 'ACTIVE' as const,
          closedAt: null,
          revision: 1,
        };
        s.activities.push(activity);
        return {
          result: activity,
          change: {
            entityId: activity.id,
            entityLabel: activity.name,
            action: 'CREATE',
            occurredAt: null,
            reason: null,
            readCapability: 'projects.read',
            before: null,
            after: { ...activity },
          },
        };
      });
    },
    async getActivity(id, asOf) {
      instantSchema.parse(asOf);
      return runtime.read('projects.read', (s) => {
        const activity = requireFound(s.activities.find((a) => a.id === id));
        return {
          activity,
          project: requireFound(
            s.projects.find((p) => p.id === activity.projectId),
          ),
          participants: s.people.map((p) => {
            const membership = membershipAt(s.memberships, p.id, asOf);
            return {
              id: p.id,
              name: p.name,
              familyCode:
                s.families.find((f) => f.id === membership?.familyId)?.code ??
                null,
              enrolled: s.enrollments.some(
                (e) =>
                  e.activityId === id &&
                  e.personId === p.id &&
                  isWithin(asOf, e.validFrom, e.validUntil),
              ),
            };
          }),
        };
      });
    },
    async enroll(activityId, personId, validFrom, revision) {
      idSchema.parse(personId);
      instantSchema.parse(validFrom);
      runtime.execute('attendance.write', (s) => {
        const activity = requireFound(
          s.activities.find((a) => a.id === activityId),
        );
        const project = requireFound(
          s.projects.find((p) => p.id === activity.projectId),
        );
        requireRevision(activity.revision, revision);
        validateActivityFact(activity, project, validFrom, runtime.now());
        requireFound(s.people.find((p) => p.id === personId));
        requireFound(membershipAt(s.memberships, personId, validFrom));
        if (
          s.enrollments.some(
            (e) =>
              e.activityId === activityId &&
              e.personId === personId &&
              (e.validUntil === null ||
                Date.parse(e.validUntil) > Date.parse(validFrom)),
          )
        )
          throw new ApplicationError(
            'DOMAIN_CONFLICT',
            'Enrollment intervals overlap',
          );
        const enrollment = {
          id: runtime.id(),
          activityId,
          personId,
          validFrom,
          validUntil: null,
          revision: 1,
        };
        s.enrollments.push(enrollment);
        activity.revision += 1;
        return {
          result: undefined,
          change: {
            entityId: activityId,
            entityLabel: activity.name,
            action: 'CREATE',
            occurredAt: validFrom,
            reason: null,
            readCapability: 'attendance.read',
            before: null,
            after: { ...enrollment },
          },
        };
      });
    },
  };
}
