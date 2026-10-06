import type { Capability } from '@erp/contracts/access';
import type { Principal } from '../../access/application/ports.js';
import type { OperationFingerprints } from '../../access/application/account-transactions.js';
import {
  assertPermission,
  capabilitiesFor,
} from '../../access/domain/permissions.js';
import { ResourceNotFoundError } from '../../../core/application/errors.js';
import {
  civilBoundary,
  coveredPeriods,
  frequencyOpportunities,
  summarizeFrequency,
} from '../../attendance/domain/frequency-rules.js';
import type { EligibilityStatus } from '../../eligibility/domain/eligibility.js';
import type {
  QualityIssueKind,
  QualityIssueStatus,
} from '../../registration/domain/data-quality.js';
import { ReportRuleError } from '../domain/report-errors.js';
import {
  assertUnchanged,
  orderHistory,
  paginate,
  reachRecords,
  resolveScope,
  summarizeActivityFrequency,
  summarizeEligibility,
  summarizeQuality,
  summarizeReach,
} from '../domain/report-rules.js';
import {
  historyCapabilities,
  type CivilPeriod,
  type EligibilityRow,
  type FrequencyOpportunityRecord,
  type FrequencySessionRecord,
  type FrequencyUnit,
  type HistoryEventType,
  type HistoryQuery,
  type Page,
  type QualityDateBasis,
  type ReachUnit,
  type ReportsReaderEvents,
  type ScopeFilters,
} from '../domain/reports.js';
import type {
  EligibilityEvaluator,
  ReportsReader,
  ReportsReaderPorts,
} from './reports-ports.js';

type Detail = Page & { expectedQueryFingerprint: string };
type ReachQuery = CivilPeriod & ScopeFilters;
interface FrequencyQuery extends CivilPeriod {
  activityId: string;
  personId?: string;
  familyId?: string;
}
interface EligibilityQuery {
  referenceDate: string;
  familyId?: string;
  status?: EligibilityStatus;
}
interface QualityQuery extends CivilPeriod {
  dateBasis: QualityDateBasis;
  kind?: QualityIssueKind;
  status?: QualityIssueStatus;
}
const familyEventTypes: HistoryEventType[] = [
  'MEMBERSHIP_STARTED',
  'MEMBERSHIP_ENDED',
  'ATTENDANCE',
  'SOCIAL_FORM',
  'ELIGIBILITY_ASSESSMENT',
];
const personEventTypes: HistoryEventType[] = [
  'MEMBERSHIP_STARTED',
  'MEMBERSHIP_ENDED',
  'ENROLLMENT_STARTED',
  'ENROLLMENT_ENDED',
  'ATTENDANCE',
  'SOCIAL_FORM',
];
const versions = (rows: readonly { id: string; revision: number }[]) =>
  rows.map((row) => [row.id, row.revision]).sort();

export class ReportsService {
  constructor(
    private readonly reader: ReportsReader,
    private readonly evaluator: EligibilityEvaluator,
    private readonly fingerprints: OperationFingerprints,
    private readonly now: () => string,
    private readonly timeZone: string,
  ) {}
  /** `reports.read` never widens access: the domain permission is always required too. */
  private authorize(actor: Principal, domain: Capability) {
    for (const capability of ['reports.read', domain] as const)
      assertPermission(
        actor.user.roleCodes,
        actor.user.mustChangePassword,
        capability,
      );
  }
  private instants(period: CivilPeriod) {
    return {
      from: civilBoundary(period.from, this.timeZone),
      toExclusive: civilBoundary(period.toExclusive, this.timeZone),
    };
  }
  private fingerprint(report: string, filters: object, sources: object) {
    return this.fingerprints.calculate({ report, filters, sources }, null);
  }

