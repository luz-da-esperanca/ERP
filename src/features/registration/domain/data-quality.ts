import type { RegistrationEntity } from './duplicate-rules.js';
export type QualityIssueKind = 'MISSING_DATA' | 'POSSIBLE_DUPLICATE';
export type QualityIssueStatus = 'OPEN' | 'RESOLVED';
export type QualityResolution = 'DISTINCT' | 'MERGED';
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
