import { describe, expect, it, vi } from 'vitest';
import {
  DataModeGuard,
  type FeatureDecisionReader,
} from '../../../src/core/application/data-mode.js';
import { FeatureNotEnabledError } from '../../../src/core/application/errors.js';

describe('DataModeGuard', () => {
  it('allows synthetic operation without requiring an institutional decision', async () => {
    const decisions = { find: vi.fn<FeatureDecisionReader['find']>() };
    await expect(
      new DataModeGuard('SYNTHETIC', decisions).assertEnabled(),
    ).resolves.toBeUndefined();
    expect(decisions.find).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { enabled: false, decisionReference: 'DEC-08' },
    { enabled: true, decisionReference: '   ' },
  ])(
    'rejects real operation without an enabled and referenced decision (%j)',
    async (decision) => {
      const decisions = {
        find: vi
          .fn<FeatureDecisionReader['find']>()
          .mockResolvedValue(decision),
      };
      await expect(
        new DataModeGuard('REAL', decisions).assertEnabled(),
      ).rejects.toBeInstanceOf(FeatureNotEnabledError);
    },
  );

  it('allows real operation only when the required decision is enabled and referenced', async () => {
    const decisions = {
      find: vi
        .fn<FeatureDecisionReader['find']>()
        .mockResolvedValue({ enabled: true, decisionReference: 'DEC-08' }),
    };
    await expect(
      new DataModeGuard('REAL', decisions).assertEnabled(),
    ).resolves.toBeUndefined();
    expect(decisions.find).toHaveBeenCalledWith('REAL_PERSONAL_DATA');
  });
});