  private async reachData(ports: ReportsReaderPorts, query: ReachQuery) {
    const filters = {
      from: query.from,
      toExclusive: query.toExclusive,
      instituteId: query.instituteId ?? null,
      projectId: query.projectId ?? null,
      activityId: query.activityId ?? null,
    };
    const scope = resolveScope(await ports.catalog(), query);
    const { from, toExclusive } = this.instants(query);
    const facts = await ports.reachFacts(
      scope.map((row) => row.id).sort(),
      from,
      toExclusive,
    );
    return {
      ...facts,
      filters,
      queryFingerprint: this.fingerprint('reach', filters, {
        sessions: versions(facts.sessions),
        presences: versions(facts.presences),
      }),
    };
  }
  async reach(actor: Principal, query: ReachQuery) {
    this.authorize(actor, 'attendance.read');
    return this.reader.read(async (ports) => {
      const data = await this.reachData(ports, query);
      const { groups, ...totals } = summarizeReach(
        data.sessions,
        data.presences,
      );
      return {
        generatedAt: this.now(),
        filters: data.filters,
        units: ['PERSON', 'FAMILY', 'SESSION', 'PRESENCE'] as const,
        method: 'PRESENT_MARKINGS_IN_COMPLETED_SESSIONS' as const,
        queryFingerprint: data.queryFingerprint,
        totals,
        groups,
      };
    });
  }
  async reachRecords(
    actor: Principal,
    query: ReachQuery & Detail & { unit: ReachUnit },
  ) {
    this.authorize(actor, 'attendance.read');
    return this.reader.read(async (ports) => {
      const data = await this.reachData(ports, query);
      assertUnchanged(query.expectedQueryFingerprint, data.queryFingerprint);
      return {
        report: {
          generatedAt: this.now(),
          filters: data.filters,
          unit: query.unit,
          queryFingerprint: data.queryFingerprint,
        },
        ...paginate(
          reachRecords(query.unit, data.sessions, data.presences),
          query,
        ),
      };
    });
  }

