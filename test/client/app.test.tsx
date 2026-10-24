import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from '../../src/client/app.tsx';

it('renders the initial public client shell', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: 'ERP Social Luz da Esperança' }).textContent)
    .toBe('ERP Social Luz da Esperança');
});
