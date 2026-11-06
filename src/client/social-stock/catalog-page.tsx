import { useCallback, useEffect, useRef, useState } from 'react';
import { CatalogForm } from './catalog-form.tsx';
import { formatCode, formatPrecision, UNKNOWN_LABEL } from './format.ts';
import {
  StockApiError,
  type CatalogKind,
  type CatalogOption,
  type Page,
  type StockApi,
  type StockItem,
} from './stock-api.ts';
import { StockItemForm } from './stock-item-form.tsx';
import './stock.css';

export type CatalogTab = 'items' | CatalogKind;

export interface CatalogPageProps {
  readonly stockApi: StockApi;
  readonly initialTab?: CatalogTab;
  readonly onSessionExpired?: () => void;
  readonly canWrite?: boolean;
}

const TABS: readonly { readonly id: CatalogTab; readonly label: string }[] = [
  { id: 'items', label: 'Itens' },
  { id: 'CATEGORY', label: 'Categorias' },
  { id: 'UNIT', label: 'Unidades' },
  { id: 'SIZE', label: 'Numerações' },
];

const CREATED_MESSAGES: Record<CatalogTab, string> = {
  items: 'Item criado com sucesso.',
  CATEGORY: 'Categoria criada com sucesso.',
  UNIT: 'Unidade criada com sucesso.',
  SIZE: 'Numeração criada com sucesso.',
};

const NEW_BUTTON_LABELS: Record<CatalogTab, string> = {
  items: 'Novo item',
  CATEGORY: 'Nova categoria',
  UNIT: 'Nova unidade',
  SIZE: 'Nova numeração',
};

const ACCESS_DENIED_MESSAGE = 'Seu perfil não possui permissão para esta operação.';
const LOAD_ERROR_MESSAGE = 'Não foi possível carregar os dados. Tente novamente.';
const OPTION_FORM_PAGE_SIZE = 100;
const OPTION_PAGE_CONCURRENCY = 4;

/**
 * Loads every option page for form selects. Pages may overlap when the
 * catalog changes mid-load, so identities are deduplicated; remaining pages
 * load in small concurrent chunks instead of all at once.
 */
async function listAllOptions(stockApi: StockApi, kind: CatalogKind): Promise<readonly CatalogOption[]> {
  const first = await stockApi.listOptions(kind, { page: 1, pageSize: OPTION_FORM_PAGE_SIZE });
  const remainingPages = Array.from({ length: Math.max(first.totalPages - 1, 0) }, (_, index) => index + 2);
  const seen = new Set<string>(first.items.map((option) => option.id));
  const collected: CatalogOption[] = [...first.items];
  for (let offset = 0; offset < remainingPages.length; offset += OPTION_PAGE_CONCURRENCY) {
    const chunk = remainingPages.slice(offset, offset + OPTION_PAGE_CONCURRENCY);
    const pages = await Promise.all(
      chunk.map((page) => stockApi.listOptions(kind, { page, pageSize: OPTION_FORM_PAGE_SIZE })),
    );
    for (const page of pages) {
      for (const option of page.items) {
        if (!seen.has(option.id)) {
          seen.add(option.id);
          collected.push(option);
        }
      }
    }
  }
  return collected;
}

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly message: string };

