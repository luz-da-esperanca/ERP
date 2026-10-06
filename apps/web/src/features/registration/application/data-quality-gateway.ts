import type { z } from 'zod';
import type {
  qualityPageSchema,
  qualityQuerySchema,
  qualityResolutionSchema,
  QualityIssueDto,
} from '@erp/contracts/data-quality-api';
import type {
  duplicateCandidateSchema,
  duplicateQuerySchema,
  PersonDto,
  FamilyDto,
} from '@erp/contracts/registration-api';
import type {
  MergeIdentitiesInput,
  MergeCommandInput,
  MergePreviewDto,
  MergeResultDto,
} from '@erp/contracts/identity-merge-api';

export type QualityQuery = z.input<typeof qualityQuerySchema>;
export type QualityPage = z.infer<typeof qualityPageSchema>;
export type DuplicateQuery = z.input<typeof duplicateQuerySchema>;
export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;
export type QualityResolution = z.input<typeof qualityResolutionSchema>;
export type RegistrationRecord = PersonDto | FamilyDto;
export type DuplicateEntityType = MergeIdentitiesInput['entityType'];
export interface DataQualityGateway {
  issues(query: QualityQuery): Promise<QualityPage>;
  candidates(query: DuplicateQuery): Promise<DuplicateCandidate[]>;
  record(
    entityType: DuplicateEntityType,
    id: string,
  ): Promise<RegistrationRecord>;
  preview(input: MergeIdentitiesInput): Promise<MergePreviewDto>;
  merge(input: MergeCommandInput, key: string): Promise<MergeResultDto>;
  resolve(
    issueId: string,
    input: QualityResolution,
    key: string,
  ): Promise<QualityIssueDto>;
}
