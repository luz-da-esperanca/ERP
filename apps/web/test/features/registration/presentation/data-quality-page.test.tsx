// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../../src/shared/api-client';
import { HttpDataQuality, DataQualityPage } from '../../../../src/registration';

const sourceId = '00000000-0000-4000-8000-000000000001';
const targetId = '00000000-0000-4000-8000-000000000002';
const issue = {
  id: '00000000-0000-4000-8000-000000000003',
  entityType: 'PERSON',
  entityId: sourceId,
  kind: 'POSSIBLE_DUPLICATE',
  candidateIds: [targetId],
  fieldKeys: [],
  identifiedAt: '2026-10-01T12:00:00Z',
  resolvedAt: null,
  resolvedBy: null,
  resolution: null,
  reason: null,
  revision: 1,
};
const page = { data: [issue], pagination: { page: 1, pageSize: 20, total: 1 } };

function setup(
  fetcher: typeof fetch,
  capabilities = [
    'registration.read',
    'registration.write',
    'registration.merge',
  ],
) {
  render(
    <MemoryRouter>
      <DataQualityPage
        gateway={new HttpDataQuality(new ApiClient(fetcher))}
        capabilities={capabilities}
      />
    </MemoryRouter>,
  );
  return userEvent.setup();
}
afterEach(cleanup);

describe('DataQualityPage', () => {
  it('lists server issues with type, analysis status and server-side filters', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(page));
    const user = setup(fetcher);
    await screen.findByRole('button', { name: 'Analisar' });
    expect(screen.getByRole('cell', { name: 'Pessoa' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Em aberto' })).toBeTruthy();
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      '/api/v1/data-quality-issues?page=1&pageSize=20&kind=POSSIBLE_DUPLICATE&status=OPEN',
    );
    await user.selectOptions(
      screen.getByLabelText('Tipo de registro'),
      'FAMILY',
    );
    expect(fetcher.mock.calls.at(-1)?.[0]).toContain('entityType=FAMILY');
  });
});

