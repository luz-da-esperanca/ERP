import { z } from 'zod';
import {
  familiesPageSchema,
  listFamiliesSchema,
  familyDetailSchema,
  personDetailSchema,
  familyDtoSchema,
  updateFamilySchema,
  createFamilySchema,
  duplicateCandidateSchema,
  duplicateQuerySchema,
  peoplePageSchema,
  personDtoSchema,
  createRegisteredPersonSchema,
  personRegistrationSchema,
  updatePersonSchema,
} from '@erp/contracts/registration-api';
import type {
  ListFamiliesInput,
  CreateFamilyInput,
  CreatePersonInput,
  UpdatePersonInput,
} from '@erp/contracts/registration-api';
import type { FamilyInput, PersonDetail } from '@erp/contracts/registration';
import type { ApiClient } from '../../../shared/api-client';
import { apiQuery, allApiPages } from '../../../shared/api-query';

export class HttpRegistration {
  constructor(
    private readonly api: ApiClient,
    private readonly onChange = () => {},
  ) {}

  searchFamilies(input: ListFamiliesInput = {}) {
    const query = listFamiliesSchema.parse(input);
    return this.api.request(apiQuery('/families', query), familiesPageSchema);
  }

  readonly listFamilies = (query?: string) =>
    allApiPages(
      this.api,
      '/families',
      familiesPageSchema,
      query ? (/^[1-9]\d*$/.test(query) ? { code: query } : { q: query }) : {},
    );
  readonly listPeople = async (query?: string) => {
    const people = await allApiPages(
      this.api,
      '/people',
      peoplePageSchema,
      query ? { q: query } : {},
    );
    return people.map((person) => personDtoSchema.parse(person));
  };

  readonly reviewFamilyDuplicates = async (input: FamilyInput) => {
    const referenceName =
      input.referenceName && input.referenceName.length >= 2
        ? input.referenceName
        : undefined;
    const address =
      input.address && input.address.length >= 2 && input.address.length <= 200
        ? input.address
        : undefined;
    if (!referenceName && !address) return [];
    const query = duplicateQuerySchema.parse({
      entityType: 'FAMILY',
      ...(referenceName ? { referenceName } : {}),
      ...(address ? { address } : {}),
    });
    const result = await this.api.request(
      apiQuery('/duplicate-candidates', query),
      z.object({ data: z.array(duplicateCandidateSchema) }),
    );
    return result.data;
  };

  async createFamily(input: CreateFamilyInput, operationKey: string) {
    const body = createFamilySchema.parse(input);
    const result = await this.api.request(
      '/families',
      z.object({ data: familyDtoSchema }),
      { method: 'POST', body, idempotencyKey: operationKey },
    );
    this.onChange();
    return result.data;
  }

  readonly reviewPersonDuplicates = async (input: CreatePersonInput) => {
    if (input.name.trim().length < 2 && !input.cpf) return [];
    const query = duplicateQuerySchema.parse({
      entityType: 'PERSON',
      name: input.name,
      ...(input.birthDate ? { birthDate: input.birthDate } : {}),
      ...(input.cpf ? { cpf: input.cpf } : {}),
    });
    const { data } = await this.api.request(
      apiQuery('/duplicate-candidates', query),
      z.object({ data: z.array(duplicateCandidateSchema) }),
    );
    return data;
  };

  async createRegisteredPerson(input: CreatePersonInput, operationKey: string) {
    const body = createRegisteredPersonSchema.parse(input);
    const { data } = await this.api.request(
      '/people',
      z.object({ data: personRegistrationSchema }),
      { method: 'POST', body, idempotencyKey: operationKey },
    );
    this.onChange();
    return data;
  }

  async updatePerson(
    id: string,
    input: UpdatePersonInput,
    operationKey: string,
  ) {
    const body = updatePersonSchema.parse(input);
    const { data } = await this.api.request(
      `/people/${id}`,
      z.object({ data: personDtoSchema }),
      { method: 'PATCH', body, idempotencyKey: operationKey },
    );
    this.onChange();
    return data;
  }

  readonly getFamily = async (id: string, asOf?: string) => {
    const result = await this.api.request(
      apiQuery(`/families/${id}`, { asOf }),
      z.object({ data: familyDetailSchema }),
    );
    return result.data;
  };

  readonly getPerson = async (id: string): Promise<PersonDetail> => {
    const { data } = await this.api.request(
      `/people/${id}`,
      z.object({ data: personDetailSchema }),
    );
    const ids = [
      ...new Set(data.memberships.map((membership) => membership.familyId)),
    ];
    const families = await Promise.all(
      ids.map(async (familyId) => {
        const detail = await this.getFamily(familyId);
        return [familyId, detail.family.code] as const;
      }),
    );
    const codes = new Map(families);
    return {
      person: data.person,
      memberships: data.memberships.map((membership) => ({
        ...membership,
        familyCode: codes.get(membership.familyId)!,
      })),
    };
  };

  async updateFamily(
    id: string,
    revision: number,
    input: FamilyInput,
    operationKey: string,
  ) {
    const body = updateFamilySchema.parse({
      ...input,
      expectedRevision: revision,
    });
    const result = await this.api.request(
      `/families/${id}`,
      z.object({ data: familyDtoSchema }),
      { method: 'PATCH', body, idempotencyKey: operationKey },
    );
    this.onChange();
    return result.data;
  }
}
