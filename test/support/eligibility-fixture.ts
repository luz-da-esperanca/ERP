import { assertPolicyDefinition } from '../../src/features/eligibility/domain/policy-rules.js';
import type {
  ActivityEvidenceSources,
  EligibilityPolicy,
  EvidenceSnapshot,
  PolicyDraft,
} from '../../src/features/eligibility/domain/eligibility.js';

export const timeZone = 'America/Fortaleza';
const uuid = (group: string, value: number) =>
  `00000000-0000-4000-8000-${group}${String(value).padStart(8, '0')}`;
export const familyId = uuid('fa00', 1);
export const otherFamilyId = uuid('fa00', 2);
export const activityId = uuid('ac00', 1);
export const otherActivityId = uuid('ac00', 2);
export const personId = (value: number) => uuid('be00', value);
const actorId = uuid('0c00', 1);

export function policyDraft(changes: Partial<PolicyDraft> = {}): PolicyDraft {
  return {
    schemaVersion: 1,
    period: { type: 'ROLLING_DAYS', length: 30 },
    minimum: { type: 'PRESENCE_COUNT', value: 2 },
    activityIds: [activityId],
    activityCombination: 'ANY_ACTIVITY',
    membershipScope: 'CURRENT_ON_REFERENCE',
    opportunityRule: 'ENROLLMENT_OR_RECORDED',
    justificationRule: 'NOT_SUPPORTED',
    recessRule: 'RECORDED_SESSIONS_ONLY',
    newParticipantRule: 'OPPORTUNITY_RULE',
    toleranceRule: 'NONE',
    incompleteEvidenceRule: 'THREE_VALUED',
    ...changes,
  };
}
export function publishedPolicy(
  changes: Partial<PolicyDraft> = {},
  effectiveFrom = '2026-01-01',
  id = uuid('b000', 1),
): EligibilityPolicy {
  return {
    id,
    effectiveFrom,
    definition: assertPolicyDefinition(policyDraft(changes)),
    decisionReference: 'Synthetic decision reference',
    reason: 'Synthetic policy fixture',
    recordedAt: '2026-01-01T12:00:00.000Z',
    recordedBy: actorId,
  };
}

/** Builds synthetic sources; civil days are converted at 13:00 UTC, inside the Fortaleza day. */
export function evidenceBuilder() {
  let sequence = 0;
  const next = (group: string) => uuid(group, ++sequence);
  const snapshot: EvidenceSnapshot = { memberships: [], activities: [] };
  const sources = (id: string): ActivityEvidenceSources => {
    let found = snapshot.activities.find((row) => row.activityId === id);
    if (!found) {
      found = {
        activityId: id,
        sessions: [],
        attendances: [],
        enrollments: [],
        declarations: [],
      };
      snapshot.activities.push(found);
    }
    return found;
  };
  const builder = {
    snapshot,
    member(
      person: number,
      options: {
        family?: string;
        from?: string;
        until?: string | null;
      } = {},
    ) {
      const id = next('3e00');
      snapshot.memberships.push({
        id,
        personId: personId(person),
        familyId: options.family ?? familyId,
        validFrom: `${options.from ?? '2025-01-01'}T03:00:00.000Z`,
        validUntil: options.until ? `${options.until}T03:00:00.000Z` : null,
        revision: 1,
      });
      return id;
    },
    enroll(person: number, activity = activityId, from = '2025-01-01') {
      sources(activity).enrollments.push({
        id: next('e000'),
        personId: personId(person),
        validFrom: `${from}T03:00:00.000Z`,
        validUntil: null,
        revision: 1,
      });
      return builder;
    },
    session(
      day: string,
      marks: Record<number, 'PRESENT' | 'ABSENT'> = {},
      options: {
        activity?: string;
        status?: 'COMPLETED' | 'CANCELED';
        family?: string;
        at?: string;
      } = {},
    ) {
      const activity = sources(options.activity ?? activityId);
      const id = next('5e00');
      activity.sessions.push({
        id,
        occurredAt: options.at ?? `${day}T13:00:00.000Z`,
        status: options.status ?? 'COMPLETED',
        revision: 1,
      });
      for (const [person, status] of Object.entries(marks))
        activity.attendances.push({
          id: next('a000'),
          sessionId: id,
          personId: personId(Number(person)),
          familyId: options.family ?? familyId,
          membershipId: uuid('3e00', 0),
          status,
          revision: 1,
        });
      return builder;
    },
    cover(from: string, toExclusive: string, activity = activityId) {
      sources(activity).declarations.push({
        id: next('c000'),
        periodStart: from,
        periodEndExclusive: toExclusive,
        revision: 1,
        invalidatedPeriods: [],
      });
      return builder;
    },
  };
  sources(activityId);
  return builder;
}
