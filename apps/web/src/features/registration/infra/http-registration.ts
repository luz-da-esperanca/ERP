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
import { normalizeSearch } from '../domain/memberships';

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
      input.address && input.address.length >= 2
        ? input.address.slice(0, 200)
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
    if (input.address && input.address.length > 200) {
      const fullAddress = normalizeSearch(input.address);
      const candidates = await Promise.all(
        result.data.map(async (candidate) => {
          if (!candidate.reasons.includes('ADDRESS_SIMILAR')) return candidate;
          const { family } = await this.getFamily(candidate.id);
          const addressMatches = normalizeSearch(family.address ?? '').includes(
            fullAddress,
          );
          return {
            ...candidate,
            reasons: candidate.reasons.filter(
              (reason) => reason !== 'ADDRESS_SIMILAR' || addressMatches,
            ),
          };
        }),
      );
      return candidates.filter((candidate) => candidate.reasons.length);
    }
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
    const name = input.name.trim().length >= 2 ? input.name : undefined;
    if (!name && !input.cpf) return [];
    const query = duplicateQuerySchema.parse({
      entityType: 'PERSON',
      ...(name ? { name } : {}),
      ...(input.birthDate ? { birthDate: input.birthDate } : {}),
      ...(input.cpf ? { cpf: input.cpf } : {}),
    });
    const { data } = await this.api.request(
      apiQuery('/duplicate-candidates', query),
      z.object({ data: z.array(duplicateCandidateSchema) }),
    );
    if (!name && input.birthDate)
      return Promise.all(
        data.map(async (candidate) => {
          const { person } = await this.getPerson(candidate.id);
          return {
            ...candidate,
            reasons:
              normalizeSearch(person.name) === normalizeSearch(input.name) &&
              person.birthDate === input.birthDate
                ? [...candidate.reasons, 'NAME_BIRTH_MATCH' as const]
                : candidate.reasons,
          };
        }),
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
