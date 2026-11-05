import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ALL_STOCK_ORIGIN_KINDS, STOCK_ORIGIN_KIND_LABELS, toStockOriginKind } from './origin-labels.ts';
import { OriginForm } from './origin-form.tsx';
import {
  StockApiError,
  type Page,
  type StockApi,
  type StockOrigin,
  type StockOriginFilter,
} from './stock-api.ts';
import './stock.css';

export interface OriginsPageProps {
  readonly stockApi: StockApi;
  readonly onSessionExpired?: () => void;
  readonly canWrite?: boolean;
}

const ACCESS_DENIED_MESSAGE = 'Seu perfil não possui permissão para esta operação.';
const LOAD_ERROR_MESSAGE = 'Não foi possível carregar os dados. Tente novamente.';
const CREATED_MESSAGE = 'Origem criada com sucesso.';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready' }
  | { readonly status: 'error'; readonly message: string };

function emptyPage(): Page<StockOrigin> {
  return { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
}

function OriginList({ origins }: { readonly origins: Page<StockOrigin> }) {
  if (origins.items.length === 0) {
    return <p>Nenhuma origem cadastrada.</p>;
  }
  return (
    <ul className="stock-list">
      {origins.items.map((origin) => (
        <li key={origin.id} className="stock-list-item">
          <strong>{origin.name}</strong>
          <span>{STOCK_ORIGIN_KIND_LABELS[origin.kind]}</span>
          {origin.isSystemManaged ? <span>Gerenciada pelo sistema</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function OriginsPage({ stockApi, onSessionExpired, canWrite = true }: OriginsPageProps) {
  const [kindFilter, setKindFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [origins, setOrigins] = useState<Page<StockOrigin>>(emptyPage());
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = loadVersion.current + 1;
    loadVersion.current = version;
    setLoadState({ status: 'loading' });
    try {
      const kind = toStockOriginKind(kindFilter);
      const filter: StockOriginFilter = {
        ...(kind === null ? {} : { kind }),
        ...(appliedSearch === '' ? {} : { search: appliedSearch }),
      };
      const page = await stockApi.listOrigins(filter, { page: pageNumber });
      if (loadVersion.current !== version) return;
      setOrigins(page);
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
  }, [stockApi, kindFilter, appliedSearch, pageNumber, onSessionExpired]);

  useEffect(() => {
    let isCurrent = true;
    void Promise.resolve().then(() => {
      if (isCurrent) void load();
    });
    return () => {
      isCurrent = false;
    };
  }, [load]);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPageNumber(1);
  };

  const handleCreated = () => {
    setShowForm(false);
    setSuccessMessage(CREATED_MESSAGE);
    void load();
  };

  return (
    <main className="stock-page">
      <h1>Origens do estoque</h1>
      <div className="stock-filters">
        <div className="stock-field">
          <label htmlFor="origin-kind-filter">Tipo</label>
          <select
            id="origin-kind-filter"
            value={kindFilter}
            onChange={(event) => {
              setKindFilter(event.target.value);
              setPageNumber(1);
            }}
          >
            <option value="">Todos os tipos</option>
            {ALL_STOCK_ORIGIN_KINDS.map((kind) => (
              <option key={kind} value={kind}>{STOCK_ORIGIN_KIND_LABELS[kind]}</option>
            ))}
          </select>
        </div>
        <form className="stock-search" onSubmit={applySearch}>
          <div className="stock-field">
            <label htmlFor="origin-search">Buscar</label>
            <input
              id="origin-search"
              name="search"
              type="search"
              maxLength={150}
              value={searchInput}
              onChange={(event) => { setSearchInput(event.target.value); }}
            />
          </div>
          <button className="stock-submit" type="submit">Buscar</button>
        </form>
      </div>
      {successMessage === null ? null : (
        <p className="stock-message stock-message-success" role="status">{successMessage}</p>
      )}
      {loadState.status === 'loading' ? <p aria-busy="true">Carregando origens…</p> : null}
      {loadState.status === 'error' ? (
        <div>
          <p className="stock-message stock-message-error" role="alert">{loadState.message}</p>
          <button type="button" onClick={() => { void load(); }}>Tentar novamente</button>
        </div>
      ) : null}
      {loadState.status === 'ready' ? (
        <section aria-label="Origens cadastradas">
          <OriginList origins={origins} />
          {origins.totalPages <= 1 ? null : (
            <div className="stock-pager">
              <button type="button" onClick={() => { setPageNumber(origins.page - 1); }} disabled={origins.page <= 1}>
                Anterior
              </button>
              <span>Página {origins.page} de {origins.totalPages}</span>
              <button
                type="button"
                onClick={() => { setPageNumber(origins.page + 1); }}
                disabled={origins.page >= origins.totalPages}
              >
                Próxima
              </button>
            </div>
          )}
        </section>
      ) : null}
      {loadState.status === 'ready' && !showForm && canWrite ? (
        <button type="button" onClick={() => { setShowForm(true); }}>Nova origem</button>
      ) : null}
      {loadState.status === 'ready' && showForm ? (
        <OriginForm
          stockApi={stockApi}
          onCreated={handleCreated}
          onCancel={() => { setShowForm(false); }}
          {...(onSessionExpired === undefined ? {} : { onSessionExpired })}
        />
      ) : null}
    </main>
  );
}