const person = (id: string, name: string) => ({
  id,
  name,
  birthDate: null,
  sex: null,
  cpf: null,
  rg: null,
  occupation: null,
  educationLevel: null,
  contactPhone: null,
  revision: 1,
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
});
const preview = {
  entityType: 'PERSON',
  sourceId,
  targetId,
  expectedSourceRevision: 1,
  expectedTargetRevision: 1,
  sourceFingerprint: 'a'.repeat(64),
  fieldConflicts: [
    { field: 'name', source: 'Ana Origem', target: 'Ana Destino' },
  ],
  adoptedFields: [],
  membershipConflicts: [],
  referenceConflicts: [],
  enrollmentConflicts: [],
  attendanceConflicts: [],
  sizeProfileConflict: null,
  memberships: [],
  enrollments: [],
  attendances: [],
  issueIds: [issue.id],
  preserved: { socialForms: 2, eligibilityAssessments: 1 },
};
function workflowFetcher(
  override?: (path: string, options?: RequestInit) => Response | undefined,
) {
  return vi.fn<typeof fetch>(async (input, options) => {
    const path = String(input);
    const response = override?.(path, options);
    if (response) return response;
    if (path.includes('/people/'))
      return Response.json({
        data: {
          person: person(
            path.endsWith(sourceId) ? sourceId : targetId,
            path.endsWith(sourceId) ? 'Ana Origem' : 'Ana Destino',
          ),
          memberships: [],
          currentFamily: null,
          sizeProfile: null,
        },
      });
    if (path.endsWith('/identity-merges/preview'))
      return Response.json({ data: preview });
    if (path.endsWith('/identity-merges'))
      return Response.json({
        data: {
          merge: {
            id: issue.id,
            entityType: 'PERSON',
            sourceId,
            targetId,
            recordedAt: '2026-10-01T12:00:00Z',
            recordedBy: sourceId,
            reason: 'Cadastro repetido confirmado',
            operationId: targetId,
            resolution: {
              fieldSelections: { name: 'TARGET' },
              adoptedFields: [],
              supersededMemberships: [],
              supersededEnrollments: [],
              supersededAttendances: [],
              sizeProfile: null,
              resolvedIssueIds: [issue.id],
            },
          },
          target: person(targetId, 'Ana Destino'),
        },
      });
    return Response.json(page);
  });
}
async function openPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Analisar' }));
  await screen.findAllByRole('option', { name: /Ana Origem/ });
  await user.selectOptions(
    screen.getByLabelText('Registro de origem'),
    sourceId,
  );
  await user.selectOptions(
    screen.getByLabelText('Registro que permanecerá'),
    targetId,
  );
  await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
  await screen.findByRole('heading', { name: 'Prévia da unificação' });
}
it('requires explicit field choices, reason and final confirmation before writing the merge', async () => {
  const fetcher = workflowFetcher();
  const user = setup(fetcher);
  await openPreview(user);
  expect(
    fetcher.mock.calls.filter(([path]) =>
      String(path).endsWith('/identity-merges'),
    ),
  ).toHaveLength(0);
  expect(screen.getByLabelText(/^Valor preservado: Nome/)).toHaveProperty(
    'value',
    '',
  );
  await user.selectOptions(
    screen.getByLabelText(/^Valor preservado: Nome/),
    'TARGET',
  );
  await user.type(
    screen.getByLabelText(/^Motivo da unificação/),
    'Cadastro repetido confirmado',
  );
  await user.click(screen.getByRole('button', { name: 'Revisar confirmação' }));
  expect(
    fetcher.mock.calls.filter(([path]) =>
      String(path).endsWith('/identity-merges'),
    ),
  ).toHaveLength(0);
  await user.click(
    screen.getByRole('button', { name: 'Confirmar unificação' }),
  );
  await screen.findByText(
    'Unificação concluída. O registro de destino foi preservado.',
  );
  const call = fetcher.mock.calls.find(([path]) =>
    String(path).endsWith('/identity-merges'),
  )!;
  expect(JSON.parse(String(call[1]?.body))).toMatchObject({
    sourceId,
    targetId,
    expectedSourceFingerprint: preview.sourceFingerprint,
    fieldSelections: { name: 'TARGET' },
    reason: 'Cadastro repetido confirmado',
  });
  expect(call[1]?.headers).toHaveProperty('Idempotency-Key');
});
it('blocks family merges with simultaneous references reported by the preview', async () => {
  const family = (id: string, code: string) => ({
    id,
    code,
    referenceName: 'Família sintética',
    address: null,
    neighborhood: null,
    postalCode: null,
    location: null,
    contactPhone: null,
    revision: 1,
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-01T12:00:00Z',
    memberCount: 0,
    referencePersonName: null,
  });
  const fetcher = workflowFetcher((path) => {
    if (path.includes('/data-quality-issues'))
      return Response.json({
        ...page,
        data: [{ ...issue, entityType: 'FAMILY' }],
      });
    if (path.includes('/families/'))
      return Response.json({
        data: {
          family: family(
            path.endsWith(sourceId) ? sourceId : targetId,
            path.endsWith(sourceId) ? '1' : '2',
          ),
          members: [],
        },
      });
    if (path.endsWith('/preview'))
      return Response.json({
        data: {
          ...preview,
          entityType: 'FAMILY',
          fieldConflicts: [],
          referenceConflicts: [{ membershipIds: [sourceId, targetId] }],
        },
      });
  });
  const user = setup(fetcher);
  await user.click(await screen.findByRole('button', { name: 'Analisar' }));
  await screen.findAllByRole('option', { name: /Família 1/ });
  await user.selectOptions(
    screen.getByLabelText('Registro de origem'),
    sourceId,
  );
  await user.selectOptions(
    screen.getByLabelText('Registro que permanecerá'),
    targetId,
  );
  await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
  expect(await screen.findByText(/Corrija a titularidade/)).toBeTruthy();
  await user.type(
    screen.getByLabelText(/^Motivo da unificação/),
    'Mesma família',
  );
  expect(
    screen.getByRole('button', { name: 'Revisar confirmação' }),
  ).toHaveProperty('disabled', true);
});
it('requires explicit interval, attendance and size resolutions without selecting defaults', async () => {
  const membership = (id: string) => ({
    id,
    personId: sourceId,
    familyId: targetId,
    relationshipToReference: null,
    isReference: false,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: null,
    revision: 1,
  });
  const attendance = (id: string, status: string) => ({
    id,
    sessionId: issue.id,
    personId: sourceId,
    familyId: targetId,
    membershipId: id,
    membershipRevision: 1,
    status,
    recordedAt: '2026-10-01T12:00:00Z',
    recordedBy: sourceId,
    revision: 1,
    supersededById: null,
  });
  const sizes = {
    personId: sourceId,
    shoeSize: '38',
    clothingSize: 'M',
    informedOn: '2026-10-01',
    revision: 1,
  };
  const fetcher = workflowFetcher((path) =>
    path.endsWith('/preview')
      ? Response.json({
          data: {
            ...preview,
            membershipConflicts: [
              { ids: [sourceId, targetId], sameGroup: true },
            ],
            memberships: [membership(sourceId), membership(targetId)],
            attendanceConflicts: [
              {
                sessionId: issue.id,
                attendanceIds: [sourceId, targetId],
                statusesDiffer: true,
              },
            ],
            attendances: [
              attendance(sourceId, 'PRESENT'),
              attendance(targetId, 'ABSENT'),
            ],
            sizeProfileConflict: {
              source: sizes,
              target: { ...sizes, personId: targetId, shoeSize: '39' },
            },
          },
        })
      : undefined,
  );
  const user = setup(fetcher);
  await openPreview(user);
  await user.selectOptions(
    screen.getByLabelText(/^Valor preservado: Nome/),
    'TARGET',
  );
  await user.type(
    screen.getByLabelText(/^Motivo da unificação/),
    'Cadastro repetido confirmado',
  );
  expect(
    screen.getByRole('button', { name: 'Revisar confirmação' }),
  ).toHaveProperty('disabled', true);
  await user.selectOptions(
    screen.getByLabelText(`Ação do vínculo ${sourceId}`),
    'KEEP',
  );
  await user.selectOptions(
    screen.getByLabelText(`Ação do vínculo ${targetId}`),
    'SUPERSEDE',
  );
  await user.selectOptions(
    screen.getByLabelText(new RegExp(`^Vínculo que substitui ${targetId}`)),
    sourceId,
  );
  await user.selectOptions(
    screen.getByLabelText(
      new RegExp(`^Marcação preservada do encontro ${issue.id}`),
    ),
    sourceId,
  );
  await user.type(
    screen.getByLabelText(
      new RegExp(`^Motivo da marcação do encontro ${issue.id}`),
    ),
    'Conferido com chamada sintética',
  );
  await user.selectOptions(
    screen.getByLabelText(/^Perfil de tamanhos preservado/),
    'TARGET',
  );
  await user.click(screen.getByRole('button', { name: 'Revisar confirmação' }));
  await user.click(
    screen.getByRole('button', { name: 'Confirmar unificação' }),
  );
  await screen.findByText(
    'Unificação concluída. O registro de destino foi preservado.',
  );
  const call = fetcher.mock.calls.find(([path]) =>
    String(path).endsWith('/identity-merges'),
  )!;
  expect(JSON.parse(String(call[1]?.body))).toMatchObject({
    membershipResolutions: [
      {
        id: sourceId,
        action: 'KEEP',
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: null,
      },
      { id: targetId, action: 'SUPERSEDE', supersededById: sourceId },
    ],
    attendanceResolutions: [
      {
        sessionId: issue.id,
        effectiveAttendanceId: sourceId,
        reason: 'Conferido com chamada sintética',
      },
    ],
    sizeProfileResolution: { keep: 'TARGET' },
  });
});
it('searches server candidates by person name and exposes server matching reasons', async () => {
  const fetcher = workflowFetcher((path) =>
    path.includes('/duplicate-candidates?')
      ? Response.json({
          data: [
            { id: sourceId, entityType: 'PERSON', reasons: ['NAME_SIMILAR'] },
            { id: targetId, entityType: 'PERSON', reasons: ['CPF_MATCH'] },
          ],
        })
      : undefined,
  );
  const user = setup(fetcher);
  await user.click(screen.getByRole('button', { name: 'Buscar candidatos' }));
  await user.type(screen.getByLabelText('Nome da pessoa'), 'Ana');
  await user.click(
    screen.getByRole('button', { name: 'Consultar candidatos' }),
  );
  await screen.findByText('Nome semelhante');
  expect(screen.getByText('CPF igual')).toBeTruthy();
  expect(
    fetcher.mock.calls.some(
      ([path]) =>
        String(path) ===
        '/api/v1/duplicate-candidates?entityType=PERSON&name=Ana',
    ),
  ).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Comparar candidatos' }));
  await screen.findByRole('heading', { name: 'Comparação de pessoas' });
});
it('resolves an open occurrence as distinct only with a reason and explicit confirmation', async () => {
  const fetcher = workflowFetcher((path) =>
    path.endsWith('/resolution')
      ? Response.json({
          data: {
            ...issue,
            revision: 2,
            resolvedAt: '2026-10-01T12:00:00Z',
            resolvedBy: sourceId,
            resolution: 'DISTINCT',
            reason: 'Conferência confirmou pessoas distintas',
          },
        })
      : undefined,
  );
  const user = setup(fetcher);
  await user.click(await screen.findByRole('button', { name: 'Analisar' }));
  await screen.findAllByRole('option', { name: /Ana Origem/ });
  await user.click(
    screen.getByRole('button', { name: 'Registrar como distintos' }),
  );
  await user.type(
    screen.getByLabelText(/^Motivo da análise/),
    'Conferência confirmou pessoas distintas',
  );
  await user.click(
    screen.getByRole('button', { name: 'Confirmar registros distintos' }),
  );
  await screen.findByText(
    'Análise concluída. Os registros foram classificados como distintos.',
  );
  const call = fetcher.mock.calls.find(([path]) =>
    String(path).endsWith('/resolution'),
  )!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    expectedRevision: 1,
    resolution: 'DISTINCT',
    reason: 'Conferência confirmou pessoas distintas',
  });
});
it('does not fetch restricted data without registration.read', async () => {
  const fetcher = workflowFetcher();
  setup(fetcher, []);
  expect(
    screen.getByText('Seu perfil não permite acessar esta área.'),
  ).toBeTruthy();
  await waitFor(() => expect(fetcher).not.toHaveBeenCalled());
});
it('paginates server results without inventing a textual issue filter', async () => {
  const fetcher = workflowFetcher((path) =>
    path.includes('/data-quality-issues?')
      ? Response.json({
          ...page,
          pagination: {
            page: path.includes('page=2') ? 2 : 1,
            pageSize: 20,
            total: 21,
          },
        })
      : undefined,
  );
  const user = setup(fetcher);
  await user.click(
    await screen.findByRole('button', { name: 'Próxima página' }),
  );
  await screen.findByText('Página 2 de 2 · 21 ocorrências');
  expect(fetcher.mock.calls.at(-1)?.[0]).toContain('page=2');
});
it('keeps the idempotency key after a network failure and blocks stale confirmation after a conflict', async () => {
  let outcome = 'NETWORK';
  const fetcher = workflowFetcher((path) => {
    if (!path.endsWith('/identity-merges')) return undefined;
    if (outcome === 'NETWORK') throw new Error('Synthetic offline failure');
    return Response.json(
      { error: { code: 'REVISION_CONFLICT', requestId: 'synthetic-request' } },
      { status: 409 },
    );
  });
  const user = setup(fetcher);
  await openPreview(user);
  await user.selectOptions(
    screen.getByLabelText(/^Valor preservado: Nome/),
    'TARGET',
  );
  await user.type(
    screen.getByLabelText(/^Motivo da unificação/),
    'Cadastro repetido confirmado',
  );
  await user.click(screen.getByRole('button', { name: 'Revisar confirmação' }));
  await user.click(
    screen.getByRole('button', { name: 'Confirmar unificação' }),
  );
  await screen.findByRole('alert');
  outcome = 'CONFLICT';
  await user.click(
    screen.getByRole('button', { name: 'Confirmar unificação' }),
  );
  await screen.findByRole('button', { name: 'Atualizar prévia' });
  expect(
    screen.queryByRole('button', { name: 'Confirmar unificação' }),
  ).toBeNull();
  const calls = fetcher.mock.calls.filter(([path]) =>
    String(path).endsWith('/identity-merges'),
  );
  expect(calls).toHaveLength(2);
  expect(calls[0]?.[1]?.headers).toEqual(calls[1]?.[1]?.headers);
  await user.click(screen.getByRole('button', { name: 'Atualizar prévia' }));
  await screen.findByLabelText(/^Valor preservado: Nome/);
  expect(screen.getByLabelText(/^Valor preservado: Nome/)).toHaveProperty(
    'value',
    '',
  );
});
it('shows empty and forbidden server states and permits retrying a failed query', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json(
        { error: { code: 'FORBIDDEN', requestId: 'synthetic' } },
        { status: 403 },
      ),
    );
  const user = setup(fetcher);
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Seu perfil não permite esta operação.',
  );
  fetcher.mockResolvedValue(
    Response.json({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0 },
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await screen.findByText('Nenhuma ocorrência encontrada.');
});
it('allows read-only comparison without offering merge or distinct writes', async () => {
  const fetcher = workflowFetcher();
  const user = setup(fetcher, ['registration.read']);
  await user.click(await screen.findByRole('button', { name: 'Analisar' }));
  await screen.findAllByRole('option', { name: /Ana Origem/ });
  expect(screen.queryByRole('button', { name: 'Gerar prévia' })).toBeNull();
  expect(
    screen.queryByRole('button', { name: 'Registrar como distintos' }),
  ).toBeNull();
});
it('locks record changes and navigation while a merge confirmation is pending', async () => {
  let finish: (response: Response) => void;
  const fetcher = workflowFetcher();
  const initial = fetcher.getMockImplementation()!;
  fetcher.mockImplementation((input, options) =>
    String(input).endsWith('/identity-merges')
      ? new Promise<Response>((resolve) => {
          finish = resolve;
        })
      : initial(input, options),
  );
  const user = setup(fetcher);
  await openPreview(user);
  await user.selectOptions(
    screen.getByLabelText(/^Valor preservado: Nome/),
    'TARGET',
  );
  await user.type(
    screen.getByLabelText(/^Motivo da unificação/),
    'Cadastro repetido confirmado',
  );
  await user.click(screen.getByRole('button', { name: 'Revisar confirmação' }));
  await user.click(
    screen.getByRole('button', { name: 'Confirmar unificação' }),
  );
  expect(
    screen.getByRole('button', { name: 'Voltar à consulta' }),
  ).toHaveProperty('disabled', true);
  expect(screen.getByLabelText('Registro de origem')).toHaveProperty(
    'disabled',
    true,
  );
  expect(screen.getByRole('button', { name: 'Gerar prévia' })).toHaveProperty(
    'disabled',
    true,
  );
  finish!(
    Response.json(
      { error: { code: 'REVISION_CONFLICT', requestId: 'synthetic' } },
      { status: 409 },
    ),
  );
  await screen.findByRole('button', { name: 'Atualizar prévia' });
});
it('shows preserved destination values and server-adopted source values without choosing divergent fields', async () => {
  const fetcher = workflowFetcher((path) => {
    if (path.endsWith(`/people/${sourceId}`))
      return Response.json({
        data: {
          person: {
            ...person(sourceId, 'Ana Origem'),
            contactPhone: 'Telefone sintético',
          },
          memberships: [],
          currentFamily: null,
          sizeProfile: null,
        },
      });
    if (path.endsWith('/preview'))
      return Response.json({
        data: { ...preview, adoptedFields: ['contactPhone'] },
      });
  });
  const user = setup(fetcher);
  await openPreview(user);
  const table = screen.getByRole('table', {
    name: 'Dados que serão preservados',
  });
  expect(table.textContent).toContain('Telefone sintético');
  expect(table.textContent).toContain('Escolha pendente');
  expect(table.textContent).toContain('Não informado');
});
it('rejects a preview when comparison details no longer match its revisions', async () => {
  let previewRequested = false;
  const fetcher = workflowFetcher((path) => {
    if (path.endsWith('/preview')) {
      previewRequested = true;
      return Response.json({ data: preview });
    }
    if (previewRequested && path.endsWith(`/people/${sourceId}`))
      return Response.json({
        data: {
          person: { ...person(sourceId, 'Ana atualizada'), revision: 2 },
          memberships: [],
          currentFamily: null,
          sizeProfile: null,
        },
      });
  });
  const user = setup(fetcher);
  await user.click(await screen.findByRole('button', { name: 'Analisar' }));
  await screen.findAllByRole('option', { name: /Ana Origem/ });
  await user.selectOptions(
    screen.getByLabelText('Registro de origem'),
    sourceId,
  );
  await user.selectOptions(
    screen.getByLabelText('Registro que permanecerá'),
    targetId,
  );
  await user.click(screen.getByRole('button', { name: 'Gerar prévia' }));
  await screen.findByRole('alert');
  expect(
    screen.queryByRole('button', { name: 'Revisar confirmação' }),
  ).toBeNull();
});
it('formats civil birth dates in Brazilian format while preserving unknown values', async () => {
  const fetcher = workflowFetcher((path) =>
    path.endsWith(`/people/${sourceId}`)
      ? Response.json({
          data: {
            person: {
              ...person(sourceId, 'Ana Origem'),
              birthDate: '1990-08-20',
            },
            memberships: [],
            currentFamily: null,
            sizeProfile: null,
          },
        })
      : undefined,
  );
  const user = setup(fetcher);
  await user.click(await screen.findByRole('button', { name: 'Analisar' }));
  await screen.findAllByRole('option', { name: /Ana Origem/ });
  await user.selectOptions(
    screen.getByLabelText('Registro de origem'),
    sourceId,
  );
  await user.selectOptions(
    screen.getByLabelText('Registro que permanecerá'),
    targetId,
  );
  expect(screen.getByText('20/08/1990')).toBeTruthy();
  expect(screen.getAllByText('Não informado').length).toBeGreaterThan(0);
});
