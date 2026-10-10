import { z } from 'zod';
import {
  createSocialOptionSchema,
  updateSocialOptionSchema,
  socialOptionDtoSchema,
  featureDecisionInputSchema,
  featureDecisionCodeSchema,
  featureDecisionDtoSchema,
  socialFormContextQuerySchema,
  socialFormContextSchema,
  socialFormListQuerySchema,
  socialFormPageSchema,
  socialFormDtoSchema,
  publishSocialFormSchema,
  socialFormFieldsSchema,
  fieldSelectionInputSchema,
  fieldSelectionDtoSchema,
  acknowledgementCommandSchema,
  acknowledgementDtoSchema,
} from '@erp/contracts/social-forms-api';
import type { ApiClient } from '../../../shared/api-client';
import { apiQuery } from '../../../shared/api-query';

export class HttpSocialForms {
  constructor(
    private readonly api: ApiClient,
    private readonly onChange = () => {},
  ) {}

  async context(
    familyId: string,
    input: z.input<typeof socialFormContextQuerySchema>,
  ) {
    const { data } = await this.api.request(
      apiQuery(
        `/families/${familyId}/social-form-context`,
        socialFormContextQuerySchema.parse(input),
      ),
      z.object({ data: socialFormContextSchema }),
    );
    return data;
  }

  list(
    familyId: string,
    input: z.input<typeof socialFormListQuerySchema> = {},
  ) {
    return this.api.request(
      apiQuery(
        `/families/${familyId}/social-forms`,
        socialFormListQuerySchema.parse(input),
      ),
      socialFormPageSchema,
    );
  }

  async get(id: string) {
    const { data } = await this.api.request(
      `/social-forms/${id}`,
      z.object({ data: socialFormDtoSchema }),
    );
    return data;
  }

  async publish(
    familyId: string,
    input: z.input<typeof publishSocialFormSchema>,
    key: string,
  ) {
    const { data } = await this.api.request(
      `/families/${familyId}/social-forms`,
      z.object({ data: socialFormDtoSchema }),
      {
        method: 'POST',
        body: publishSocialFormSchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  }

  async configuration() {
    return (
      await this.api.request(
        '/social-form-configuration',
        z.object({ data: socialFormFieldsSchema }),
      )
    ).data;
  }
  async fields() {
    const { data } = await this.api.request(
      '/social-form-fields',
      z.object({ data: socialFormFieldsSchema }),
    );
    return data;
  }

  async prepareTemplate(key: string) {
    const { data } = await this.api.request(
      '/social-form-template',
      z.object({ data: fieldSelectionDtoSchema }),
      { method: 'POST', body: {}, idempotencyKey: key },
    );
    this.onChange();
    return data;
  }

  async selectFields(
    input: z.input<typeof fieldSelectionInputSchema>,
    key: string,
  ) {
    const { data } = await this.api.request(
      '/social-form-field-selections',
      z.object({ data: fieldSelectionDtoSchema }),
      {
        method: 'POST',
        body: fieldSelectionInputSchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  }

  async acknowledge(
    id: string,
    input: z.input<typeof acknowledgementCommandSchema>,
    key: string,
  ) {
    const { data } = await this.api.request(
      `/social-forms/${id}/acknowledgements`,
      z.object({ data: acknowledgementDtoSchema }),
      {
        method: 'POST',
        body: acknowledgementCommandSchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  }
  async createOption(
    input: z.input<typeof createSocialOptionSchema>,
    key: string,
  ) {
    const { data } = await this.api.request(
      '/social-form-options',
      z.object({ data: socialOptionDtoSchema }),
      {
        method: 'POST',
        body: createSocialOptionSchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  }
  async updateOption(
    id: string,
    input: z.input<typeof updateSocialOptionSchema>,
    key: string,
  ) {
    const { data } = await this.api.request(
      `/social-form-options/${z.uuid().parse(id)}`,
      z.object({ data: socialOptionDtoSchema }),
      {
        method: 'PATCH',
        body: updateSocialOptionSchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  }
  async decideFeature(
    code: z.input<typeof featureDecisionCodeSchema>,
    input: z.input<typeof featureDecisionInputSchema>,
    key: string,
  ) {
    const { data } = await this.api.request(
      `/feature-decisions/${featureDecisionCodeSchema.parse(code)}`,
      z.object({ data: featureDecisionDtoSchema }),
      {
        method: 'POST',
        body: featureDecisionInputSchema.parse(input),
        idempotencyKey: key,
      },
    );
    this.onChange();
    return data;
  }
}
