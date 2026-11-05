import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OriginsPage } from '../../../src/client/social-stock/origins-page.tsx';
import {
  StockApiError,
  type Page,
  type StockApi,
  type StockOrigin,
} from '../../../src/client/social-stock/stock-api.ts';

const createdAt = '2026-10-26T12:00:00.000Z';

function origin(overrides: Partial<StockOrigin> = {}): StockOrigin {
  return {
    id: 'origin-1', kind: 'INDIVIDUAL_DONOR', name: 'Doadora Maria',
    isExternalDonation: true, isSystemManaged: false, createdAt, ...overrides,
  };
}

function emptyOriginsPage(): Page<StockOrigin> {
  return { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
}

function stubStockApi(overrides: Partial<StockApi> = {}): StockApi {
  const unstubbed = async (): Promise<never> => {
    throw new Error('StockApi method not stubbed.');
  };
  return {
    listOptions: unstubbed,
    getOption: unstubbed,
    createOption: unstubbed,
    listItems: unstubbed,
    getItem: unstubbed,
    createItem: unstubbed,
    listOrigins: unstubbed,
    getOrigin: unstubbed,
    createOrigin: unstubbed,
    ...overrides,
  };
}

function accessError(code: 'AUTH_REQUIRED' | 'FORBIDDEN'): StockApiError {
  return new StockApiError({ status: code === 'AUTH_REQUIRED' ? 401 : 403, code, traceId: null, errors: [] });
}

afterEach(() => {
  cleanup();
});

it('shows a loading state while fetching origins', async () => {
  const gate: { resolve: (page: Page<StockOrigin>) => void } = { resolve: () => {} };
  const pending = new Promise<Page<StockOrigin>>((resolve) => { gate.resolve = resolve; });
  render(<OriginsPage stockApi={stubStockApi({ listOrigins: () => pending })} />);

  expect(screen.getByText('Carregando origens…')).toBeTruthy();

  gate.resolve(emptyOriginsPage());
  expect(await screen.findByText('Nenhuma origem cadastrada.')).toBeTruthy();
});

it('lists origins with kind labels and system-managed marking', async () => {
  render(<OriginsPage stockApi={stubStockApi({ listOrigins: async () => ({
    items: [
      origin(),
      origin({ id: 'origin-unknown', kind: 'UNKNOWN', name: 'Origem desconhecida',
        isExternalDonation: true, isSystemManaged: true }),
    ],
    page: 1, pageSize: 20, totalItems: 2, totalPages: 1,
  }) })} />);

  expect(await screen.findByText('Doadora Maria')).toBeTruthy();
  const list = screen.getByRole('region', { name: 'Origens cadastradas' });
  expect(within(list).getByText('Doador pessoa física')).toBeTruthy();
  // The seeded UNKNOWN origin is named after its kind label, so both appear.
  expect(within(list).getAllByText('Origem desconhecida')).toHaveLength(2);
  expect(within(list).getByText('Gerenciada pelo sistema')).toBeTruthy();
});

it('filters origins by kind', async () => {
  const listOrigins = vi.fn(async () => emptyOriginsPage());
  render(<OriginsPage stockApi={stubStockApi({ listOrigins })} />);

  expect(await screen.findByText('Nenhuma origem cadastrada.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'CAMPAIGN' } });

  await vi.waitFor(() => {
    expect(listOrigins).toHaveBeenLastCalledWith({ kind: 'CAMPAIGN' }, { page: 1 });
  });
});

it('searches origins by name', async () => {
  const listOrigins = vi.fn(async () => emptyOriginsPage());
  render(<OriginsPage stockApi={stubStockApi({ listOrigins })} />);

  expect(await screen.findByText('Nenhuma origem cadastrada.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'inverno' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

  await vi.waitFor(() => {
    expect(listOrigins).toHaveBeenLastCalledWith({ search: 'inverno' }, { page: 1 });
  });
});

it('paginates the origin list', async () => {
  const firstPage: Page<StockOrigin> = {
    items: [origin()], page: 1, pageSize: 1, totalItems: 2, totalPages: 2,
  };
  const secondPage: Page<StockOrigin> = {
    items: [origin({ id: 'origin-2', kind: 'CAMPAIGN', name: 'Campanha Inverno' })],
    page: 2, pageSize: 1, totalItems: 2, totalPages: 2,
  };
  const listOrigins = vi.fn(async (filter?: object, pagination?: { page?: number }) =>
    (pagination?.page === 2 ? secondPage : firstPage));
  render(<OriginsPage stockApi={stubStockApi({ listOrigins })} />);

  expect(await screen.findByText('Doadora Maria')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));

  expect(await screen.findByText('Campanha Inverno')).toBeTruthy();
});

it('creates an origin and refreshes the list', async () => {
  const listOrigins = vi.fn(async () => ({
    items: [origin()], page: 1, pageSize: 20, totalItems: 1, totalPages: 1,
  }));
  const createOrigin = vi.fn(async () => origin({ id: 'origin-2', kind: 'CAMPAIGN', name: 'Campanha Inverno' }));
  render(<OriginsPage stockApi={stubStockApi({ listOrigins, createOrigin })} />);

  expect(await screen.findByText('Doadora Maria')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nova origem' }));
  fireEvent.change(screen.getByLabelText('Tipo de origem'), { target: { value: 'CAMPAIGN' } });
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Campanha Inverno' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar origem' }));

  expect(await screen.findByText('Origem criada com sucesso.')).toBeTruthy();
  expect(createOrigin).toHaveBeenCalledWith({ kind: 'CAMPAIGN', name: 'Campanha Inverno' });
  expect(listOrigins).toHaveBeenCalledTimes(2);
});

it('only offers creatable kinds in the origin form', async () => {
  render(<OriginsPage stockApi={stubStockApi({ listOrigins: async () => emptyOriginsPage() })} />);

  expect(await screen.findByText('Nenhuma origem cadastrada.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nova origem' }));

  const kindSelect = screen.getByLabelText('Tipo de origem');
  expect(within(kindSelect).getByRole('option', { name: 'Doador pessoa física' })).toBeTruthy();
  expect(within(kindSelect).getByRole('option', { name: 'Doador empresa' })).toBeTruthy();
  expect(within(kindSelect).getByRole('option', { name: 'Campanha' })).toBeTruthy();
  expect(within(kindSelect).queryByRole('option', { name: 'Origem desconhecida' })).toBeNull();
  expect(within(kindSelect).queryByRole('option', { name: 'Transferência do Bazar' })).toBeNull();
});

it('shows client validation before submitting', async () => {
  const createOrigin = vi.fn(async () => origin());
  render(<OriginsPage stockApi={stubStockApi({
    listOrigins: async () => emptyOriginsPage(),
    createOrigin,
  })} />);

  expect(await screen.findByText('Nenhuma origem cadastrada.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nova origem' }));
  fireEvent.click(screen.getByRole('button', { name: 'Criar origem' }));

  expect(await screen.findByText('Selecione o tipo de origem.')).toBeTruthy();
  expect(await screen.findByText('Informe um nome entre 1 e 150 caracteres.')).toBeTruthy();
  expect(createOrigin).not.toHaveBeenCalled();
});

