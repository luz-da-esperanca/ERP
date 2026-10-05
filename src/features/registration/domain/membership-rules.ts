import {
  RegistrationConflictError,
  RegistrationRuleError,
} from './registration-errors.js';

export interface MembershipInterval {
  id: string;
  personId: string;
  familyId: string;
  isReference: boolean;
  validFrom: string;
  validUntil: string | null;
}
export function isMembershipCurrent(
  membership: Pick<MembershipInterval, 'validFrom' | 'validUntil'>,
  instant: string,
) {
  const time = Date.parse(instant);
  return (
    Date.parse(membership.validFrom) <= time &&
    (membership.validUntil === null || time < Date.parse(membership.validUntil))
  );
}
export function assertMembershipPlan(
  memberships: readonly MembershipInterval[],
  now: string,
) {
  for (const membership of memberships) {
    if (
      Date.parse(membership.validFrom) > Date.parse(now) ||
      (membership.validUntil !== null &&
        Date.parse(membership.validUntil) > Date.parse(now))
    )
      throw new RegistrationRuleError('FUTURE_MEMBERSHIP');
    if (
      membership.validUntil !== null &&
      Date.parse(membership.validFrom) >= Date.parse(membership.validUntil)
    )
      throw new RegistrationRuleError('INVALID_MEMBERSHIP_INTERVAL');
  }
  for (let index = 0; index < memberships.length; index++) {
    const first = memberships[index]!;
    for (const second of memberships.slice(index + 1)) {
      const overlap =
        Date.parse(first.validFrom) <
          (second.validUntil === null
            ? Infinity
            : Date.parse(second.validUntil)) &&
        Date.parse(second.validFrom) <
          (first.validUntil === null ? Infinity : Date.parse(first.validUntil));
      if (!overlap) continue;
      if (first.personId === second.personId)
        throw new RegistrationConflictError('MEMBERSHIP_OVERLAP', [
          first.id,
          second.id,
        ]);
      if (
        first.familyId === second.familyId &&
        first.isReference &&
        second.isReference
      )
        throw new RegistrationConflictError('REFERENCE_OVERLAP', [
          first.id,
          second.id,
        ]);
    }
  }
}
