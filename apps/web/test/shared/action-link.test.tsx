// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { History } from 'lucide-react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { ActionLink, BackLink } from '../../src/shared/ui';

afterEach(cleanup);

it('presents a navigation action with a decorative icon and supports keyboard navigation', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ActionLink to="/history" icon={History}>
              Histórico consolidado
            </ActionLink>
          }
        />
        <Route path="/history" element={<h1>Histórico familiar</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  const link = screen.getByRole('link', { name: 'Histórico consolidado' });
  expect(link.classList.contains('button')).toBe(true);
  expect(link.classList.contains('secondary')).toBe(true);
  expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  await user.tab();
  expect(document.activeElement).toBe(link);
  await user.keyboard('{Enter}');
  expect(
    screen.getByRole('heading', { name: 'Histórico familiar' }),
  ).toBeTruthy();
});

it('keeps the back destination and accessible label separate from its arrow icon', () => {
  render(
    <MemoryRouter>
      <BackLink to="/families">Pessoas e famílias</BackLink>
    </MemoryRouter>,
  );
  const link = screen.getByRole('link', { name: 'Pessoas e famílias' });
  expect(link.getAttribute('href')).toBe('/families');
  expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
});
