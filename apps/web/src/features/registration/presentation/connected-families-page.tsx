import type { HttpEligibility } from '../../eligibility/infra/http-eligibility';
import { eligibilityLabels } from '../../eligibility/presentation/eligibility-page';
import type { FamilySummary } from '@erp/contracts/registration';
import { useAction } from '../../../shared/use-action';
import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import type { HttpRegistration } from '../infra/http-registration';
import { useErp } from '../../../app/erp-provider';
import { useQuery } from '../../../shared/use-query';
import { Alert, AsyncView, Field, Page, Panel } from '../../../shared/ui';
import { FamilyTable } from './families-page';
import { civilToday, displayInstant } from '../../../shared/time';

export function ConnectedFamiliesPage({
  registration,
  eligibility,
}: {
  registration: HttpRegistration;
  eligibility?: HttpEligibility;
}) {
  const { session } = useErp();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ query: '', page: 1 });
  const [asOf] = useState(() => new Date().toISOString());
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    const q = filters.query;
    return registration.searchFamilies({
      page: filters.page,
      pageSize: 20,
      asOf,
      ...(q ? (/^[1-9]\d*$/.test(q) ? { code: q } : { q }) : {}),
    });
  }, [registration, filters, asOf]);
  const state = useQuery(load);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (value && value.length < 2 && !/^[1-9]\d*$/.test(value)) {
      setError(
        'Digite pelo menos dois caracteres ou informe o código da família.',
      );
      return;
    }
    setError(null);
    setFilters({ query: value, page: 1 });
  }
  return (
    <Page
      title="Famílias"
      description="Cadastro, composição por data e histórico familiar."
      actions={
        session?.capabilities.includes('registration.write') && (
          <Link className="button primary" to="/families/new">
            Nova família
          </Link>
        )
      }
    >
      <form className="form-stack" onSubmit={search}>
        <Field
          label="Buscar famílias"
          name="q"
          type="search"
          value={query}
          maxLength={200}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome, endereço ou código"
        />
        <div>
          <button className="button secondary" type="submit">
            Buscar
          </button>
        </div>
        {error && <Alert error>{error}</Alert>}
      </form>
      <AsyncView state={state}>
        {(result) => (
          <Panel>
            <p className="muted">
              {result.pagination.total} famílias · Composição em{' '}
              {displayInstant(asOf)}.
            </p>
            <FamilyEligibilityTable
              key={result.data
                .map((family) => `${family.id}:${family.revision}`)
                .join()}
              families={result.data}
              gateway={
                session?.capabilities.includes('eligibility.read')
                  ? eligibility
                  : undefined
              }
              referenceDate={civilToday(new Date(asOf))}
            />
            {result.pagination.total > result.pagination.pageSize && (
              <div className="pagination">
                <button
                  className="button secondary"
                  disabled={result.pagination.page === 1}
                  onClick={() =>
                    setFilters({ ...filters, page: result.pagination.page - 1 })
                  }
                >
                  Anterior
                </button>
                <span>Página {result.pagination.page}</span>
                <button
                  className="button secondary"
                  disabled={
                    result.pagination.page * result.pagination.pageSize >=
                    result.pagination.total
                  }
                  onClick={() =>
                    setFilters({ ...filters, page: result.pagination.page + 1 })
                  }
                >
                  Próxima
                </button>
              </div>
            )}
          </Panel>
        )}
      </AsyncView>
      {state.status === 'error' && (
        <button
          className="button secondary"
          onClick={() => setFilters({ ...filters })}
        >
          Tentar novamente
        </button>
      )}
    </Page>
  );
}

function FamilyEligibilityTable({
  families,
  gateway,
  referenceDate,
}: {
  families: FamilySummary[];
  gateway?: HttpEligibility;
  referenceDate: string;
}) {
  const [statuses, setStatuses] = useState<
    Record<string, keyof typeof eligibilityLabels>
  >({});
  const action = useAction();
  return (
    <>
      <FamilyTable
        families={families}
        eligibilityLabel={(family) =>
          statuses[family.id] ? (
            <Link
              to={`/families/${family.id}/eligibility?referenceDate=${referenceDate}`}
            >
              {eligibilityLabels[statuses[family.id]!]} — consultar evidências
            </Link>
          ) : (
            'Não consultada'
          )
        }
      />
      {gateway && families.length > 0 && (
        <>
          <p>
            Aptidão na referência {referenceDate}. A consulta não registra uma
            avaliação.
          </p>
          <button
            className="button secondary"
            disabled={action.pending}
            onClick={() => {
              void action.run(async () => {
                const results = await Promise.all(
                  families.map((family) =>
                    gateway.preview(family.id, referenceDate),
                  ),
                );
                setStatuses(
                  Object.fromEntries(
                    results.map((result) => [result.familyId, result.status]),
                  ),
                );
              });
            }}
          >
            {action.pending
              ? 'Consultando aptidão…'
              : 'Consultar aptidão das famílias desta página'}
          </button>
          {action.error && <Alert error>{action.error}</Alert>}
        </>
      )}
    </>
  );
}
