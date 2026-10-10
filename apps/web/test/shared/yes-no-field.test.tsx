// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { YesNoField } from '../../src/shared/yes-no-field';

afterEach(cleanup);

it('requires an explicit exclusive answer and submits true or false while notifying changes', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn<(value: boolean) => void>();
  const { container } = render(
    <form>
      <YesNoField label="Recebe auxílio?" name="benefit" onChange={onChange} />
    </form>,
  );
  const form = container.querySelector('form')!;
  const group = within(screen.getByRole('group', { name: 'Recebe auxílio?' }));
  const yes = group.getByRole('radio', { name: 'Sim' }) as HTMLInputElement;
  const no = group.getByRole('radio', { name: 'Não' }) as HTMLInputElement;

  expect(yes.checked).toBe(false);
  expect(no.checked).toBe(false);
  expect(form.checkValidity()).toBe(false);
  expect(new FormData(form).has('benefit')).toBe(false);
  expect(onChange).not.toHaveBeenCalled();

  await user.click(yes);

  expect(yes.checked).toBe(true);
  expect(no.checked).toBe(false);
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).getAll('benefit')).toEqual(['true']);
  expect(onChange).toHaveBeenCalledExactlyOnceWith(true);

  await user.click(no);

  expect(yes.checked).toBe(false);
  expect(no.checked).toBe(true);
  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).getAll('benefit')).toEqual(['false']);
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(onChange).toHaveBeenLastCalledWith(false);
});

it.each([
  { defaultValue: true, expected: ['true'], valid: true },
  { defaultValue: false, expected: ['false'], valid: true },
  { defaultValue: null, expected: [], valid: false },
])(
  'preserves a $defaultValue default without inventing an answer or notifying changes',
  ({ defaultValue, expected, valid }) => {
    const onChange = vi.fn<(value: boolean) => void>();
    const { container } = render(
      <form>
        <YesNoField
          label="Recebe auxílio?"
          name="benefit"
          defaultValue={defaultValue}
          onChange={onChange}
        />
      </form>,
    );
    const form = container.querySelector('form')!;

    expect(form.checkValidity()).toBe(valid);
    expect(new FormData(form).getAll('benefit')).toEqual(expected);
    expect(onChange).not.toHaveBeenCalled();
  },
);

it('allows an unanswered optional field and accepts input without a change callback', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <form>
      <YesNoField label="Recebe auxílio?" name="benefit" required={false} />
    </form>,
  );
  const form = container.querySelector('form')!;

  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).has('benefit')).toBe(false);

  await user.click(screen.getByRole('radio', { name: 'Não' }));

  expect(form.checkValidity()).toBe(true);
  expect(new FormData(form).getAll('benefit')).toEqual(['false']);
});
