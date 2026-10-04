import type { FamilyMembership, Person } from '@erp/contracts/registration';
import { isWithin } from '../../../shared/time';

export function membershipAt(
  memberships: readonly FamilyMembership[],
  personId: string,
  at: string,
) {
  return memberships.find(
    (m) => m.personId === personId && isWithin(at, m.validFrom, m.validUntil),
  );
}
export function familyMemberships(
  memberships: readonly FamilyMembership[],
  familyId: string,
  at: string,
) {
  return memberships.filter(
    (m) => m.familyId === familyId && isWithin(at, m.validFrom, m.validUntil),
  );
}
export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
export function duplicatePeople(
  people: readonly Person[],
  name: string,
  cpf: string | null,
) {
  return people.filter(
    (p) =>
      normalizeSearch(p.name) === normalizeSearch(name) ||
      (cpf !== null && cpf === p.cpf),
  );
}
