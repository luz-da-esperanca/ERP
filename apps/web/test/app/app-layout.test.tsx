// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { capabilitySchema } from '@erp/contracts/access';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout, AppShell } from '../../src/app/app-layout';
import { ErpProvider } from '../../src/app/erp-provider';
import { createDemoClient } from '../../src/demo/create-demo-client';
import { ProjectsPage } from '../../src/projects';
import { installNativeDialogDouble } from '../support/native-dialog';

function LocationProbe() {
  const location = useLocation();

  return <output aria-label="Localização atual">{location.pathname}</output>;
}

function renderLayout(role = 'COORDINATION') {
  const client = createDemoClient();
  const demoAccount = client.access
    .demoAccounts()
    .find((account) =>
      account.roles.some((accountRole) => accountRole === role),
    );
  if (!demoAccount) throw new Error('Demo account was not found');
  client.access.enterDemo(demoAccount.id);

  render(
    <ErpProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<LocationProbe />} />
            <Route path="search" element={<LocationProbe />} />
            <Route path="projects" element={<ProjectsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ErpProvider>,
  );
}

describe('AppLayout', () => {
  let dialog: ReturnType<typeof installNativeDialogDouble>;
  beforeEach(() => {
    dialog = installNativeDialogDouble();
  });
  afterEach(() => {
    cleanup();
    dialog.restore();
    vi.unstubAllGlobals();
  });

  it('distinguishes management destinations with different sidebar icons', () => {
    render(
      <MemoryRouter>
        <AppShell
          displayName="Conta sintética"
          roles={['ADMINISTRATOR', 'COORDINATION']}
          capabilities={capabilitySchema.options}
          showManagement
          onLogout={() => {}}
          accountLabel="Dados sintéticos"
        >
          <h1>Início</h1>
        </AppShell>
      </MemoryRouter>,
    );
    const destinations = [
      'Pessoas e famílias',
      'Projetos e atividades',
      'Políticas de aptidão',
      'Relatórios',
      'Auditoria',
      'Campos cadastrais',
      'Usuários e perfis',
    ];
    expect(
      screen.queryByRole('link', { name: 'Duplicidades e qualidade' }),
    ).toBeNull();
    const silhouettes = destinations.map((name) => {
      const icon = screen.getByRole('link', { name }).querySelector('svg');
      expect(icon).not.toBeNull();
      return icon!.innerHTML;
    });
    expect(new Set(silhouettes).size).toBe(destinations.length);
  });

  it('focuses mobile navigation and closes it with Escape', async () => {
    const user = userEvent.setup();
    renderLayout();
    const trigger = screen.getByRole('button', { name: 'Abrir menu' });
    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Fechar menu' }),
    );
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Sair da demonstração' }),
    );
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Fechar menu' }),
    );
    await user.keyboard('{Escape}');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('releases the mobile menu when the viewport switches to desktop', async () => {
    const media = new EventTarget();
    vi.stubGlobal('matchMedia', () => media);
    const user = userEvent.setup();
    renderLayout();
    const trigger = screen.getByRole('button', { name: 'Abrir menu' });
    await user.click(trigger);
    const change = new Event('change');
    Object.defineProperty(change, 'matches', { value: true });
    act(() => {
      media.dispatchEvent(change);
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.main-content')?.hasAttribute('inert')).toBe(
      false,
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('opens global help and restores focus when dismissed with Escape', async () => {
    const user = userEvent.setup();
    renderLayout();
    const trigger = screen.getByRole('button', { name: 'Ajuda' });
    await user.click(trigger);
    expect(screen.getByRole('region', { name: 'Ajuda' })).toBeTruthy();
    expect(screen.getByText('Como buscar uma pessoa ou família?')).toBeTruthy();
    await user.click(screen.getByRole('heading', { name: 'Ajuda', level: 2 }));
    expect(screen.getByRole('region', { name: 'Ajuda' })).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Ajuda' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByLabelText('Localização atual').textContent).toBe('/');
  });

  it('opens the notification placeholder across routes and switches to help', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByRole('region', { name: 'Notificações' })).toBeTruthy();
    expect(
      screen.getByText('As notificações ainda não estão disponíveis.'),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ajuda' }));
    expect(screen.queryByRole('region', { name: 'Notificações' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Ajuda' })).toBeTruthy();
    await user.click(
      screen.getByRole('link', { name: 'Projetos e atividades' }),
    );
    expect(screen.queryByRole('region', { name: 'Ajuda' })).toBeNull();
    await screen.findByRole('heading', {
      name: 'Projetos e atividades',
      level: 1,
    });
    const trigger = screen.getByRole('button', { name: 'Notificações' });
    await user.click(trigger);
    await user.click(
      screen.getByRole('button', { name: 'Fechar notificações' }),
    );
    expect(screen.queryByRole('region', { name: 'Notificações' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('supports keyboard help, notification toggling and dismissal outside the panels', async () => {
    const user = userEvent.setup();
    renderLayout('ADMINISTRATOR');
    screen.getByRole('button', { name: 'Ajuda' }).focus();
    await user.keyboard('{Enter}');
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Fechar ajuda' }),
    );
    await user.click(screen.getByText('Como buscar uma pessoa ou família?'));
    expect(
      screen.getByText(/Use a busca no topo da tela/).closest('details')?.open,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Notificações' }));
    await user.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.queryByRole('region', { name: 'Notificações' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Notificações' }));
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(screen.queryByRole('region', { name: 'Notificações' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ajuda' }));
    await user.click(screen.getByLabelText('Localização atual'));
    expect(screen.queryByRole('region', { name: 'Ajuda' })).toBeNull();
  });

  it('navigates to the project list through the authorized sidebar entry', async () => {
    const user = userEvent.setup();
    renderLayout();
    const link = screen.getByRole('link', { name: 'Projetos e atividades' });
    expect(link.getAttribute('href')).toBe('/projects');
    await user.click(link);
    expect(
      await screen.findByRole('heading', {
        name: 'Projetos e atividades',
        level: 1,
      }),
    ).toBeTruthy();
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(await screen.findByRole('table')).toBeTruthy();
  });

  it('hides project navigation from profiles without read permission', () => {
    renderLayout('ADMINISTRATOR');
    expect(
      screen.queryByRole('link', { name: 'Projetos e atividades' }),
    ).toBeNull();
  });

  it('opens search as a modal without changing the current route', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(
      screen.getByRole('button', {
        name: 'Buscar por família, pessoa ou código...',
      }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Buscar cadastros' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Localização atual').textContent).toBe('/');
    expect(screen.queryByText('Esc')).toBeNull();
  });
});
