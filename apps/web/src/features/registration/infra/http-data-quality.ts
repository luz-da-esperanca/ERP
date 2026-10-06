import { z } from 'zod';
import {
  qualityPageSchema,
  qualityQuerySchema,
  qualityResolutionSchema,
  dataQualityIssueSchema,
} from '@erp/contracts/data-quality-api';
import {
  duplicateQuerySchema,
  duplicateCandidateSchema,
  personDetailSchema,
  familyDetailSchema,
} from '@erp/contracts/registration-api';
import {
  mergeIdentitiesSchema,
  mergeCommandSchema,
  mergePreviewSchema,
  mergeResultSchema,
} from '@erp/contracts/identity-merge-api';
import type {
  MergeIdentitiesInput,
  MergeCommandInput,
} from '@erp/contracts/identity-merge-api';
import type {
  DataQualityGateway,
  QualityQuery,
  DuplicateQuery,
  DuplicateEntityType,
  QualityResolution,
} from '../application/data-quality-gateway';
import type { ApiClient } from '../../../shared/api-client';

function queryString(values: object) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  return params.toString();
}
const candidateResponse = z.object({ data: z.array(duplicateCandidateSchema) });
const personResponse = z.object({ data: personDetailSchema });
const familyResponse = z.object({ data: familyDetailSchema });
const previewResponse = z.object({ data: mergePreviewSchema });
const mergeResponse = z.object({ data: mergeResultSchema });
const resolutionResponse = z.object({ data: dataQualityIssueSchema });

export class HttpDataQuality implements DataQualityGateway {
  constructor(private readonly api: ApiClient) {}
  issues(query: QualityQuery) {
    return this.api.request(
      `/data-quality-issues?${queryString(qualityQuerySchema.parse(query))}`,
      qualityPageSchema,
    );
  }
  async candidates(query: DuplicateQuery) {
    return (
      await this.api.request(
        `/duplicate-candidates?${queryString(duplicateQuerySchema.parse(query))}`,
        candidateResponse,
      )
    ).data;
  }
  async record(entityType: DuplicateEntityType, id: string) {
    z.uuid().parse(id);
    if (entityType === 'PERSON')
      return (await this.api.request(`/people/${id}`, personResponse)).data
        .person;
    return (await this.api.request(`/families/${id}`, familyResponse)).data
      .family;
  }
  async preview(input: MergeIdentitiesInput) {
    return (
      await this.api.request('/identity-merges/preview', previewResponse, {
        method: 'POST',
        body: mergeIdentitiesSchema.parse(input),
      })
    ).data;
  }
  async merge(input: MergeCommandInput, key: string) {
    return (
      await this.api.request('/identity-merges', mergeResponse, {
        method: 'POST',
        body: mergeCommandSchema.parse(input),
        idempotencyKey: key,
      })
    ).data;
  }
  async resolve(issueId: string, input: QualityResolution, key: string) {
    z.uuid().parse(issueId);
    return (
      await this.api.request(
        `/data-quality-issues/${issueId}/resolution`,
        resolutionResponse,
        {
          method: 'POST',
          body: qualityResolutionSchema.parse(input),
          idempotencyKey: key,
        },
      )
    ).data;
  }
}
