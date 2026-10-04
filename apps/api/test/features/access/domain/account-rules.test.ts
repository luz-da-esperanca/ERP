import { describe, expect, it } from 'vitest';
import { assertAdministratorRemains } from '../../../../src/features/access/domain/account-rules.js';
describe('Account invariants', () => {
  it('rejects removing or deactivating the last active administrator', () => {
    expect(() =>
      assertAdministratorRemains(
        true,
        ['ADMINISTRATOR'],
        false,
        ['ADMINISTRATOR'],
        1,
      ),
    ).toThrow();
    expect(() =>
      assertAdministratorRemains(
        true,
        ['ADMINISTRATOR'],
        true,
        ['SOCIAL_ASSISTANCE'],
        1,
      ),
    ).toThrow();
    expect(() =>
      assertAdministratorRemains(
        true,
        ['ADMINISTRATOR'],
        false,
        ['ADMINISTRATOR'],
        2,
      ),
    ).not.toThrow();
  });
});
