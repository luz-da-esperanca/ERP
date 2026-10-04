import { ApplicationError, civilDateSchema } from '@erp/contracts/common';
import type { QualityIssue, ReachRecord } from '@erp/contracts/reports';
import type { DemoRuntime } from '../../../demo/runtime';
import { requireFound } from '../../../demo/runtime';
import {
  familyMemberships,
  duplicatePeople,
} from '../../registration/domain/memberships';
import {
  frequencyOpportunities,
  summarizeFrequency,
} from '../../attendance/domain/frequency';
import { isWithin, startOfDay } from '../../../shared/time';
import type { ReportsGateway } from '../application/reports-gateway';

function validatePeriod(from: string, to: string) {
  civilDateSchema.parse(from);
  civilDateSchema.parse(to);
  if (from >= to)
    throw new ApplicationError(
      'VALIDATION_ERROR',
      'Report period must be ordered',
    );
}
export function createDemoReports(runtime: DemoRuntime): ReportsGateway {
  return {
    async reach(from, toExclusive) {
      validatePeriod(from, toExclusive);
      return runtime.read('reports.read', (s) => {
        const sessions = s.sessions.filter(
          (session) =>
            session.status === 'COMPLETED' &&
            isWithin(
              session.occurredAt,
              startOfDay(from),
              startOfDay(toExclusive),
            ),
        );
        const records: ReachRecord[] = sessions.flatMap((session) =>
          session.entries
            .filter((e) => e.status === 'PRESENT')
            .map((entry) => ({
              sessionId: session.id,
              personId: entry.personId,
              personName: requireFound(
                s.people.find((p) => p.id === entry.personId),
              ).name,
              familyId: entry.familyId,
              familyCode: requireFound(
                s.families.find((f) => f.id === entry.familyId),
              ).code,
              activityId: session.activityId,
              activityName: requireFound(
                s.activities.find((a) => a.id === session.activityId),
              ).name,
              occurredAt: session.occurredAt,
            })),
        );
        return {
          from,
          toExclusive,
          generatedAt: runtime.now(),
          people: new Set(records.map((r) => r.personId)).size,
          families: new Set(records.map((r) => r.familyId)).size,
          sessions: sessions.length,
          presences: records.length,
          records,
          sessionRecords: sessions.map((session) => ({
            id: session.id,
            activityName: requireFound(
              s.activities.find((a) => a.id === session.activityId),
            ).name,
            occurredAt: session.occurredAt,
          })),
        };
      });
    },
    async frequency(from, toExclusive) {
      validatePeriod(from, toExclusive);
      runtime.authorize('reports.read');
      return runtime.read('attendance.read', (s) => ({
        ...summarizeFrequency(
          frequencyOpportunities(s, startOfDay(from), startOfDay(toExclusive)),
        ),
        from,
        toExclusive,
      }));
    },
    async quality() {
      return runtime.read('registration.read', (s) => {
        const issues: QualityIssue[] = s.families
          .filter(
            (f) =>
              !familyMemberships(s.memberships, f.id, runtime.now()).some(
                (m) => m.isReference,
              ),
          )
          .map((f) => ({
            id: `reference-${f.id}`,
            entityId: f.id,
            entityType: 'FAMILY',
            label: f.referenceName ?? `Família ${f.code}`,
            kind: 'MISSING_REFERENCE',
          }));
        for (const p of s.people) {
          if (!p.birthDate)
            issues.push({
              id: `birth-${p.id}`,
              entityId: p.id,
              entityType: 'PERSON',
              label: p.name,
              kind: 'MISSING_BIRTH_DATE',
            });
          if (
            duplicatePeople(
              s.people.filter((other) => other.id !== p.id),
              p.name,
              p.cpf,
            ).length
          )
            issues.push({
              id: `duplicate-${p.id}`,
              entityId: p.id,
              entityType: 'PERSON',
              label: p.name,
              kind: 'POSSIBLE_DUPLICATE',
            });
        }
        return issues;
      });
    },
  };
}
