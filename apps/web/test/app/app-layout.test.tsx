// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppLayout } from '../../src/app/app-layout';
import { ErpProvider } from '../../src/app/erp-provider';
import { createDemoClient } from '../../src/demo/create-demo-client';

function LocationProbe() {
  const location = useLocation();

  return <output aria-label="Localização atual">{location.pathname}</output>;
}

function renderLayout() {
  const client = createDemoClient();
  const [demoAccount] = client.access.demoAccounts();
  client.access.enterDemo(demoAccount.id);

  render(
    <ErpProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<LocationProbe />} />
            <Route path="search" element={<LocationProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ErpProvider>,
  );
}

describe('AppLayout', () => {
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
