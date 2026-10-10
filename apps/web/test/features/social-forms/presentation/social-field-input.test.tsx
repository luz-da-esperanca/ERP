// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import {
  collectSocialFields,
  SocialFieldInput,
} from '../../../../src/social-forms';
import type { FieldSelectionDto } from '@erp/contracts/social-forms-api';

afterEach(cleanup);

it('collects a masked income as a decimal API value and preserves missing versus explicit zero', async () => {
  const user = userEvent.setup();
  const field: FieldSelectionDto['fields'][number] = {
    fieldKey: 'members[].economy.incomeAmount',
    included: true,
    required: true,
    appliesTo: 'ALL_MEMBERS',
    cardinality: 'SINGLE',
    allowedRoleCodes: ['SOCIAL_ASSISTANCE', 'COORDINATION'],
    purpose: 'Synthetic form evaluation',
    decisionReference: 'SYNTHETIC',
  };
  const { container } = render(
    <form>
      <SocialFieldInput field={field} options={[]} prefix="person:" />
    </form>,
  );
  const form = container.querySelector('form')!;
  const collect = () =>
    collectSocialFields(new FormData(form), [field], [], 'person:');
  expect(collect()).toEqual({ economy: { incomeAmount: null } });
  const income = screen.getByLabelText(/Renda declarada/);
  await user.type(income, '123456');
  expect((income as HTMLInputElement).value).toBe('1.234,56');
  expect(collect()).toEqual({ economy: { incomeAmount: '1234.56' } });
  await user.clear(income);
  await user.type(income, '0');
  expect(collect()).toEqual({ economy: { incomeAmount: '0.00' } });
});
