export type ReportUnit = 'PERSON' | 'FAMILY' | 'SESSION' | 'PRESENCE';
export interface ReachRecord {
  sessionId: string;
  personId: string;
  personName: string;
  familyId: string;
  familyCode: string;
  activityId: string;
  activityName: string;
  occurredAt: string;
}
export interface ReachReport {
  from: string;
  toExclusive: string;
  generatedAt: string;
  people: number;
  families: number;
  sessions: number;
  presences: number;
  records: ReachRecord[];
  sessionRecords: Array<{
    id: string;
    activityName: string;
    occurredAt: string;
  }>;
}
export type QualityKind =
  'MISSING_REFERENCE' | 'MISSING_BIRTH_DATE' | 'POSSIBLE_DUPLICATE';
export interface QualityIssue {
  id: string;
  entityId: string;
  entityType: 'FAMILY' | 'PERSON';
  label: string;
  kind: QualityKind;
}
