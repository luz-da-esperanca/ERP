import { describe, expect, it, vi } from 'vitest';
import type {
  EligibilityPreviewDto,
  PolicyVersionDto,
} from '@erp/contracts/eligibility-api';
import { HttpEligibility } from '../../../../src/eligibility';
import { ApiClient } from '../../../../src/shared/api-client';

const familyId = '00000000-0000-4000-8000-000000000001';
const policyId = '00000000-0000-4000-8000-000000000002';
const activityId = '00000000-0000-4000-8000-000000000003';
const actorId = '00000000-0000-4000-8000-000000000004';
const key = '00000000-0000-4000-8000-000000000005';
const referenceDate = '2026-10-05';
const preview: EligibilityPreviewDto = {
  familyId,
  referenceDate,
  evaluatedAt: '2026-10-06T12:00:00.000Z',
  policyId: null,
  status: 'PENDING',
  pendingReasons: ['POLICY_UNDEFINED'],
  explanation: {
    rule: 'POLICY_UNDEFINED',
    period: null,
    minimum: null,
    activityIds: [],
    activityCombination: null,
    membershipScope: null,
    opportunityRule: null,
    qualifyingPersonIds: [],
  },
  evidences: [],
  sourceFingerprint: 'a'.repeat(64),
};
const policy: PolicyVersionDto = {
  id: policyId,
  effectiveFrom: '2026-10-01',
  effectiveUntilExclusive: null,
  recordedAt: '2026-10-05T12:00:00.000Z',
  recordedBy: actorId,
  decisionReference: 'Synthetic decision',
  reason: 'Synthetic publication',
  definition: {
    schemaVersion: 1,
    period: { type: 'ROLLING_DAYS', length: 30 },
    minimum: { type: 'PRESENCE_COUNT', value: 2 },
    activityIds: [activityId],
    activityCombination: 'ANY_ACTIVITY',
    membershipScope: 'CURRENT_ON_REFERENCE',
    opportunityRule: 'ENROLLMENT_OR_RECORDED',
    justificationRule: 'NOT_SUPPORTED',
    recessRule: 'RECORDED_SESSIONS_ONLY',
    newParticipantRule: 'OPPORTUNITY_RULE',
    toleranceRule: 'NONE',
    incompleteEvidenceRule: 'THREE_VALUED',
  },
};

