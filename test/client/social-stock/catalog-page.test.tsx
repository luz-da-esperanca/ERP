import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CatalogPage } from '../../../src/client/social-stock/catalog-page.tsx';
import {
  StockApiError,
  type CatalogOption,
  type Page,
  type StockApi,
  type StockItem,
} from '../../../src/client/social-stock/stock-api.ts';

const createdAt = '2026-10-26T12:00:00.000Z';

function category(overrides: Partial<CatalogOption> = {}): CatalogOption {
  return {
    id: 'category-1', code: 'CAT-000001', name: 'Roupas', precision: null,
    isActive: true, version: 1, createdAt, updatedAt: createdAt, ...overrides,
  };
}

function unit(overrides: Partial<CatalogOption> = {}): CatalogOption {
  return {
    id: 'unit-1', code: 'UNIT-000001', name: 'Peça', precision: 0,
    isActive: true, version: 1, createdAt, updatedAt: createdAt, ...overrides,
  };
}

function item(overrides: Partial<StockItem> = {}): StockItem {
  return {
    id: 'item-1', code: 'ITEM-000001', revisionId: 'revision-1', version: 1, name: 'Cobertor',
    category: { id: 'category-1', code: 'CAT-000002', name: 'Cama e banho' },
    unit: { id: 'unit-1', code: 'UNIT-000001', name: 'Peça', precision: 0 },
    size: null, isActive: true, createdAt, updatedAt: createdAt, ...overrides,
  };
}

function emptyOptionsPage(): Page<CatalogOption> {
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

it('shows a loading state while fetching categories', async () => {
  const gate: { resolve: (page: Page<CatalogOption>) => void } = { resolve: () => {} };
  const pending = new Promise<Page<CatalogOption>>((resolve) => { gate.resolve = resolve; });
  render(<CatalogPage stockApi={stubStockApi({ listOptions: () => pending })} initialTab="CATEGORY" />);

  expect(screen.getByText('Carregando catálogo…')).toBeTruthy();

  gate.resolve(emptyOptionsPage());
  expect(await screen.findByText('Nenhuma categoria cadastrada.')).toBeTruthy();
});

it('lists categories with codes and status', async () => {
  render(<CatalogPage
    stockApi={stubStockApi({ listOptions: async () => ({
      items: [category(), category({ id: 'category-2', code: null, name: 'Calçados', isActive: false })],
      page: 1, pageSize: 20, totalItems: 2, totalPages: 1,
    }) })}
    initialTab="CATEGORY"
  />);

  expect(await screen.findByText('Roupas')).toBeTruthy();
  expect(screen.getByText('Código: CAT-000001')).toBeTruthy();
  expect(screen.getByText('Calçados')).toBeTruthy();
});

it('shows an empty state for sizes without options', async () => {
  render(<CatalogPage stockApi={stubStockApi({ listOptions: async () => emptyOptionsPage() })} initialTab="SIZE" />);

  expect(await screen.findByText('Nenhuma numeração cadastrada.')).toBeTruthy();
});

it('paginates the item list', async () => {
  const firstPage: Page<StockItem> = { items: [item()], page: 1, pageSize: 1, totalItems: 2, totalPages: 2 };
  const secondPage: Page<StockItem> = {
    items: [item({ id: 'item-2', code: null, name: 'Travesseiro' })],
    page: 2, pageSize: 1, totalItems: 2, totalPages: 2,
  };
  const listItems = vi.fn(async (pagination?: { page?: number }) =>
    (pagination?.page === 2 ? secondPage : firstPage));
  render(<CatalogPage stockApi={stubStockApi({
    listItems,
    listOptions: async () => emptyOptionsPage(),
  })} />);

  expect(await screen.findByText('Cobertor')).toBeTruthy();
  expect(screen.getByText('Página 1 de 2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));

  expect(await screen.findByText('Travesseiro')).toBeTruthy();
  expect(listItems).toHaveBeenLastCalledWith({ page: 2 });
});

it('creates a category and refreshes the list', async () => {
  const listOptions = vi.fn(async () => ({
    items: [category()], page: 1, pageSize: 20, totalItems: 1, totalPages: 1,
  }));
  const createOption = vi.fn(async () => category({ id: 'category-2', code: 'CAT-000002', name: 'Calçados' }));
  render(<CatalogPage stockApi={stubStockApi({ listOptions, createOption })} initialTab="CATEGORY" />);

  expect(await screen.findByText('Roupas')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Calçados' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar categoria' }));

  expect(await screen.findByText('Categoria criada com sucesso.')).toBeTruthy();
    expect(createOption).toHaveBeenCalledWith('CATEGORY', { name: 'Calçados' },
      { idempotencyKey: expect.any(String) });
  expect(listOptions).toHaveBeenCalledTimes(2);
});

it('shows client validation before submitting', async () => {
  const createOption = vi.fn(async () => category());
  render(<CatalogPage stockApi={stubStockApi({
    listOptions: async () => emptyOptionsPage(),
    createOption,
  })} initialTab="CATEGORY" />);

  expect(await screen.findByText('Nenhuma categoria cadastrada.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
  fireEvent.click(screen.getByRole('button', { name: 'Criar categoria' }));

  expect(await screen.findByText('Informe um nome entre 1 e 150 caracteres.')).toBeTruthy();
  expect(createOption).not.toHaveBeenCalled();
});

it('reuses the same idempotency key when resubmitting a category after a network failure', async () => {
  const createOption = vi.fn(async (): Promise<CatalogOption> => {
    throw new StockApiError({ status: 0, code: 'NETWORK_ERROR', traceId: null, errors: [] });
  });
  render(<CatalogPage stockApi={stubStockApi({
    listOptions: async () => emptyOptionsPage(),
    createOption,
  })} initialTab="CATEGORY" />);

  expect(await screen.findByText('Nenhuma categoria cadastrada.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Roupas' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar categoria' }));

  expect(await screen.findByText('Não foi possível salvar. Tente novamente.')).toBeTruthy();
  createOption.mockResolvedValueOnce(category());
  fireEvent.click(screen.getByRole('button', { name: 'Criar categoria' }));

  expect(await screen.findByText('Categoria criada com sucesso.')).toBeTruthy();
  const firstKey = (createOption.mock.calls[0] as unknown as readonly unknown[])[2];
  const secondKey = (createOption.mock.calls[1] as unknown as readonly unknown[])[2];
  expect(firstKey).toEqual(secondKey);
  expect((firstKey as { idempotencyKey?: unknown }).idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
});

it('reuses the same idempotency key when resubmitting an item after a network failure', async () => {
  const listOptions = async (kind: string) => kind === 'CATEGORY'
    ? { items: [category()], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }
    : kind === 'UNIT'
      ? { items: [unit()], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }
      : emptyOptionsPage();
  const createItem = vi.fn(async (): Promise<StockItem> => {
    throw new StockApiError({ status: 0, code: 'NETWORK_ERROR', traceId: null, errors: [] });
  });
  render(<CatalogPage stockApi={stubStockApi({
    listItems: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    listOptions,
    createItem,
  })} />);

  expect(await screen.findByText('Nenhum item cadastrado.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Cobertor' } });
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'category-1' } });
  fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'unit-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar item' }));

  expect(await screen.findByText('Não foi possível salvar. Tente novamente.')).toBeTruthy();
  createItem.mockResolvedValueOnce(item());
  fireEvent.click(screen.getByRole('button', { name: 'Criar item' }));

  expect(await screen.findByText('Item criado com sucesso.')).toBeTruthy();
  const firstKey = (createItem.mock.calls[0] as unknown as readonly unknown[])[1];
  const secondKey = (createItem.mock.calls[1] as unknown as readonly unknown[])[1];
  expect(firstKey).toEqual(secondKey);
  expect((firstKey as { idempotencyKey?: unknown }).idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
});

