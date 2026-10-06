import type { AttendanceSources } from '../../attendance/domain/attendance.js';
import type {
  QualityIssueKind,
  QualityIssueStatus,
} from '../../registration/domain/data-quality.js';
import type {
  EligibilityRow,
  HistoryEvent,
  HistoryEventType,
  QualityDateBasis,
  QualityIssue,
  ReachPresence,
  ReachSession,
  ReportCatalog,
} from '../domain/reports.js';

export interface ReportsReaderPorts {
  catalog(): Promise<ReportCatalog>;
  /** Completed sessions and effective PRESENT markings of the activities in the instant window. */
  reachFacts(
    activityIds: readonly string[],
    from: string,
    toExclusive: string,
  ): Promise<{ sessions: ReachSession[]; presences: ReachPresence[] }>;
  attendanceSources(activityId: string): Promise<AttendanceSources | null>;
  qualityIssues(filters: {
    from: string;
    toExclusive: string;
    dateBasis: QualityDateBasis;
    kind?: QualityIssueKind;
    status?: QualityIssueStatus;
  }): Promise<QualityIssue[]>;
  /** Resolve merged identities to the canonical one; null when unknown. */
  canonicalFamily(id: string): Promise<{ id: string; code: string } | null>;
  canonicalPerson(id: string): Promise<{ id: string; name: string } | null>;
  /** Only the requested event types are read, so restricted sources are never loaded. */
  familyEvents(
    familyId: string,
    types: readonly HistoryEventType[],
  ): Promise<HistoryEvent[]>;
  personEvents(
    personId: string,
    types: readonly HistoryEventType[],
  ): Promise<HistoryEvent[]>;
}
export interface ReportsReader {
  read<T>(work: (ports: ReportsReaderPorts) => Promise<T>): Promise<T>;
}
/** The single eligibility evaluator, owned by its module. */
export interface EligibilityEvaluator {
  evaluateAll(
    referenceDate: string,
    familyId?: string,
  ): Promise<EligibilityRow[]>;
}