describe('HTTP eligibility', () => {
  it('reads the direct paginated policy envelope and preserves the published definition', async () => {
    const page = {
      data: [policy],
      pagination: { page: 2, pageSize: 10, total: 11 },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(page));
    const onChange = vi.fn();
    const result = await new HttpEligibility(
      new ApiClient(fetcher),
      onChange,
    ).listPolicies({ page: 2, pageSize: 10 });

    expect(result).toEqual(page);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/v1/eligibility-policies');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('10');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reads a policy item without confusing its envelope with the policy page', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: policy }));
    const result = await new HttpEligibility(new ApiClient(fetcher)).getPolicy(
      policyId,
    );

    expect(result).toEqual(policy);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `/api/v1/eligibility-policies/${policyId}`,
    );
  });

  it('publishes the operator selections with the unchanged idempotency key and latest policy expectation', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json({ data: policy }, { status: 201 }),
      );
    const onChange = vi.fn();
    const gateway = new HttpEligibility(new ApiClient(fetcher), onChange);
    for (const expectedLatestPolicyId of [null, policyId]) {
      const input = {
        definition: policy.definition,
        effectiveFrom: policy.effectiveFrom,
        expectedLatestPolicyId,
        decisionReference: 'Synthetic decision',
        reason: 'Synthetic publication',
        retroactive: true,
      };
      expect(await gateway.publishPolicy(input, key)).toEqual(policy);
      const request = fetcher.mock.calls.at(-1)?.[1];
      expect(fetcher.mock.calls.at(-1)?.[0]).toBe(
        '/api/v1/eligibility-policies',
      );
      expect(request?.method).toBe('POST');
      expect(request?.headers).toMatchObject({ 'Idempotency-Key': key });
      expect(JSON.parse(String(request?.body))).toEqual(input);
    }
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('preserves policy uncertainty and the server fingerprint without writing an assessment for a preview', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: preview }));
    const onChange = vi.fn();
    expect(
      await new HttpEligibility(new ApiClient(fetcher), onChange).preview(
        familyId,
        referenceDate,
      ),
    ).toEqual(preview);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe(
      `/api/v1/families/${familyId}/eligibility-preview`,
    );
    expect(url.searchParams.get('referenceDate')).toBe(referenceDate);
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('saves an assessment only through the idempotent assessment command', async () => {
    const assessment = { ...preview, id: policyId, requestedBy: actorId };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: assessment }, { status: 201 }));
    const onChange = vi.fn();
    expect(
      await new HttpEligibility(new ApiClient(fetcher), onChange).assess(
        familyId,
        referenceDate,
        key,
      ),
    ).toEqual(assessment);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `/api/v1/families/${familyId}/eligibility-assessments`,
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({ referenceDate }),
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('retrieves the saved original assessment without notifying a business change', async () => {
    const assessment = { ...preview, id: policyId, requestedBy: actorId };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: assessment }));
    const onChange = vi.fn();
    expect(
      await new HttpEligibility(new ApiClient(fetcher), onChange).getAssessment(
        policyId,
      ),
    ).toEqual(assessment);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `/api/v1/eligibility-assessments/${policyId}`,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects malformed fingerprints instead of exposing an unverified preview', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: { ...preview, sourceFingerprint: 'invalid' } }),
      );
    await expect(
      new HttpEligibility(new ApiClient(fetcher)).preview(
        familyId,
        referenceDate,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('propagates publication conflicts without notifying changes or retrying', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'DOMAIN_CONFLICT',
            requestId: key,
            details: { rule: 'POLICY_CHANGED', ids: [policyId] },
          },
        },
        { status: 409 },
      ),
    );
    const onChange = vi.fn();
    await expect(
      new HttpEligibility(new ApiClient(fetcher), onChange).publishPolicy(
        {
          definition: policy.definition,
          effectiveFrom: policy.effectiveFrom,
          expectedLatestPolicyId: null,
          decisionReference: 'Synthetic decision',
          reason: 'Synthetic publication',
          retroactive: true,
        },
        key,
      ),
    ).rejects.toMatchObject({
      code: 'DOMAIN_CONFLICT',
      status: 409,
      details: { rule: 'POLICY_CHANGED', ids: [policyId] },
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('validates dates and identifiers before sending a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const gateway = new HttpEligibility(new ApiClient(fetcher));
    await expect(gateway.preview(familyId, '2026-02-30')).rejects.toThrow();
    await expect(gateway.getPolicy('../secret')).rejects.toThrow();
    await expect(gateway.getAssessment('../secret')).rejects.toThrow();
    await expect(
      gateway.assess('invalid', referenceDate, key),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps the caller key and body on an explicit retry after a lost connection', async () => {
    const assessment = { ...preview, id: policyId, requestedBy: actorId };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Connection lost'))
      .mockResolvedValueOnce(
        Response.json({ data: assessment }, { status: 201 }),
      );
    const onChange = vi.fn();
    const gateway = new HttpEligibility(new ApiClient(fetcher), onChange);
    await expect(
      gateway.assess(familyId, referenceDate, key),
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(await gateway.assess(familyId, referenceDate, key)).toEqual(
      assessment,
    );
    expect(fetcher.mock.calls[1]).toEqual(fetcher.mock.calls[0]);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('does not notify a change when the written response cannot be verified', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: preview }, { status: 201 }));
    const onChange = vi.fn();
    await expect(
      new HttpEligibility(new ApiClient(fetcher), onChange).assess(
        familyId,
        referenceDate,
        key,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refuses incomplete policy commands and invalid idempotency keys before requesting a write', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const gateway = new HttpEligibility(new ApiClient(fetcher));
    const input = {
      definition: policy.definition,
      effectiveFrom: policy.effectiveFrom,
      expectedLatestPolicyId: null,
      decisionReference: 'Synthetic decision',
      reason: ' ',
      retroactive: false,
    };
    await expect(gateway.publishPolicy(input, key)).rejects.toThrow();
    await expect(
      gateway.assess(familyId, referenceDate, 'invalid'),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