function emptyPage<Item>(): Page<Item> {
  return { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
}

function emptyOptionName(kind: CatalogKind): string {
  if (kind === 'CATEGORY') return 'Nenhuma categoria cadastrada.';
  if (kind === 'UNIT') return 'Nenhuma unidade cadastrada.';
  return 'Nenhuma numeração cadastrada.';
}

function Pager({ page, onPrevious, onNext }: {
  readonly page: Page<unknown>;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}) {
  if (page.totalPages <= 1) return null;
  return (
    <div className="stock-pager">
      <button type="button" onClick={onPrevious} disabled={page.page <= 1}>Anterior</button>
      <span>Página {page.page} de {page.totalPages}</span>
      <button type="button" onClick={onNext} disabled={page.page >= page.totalPages}>Próxima</button>
    </div>
  );
}

function OptionList({ options, kind }: { readonly options: Page<CatalogOption>; readonly kind: CatalogKind }) {
  if (options.items.length === 0) {
    return <p>{emptyOptionName(kind)}</p>;
  }
  return (
    <ul className="stock-list">
      {options.items.map((option) => (
        <li key={option.id} className="stock-list-item">
          <strong>{option.name}</strong>
          <span>Código: {formatCode(option.code)}</span>
          {kind === 'UNIT' ? <span>Precisão: {formatPrecision(option.precision)}</span> : null}
          <span>{option.isActive ? 'Ativo' : 'Inativo'}</span>
        </li>
      ))}
    </ul>
  );
}

function ItemList({ items }: { readonly items: Page<StockItem> }) {
  if (items.items.length === 0) {
    return <p>Nenhum item cadastrado.</p>;
  }
  return (
    <ul className="stock-list">
      {items.items.map((item) => (
        <li key={item.id} className="stock-list-item">
          <strong>{item.name}</strong>
          <span>Código: {formatCode(item.code)}</span>
          <span>Categoria: {item.category.name}</span>
          <span>Unidade: {item.unit.name} ({formatPrecision(item.unit.precision)})</span>
          <span>Tamanho: {item.size === null ? UNKNOWN_LABEL : item.size.name}</span>
          <span>{item.isActive ? 'Ativo' : 'Inativo'}</span>
        </li>
      ))}
    </ul>
  );
}

export function CatalogPage({ stockApi, initialTab = 'items', onSessionExpired, canWrite = true }: CatalogPageProps) {
  const [tab, setTab] = useState<CatalogTab>(initialTab);
  const [pageNumber, setPageNumber] = useState(1);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [optionPage, setOptionPage] = useState<Page<CatalogOption>>(emptyPage());
  const [itemPage, setItemPage] = useState<Page<StockItem>>(emptyPage());
  const [categories, setCategories] = useState<readonly CatalogOption[]>([]);
  const [units, setUnits] = useState<readonly CatalogOption[]>([]);
  const [sizes, setSizes] = useState<readonly CatalogOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const optionsLoaded = useRef(false);

  const load = useCallback(async () => {
    const version = loadVersion.current + 1;
    loadVersion.current = version;
    setLoadState({ status: 'loading' });
    try {
      if (tab === 'items') {
        // Form options load once per mount: paginating the item list must not
        // refetch them, and read-only profiles never need them.
        const shouldLoadOptions = canWrite && !optionsLoaded.current;
        const [items, fetchedCategories, fetchedUnits, fetchedSizes] = await Promise.all([
          stockApi.listItems({ page: pageNumber }),
          shouldLoadOptions ? listAllOptions(stockApi, 'CATEGORY') : Promise.resolve<readonly CatalogOption[]>([]),
          shouldLoadOptions ? listAllOptions(stockApi, 'UNIT') : Promise.resolve<readonly CatalogOption[]>([]),
          shouldLoadOptions ? listAllOptions(stockApi, 'SIZE') : Promise.resolve<readonly CatalogOption[]>([]),
        ]);
        if (loadVersion.current !== version) return;
        setItemPage(items);
        if (shouldLoadOptions) {
          setCategories(fetchedCategories);
          setUnits(fetchedUnits);
          setSizes(fetchedSizes);
          optionsLoaded.current = true;
        }
      } else {
        const options = await stockApi.listOptions(tab, { page: pageNumber });
        if (loadVersion.current !== version) return;
        setOptionPage(options);
      }
      setLoadState({ status: 'ready' });
    } catch (error) {
      if (loadVersion.current !== version) return;
      if (error instanceof StockApiError && error.code === 'AUTH_REQUIRED') {
        onSessionExpired?.();
        return;
      }
      if (error instanceof StockApiError && error.code === 'FORBIDDEN') {
        setLoadState({ status: 'error', message: ACCESS_DENIED_MESSAGE });
        return;
      }
      setLoadState({ status: 'error', message: LOAD_ERROR_MESSAGE });
    }
  }, [stockApi, tab, pageNumber, canWrite, onSessionExpired]);

  useEffect(() => {
    let isCurrent = true;
    void Promise.resolve().then(() => {
      if (isCurrent) void load();
    });
    return () => {
      isCurrent = false;
    };
  }, [load]);

  const selectTab = (next: CatalogTab) => {
    setTab(next);
    setPageNumber(1);
    setShowForm(false);
    setSuccessMessage(null);
    optionsLoaded.current = false;
  };

  const handleCreated = () => {
    setShowForm(false);
    setSuccessMessage(CREATED_MESSAGES[tab]);
    optionsLoaded.current = false;
    void load();
  };

  return (
    <main className="stock-page">
      <h1>Catálogo do estoque</h1>
      <div className="stock-tabs" role="group" aria-label="Seções do catálogo">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={tab === entry.id}
            className={tab === entry.id ? 'stock-tab stock-tab-active' : 'stock-tab'}
            onClick={() => { selectTab(entry.id); }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {successMessage === null ? null : (
        <p className="stock-message stock-message-success" role="status">{successMessage}</p>
      )}
      {loadState.status === 'loading' ? <p aria-busy="true">Carregando catálogo…</p> : null}
      {loadState.status === 'error' ? (
        <div>
          <p className="stock-message stock-message-error" role="alert">{loadState.message}</p>
          <button type="button" onClick={() => { void load(); }}>Tentar novamente</button>
        </div>
      ) : null}
      {loadState.status === 'ready' && tab === 'items' ? (
        <section aria-label="Itens cadastrados">
          <ItemList items={itemPage} />
          <Pager
            page={itemPage}
            onPrevious={() => { setPageNumber(itemPage.page - 1); }}
            onNext={() => { setPageNumber(itemPage.page + 1); }}
          />
        </section>
      ) : null}
      {loadState.status === 'ready' && tab !== 'items' ? (
        <section aria-label="Opções cadastradas">
          <OptionList options={optionPage} kind={tab} />
          <Pager
            page={optionPage}
            onPrevious={() => { setPageNumber(optionPage.page - 1); }}
            onNext={() => { setPageNumber(optionPage.page + 1); }}
          />
        </section>
      ) : null}
      {loadState.status === 'ready' && !showForm && canWrite ? (
        <button type="button" onClick={() => { setShowForm(true); }}>
          {NEW_BUTTON_LABELS[tab]}
        </button>
      ) : null}
      {loadState.status === 'ready' && showForm && tab === 'items' ? (
        <StockItemForm
          stockApi={stockApi}
          categories={categories}
          units={units}
          sizes={sizes}
          onCreated={handleCreated}
          onCancel={() => { setShowForm(false); }}
          {...(onSessionExpired === undefined ? {} : { onSessionExpired })}
        />
      ) : null}
      {loadState.status === 'ready' && showForm && tab !== 'items' ? (
        <CatalogForm
          kind={tab}
          stockApi={stockApi}
          onCreated={handleCreated}
          onCancel={() => { setShowForm(false); }}
          {...(onSessionExpired === undefined ? {} : { onSessionExpired })}
        />
      ) : null}
    </main>
  );
}
