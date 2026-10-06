import type { RegistrationEntity } from './duplicate-rules.js';
export type QualityIssueKind = 'MISSING_DATA' | 'POSSIBLE_DUPLICATE';
export type QualityIssueStatus = 'OPEN' | 'RESOLVED';
export type QualityResolution =
  'DISTINCT' | 'MERGED' | 'COMPLETED' | 'NOT_TRACKED';
export interface MissingDataSelection {
  id: string;
  version: number;
  personFields: string[];
  familyFields: string[];
  decisionReference: string;
  recordedAt: string;
  recordedBy: string;
}
export interface PublishMissingDataSelection {
  expectedVersion: number | null;
  personFields: string[];
  familyFields: string[];
  decisionReference: string;
}
export interface QualityIssue {
  id: string;
  entityType: RegistrationEntity;
  entityId: string;
  kind: QualityIssueKind;
  candidateIds: string[];
  fieldKeys: string[];
  identifiedAt: string;
  resolvedAt: string | null;
  resolution: QualityResolution | null;
  resolvedBy: string | null;
  reason: string | null;
  revision: number;
}
export interface QualityQuery {
  page: number;
  pageSize: number;
  kind?: QualityIssueKind;
  status?: QualityIssueStatus;
  entityType?: RegistrationEntity;
}
export interface ResolveQualityIssue {
  expectedRevision: number;
  resolution: 'DISTINCT';
  reason: string;
}
