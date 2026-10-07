// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectedApp } from '../../src/app/connected-app';
import { HttpAuthentication } from '../../src/access';
import { ApiClient } from '../../src/shared/api-client';
import { HttpErpClient } from '../../src/app/http-erp-client';

const session = {
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    login: 'synthetic.operator',
    displayName: 'Synthetic Operator',
    active: true,
    mustChangePassword: false,
    revision: 2,
    roleCodes: ['COORDINATION'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  roles: ['COORDINATION'],
  capabilities: ['registration.read'],
};

function renderApp(fetcher: typeof fetch, path = '/') {
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
  return api;
}

afterEach(cleanup);

describe('Connected application authentication', () => {
  it('keeps access when logout fails, returns to login after confirmed logout and expires the view on any unauthorized request', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) =>
      String(value).includes('/families?')
        ? Response.json({
            data: [],
            pagination: { page: 1, pageSize: 1, total: 0 },
          })
        : Response.json({ data: session }),
    );
    const api = renderApp(fetcher);
    await screen.findByRole('heading', {
      name: /Synthetic Operator\. Paz e bem\./,
      level: 1,
    });
    fetcher.mockImplementation(async () =>
      Response.json(
        { error: { code: 'DEPENDENCY_UNAVAILABLE', requestId: 'request-id' } },
        { status: 503 },
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(
      await screen.findByText(
        'Não foi possível conectar ao serviço de acesso. Tente novamente.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('navigation')).toBeTruthy();
    fetcher.mockResolvedValue(new Response(null, { status: 204 }));
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    await screen.findByLabelText(/^Login/);
    fetcher.mockResolvedValue(Response.json({ data: session }));
    await user.type(screen.getByLabelText(/^Login/), 'synthetic.operator');
    await user.type(screen.getByLabelText(/^Senha/), 'synthetic-password');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('navigation');
    fetcher.mockResolvedValue(new Response('Invalid session', { status: 401 }));
    await act(async () => {
      await expect(
        api.requestEmpty('/protected-operation', { method: 'POST', body: {} }),
      ).rejects.toMatchObject({ status: 401 });
    });
    expect(await screen.findByLabelText(/^Login/)).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('requires password replacement before opening protected routes and asks for a new login after success', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: {
          ...session,
          user: { ...session.user, mustChangePassword: true },
        },
      }),
    );
    renderApp(fetcher, '/families');
    await screen.findByRole('heading', { name: 'Alterar senha', level: 1 });
    expect(screen.queryByRole('navigation')).toBeNull();
    await user.type(
      screen.getByLabelText(/^Senha atual/),
      '  synthetic-password  ',
    );
    await user.type(
      screen.getByLabelText(/^Nova senha/),
      '  another-password  ',
    );
    await user.type(
      screen.getByLabelText(/^Confirmar nova senha/),
      'incorrect-confirmation',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'A confirmação deve ser igual à nova senha.',
    );
    expect(fetcher).toHaveBeenCalledOnce();
    await user.clear(screen.getByLabelText(/^Confirmar nova senha/));
    await user.type(
      screen.getByLabelText(/^Confirmar nova senha/),
      '  another-password  ',
    );
    fetcher.mockResolvedValue(
      Response.json({
        data: { ...session.user, revision: 3, mustChangePassword: false },
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(
      await screen.findByRole('heading', { name: 'Gestão Social', level: 1 }),
    ).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      'Senha alterada. Entre com a nova senha.',
    );
    expect(fetcher.mock.lastCall?.[0]).toBe('/api/v1/auth/password');
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({
        expectedRevision: 2,
        currentPassword: '  synthetic-password  ',
        newPassword: '  another-password  ',
      }),
    });
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('does not retry a conflicting password change with a substituted revision', async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: session }));
    renderApp(fetcher, '/change-password');
    await screen.findByLabelText(/^Senha atual/);
    await user.type(
      screen.getByLabelText(/^Senha atual/),
      'synthetic-password',
    );
    await user.type(screen.getByLabelText(/^Nova senha/), 'another-password');
    await user.type(
      screen.getByLabelText(/^Confirmar nova senha/),
      'another-password',
    );
    fetcher.mockResolvedValue(
      Response.json(
        { error: { code: 'REVISION_CONFLICT', requestId: 'request-id' } },
        { status: 409 },
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'A conta foi alterada durante a operação. Entre novamente para conferir a versão atual antes de tentar outra vez.',
    );
    expect(
      (
        screen.getByRole('button', {
          name: 'Salvar nova senha',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockResolvedValue(new Response(null, { status: 204 }));
    await user.click(
      screen.getByRole('button', { name: 'Sair e entrar novamente' }),
    );
    expect(await screen.findByLabelText(/^Login/)).toBeTruthy();
  });

  it('waits for cookie session restoration before exposing protected pages and permits recovery from dependency failure', async () => {
    let resolveSession!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    renderApp(fetcher, '/families');
    expect(screen.getByRole('status').textContent).toContain('Verificando');
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
    await act(async () =>
      resolveSession(
        Response.json(
          {
            error: { code: 'DEPENDENCY_UNAVAILABLE', requestId: 'request-id' },
          },
          { status: 503 },
        ),
      ),
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByLabelText(/^Login/)).toBeNull();
    fetcher.mockImplementation(async (url) =>
      String(url).includes('/auth/session')
        ? Response.json({ data: session })
        : Response.json({
            data: [],
            pagination: { page: 1, pageSize: 20, total: 0 },
          }),
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByRole('heading', {
        name: 'Famílias',
        level: 1,
      }),
    ).toBeTruthy();
    expect(await screen.findByText('Nenhuma família encontrada.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('accepts real credentials, reports safe login errors and uses server permissions without displaying demo accounts', async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json(
          { error: { code: 'UNAUTHENTICATED', requestId: 'request-id' } },
          { status: 401 },
        ),
      );
    renderApp(fetcher);
    await screen.findByLabelText(/^Login/);
    expect(screen.queryByText('Conta de demonstração')).toBeNull();
    await user.type(screen.getByLabelText(/^Login/), ' Synthetic.Operator ');
    await user.type(screen.getByLabelText(/^Senha/), '  synthetic-password  ');
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(screen.getByLabelText(/^Senha/).getAttribute('type')).toBe('text');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Login ou senha inválidos.',
    );
    expect((screen.getByLabelText(/^Senha/) as HTMLInputElement).value).toBe(
      '',
    );
    fetcher.mockResolvedValue(Response.json({ data: session }));
    await user.type(screen.getByLabelText(/^Senha/), '  synthetic-password  ');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(
      await screen.findByRole('heading', {
        name: /Synthetic Operator\. Paz e bem\./,
        level: 1,
      }),
    ).toBeTruthy();
    expect(
      fetcher.mock.calls.findLast(([url]) =>
        String(url).endsWith('/auth/login'),
      )?.[1]?.body,
    ).toBe(
      '{"login":"synthetic.operator","password":"  synthetic-password  "}',
    );
    expect(screen.getByText('Synthetic Operator')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Pessoas e famílias' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: 'Projetos e atividades' }),
    ).toBeNull();
  });
});

it.each(['api', 'client'] as const)(
  'removes the retired data quality route from the authenticated %s client',
  async (composition) => {
    const fetcher = vi.fn<typeof fetch>(async (input) =>
      String(input).endsWith('/auth/session')
        ? Response.json({ data: session })
        : Response.json({
            data: [],
            pagination: { page: 1, pageSize: 20, total: 0 },
          }),
    );
    const api = new ApiClient(fetcher);
    render(
      <MemoryRouter initialEntries={['/data-quality']}>
        <ConnectedApp
          authentication={new HttpAuthentication(api)}
          {...(composition === 'api'
            ? { api }
            : { client: new HttpErpClient(api) })}
        />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', {
      name: /Synthetic Operator\. Paz e bem\./,
    });
    expect(
      screen.queryByRole('link', { name: 'Duplicidades e qualidade' }),
    ).toBeNull();
    expect(
      fetcher.mock.calls.some(([path]) =>
        String(path).includes('/data-quality-issues?'),
      ),
    ).toBe(false);
  },
);

it.each(['api', 'client'] as const)(
  'opens authenticated projects through the %s client and returns to login on expired access',
  async (composition) => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (path) => {
      if (String(path).endsWith('/auth/session'))
        return Response.json({
          data: {
            ...session,
            capabilities: ['projects.read', 'projects.write'],
          },
        });
      return Response.json({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0 },
      });
    });
    const api = new ApiClient(fetcher);
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <ConnectedApp
          authentication={new HttpAuthentication(api)}
          {...(composition === 'api'
            ? { api }
            : { client: new HttpErpClient(api) })}
        />
      </MemoryRouter>,
    );
    await screen.findByText('Nenhum projeto cadastrado.');
    expect(screen.getByRole('button', { name: 'Novo projeto' })).toHaveProperty(
      'disabled',
      false,
    );
    expect(
      fetcher.mock.calls.some((call) =>
        String(call[0]).startsWith('/api/v1/projects?'),
      ),
    ).toBe(true);
    fetcher.mockResolvedValue(
      Response.json(
        { error: { code: 'UNAUTHENTICATED', requestId: 'test' } },
        { status: 401 },
      ),
    );
    await act(async () => {
      await expect(
        api.requestEmpty('/projects', { method: 'POST', body: {} }),
      ).rejects.toMatchObject({ status: 401 });
    });
    await screen.findByLabelText(/^Login/);
    cleanup();
  },
);
