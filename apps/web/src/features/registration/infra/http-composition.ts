import { z } from 'zod';
import * as contracts from '@erp/contracts/registration-api';
import * as reconciliation from '@erp/contracts/membership-reconciliation-api';
import * as quality from '@erp/contracts/data-quality-api';
import type { ApiClient } from '../../../shared/api-client';
export class HttpComposition {
  constructor(
    private readonly api: ApiClient,
    private readonly onChange = () => {},
  ) {}
  async person(id: string) {
    return (
      await this.api.request(
        `/people/${z.uuid().parse(id)}`,
        z.object({ data: contracts.personDetailSchema }),
      )
    ).data;
  }
  private async write<T>(
    path: string,
    method: 'POST' | 'PUT' | 'PATCH',
    input: unknown,
    key: string,
    schema: z.ZodType<T>,
  ) {
    const { data } = await this.api.request(path, z.object({ data: schema }), {
      method,
      body: input,
      idempotencyKey: key,
    });
    this.onChange();
    return data;
  }
  sizes(id: string, input: contracts.SizesInput, key: string) {
    return this.write(
      `/people/${z.uuid().parse(id)}/sizes`,
      'PUT',
      contracts.sizesInputSchema.parse(input),
      key,
      contracts.sizeProfileSchema,
    );
  }
  transfer(id: string, input: contracts.MembershipTransferInput, key: string) {
    return this.write(
      `/people/${z.uuid().parse(id)}/membership-transfers`,
      'POST',
      contracts.membershipTransferSchema.parse(input),
      key,
      contracts.membershipTransferResultSchema,
    );
  }
  reference(
    familyId: string,
    input: contracts.ReferenceChangeInput,
    key: string,
  ) {
    return this.write(
      `/families/${z.uuid().parse(familyId)}/reference-changes`,
      'POST',
      contracts.referenceChangeSchema.parse(input),
      key,
      contracts.referenceChangeResultSchema,
    );
  }
  correct(id: string, input: contracts.MembershipCorrectionInput, key: string) {
    return this.write(
      `/memberships/${z.uuid().parse(id)}`,
      'PATCH',
      contracts.membershipCorrectionSchema.parse(input),
      key,
      contracts.membershipChangeResultSchema,
    );
  }
  close(id: string, input: contracts.MembershipClosureInput, key: string) {
    return this.write(
      `/memberships/${z.uuid().parse(id)}/closure`,
      'POST',
      contracts.membershipClosureSchema.parse(input),
      key,
      contracts.membershipChangeResultSchema,
    );
  }
  async preview(id: string, input: reconciliation.ReconciliationPlanInput) {
    return (
      await this.api.request(
        `/people/${z.uuid().parse(id)}/membership-reconciliations/preview`,
        z.object({ data: reconciliation.reconciliationPreviewSchema }),
        {
          method: 'POST',
          body: reconciliation.reconciliationPlanSchema.parse(input),
        },
      )
    ).data;
  }
  async reconcile(
    id: string,
    input: reconciliation.ReconciliationCommandInput,
    key: string,
  ) {
    return this.write(
      `/people/${z.uuid().parse(id)}/membership-reconciliations`,
      'POST',
      reconciliation.reconciliationCommandSchema.parse(input),
      key,
      reconciliation.reconciliationResultSchema,
    );
  }
  async fields() {
    return (
      await this.api.request(
        '/registration-field-selections/current',
        z.object({ data: quality.missingDataSelectionSchema.nullable() }),
      )
    ).data;
  }
  selectFields(
    input: z.input<typeof quality.missingDataSelectionInputSchema>,
    key: string,
  ) {
    return this.write(
      '/registration-field-selections',
      'POST',
      quality.missingDataSelectionInputSchema.parse(input),
      key,
      quality.missingDataSelectionSchema,
    );
  }
}
