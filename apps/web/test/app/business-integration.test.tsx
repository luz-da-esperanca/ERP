// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectedApp } from '../../src/app/connected-app';
import { HttpErpClient } from '../../src/app/http-erp-client';
import { HttpAuthentication } from '../../src/access';
import { ApiClient } from '../../src/shared/api-client';
import { installNativeDialogDouble } from '../support/native-dialog';

const userId = '00000000-0000-4000-8000-000000000001';
const familyId = '00000000-0000-4000-8000-000000000002';
const family = {
  id: familyId,
  code: '2',
  referenceName: 'Família sintética',
  address: null,
  neighborhood: null,
  postalCode: null,
  location: null,
  contactPhone: null,
  revision: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};
const session = {
  user: {
    id: userId,
    login: 'synthetic.operator',
    displayName: 'Synthetic operator',
    active: true,
    mustChangePassword: false,
    revision: 1,
    roleCodes: ['SOCIAL_ASSISTANCE'],
    createdAt: family.createdAt,
    updatedAt: family.updatedAt,
  },
  roles: ['SOCIAL_ASSISTANCE'],
  capabilities: ['registration.read', 'registration.write'],
};
function renderConnected(fetcher: typeof fetch, path: string) {
  const api = new ApiClient(fetcher);
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <ConnectedApp
          authentication={new HttpAuthentication(api)}
          client={new HttpErpClient(api)}
        />
      </MemoryRouter>
    </StrictMode>,
  );
}
let dialog: ReturnType<typeof installNativeDialogDouble>;
beforeEach(() => {
  dialog = installNativeDialogDouble();
});
afterEach(() => {
  cleanup();
  dialog.restore();
});

