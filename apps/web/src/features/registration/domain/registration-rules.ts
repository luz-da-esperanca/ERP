import { ApplicationError } from '@erp/contracts/common';
import type {
  CreatePersonInput,
  FamilyMembership,
  Person,
} from '@erp/contracts/registration';
import type { ActivitySession } from '@erp/contracts/attendance';
import { civilToday, isWithin } from '../../../shared/time';
import { duplicatePeople } from './memberships';

export function validatePersonRegistration(
  input: CreatePersonInput,
  people: readonly Person[],
  memberships: readonly FamilyMembership[],
  now: string,
) {
  if (
    Date.parse(input.validFrom) > Date.parse(now) ||
    (input.person.birthDate !== null &&
      input.person.birthDate > civilToday(new Date(now)))
  )
    throw new ApplicationError(
      'VALIDATION_ERROR',
      'Historical facts cannot be in the future',
    );
  if (
    input.isReference &&
    memberships.some(
      (m) =>
        m.familyId === input.familyId &&
        m.isReference &&
        (m.validUntil === null ||
          Date.parse(m.validUntil) > Date.parse(input.validFrom)),
    )
  )
    throw new ApplicationError(
      'DOMAIN_CONFLICT',
      'A reference member already exists in this interval',
    );
  if (
    duplicatePeople(people, input.person.name, input.person.cpf).length > 0 &&
    !input.duplicateReason?.trim()
  )
    throw new ApplicationError(
      'DOMAIN_CONFLICT',
      'Similar people require an explicit distinct-person reason',
    );
}
export function validateTransfer(
  membership: FamilyMembership,
  targetFamilyId: string,
  effectiveAt: string,
  sessions: readonly ActivitySession[],
  now: string,
) {
  if (
    membership.familyId === targetFamilyId ||
    !isWithin(effectiveAt, membership.validFrom, membership.validUntil) ||
    Date.parse(effectiveAt) === Date.parse(membership.validFrom) ||
    Date.parse(effectiveAt) > Date.parse(now)
  )
    throw new ApplicationError(
      'DOMAIN_CONFLICT',
      'The transfer must split a valid historical membership',
    );
  if (
    sessions.some(
      (s) =>
        s.status === 'COMPLETED' &&
        Date.parse(s.occurredAt) >= Date.parse(effectiveAt) &&
        s.entries.some((e) => e.membershipId === membership.id),
    )
  )
    throw new ApplicationError(
      'DOMAIN_CONFLICT',
      'The transfer would invalidate an attendance context',
    );
}
