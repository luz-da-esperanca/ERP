import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Search, Users, X } from 'lucide-react';
import type { FamilySummary, Person } from '@erp/contracts/registration';
import { useErp } from '../../../app/erp-provider';
import { AsyncView, Empty } from '../../../shared/ui';
import { useQuery } from '../../../shared/use-query';
import { normalizeSearch } from '../domain/memberships';

interface SearchResultsProps {
  families: FamilySummary[];
  people: Person[];
  query: string;
  onSelect: () => void;
}

function matches(query: string, value: string) {
  return normalizeSearch(value).includes(normalizeSearch(query));
}

function SearchResults({
  families,
  people,
  query,
  onSelect,
}: SearchResultsProps) {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2)
    return <Empty>Digite pelo menos dois caracteres para buscar.</Empty>;

  const familyMatches = families.filter((family) =>
    matches(
      normalizedQuery,
      `${family.code} ${family.referenceName ?? ''} ${family.neighborhood ?? ''}`,
    ),
  );
  const peopleMatches = people.filter((person) =>
    matches(normalizedQuery, person.name),
  );

  if (!familyMatches.length && !peopleMatches.length)
    return <Empty>Nenhum cadastro encontrado para esta busca.</Empty>;

  return (
    <div className="search-results">
      {familyMatches.length ? (
        <section aria-labelledby="search-families-title">
          <div className="search-section-heading">
            <h2 id="search-families-title">Famílias</h2>
            <span>{familyMatches.length}</span>
          </div>
          <ul>
            {familyMatches.map((family) => (
              <li key={family.id}>
                <Link to={`/families/${family.id}`} onClick={onSelect}>
                  <Users aria-hidden="true" size={18} />
                  <span>
                    <strong>
                      {family.referenceName ?? `Família ${family.code}`}
                    </strong>
                    <small>
                      Código {family.code}
                      {family.neighborhood ? ` · ${family.neighborhood}` : ''}
                    </small>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {peopleMatches.length ? (
        <section aria-labelledby="search-people-title">
          <div className="search-section-heading">
            <h2 id="search-people-title">Pessoas</h2>
            <span>{peopleMatches.length}</span>
          </div>
          <ul>
            {peopleMatches.map((person) => (
              <li key={person.id}>
                <Link to={`/people/${person.id}`} onClick={onSelect}>
                  <Users aria-hidden="true" size={18} />
                  <span>
                    <strong>{person.name}</strong>
                    <small>Cadastro individual</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function SearchPage({
  onClose,
  returnFocusTo,
}: {
  onClose: () => void;
  returnFocusTo?: Element | null;
}) {
  const { client, session } = useErp();
  const [query, setQuery] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const searchQuery = query.trim();
  const canReadRegistration = Boolean(
    session?.capabilities.includes('registration.read'),
  );
  const loadFamilies = useCallback(
    () =>
      canReadRegistration && searchQuery.length >= 2
        ? client.registration.listFamilies(searchQuery)
        : Promise.resolve([]),
    [canReadRegistration, client, searchQuery],
  );
  const loadPeople = useCallback(
    () =>
      canReadRegistration && searchQuery.length >= 2
        ? client.registration.listPeople(searchQuery)
        : Promise.resolve([]),
    [canReadRegistration, client, searchQuery],
  );
  const families = useQuery(loadFamilies);
  const people = useQuery(loadPeople);
  useEffect(() => {
    const element = dialog.current;
    const trigger = returnFocusTo ?? document.activeElement;
    element?.showModal();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    };
  }, [onClose, returnFocusTo]);

  return (
    <dialog
      ref={dialog}
      className="search-overlay m-0 h-full max-h-none w-full max-w-none border-0"
      aria-modal="true"
      aria-labelledby="search-dialog-title"
      onCancel={onClose}
    >
      <section className="search-dialog">
        <header>
          <h1 id="search-dialog-title">Buscar cadastros</h1>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar busca"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        {canReadRegistration ? (
          <label className="search-dialog-input">
            <span className="sr-only">
              Buscar por família, pessoa ou código
            </span>
            <Search aria-hidden="true" size={20} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por família, pessoa ou código..."
              type="search"
              maxLength={200}
            />
          </label>
        ) : (
          <Empty>Seu perfil não permite consultar cadastros.</Empty>
        )}
        {canReadRegistration ? (
          <AsyncView state={families}>
            {(familyData) => (
              <AsyncView state={people}>
                {(peopleData) => (
                  <SearchResults
                    families={familyData}
                    people={peopleData}
                    query={query}
                    onSelect={onClose}
                  />
                )}
              </AsyncView>
            )}
          </AsyncView>
        ) : null}
        <footer>
          <span>Os resultados respeitam as permissões da conta.</span>
        </footer>
      </section>
      <button
        type="button"
        className="search-dismiss"
        onClick={onClose}
        aria-label="Fechar busca"
      />
    </dialog>
  );
}