it('explains idempotency conflicts instead of duplicating the item', async () => {
  const createItem = vi.fn(async (): Promise<StockItem> => {
    throw new StockApiError({ status: 409, code: 'IDEMPOTENCY_CONFLICT', traceId: null, errors: [] });
  });
  render(<CatalogPage stockApi={stubStockApi({
    listItems: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    listOptions: async (kind) => kind === 'CATEGORY'
      ? { items: [category()], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }
      : kind === 'UNIT'
        ? { items: [unit()], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }
        : emptyOptionsPage(),
    createItem,
  })} />);

  expect(await screen.findByText('Nenhum item cadastrado.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Cobertor' } });
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'category-1' } });
  fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'unit-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar item' }));

  expect(await screen.findByText('Esta operação já foi registrada com dados diferentes. Recarregue a lista e confira antes de tentar novamente.')).toBeTruthy();
});

it('shows server field errors without losing typed values', async () => {
  const createOption = vi.fn(async (): Promise<CatalogOption> => {
    throw new StockApiError({ status: 422, code: 'VALIDATION_FAILED', traceId: null,
      errors: [{ field: 'name', code: 'DUPLICATE', message: 'Este nome já está em uso.' }] });
  });
  render(<CatalogPage stockApi={stubStockApi({
    listOptions: async () => emptyOptionsPage(),
    createOption,
  })} initialTab="CATEGORY" />);

  expect(await screen.findByText('Nenhuma categoria cadastrada.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Roupas' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar categoria' }));

  expect(await screen.findByText('Este nome já está em uso.')).toBeTruthy();
  expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Roupas');
});

it('creates a unit with precision', async () => {
  const createOption = vi.fn(async () => unit());
  render(<CatalogPage stockApi={stubStockApi({
    listOptions: async () => emptyOptionsPage(),
    createOption,
  })} initialTab="UNIT" />);

  expect(await screen.findByText('Nenhuma unidade cadastrada.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Nova unidade' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Par' } });
  fireEvent.change(screen.getByLabelText(/Precisão/), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar unidade' }));

  expect(await screen.findByText('Unidade criada com sucesso.')).toBeTruthy();
    expect(createOption).toHaveBeenCalledWith('UNIT', { name: 'Par', precision: 0 },
      { idempotencyKey: expect.any(String) });
});

it('creates an item without size when none is selected', async () => {
  const createItem = vi.fn(async () => item());
  render(<CatalogPage stockApi={stubStockApi({
    listItems: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    listOptions: async (kind) => kind === 'CATEGORY'
      ? { items: [category()], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }
      : kind === 'UNIT'
        ? { items: [unit()], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }
        : emptyOptionsPage(),
    createItem,
  })} />);

  expect(await screen.findByText('Nenhum item cadastrado.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Cobertor' } });
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'category-1' } });
  fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'unit-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar item' }));

  expect(await screen.findByText('Item criado com sucesso.')).toBeTruthy();
    expect(createItem).toHaveBeenCalledWith({ name: 'Cobertor', categoryId: 'category-1', unitId: 'unit-1' },
      { idempotencyKey: expect.any(String) });
});