describe('Connected business screens', () => {
  it('submits a normalized masked CPF and rejects duplication without a distinct-person override', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>(async (value, options) => {
      if (String(value).endsWith('/auth/session'))
        return Response.json({ data: session });
      if (options?.method === 'POST')
        return Response.json(
          {
            error: {
              code: 'DOMAIN_CONFLICT',
              requestId: 'cpf-conflict',
              details: { rule: 'CPF_ALREADY_REGISTERED', ids: [userId] },
            },
          },
          { status: 409 },
        );
      return Response.json({
        data: {
          family: { ...family, memberCount: 0, referencePersonName: null },
          members: [],
        },
      });
    });
    renderConnected(fetcher, `/people/new?familyId=${familyId}`);
    await user.type(
      await screen.findByLabelText(/^Nome completo/),
      'Pessoa sintética',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'CPF' }),
      '12345678909',
    );
    await user.click(screen.getByRole('button', { name: 'Cadastrar pessoa' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Este CPF já está cadastrado. Localize a pessoa existente para continuar.',
    );
    const write = fetcher.mock.calls.find(
      ([, options]) => options?.method === 'POST',
    );
    expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({
      cpf: '12345678909',
    });
    expect(JSON.parse(String(write?.[1]?.body))).not.toHaveProperty(
      'duplicateReview',
    );
    expect(
      screen.queryByLabelText(/^Motivo para cadastrar como distinto/),
    ).toBeNull();
    expect(
      fetcher.mock.calls.some(([path]) =>
        String(path).includes('/duplicate-candidates'),
      ),
    ).toBe(false);
  });
  it('searches authorized families and people through the API and closes the search with Escape', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      if (url.pathname.endsWith('/auth/session'))
        return Response.json({ data: session });
      const data = url.pathname.endsWith('/people')
        ? [
            {
              id: userId,
              name: 'Pessoa Luz',
              birthDate: null,
              sex: null,
              cpf: null,
              rg: null,
              occupation: null,
              educationLevel: null,
              contactPhone: null,
              revision: 1,
              createdAt: family.createdAt,
              updatedAt: family.updatedAt,
            },
          ]
        : [
            {
              ...family,
              referenceName: 'Família Luz',
              memberCount: 0,
              referencePersonName: null,
            },
          ];
      return Response.json({
        data,
        pagination: { page: 1, pageSize: 100, total: 1 },
      });
    });
    renderConnected(fetcher, '/');
    await user.click(
      await screen.findByRole('button', { name: /Buscar por família/ }),
    );
    await user.type(
      screen.getByLabelText('Buscar por família, pessoa ou código'),
      'Luz',
    );
    expect(
      await screen.findByRole('link', { name: /Pessoa Luz/ }),
    ).toBeTruthy();
    expect(
      await screen.findByRole('link', { name: /Família Luz/ }),
    ).toBeTruthy();
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes('q=Luz')),
    ).toBe(true);
    expect(dialog.showModal).toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Buscar por família/ }),
    );
  });

  it('preserves server search results matching an address or a historical code', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      if (url.pathname.endsWith('/auth/session'))
        return Response.json({ data: session });
      return Response.json({
        data: url.pathname.endsWith('/people')
          ? []
          : [{ ...family, memberCount: 0, referencePersonName: null }],
        pagination: {
          page: 1,
          pageSize: 100,
          total: url.pathname.endsWith('/people') ? 0 : 1,
        },
      });
    });
    renderConnected(fetcher, '/');
    await user.click(
      await screen.findByRole('button', { name: /Buscar por família/ }),
    );
    await user.type(
      screen.getByLabelText('Buscar por família, pessoa ou código'),
      'Rua da Esperança',
    );
    expect(
      await screen.findByRole('link', { name: /Família sintética/ }),
    ).toBeTruthy();
  });

  it('keeps a minimal creation key after a lost response without offering to discard the uncertain operation', async () => {
    const user = userEvent.setup();
    const writes: RequestInit[] = [];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (value, options) => {
        const url = new URL(String(value), 'http://localhost');
        if (url.pathname.endsWith('/auth/session'))
          return Response.json({ data: session });
        if (options?.method === 'POST') {
          writes.push(options);
          if (writes.length === 1) throw new TypeError('Lost response');
          return Response.json({ data: family }, { status: 201 });
        }
        return Response.json({
          data: {
            family: { ...family, memberCount: 0, referencePersonName: null },
            members: [],
          },
        });
      });
    renderConnected(fetcher, '/families/new');
    await user.click(
      await screen.findByRole('button', { name: 'Criar família' }),
    );
    await screen.findByRole('alert');
    expect(
      screen.queryByRole('button', { name: 'Consultar candidatos novamente' }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Criar família' }));
    await screen.findByRole('heading', { name: 'Família sintética', level: 1 });
    expect(writes[0]).toEqual(writes[1]);
  });

  it('queries family audit using the canonical identity returned for a historical identifier', async () => {
    const alias = '00000000-0000-4000-8000-000000000099';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      if (url.pathname.endsWith('/auth/session'))
        return Response.json({
          data: {
            ...session,
            capabilities: [...session.capabilities, 'audit.read'],
          },
        });
      if (url.pathname.endsWith('/audit-entries'))
        return Response.json({
          data: [],
          pagination: { page: 1, pageSize: 100, total: 0 },
        });
      return Response.json({
        data: {
          family: { ...family, memberCount: 0, referencePersonName: null },
          members: [],
        },
      });
    });
    renderConnected(fetcher, `/families/${alias}`);
    await screen.findByText('Nenhuma alteração disponível para esta família.');
    const audits = fetcher.mock.calls.filter(([url]) =>
      String(url).includes('/audit-entries'),
    );
    expect(audits.length).toBeGreaterThan(0);
    expect(
      audits.every(
        ([url]) =>
          new URL(String(url), 'http://localhost').searchParams.get(
            'entityId',
          ) === familyId,
      ),
    ).toBe(true);
  });

  it('requires a new duplicate confirmation when the draft and candidates change', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      if (url.pathname.endsWith('/auth/session'))
        return Response.json({ data: session });
      return Response.json({
        data: [
          {
            id: url.searchParams.get('name')?.includes('Nova')
              ? userId
              : familyId,
            entityType: 'FAMILY',
            reasons: ['NAME_SIMILAR'],
          },
        ],
      });
    });
    renderConnected(fetcher, '/families/new');
    const name = await screen.findByLabelText('Nome de referência');
    await user.type(name, 'Família sintética');
    await user.click(screen.getByRole('button', { name: 'Criar família' }));
    const confirmation = await screen.findByLabelText(/^Conferi os candidatos/);
    await user.click(confirmation);
    await user.type(
      screen.getByLabelText(/^Motivo para cadastrar como distinto/),
      'Reviewed original candidate',
    );
    await user.clear(name);
    await user.type(name, 'Nova família');
    await user.click(screen.getByRole('button', { name: 'Criar família' }));
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/^Conferi os candidatos/) as HTMLInputElement)
          .checked,
      ).toBe(false),
    );
    expect(
      (
        screen.getByLabelText(
          /^Motivo para cadastrar como distinto/,
        ) as HTMLInputElement
      ).value,
    ).toBe('');
    expect(
      fetcher.mock.calls.some(([, options]) => options?.method === 'POST'),
    ).toBe(false);
  });

  it('recovers authorized server duplicate candidates missed by preflight and requires a fresh distinct-record review', async () => {
    const user = userEvent.setup();
    const writes: RequestInit[] = [];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (value, options) => {
        const url = new URL(String(value), 'http://localhost');
        if (url.pathname.endsWith('/auth/session'))
          return Response.json({ data: session });
        if (url.pathname.endsWith('/duplicate-candidates'))
          return Response.json({ data: [] });
        if (options?.method === 'POST') {
          writes.push(options);
          if (writes.length === 1)
            return Response.json(
              {
                error: {
                  code: 'DOMAIN_CONFLICT',
                  requestId: 'review',
                  details: {
                    rule: 'DUPLICATE_REVIEW_REQUIRED',
                    ids: [familyId],
                  },
                },
              },
              { status: 409 },
            );
          return Response.json({ data: family }, { status: 201 });
        }
        return Response.json({
          data: {
            family: { ...family, memberCount: 0, referencePersonName: null },
            members: [],
          },
        });
      });
    renderConnected(fetcher, '/families/new');
    await user.type(
      await screen.findByLabelText('Nome de referência'),
      'New synthetic',
    );
    await user.click(screen.getByRole('button', { name: 'Criar família' }));
    await screen.findByText('Possíveis cadastros duplicados');
    await user.type(
      screen.getByLabelText(/^Motivo para cadastrar como distinto/),
      'Server candidates reviewed',
    );
    await user.click(screen.getByLabelText(/^Conferi os candidatos/));
    await user.click(screen.getByRole('button', { name: 'Criar família' }));
    await screen.findByRole('heading', { name: 'Família sintética', level: 1 });
    expect(JSON.parse(String(writes[1]?.body))).toMatchObject({
      duplicateReview: {
        candidateIds: [familyId],
        decision: 'DISTINCT',
        reason: 'Server candidates reviewed',
      },
    });
  });

  it('creates a person with unknown optional data and the displayed family revision, then edits without overwriting a revision conflict', async () => {
    const user = userEvent.setup();
    const personId = '00000000-0000-4000-8000-000000000003';
    const person = {
      id: personId,
      name: 'Pessoa sintética',
      birthDate: null,
      sex: null,
      cpf: null,
      rg: null,
      occupation: null,
      educationLevel: null,
      contactPhone: null,
      revision: 1,
      createdAt: family.createdAt,
      updatedAt: family.updatedAt,
    };
    const membership = {
      id: '00000000-0000-4000-8000-000000000004',
      personId,
      familyId,
      relationshipToReference: null,
      isReference: false,
      validFrom: family.createdAt,
      validUntil: null,
      revision: 1,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (value, options) => {
        const url = new URL(String(value), 'http://localhost');
        if (url.pathname.endsWith('/auth/session'))
          return Response.json({ data: session });
        if (url.pathname.endsWith('/duplicate-candidates'))
          return Response.json({ data: [] });
        if (options?.method === 'POST')
          return Response.json(
            {
              data: { person, membership, family: { ...family, revision: 4 } },
            },
            { status: 201 },
          );
        if (options?.method === 'PATCH')
          return Response.json(
            { error: { code: 'REVISION_CONFLICT', requestId: 'conflict' } },
            { status: 409 },
          );
        if (url.pathname.includes(`/people/${personId}`))
          return Response.json({
            data: {
              person,
              memberships: [membership],
              currentFamily: { id: familyId, code: family.code },
              sizeProfile: null,
            },
          });
        return Response.json({
          data: {
            family: { ...family, memberCount: 0, referencePersonName: null },
            members: [],
          },
        });
      });
    renderConnected(fetcher, `/people/new?familyId=${familyId}`);
    await user.type(
      await screen.findByLabelText(/^Nome completo/),
      'Pessoa sintética',
    );
    await user.click(screen.getByRole('button', { name: 'Cadastrar pessoa' }));
    await screen.findByRole('heading', { name: 'Pessoa sintética', level: 1 });
    const creation = fetcher.mock.calls.find(
      ([, options]) => options?.method === 'POST',
    );
    expect(JSON.parse(String(creation?.[1]?.body))).toMatchObject({
      name: 'Pessoa sintética',
      birthDate: null,
      cpf: null,
      expectedFamilyRevision: 3,
      isReference: false,
      familyId,
    });
    expect(creation?.[1]?.headers).toHaveProperty('Idempotency-Key');
    await user.click(screen.getByRole('link', { name: 'Editar pessoa' }));
    await user.type(await screen.findByLabelText('Telefone'), '86999990000');
    await user.click(screen.getByRole('button', { name: 'Salvar pessoa' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Os dados mudaram',
    );
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'PATCH'),
    ).toHaveLength(1);
    const patch = fetcher.mock.calls.find(
      ([, options]) => options?.method === 'PATCH',
    );
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({
      expectedRevision: 1,
      contactPhone: '86999990000',
    });
    expect(screen.getByRole('button', { name: 'Salvar pessoa' })).toBeTruthy();
  });

  it('checks duplicates before creation and reuses the same write after a lost response, including an explicit distinct-record review', async () => {
    const user = userEvent.setup();
    const writes: RequestInit[] = [];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (value, options) => {
        const url = new URL(String(value), 'http://localhost');
        if (url.pathname.endsWith('/auth/session'))
          return Response.json({ data: session });
        if (url.pathname.endsWith('/duplicate-candidates'))
          return Response.json({
            data: [
              { id: familyId, entityType: 'FAMILY', reasons: ['NAME_SIMILAR'] },
            ],
          });
        if (options?.method === 'POST') {
          writes.push(options);
          if (writes.length === 1) throw new TypeError('Lost response');
          return Response.json({ data: family }, { status: 201 });
        }
        return Response.json({
          data: {
            family: { ...family, memberCount: 0, referencePersonName: null },
            members: [],
          },
        });
      });
    renderConnected(fetcher, '/families/new');
    await user.type(
      await screen.findByLabelText('Nome de referência'),
      'Família sintética',
    );
    await user.click(screen.getByRole('button', { name: 'Criar família' }));
    expect(
      await screen.findByText('Possíveis cadastros duplicados'),
    ).toBeTruthy();
    expect(writes).toHaveLength(0);
    await user.type(
      screen.getByLabelText(/^Motivo para cadastrar como distinto/),
      'Famílias sintéticas distintas após análise',
    );
    await user.click(
      screen.getByLabelText(
        /^Conferi os candidatos e este é um cadastro distinto/,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Criar família' }));
    expect((await screen.findByRole('alert')).textContent).toContain('conexão');
    await user.click(screen.getByRole('button', { name: 'Criar família' }));
    await screen.findByRole('heading', { name: 'Família sintética', level: 1 });
    expect(writes).toHaveLength(2);
    expect(writes[0]?.body).toBe(writes[1]?.body);
    expect(writes[0]?.headers).toEqual(writes[1]?.headers);
    expect(JSON.parse(String(writes[0]?.body))).toMatchObject({
      duplicateReview: {
        candidateIds: [familyId],
        decision: 'DISTINCT',
        reason: 'Famílias sintéticas distintas após análise',
      },
      contactPhone: null,
    });
    expect(
      fetcher.mock.calls.filter(([url]) =>
        String(url).includes('/duplicate-candidates'),
      ),
    ).toHaveLength(1);
  });

  it('uses server totals and search, opens a family and its members and never invents an eligibility result', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      if (url.pathname.endsWith('/auth/session'))
        return Response.json({ data: session });
      if (url.pathname.endsWith(`/families/${familyId}`))
        return Response.json({
          data: {
            family: { ...family, memberCount: 0, referencePersonName: null },
            members: [],
          },
        });
      return Response.json({
        data: [{ ...family, memberCount: 0, referencePersonName: null }],
        pagination: {
          page: Number(url.searchParams.get('page')),
          pageSize: 20,
          total: 21,
        },
      });
    });
    renderConnected(fetcher, '/families');
    await screen.findByRole('link', { name: 'Família sintética' });
    expect(screen.getByText(/21 famílias/)).toBeTruthy();
    expect(screen.queryByText('Pendente')).toBeNull();
    expect(screen.queryByText(/critério não configurado/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    await screen.findByText('Página 2');
    await user.type(screen.getByLabelText('Buscar famílias'), 'Luz');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          ([url]) =>
            String(url).includes('q=Luz') && String(url).includes('page=1'),
        ),
      ).toBe(true),
    );
    await user.click(
      await screen.findByRole('link', { name: 'Família sintética' }),
    );
    await screen.findByRole('heading', { name: 'Família sintética', level: 1 });
    await user.click(screen.getByRole('link', { name: 'Membros' }));
    expect(
      await screen.findByText('Sem membros com vínculo vigente nesta data.'),
    ).toBeTruthy();
  });

  it('consults family eligibility only on request and displays server statuses without persisting assessments', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      if (url.pathname.endsWith('/auth/session'))
        return Response.json({
          data: {
            ...session,
            capabilities: [...session.capabilities, 'eligibility.read'],
          },
        });
      if (url.pathname.endsWith('/eligibility-preview'))
        return Response.json({
          data: {
            familyId,
            referenceDate: url.searchParams.get('referenceDate'),
            evaluatedAt: family.updatedAt,
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
          },
        });
      return Response.json({
        data: [{ ...family, memberCount: 0, referencePersonName: null }],
        pagination: { page: 1, pageSize: 20, total: 1 },
      });
    });
    renderConnected(fetcher, '/families');
    await screen.findByText('Não consultada');
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).includes('eligibility-preview'),
      ),
    ).toBe(false);
    await user.click(
      screen.getByRole('button', {
        name: 'Consultar aptidão das famílias desta página',
      }),
    );
    await screen.findByRole('link', {
      name: 'Pendente — consultar evidências',
    });
    expect(
      fetcher.mock.calls.some(([, options]) => options?.method === 'POST'),
    ).toBe(false);
  });

  it('blocks direct access before issuing registration queries for an administrator without social permission', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: {
          ...session,
          roles: ['ADMINISTRATOR'],
          user: { ...session.user, roleCodes: ['ADMINISTRATOR'] },
          capabilities: ['accounts.manage'],
        },
      }),
    );
    renderConnected(fetcher, '/families');
    expect(
      await screen.findByText('Seu perfil não permite acessar esta área.'),
    ).toBeTruthy();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
