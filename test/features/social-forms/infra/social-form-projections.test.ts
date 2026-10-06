import { describe, expect, it } from 'vitest';
import { projectSocialFormSummary } from '../../../../src/features/social-forms/infra/social-form-projections.js';
import { socialFormSummarySchema } from '@erp/contracts/social-forms-api';

describe('Social form summary projection', () => {
  it('returns public version metadata without persistence payloads and preserves an imported namespace', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const row = {
      id,
      familyId: id,
      version: 3,
      previousVersionId: id,
      correctionOfFormId: null,
      referenceMemberId: id,
      occurredAt: new Date('2026-10-01T12:00:00Z'),
      recordedAt: new Date('2026-10-05T12:00:00Z'),
      recordedBy: id,
      fieldSelectionVersionId: id,
      familySnapshot: { private: 'hidden' },
      blocks: { private: 'hidden' },
      reason: 'private reason',
    };
    const summary = projectSocialFormSummary(row, 'another-family');
    expect(socialFormSummarySchema.safeParse(summary).success).toBe(true);
    expect(summary).toMatchObject({
      familyId: id,
      version: 3,
      originFamilyId: id,
      originalVersion: 3,
    });
    expect(summary).not.toHaveProperty('blocks');
    expect(summary).not.toHaveProperty('reason');
  });
});
