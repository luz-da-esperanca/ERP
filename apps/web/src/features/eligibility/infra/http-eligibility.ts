import { z } from 'zod';
import {
  policiesPageSchema,
  policiesQuerySchema,
  policyVersionSchema,
  publishPolicySchema,
  eligibilityPreviewSchema,
  previewQuerySchema,
  assessmentCommandSchema,
  assessmentDtoSchema,
} from '@erp/contracts/eligibility-api';
import type { PublishPolicyInput } from '@erp/contracts/eligibility-api';
import { idSchema } from '@erp/contracts/common';
import type { ApiClient } from '../../../shared/api-client';
import { apiQuery } from '../../../shared/api-query';

export class HttpEligibility {
  constructor(
    private readonly api: ApiClient,
    private readonly onChange: () => void = () => {},
  ) {}

  readonly listPolicies = (query: z.input<typeof policiesQuerySchema> = {}) =>
    this.api.request(
      apiQuery('/eligibility-policies', policiesQuerySchema.parse(query)),
      policiesPageSchema,
    );

  readonly getPolicy = async (id: string) => {
    const { data } = await this.api.request(
      `/eligibility-policies/${idSchema.parse(id)}`,
      z.object({ data: policyVersionSchema }),
    );
    return data;
  };

  readonly publishPolicy = async (input: PublishPolicyInput, key: string) => {
    const { data } = await this.api.request(
      '/eligibility-policies',
      z.object({ data: policyVersionSchema }),
      {
        method: 'POST',
        body: publishPolicySchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  };

  readonly preview = async (familyId: string, referenceDate: string) => {
    const { data } = await this.api.request(
      apiQuery(
        `/families/${idSchema.parse(familyId)}/eligibility-preview`,
        previewQuerySchema.parse({ referenceDate }),
      ),
      z.object({ data: eligibilityPreviewSchema }),
    );
    return data;
  };

  readonly assess = async (
    familyId: string,
    referenceDate: string,
    key: string,
  ) => {
    const { data } = await this.api.request(
      `/families/${idSchema.parse(familyId)}/eligibility-assessments`,
      z.object({ data: assessmentDtoSchema }),
      {
        method: 'POST',
        body: assessmentCommandSchema.parse({ referenceDate }),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  };

  readonly getAssessment = async (id: string) => {
    const { data } = await this.api.request(
      `/eligibility-assessments/${idSchema.parse(id)}`,
      z.object({ data: assessmentDtoSchema }),
    );
    return data;
  };
}
