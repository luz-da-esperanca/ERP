// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import {
  FamilyEligibilityPage,
  EligibilityEvidence,
} from '../../../../src/eligibility';
import type { EligibilityPreviewDto } from '@erp/contracts/eligibility-api';
import type { HttpEligibility } from '../../../../src/eligibility';
import { ApiRequestError } from '../../../../src/shared/api-client';
afterEach(cleanup);
it('presents dated eligibility evidence with a clear policy action and keeps source revisions under disclosure', async () => {
  const result: EligibilityPreviewDto = {
    familyId: 'family',
    referenceDate: '2026-10-05',
    evaluatedAt: '2026-10-05T12:00:00Z',
    policyId: 'policy',
    status: 'ELIGIBLE',
    pendingReasons: [],
    sourceFingerprint: 'a'.repeat(64),
    explanation: {
      rule: 'MEMBER_MEETS_MINIMUM',
      minimum: { type: 'PRESENCE_COUNT', value: 1 },
      activityCombination: 'ANY_ACTIVITY',
      membershipScope: 'CURRENT_ON_REFERENCE',
      opportunityRule: 'ENROLLMENT_OR_RECORDED',
      period: { from: '2026-09-01', toExclusive: '2026-10-01' },
      qualifyingPersonIds: ['person'],
      activityIds: ['activity'],
    },
    evidences: [
      {
        personId: 'person',
        membershipIds: ['membership'],
        activityIds: ['activity'],
        periodStart: '2026-09-01',
        periodEndExclusive: '2026-10-01',
        sessionCount: 2,
        presenceCount: 1,
        absenceCount: 1,
        unrecordedCount: 0,
        rateLowerBasisPoints: 5000,
        rateUpperBasisPoints: 5000,
        coverageComplete: true,
        status: 'ELIGIBLE',
        pendingReason: null,
        sourceVersions: [],
      },
    ],
  };
  render(
    <MemoryRouter>
      <EligibilityEvidence result={result} />
    </MemoryRouter>,
  );
  expect(screen.getByText('05/10/2026')).toBeTruthy();
  const policy = screen.getByRole('link', {
    name: 'Consultar política utilizada',
  });
  expect(policy.classList.contains('button')).toBe(true);
  expect(policy.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  await userEvent.setup().click(screen.getByText('Membro 1: Apta'));
  expect(screen.getByText('Presenças')).toBeTruthy();
  const revisions = screen
    .getByText('Revisões das fontes utilizadas')
    .closest('details')!;
  expect(revisions.open).toBe(false);
});
it('shows server pending evidence, keeps previews read-only, and replays an uncertain assessment', async () => {
  const result = {
    familyId: 'family',
    referenceDate: '2026-10-05',
    evaluatedAt: '2026-10-05T12:00:00Z',
    policyId: null,
    status: 'PENDING',
    pendingReasons: ['POLICY_UNDEFINED'],
    explanation: { period: null, qualifyingPersonIds: [], activityIds: [] },
    evidences: [],
    sourceFingerprint: 'a'.repeat(64),
  };
  const preview = vi.fn().mockResolvedValue(result);
  const assess = vi
    .fn()
    .mockRejectedValueOnce(new ApiRequestError('NETWORK_ERROR', 0))
    .mockResolvedValue({ ...result, id: 'saved' });
  const gateway = { preview, assess } as unknown as HttpEligibility;
  render(
    <MemoryRouter initialEntries={['/families/family/eligibility']}>
      <Routes>
        <Route
          path="/families/:id/eligibility"
          element={<FamilyEligibilityPage gateway={gateway} canEvaluate />}
        />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Política não configurada')).toBeTruthy();
  expect(assess).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Registrar avaliação' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Registrar avaliação' }));
  await waitFor(() => expect(assess).toHaveBeenCalledTimes(2));
  expect(assess.mock.calls[0]).toEqual(assess.mock.calls[1]);
  expect(await screen.findByText('Avaliação registrada.')).toBeTruthy();
});
it('requires every institutional policy choice and publishes against the latest recorded policy', async () => {
  const { EligibilityPoliciesPage } =
    await import('../../../../src/eligibility');
  const gateway = {
    listPolicies: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    }),
    publishPolicy: vi.fn().mockResolvedValue({ id: 'new' }),
  } as unknown as HttpEligibility;
  const projects = {
    overview: vi.fn().mockResolvedValue({
      activities: [
        { id: 'activity', name: 'Synthetic activity', nature: 'PERIODIC' },
      ],
      projects: [],
      institutes: [],
      serviceTypes: [],
    }),
  };
  render(
    <MemoryRouter>
      <EligibilityPoliciesPage
        gateway={gateway}
        projects={projects as never}
        canWrite
      />
    </MemoryRouter>,
  );
  await screen.findByText('Sem política configurada.');
  expect(
    (screen.getByLabelText(/^Período de avaliação/) as HTMLSelectElement).value,
  ).toBe('');
  expect(
    (screen.getByLabelText(/^Critério mínimo/) as HTMLSelectElement).value,
  ).toBe('');
  expect(
    (screen.getByLabelText(/^Combinação de atividades/) as HTMLSelectElement)
      .value,
  ).toBe('');
  expect(gateway.publishPolicy).not.toHaveBeenCalled();
});

