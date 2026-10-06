// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useOperationKey } from '../../src/shared/use-operation-key';
afterEach(cleanup);
it('reuses keys for uncertain retries and distinguishes changed bodies and target operations', () => {
  const received = vi.fn();
  function Form() {
    const keyFor = useOperationKey();
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          received(
            keyFor(String(data.get('target')), { name: data.get('name') }),
          );
        }}
      >
        <input name="name" aria-label="Name" defaultValue="Synthetic" />
        <input name="target" aria-label="Target" defaultValue="family/one" />
        <button>Save</button>
      </form>
    );
  }
  render(<Form />);
  fireEvent.click(screen.getByText('Save'));
  fireEvent.click(screen.getByText('Save'));
  expect(received.mock.calls[0]?.[0]).toBe(received.mock.calls[1]?.[0]);
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Changed' },
  });
  fireEvent.click(screen.getByText('Save'));
  expect(received.mock.calls[2]?.[0]).not.toBe(received.mock.calls[0]?.[0]);
  fireEvent.change(screen.getByLabelText('Target'), {
    target: { value: 'family/two' },
  });
  fireEvent.click(screen.getByText('Save'));
  expect(received.mock.calls[3]?.[0]).not.toBe(received.mock.calls[2]?.[0]);
});
