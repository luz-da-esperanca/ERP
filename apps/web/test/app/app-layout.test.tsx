// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AppLayout } from '../../src/app/app-layout';
import { ErpProvider } from '../../src/app/erp-provider';
import { createDemoClient } from '../../src/demo/create-demo-client';
import { ProjectsPage } from '../../src/projects';

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
  afterEach(cleanup);

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
