import { useCallback, useState } from 'react';
import type { HttpProjects } from '../../projects/infra/http-projects';
import type { HttpRegistration } from '../../registration/infra/http-registration';
import { useApiQuery } from '../../../shared/use-query';
import { Field, SelectField, AsyncView } from '../../../shared/ui';
export function ReportPartyFilter({
  projects,
  registration,
  family = false,
}: {
  projects?: HttpProjects;
  registration?: HttpRegistration;
  family?: boolean;
}) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const load = useCallback(async () => {
    if (!query) return { data: [], total: 0, pageSize: 20 };
    if (family && registration) {
      const result = await registration.searchFamilies({
        page,
        pageSize: 20,
        ...(/^[1-9]\d*$/.test(query) ? { code: query } : { q: query }),
      });
      return {
        data: result.data.map((family) => ({
          id: family.id,
          label: `${family.referenceName ?? 'Família'} · Código ${family.code}`,
        })),
        total: result.pagination.total,
        pageSize: result.pagination.pageSize,
      };
    }
    const people = projects ? await projects.people(query) : [];
    const values = family
      ? [
          ...new Map(
            people
              .filter((person) => 'family' in person && person.family)
              .map((person) => {
                if (!('family' in person) || !person.family)
                  throw new Error('A projected family is required');
                return [
                  person.family.id,
                  {
                    id: person.family.id,
                    label: `Família ${person.family.code}`,
                  },
                ];
              }),
          ).values(),
        ]
      : people.map((person) => ({ id: person.id, label: person.name }));
    return {
      data: values,
      total: values.length,
      pageSize: Math.max(1, values.length),
    };
  }, [registration, projects, family, query, page]);
  const state = useApiQuery(load);
  return (
    <div>
      <Field
        label={
          family
            ? registration
              ? 'Buscar família para o relatório'
              : 'Buscar pessoa da família para o relatório'
            : 'Buscar pessoa para o relatório'
        }
        name={family ? 'familySearch' : 'personSearch'}
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={200}
      />
      <button
        type="button"
        className="button secondary"
        disabled={
          text.trim().length < 2 &&
          !(family && registration && /^[1-9]\d*$/.test(text.trim()))
        }
        onClick={() => {
          setQuery(text.trim());
          setPage(1);
        }}
      >
        Buscar {family ? 'família' : 'pessoa'} no relatório
      </button>
      <AsyncView state={state}>
        {(result) => (
          <>
            <SelectField
              key={`${query}:${page}`}
              label={family ? 'Família (opcional)' : 'Pessoa (opcional)'}
              name={family ? 'familyId' : 'personId'}
            >
              <option value="">Todas</option>
              {result.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </SelectField>
            {family && registration && result.total > result.pageSize && (
              <nav aria-label="Páginas de famílias do filtro">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>
                <span>Página {page}</span>
                <button
                  type="button"
                  disabled={page * result.pageSize >= result.total}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </button>
              </nav>
            )}
          </>
        )}
      </AsyncView>
    </div>
  );
}