it('retrieves a saved assessment and links the exact policy version without recalculating', async () => {
  const { EligibilityAssessmentPage } =
    await import('../../../../src/eligibility');
  const getAssessment = vi.fn().mockResolvedValue({
    id: 'assessment',
    familyId: 'family',
    referenceDate: '2026-09-01',
    evaluatedAt: '2026-09-01T12:00:00Z',
    policyId: 'old-policy',
    status: 'PENDING',
    pendingReasons: ['COVERAGE_INCOMPLETE'],
    explanation: { period: null },
    evidences: [],
  });
  const preview = vi.fn();
  render(
    <MemoryRouter initialEntries={['/eligibility-assessments/assessment']}>
      <Routes>
        <Route
          path="/eligibility-assessments/:id"
          element={
            <EligibilityAssessmentPage
              gateway={{ getAssessment, preview } as unknown as HttpEligibility}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText('Cobertura incompleta');
  expect(getAssessment).toHaveBeenCalledWith('assessment');
  expect(preview).not.toHaveBeenCalled();
  expect(
    screen
      .getByRole('link', { name: 'Consultar política utilizada' })
      .getAttribute('href'),
  ).toBe('/eligibility-policies/old-policy');
});
it('retrieves an exact historical policy even when it is absent from the first page', async () => {
  const { EligibilityPolicyPage } = await import('../../../../src/eligibility');
  const getPolicy = vi.fn().mockResolvedValue({
    id: 'old-policy',
    effectiveFrom: '2026-01-01',
    effectiveUntilExclusive: '2026-02-01',
    decisionReference: 'Historical decision',
    reason: 'Historical reason',
    recordedAt: '2026-01-01T12:00:00Z',
    definition: {
      period: { type: 'ROLLING_DAYS', length: 30 },
      minimum: { type: 'PRESENCE_COUNT', value: 2 },
      activityIds: ['activity'],
      activityCombination: 'ANY_ACTIVITY',
      membershipScope: 'CURRENT_ON_REFERENCE',
      opportunityRule: 'ENROLLMENT_OR_RECORDED',
    },
  });
  render(
    <MemoryRouter initialEntries={['/eligibility-policies/old-policy']}>
      <Routes>
        <Route
          path="/eligibility-policies/:id"
          element={
            <EligibilityPolicyPage
              gateway={{ getPolicy } as unknown as HttpEligibility}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText('Historical decision')).toBeTruthy();
  expect(getPolicy).toHaveBeenCalledWith('old-policy');
  expect(
    screen
      .getByRole('link', { name: 'Consultar atividade utilizada' })
      .getAttribute('href'),
  ).toBe('/activities/activity');
});
