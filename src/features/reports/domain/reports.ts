import type { Capability } from '@erp/contracts/access';
import type {
  AttendanceStatus,
  CivilPeriod,
  OpportunityRelevance,
  SessionStatus,
} from '../../attendance/domain/attendance.js';
import type {
  EligibilityPreview,
  EligibilityStatus,
} from '../../eligibility/domain/eligibility.js';
import type {
  QualityIssue,
  QualityIssueKind,
  QualityIssueStatus,
} from '../../registration/domain/data-quality.js';

export type ReachUnit = 'PERSON' | 'FAMILY' | 'SESSION' | 'PRESENCE';
export type FrequencyUnit = 'OPPORTUNITY' | 'SESSION';
export type QualityDateBasis = 'IDENTIFICATION' | 'RESOLUTION';
export type HistoryOrder = 'asc' | 'desc';
export interface Page {
  page: number;
  pageSize: number;
}
export interface ScopeFilters {
  instituteId?: string;
  projectId?: string;
  activityId?: string;
}
export interface ReportCatalog {
  institutes: string[];
  projects: { id: string; instituteId: string }[];
  activities: { id: string; projectId: string; name: string }[];
}
export interface ReachSession {
  id: string;
  activityId: string;
  occurredAt: string;
  revision: number;
}
export interface ReachPresence {
  id: string;
  sessionId: string;
  activityId: string;
  occurredAt: string;
  personId: string;
  personName: string;
  familyId: string;
  familyCode: string;
  revision: number;
}
export interface ReachCounts {
  people: number;
  families: number;
  sessions: number;
  presences: number;
}
export type ReachRecord =
  | { personId: string; personName: string; presences: number }
  | {
      familyId: string;
      familyCode: string;
      people: number;
      presences: number;
    }
  | (ReachSession & { presences: number })
  | ReachPresence;
export interface FrequencyCounts {
  sessionCount: number;
  presenceCount: number;
  absenceCount: number;
  unrecordedCount: number;
  contextComplete: boolean;
}
export interface FrequencyOpportunityRecord {
  personId: string;
  personName: string;
  sessionId: string;
  occurredAt: string;
  familyId: string | null;
  status: AttendanceStatus | null;
  attendanceId: string | null;
  relevance: OpportunityRelevance;
  contextResolved: boolean;
}
export interface FrequencySessionRecord {
  id: string;
  occurredAt: string;
  status: SessionStatus;
  revision: number;
}
export interface EligibilityRow {
  family: { id: string; code: string };
  preview: EligibilityPreview;
}
export type EligibilityTotals = Record<EligibilityStatus, number> & {
  total: number;
};
export interface QualityFilters {
  from: string;
  toExclusive: string;
  dateBasis: QualityDateBasis;
  kind?: QualityIssueKind;
  status?: QualityIssueStatus;
}
export type { QualityIssue };
export const historyCapabilities = {
  MEMBERSHIP_STARTED: 'registration.read',
  MEMBERSHIP_ENDED: 'registration.read',
  ENROLLMENT_STARTED: 'projects.read',
  ENROLLMENT_ENDED: 'projects.read',
  ATTENDANCE: 'attendance.read',
  SOCIAL_FORM: 'socialForms.read',
  ELIGIBILITY_ASSESSMENT: 'eligibility.read',
} as const satisfies Record<string, Capability>;
export type HistoryEventType = keyof typeof historyCapabilities;
export interface HistoryEvent {
  type: HistoryEventType;
  /** Fact instant; rows with only a civil reference use the start of that day. */
  occurredAt: string;
  referenceDate: string | null;
  recordedAt: string | null;
  sourceType: string;
  sourceId: string;
  familyId: string | null;
  personId: string | null;
  activityId: string | null;
  /** False for facts kept only as history: canceled sessions and superseded records. */
  valid: boolean;
  invalidReason: 'SESSION_CANCELED' | 'SUPERSEDED' | null;
  details: Record<string, string | number | boolean | null>;
}
export interface HistoryQuery extends Page {
  from?: string;
  toExclusive?: string;
  eventTypes?: HistoryEventType[];
  order: HistoryOrder;
}
export type ReportsReaderEvents = readonly HistoryEvent[];
export type { CivilPeriod };
