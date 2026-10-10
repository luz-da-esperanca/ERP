import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { historyEventTypeSchema } from '@erp/contracts/reports-api';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { HttpReports } from '../infra/http-reports';
import { useApiQuery } from '../../../shared/use-query';
import {
  Page,
  Panel,
  Field,
  SelectField,
  AsyncView,
  BackLink,
  textValue,
} from '../../../shared/ui';
import { HistoryEventList, historyEventLabels } from './history-event-list';
import { addDays } from '../../../shared/time';
export function HistoryPage({
  gateway,
  person = false,
}: {
  gateway: HttpReports;
  person?: boolean;
}) {
  const { id = '' } = useParams();
  const [query, setQuery] = useState<{
    from?: string;
    toExclusive?: string;
    eventTypes?: string;
    order: 'asc' | 'desc';
    page: number;
  }>({ order: 'desc', page: 1 });
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(
    () =>
      person
        ? gateway.personHistory(id, query)
        : gateway.familyHistory(id, query),
    [gateway, person, id, query],
  );
  const state = useApiQuery(load, refresh);
  return (
    <>
      <BackLink to={`/${person ? 'people' : 'families'}/${id}`} />
      <Page
        title={person ? 'Histórico individual' : 'Histórico familiar'}
        actions={
          <button
            className="button secondary"
            onClick={() => setRefresh((value) => value + 1)}
          >
            <RefreshCw size={18} aria-hidden="true" />
            Atualizar histórico
          </button>
        }
      >
        <Panel title="Consultar histórico">
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const from = textValue(data, 'from');
              const toExclusive = textValue(data, 'toExclusive');
              const types = data.getAll('types').map(String).join(',');
              setQuery({
                page: 1,
                order: textValue(data, 'order') === 'asc' ? 'asc' : 'desc',
                ...(from ? { from } : {}),
                ...(toExclusive
                  ? { toExclusive: addDays(toExclusive, 1) }
                  : {}),
                ...(types ? { eventTypes: types } : {}),
              });
            }}
          >
            <Field label="Início do período" name="from" type="date" />
            <Field label="Fim do período" name="toExclusive" type="date" />
            <SelectField label="Ordenação do histórico" name="order">
              <option value="desc">Mais recente primeiro</option>
              <option value="asc">Mais antigo primeiro</option>
            </SelectField>
            <details className="disclosure">
              <summary>Tipos de registros</summary>
              <fieldset className="history-type-filters">
                <legend className="sr-only">
                  Filtrar por tipo de registro
                </legend>
                {historyEventTypeSchema.options.map((type) => (
                  <Field
                    key={type}
                    label={historyEventLabels[type]}
                    name="types"
                    type="checkbox"
                    value={type}
                  />
                ))}
              </fieldset>
            </details>
            <div className="form-actions">
              <button className="button primary">
                <Search size={18} aria-hidden="true" />
                Consultar histórico
              </button>
            </div>
          </form>
        </Panel>
        <AsyncView state={state}>
          {(result) => (
            <Panel title="Registros do histórico">
              <HistoryEventList records={result.data} />
              <nav className="pagination" aria-label="Páginas do histórico">
                <button
                  className="button secondary"
                  disabled={query.page === 1}
                  onClick={() => setQuery({ ...query, page: query.page - 1 })}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                  Anterior
                </button>
                <span>
                  Página {query.page} · {result.pagination.total} fatos
                </span>
                <button
                  className="button secondary"
                  disabled={
                    query.page * result.pagination.pageSize >=
                    result.pagination.total
                  }
                  onClick={() => setQuery({ ...query, page: query.page + 1 })}
                >
                  Próxima
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </nav>
            </Panel>
          )}
        </AsyncView>
      </Page>
    </>
  );
}