it('shows server field errors without losing typed values', async () => {
  const createOrigin = vi.fn(async (): Promise<StockOrigin> => {
    throw new StockApiError({ status: 422, code: 'VALIDATION_FAILED', traceId: null,
      errors: [{ field: 'name', code: 'DUPLICATE', message: 'Este nome já está em uso.' }] });
  });
  render(<OriginsPage stockApi={stubStockApi({
    listOrigins: async () => emptyOriginsPage(),
    createOrigin,
  })} />);

  expect(await screen.findByText('Nenhuma origem cadastrada.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nova origem' }));
  fireEvent.change(screen.getByLabelText('Tipo de origem'), { target: { value: 'INDIVIDUAL_DONOR' } });
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Doadora Maria' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar origem' }));

  expect(await screen.findByText('Este nome já está em uso.')).toBeTruthy();
  expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Doadora Maria');
});

it('shows an access denied message on forbidden responses', async () => {
  const onSessionExpired = vi.fn();
  render(<OriginsPage
    stockApi={stubStockApi({ listOrigins: async (): Promise<Page<StockOrigin>> => {
      throw accessError('FORBIDDEN');
    } })}
    onSessionExpired={onSessionExpired}
  />);

  expect(await screen.findByText('Seu perfil não possui permissão para esta operação.')).toBeTruthy();
  expect(onSessionExpired).not.toHaveBeenCalled();
});

it('notifies session expiry on unauthorized responses', async () => {
  const onSessionExpired = vi.fn();
  render(<OriginsPage
    stockApi={stubStockApi({ listOrigins: async (): Promise<Page<StockOrigin>> => {
      throw accessError('AUTH_REQUIRED');
    } })}
    onSessionExpired={onSessionExpired}
  />);

  await vi.waitFor(() => { expect(onSessionExpired).toHaveBeenCalledTimes(1); });
  expect(screen.queryByRole('alert')).toBeNull();
});