  private async frequencyData(
    ports: ReportsReaderPorts,
    query: FrequencyQuery,
  ) {
    const filters = {
      from: query.from,
      toExclusive: query.toExclusive,
      activityId: query.activityId,
      personId: query.personId ?? null,
      familyId: query.familyId ?? null,
    };
    const sources = await ports.attendanceSources(query.activityId);
    if (!sources) throw new ReportRuleError('REPORT_FILTER_UNKNOWN');
    if (sources.activity.nature !== 'PERIODIC')
      throw new ReportRuleError('PERIODIC_ACTIVITY_REQUIRED');
    const { from, toExclusive } = this.instants(query);
    const coverage = coveredPeriods(
      query.from,
      query.toExclusive,
      sources.declarations,
    );
    const sessions: FrequencySessionRecord[] = sources.sessions
      .filter((row) => row.occurredAt >= from && row.occurredAt < toExclusive)
      .map(({ id, occurredAt, status, revision }) => ({
        id,
        occurredAt,
        status,
        revision,
      }));
    const participants = [
      ...new Set([
        ...sources.enrollments.map((row) => row.personId),
        ...sources.attendances.map((row) => row.personId),
      ]),
    ]
      .filter((id) => !query.personId || id === query.personId)
      .sort()
      .map((personId) => ({
        personId,
        personName:
          sources.people.find((row) => row.id === personId)?.name ?? '',
        // Same projection and counters FRQ uses for a single person.
        ...summarizeFrequency(
          frequencyOpportunities(sources, personId, from, toExclusive),
          coverage.isComplete,
          query.familyId,
        ),
      }))
      .filter((row) => row.sessionCount > 0);
    const inWindow = new Set(sessions.map((row) => row.id));
    return {
      filters,
      coverage,
      sessions,
      participants,
      queryFingerprint: this.fingerprint('frequency', filters, {
        sessions: versions(sessions),
        attendances: versions(
          sources.attendances.filter((row) => inWindow.has(row.sessionId)),
        ),
        enrollments: versions(sources.enrollments),
        declarations: versions(sources.declarations),
        memberships: versions(
          sources.people.flatMap((person) => person.memberships),
        ),
      }),
    };
  }
  async frequency(actor: Principal, query: FrequencyQuery) {
    this.authorize(actor, 'attendance.read');
    return this.reader.read(async (ports) => {
      const data = await this.frequencyData(ports, query);
      const count = (status: string) =>
        data.sessions.filter((row) => row.status === status).length;
      return {
        generatedAt: this.now(),
        filters: data.filters,
        units: ['OPPORTUNITY', 'SESSION'] as const,
        denominator: 'ENROLLMENT_OR_RECORDED' as const,
        queryFingerprint: data.queryFingerprint,
        totals: {
          ...summarizeActivityFrequency(
            data.participants,
            data.coverage.isComplete,
          ),
          completedSessions: count('COMPLETED'),
          canceledSessions: count('CANCELED'),
        },
        coverage: {
          confirmedPeriods: data.coverage.confirmedPeriods,
          gaps: data.coverage.gaps,
        },
      };
    });
  }
  async frequencyRecords(
    actor: Principal,
    query: FrequencyQuery & Detail & { unit: FrequencyUnit },
  ) {
    this.authorize(actor, 'attendance.read');
    return this.reader.read(async (ports) => {
      const data = await this.frequencyData(ports, query);
      assertUnchanged(query.expectedQueryFingerprint, data.queryFingerprint);
      const byFact = (
        a: { occurredAt: string; id: string },
        b: { occurredAt: string; id: string },
      ) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id);
      const opportunities = data.participants
        .flatMap(({ personId, personName, opportunities }) =>
          opportunities.map((row): FrequencyOpportunityRecord => ({
            personId,
            personName,
            sessionId: row.sessionId,
            occurredAt: row.occurredAt,
            familyId: row.familyId,
            status: row.attendance?.status ?? null,
            attendanceId: row.attendance?.id ?? null,
            relevance: row.relevance,
            contextResolved: row.contextResolved,
          })),
        )
        .sort(
          (a, b) =>
            a.occurredAt.localeCompare(b.occurredAt) ||
            a.sessionId.localeCompare(b.sessionId) ||
            a.personId.localeCompare(b.personId),
        );
      const rows: (FrequencyOpportunityRecord | FrequencySessionRecord)[] =
        query.unit === 'SESSION'
          ? [...data.sessions].sort(byFact)
          : opportunities;
      return {
        report: {
          generatedAt: this.now(),
          filters: data.filters,
          unit: query.unit,
          queryFingerprint: data.queryFingerprint,
        },
        ...paginate(rows, query),
      };
    });
  }

  private async eligibilityData(query: EligibilityQuery) {
    const rows = await this.evaluator.evaluateAll(
      query.referenceDate,
      query.familyId,
    );
    if (query.familyId && !rows.length) throw new ResourceNotFoundError();
    const filters = {
      referenceDate: query.referenceDate,
      familyId: query.familyId ?? null,
    };
    const project = ({ family, preview }: EligibilityRow) => ({
      family,
      status: preview.status,
      pendingReasons: preview.pendingReasons,
      policyId: preview.policyId,
      explanation: preview.explanation,
      evidences: preview.evidences,
    });
    return {
      filters,
      // Every family is classified before any status filter or page is applied.
      totals: summarizeEligibility(rows.map((row) => row.preview.status)),
      policyId: rows[0]?.preview.policyId ?? null,
      rows: (status?: EligibilityStatus) =>
        rows
          .filter((row) => !status || row.preview.status === status)
          .map(project),
      queryFingerprint: this.fingerprint(
        'eligibility',
        filters,
        rows.map((row) => [row.family.id, row.preview.sourceFingerprint]),
      ),
    };
  }
  async eligibility(actor: Principal, query: EligibilityQuery & Page) {
    this.authorize(actor, 'eligibility.read');
    const data = await this.eligibilityData(query);
    return {
      generatedAt: this.now(),
      filters: { ...data.filters, status: query.status ?? null },
      unit: 'FAMILY' as const,
      // A calculation at this instant, not a saved assessment.
      method: 'CALCULATED_ON_REQUEST' as const,
      policyId: data.policyId,
      queryFingerprint: data.queryFingerprint,
      totals: data.totals,
      ...paginate(data.rows(query.status), query),
    };
  }
  async eligibilityRecords(
    actor: Principal,
    query: EligibilityQuery & Detail & { status: EligibilityStatus },
  ) {
    this.authorize(actor, 'eligibility.read');
    const data = await this.eligibilityData(query);
    assertUnchanged(query.expectedQueryFingerprint, data.queryFingerprint);
    return {
      report: {
        generatedAt: this.now(),
        filters: { ...data.filters, status: query.status },
        unit: 'FAMILY' as const,
        queryFingerprint: data.queryFingerprint,
      },
      ...paginate(data.rows(query.status), query),
    };
  }

  private async qualityData(ports: ReportsReaderPorts, query: QualityQuery) {
    const filters = {
      from: query.from,
      toExclusive: query.toExclusive,
      dateBasis: query.dateBasis,
      kind: query.kind ?? null,
      status: query.status ?? null,
    };
    const issues = await ports.qualityIssues({
      ...this.instants(query),
      dateBasis: query.dateBasis,
      kind: query.kind,
      status: query.status,
    });
    return {
      filters,
      issues,
      queryFingerprint: this.fingerprint(
        'data-quality',
        filters,
        versions(issues),
      ),
    };
  }
  private assertQualityFilters(query: QualityQuery) {
    // An open issue has no resolution date to be selected by.
    if (query.dateBasis === 'RESOLUTION' && query.status === 'OPEN')
      throw new ReportRuleError('REPORT_FILTER_CONFLICT');
  }
  async dataQuality(actor: Principal, query: QualityQuery & Page) {
    this.authorize(actor, 'registration.read');
    this.assertQualityFilters(query);
    return this.reader.read(async (ports) => {
      const data = await this.qualityData(ports, query);
      return {
        generatedAt: this.now(),
        filters: data.filters,
        unit: 'ISSUE' as const,
        queryFingerprint: data.queryFingerprint,
        totals: summarizeQuality(data.issues),
        ...paginate(data.issues, query),
      };
    });
  }
  async dataQualityRecords(actor: Principal, query: QualityQuery & Detail) {
    this.authorize(actor, 'registration.read');
    this.assertQualityFilters(query);
    return this.reader.read(async (ports) => {
      const data = await this.qualityData(ports, query);
      assertUnchanged(query.expectedQueryFingerprint, data.queryFingerprint);
      return {
        report: {
          generatedAt: this.now(),
          filters: data.filters,
          unit: 'ISSUE' as const,
          queryFingerprint: data.queryFingerprint,
        },
        ...paginate(data.issues, query),
      };
    });
  }

  private eventTypes(
    actor: Principal,
    available: readonly HistoryEventType[],
    requested?: readonly HistoryEventType[],
  ) {
    const capabilities = capabilitiesFor(actor.user.roleCodes);
    // Forbidden event types are dropped here, before anything is read.
    return available
      .filter(
        (type) =>
          capabilities.includes(historyCapabilities[type]) &&
          (!requested || requested.includes(type)),
      )
      .sort();
  }
  private history(
    query: HistoryQuery,
    eventTypes: HistoryEventType[],
    events: ReportsReaderEvents,
  ) {
    const from = query.from ? civilBoundary(query.from, this.timeZone) : null;
    const toExclusive = query.toExclusive
      ? civilBoundary(query.toExclusive, this.timeZone)
      : null;
    return {
      report: {
        generatedAt: this.now(),
        order: query.order,
        eventTypes,
        from: query.from ?? null,
        toExclusive: query.toExclusive ?? null,
      },
      ...paginate(
        orderHistory(
          events.filter(
            (row) =>
              (!from || row.occurredAt >= from) &&
              (!toExclusive || row.occurredAt < toExclusive),
          ),
          query.order,
        ),
        query,
      ),
    };
  }
  async familyHistory(actor: Principal, familyId: string, query: HistoryQuery) {
    this.authorize(actor, 'registration.read');
    const types = this.eventTypes(actor, familyEventTypes, query.eventTypes);
    return this.reader.read(async (ports) => {
      const family = await ports.canonicalFamily(familyId);
      if (!family) throw new ResourceNotFoundError();
      const result = this.history(
        query,
        types,
        types.length ? await ports.familyEvents(family.id, types) : [],
      );
      return {
        ...result,
        report: { ...result.report, familyId: family.id },
      };
    });
  }
  async personHistory(actor: Principal, personId: string, query: HistoryQuery) {
    this.authorize(actor, 'participants.lookup');
    const types = this.eventTypes(actor, personEventTypes, query.eventTypes);
    return this.reader.read(async (ports) => {
      const person = await ports.canonicalPerson(personId);
      if (!person) throw new ResourceNotFoundError();
      const result = this.history(
        query,
        types,
        types.length ? await ports.personEvents(person.id, types) : [],
      );
      return {
        ...result,
        report: { ...result.report, personId: person.id },
      };
    });
  }
}
