import { RegistrationConflictError } from './registration-errors.js';

export type RegistrationEntity = 'FAMILY' | 'PERSON';
export type DuplicateReason =
  'CPF_MATCH' | 'NAME_BIRTH_MATCH' | 'NAME_SIMILAR' | 'ADDRESS_SIMILAR';
export interface DuplicateQuery {
  entityType: RegistrationEntity;
  name?: string;
  referenceName?: string;
  address?: string;
  birthDate?: string;
  cpf?: string;
}
export interface DuplicateRecord {
  id: string;
  entityType: RegistrationEntity;
  name: string | null;
  address: string | null;
  birthDate: string | null;
  cpf: string | null;
}
export interface DuplicateCandidate {
  id: string;
  entityType: RegistrationEntity;
  reasons: DuplicateReason[];
}
export interface DuplicateReview {
  candidateIds: string[];
  decision: 'DISTINCT';
  reason: string;
}
export const normalizeSearch = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
export function identifyDuplicateCandidates(
  records: readonly DuplicateRecord[],
  query: DuplicateQuery,
): DuplicateCandidate[] {
  const name = normalizeSearch(query.name ?? query.referenceName ?? '');
  const address = normalizeSearch(query.address ?? '');
  const ranks = {
    CPF_MATCH: 0,
    NAME_BIRTH_MATCH: 1,
    NAME_SIMILAR: 2,
    ADDRESS_SIMILAR: 2,
  };
  return records
    .map((record) => {
      const reasons: DuplicateReason[] = [];
      const recordName = normalizeSearch(record.name ?? '');
      if (query.cpf && record.cpf === query.cpf) reasons.push('CPF_MATCH');
      if (
        name &&
        recordName === name &&
        query.birthDate &&
        record.birthDate === query.birthDate
      )
        reasons.push('NAME_BIRTH_MATCH');
      if (name.length >= 2 && recordName.includes(name))
        reasons.push('NAME_SIMILAR');
      if (
        address.length >= 2 &&
        normalizeSearch(record.address ?? '').includes(address)
      )
        reasons.push('ADDRESS_SIMILAR');
      return { id: record.id, entityType: record.entityType, reasons };
    })
    .filter((record) => record.reasons.length > 0)
    .sort(
      (first, second) =>
        ranks[first.reasons[0]!] - ranks[second.reasons[0]!] ||
        first.id.localeCompare(second.id),
    );
}
export function assertDuplicateReview(
  candidates: readonly DuplicateCandidate[],
  review?: DuplicateReview,
) {
  const ids = candidates.map((candidate) => candidate.id).sort();
  if (ids.length && !review)
    throw new RegistrationConflictError('DUPLICATE_REVIEW_REQUIRED', ids);
  if (
    review &&
    (ids.length !== review.candidateIds.length ||
      ids.some((id, index) => id !== [...review.candidateIds].sort()[index]))
  )
    throw new RegistrationConflictError('DUPLICATE_REVIEW_CHANGED', ids);
}
