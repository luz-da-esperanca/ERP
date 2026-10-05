import { useCallback, useEffect, useState } from 'react';
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
              <li key={person.id} className="search-result-static">
                <Users aria-hidden="true" size={18} />
                <span>
                  <strong>{person.name}</strong>
                  <small>Cadastro individual</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function SearchPage({ onClose }: { onClose: () => void }) {
  const { client, session } = useErp();
  const [query, setQuery] = useState('');
  const canReadRegistration = Boolean(
    session?.capabilities.includes('registration.read'),
  );
  const loadFamilies = useCallback(
    () =>
      canReadRegistration
        ? client.registration.listFamilies()
        : Promise.resolve([]),
    [canReadRegistration, client],
  );
  const loadPeople = useCallback(
    () =>
      canReadRegistration
        ? client.registration.listPeople()
        : Promise.resolve([]),
    [canReadRegistration, client],
  );
  const families = useQuery(loadFamilies);
  const people = useQuery(loadPeople);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="search-overlay" role="presentation">
      <section
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
      >
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
    </div>
  );
}