it('loads every catalog page for the item form selects', async () => {
  const firstCategories = { items: [category()], page: 1, pageSize: 1, totalItems: 2, totalPages: 2 };
  const secondCategories = { items: [category({ id: 'category-2', code: 'CAT-000002', name: 'Calçados' })],
    page: 2, pageSize: 1, totalItems: 2, totalPages: 2 };
  const listOptions = vi.fn(async (kind: string, pagination?: { page?: number }) => {
    if (kind === 'CATEGORY') return (pagination?.page ?? 1) === 2 ? secondCategories : firstCategories;
    return emptyOptionsPage();
  });
  render(<CatalogPage stockApi={stubStockApi({
    listItems: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    listOptions,
  })} />);

  expect(await screen.findByText('Nenhum item cadastrado.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));

  expect(await screen.findByRole('option', { name: 'Calçados' })).toBeTruthy();
  expect(listOptions).toHaveBeenCalledWith('CATEGORY', { page: 1, pageSize: 100 });
  expect(listOptions).toHaveBeenCalledWith('CATEGORY', { page: 2, pageSize: 100 });
});

it('only offers active options in the item form', async () => {
  render(<CatalogPage stockApi={stubStockApi({
    listItems: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    listOptions: async (kind) => kind === 'CATEGORY'
      ? { items: [category(), category({ id: 'category-9', name: 'Desativada', isActive: false })],
        page: 1, pageSize: 20, totalItems: 2, totalPages: 1 }
      : emptyOptionsPage(),
  })} />);

  expect(await screen.findByText('Nenhum item cadastrado.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Novo item' }));

  expect(screen.getByRole('option', { name: 'Roupas' })).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'Desativada' })).toBeNull();
});

it('shows an access denied message on forbidden responses', async () => {
  const onSessionExpired = vi.fn();
  render(<CatalogPage
    stockApi={stubStockApi({ listOptions: async (): Promise<Page<CatalogOption>> => {
      throw accessError('FORBIDDEN');
    } })}
    initialTab="CATEGORY"
    onSessionExpired={onSessionExpired}
  />);

  expect(await screen.findByText('Seu perfil não possui permissão para esta operação.')).toBeTruthy();
  expect(onSessionExpired).not.toHaveBeenCalled();
});

it('notifies session expiry on unauthorized responses', async () => {
  const onSessionExpired = vi.fn();
  render(<CatalogPage
    stockApi={stubStockApi({ listOptions: async (): Promise<Page<CatalogOption>> => {
      throw accessError('AUTH_REQUIRED');
    } })}
    initialTab="CATEGORY"
    onSessionExpired={onSessionExpired}
  />);

  await vi.waitFor(() => { expect(onSessionExpired).toHaveBeenCalledTimes(1); });
  expect(screen.queryByRole('alert')).toBeNull();
});

it('presents missing size and code as unknown and zero precision as indivisible', async () => {
  render(<CatalogPage stockApi={stubStockApi({
    listItems: async () => ({
      items: [item({ code: null, category: { id: 'category-1', code: null, name: 'Cama e banho' } })],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1,
    }),
    listOptions: async () => emptyOptionsPage(),
  })} />);

  expect(await screen.findByText('Cobertor')).toBeTruthy();
  expect(screen.getByText('Código: Não informado')).toBeTruthy();
  expect(screen.getByText('Tamanho: Não informado')).toBeTruthy();
  expect(screen.getByText('Unidade: Peça (Indivisível)')).toBeTruthy();
});
