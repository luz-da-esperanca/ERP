import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { historyEventTypeSchema } from '@erp/contracts/reports-api';
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
import { RecordList } from '../../../shared/record-list';
const historyLabels = [
  'Início de vínculo familiar',
  'Fim de vínculo familiar',
  'Início de inscrição',
  'Fim de inscrição',
  'Frequência',
  'Ficha social',
  'Avaliação de aptidão',
];
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
      <Page title={person ? 'Histórico individual' : 'Histórico familiar'}>
        <Panel>
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
                ...(toExclusive ? { toExclusive } : {}),
                ...(types ? { eventTypes: types } : {}),
              });
            }}
          >
            <Field label="Início do período" name="from" type="date" />
            <Field
              label="Fim do período (exclusivo)"
              name="toExclusive"
              type="date"
            />
            <SelectField label="Ordenação do histórico" name="order">
              <option value="desc">Mais recente primeiro</option>
              <option value="asc">Mais antigo primeiro</option>
            </SelectField>
            <SelectField
              label="Tipos de fatos (opcional)"
              name="types"
              multiple
            >
              {historyEventTypeSchema.options.map((type, index) => (
                <option key={type} value={type}>
                  {historyLabels[index]}
                </option>
              ))}
            </SelectField>
            <button className="button primary">Consultar histórico</button>
          </form>
        </Panel>
        <AsyncView state={state}>
          {(result) => (
            <Panel title="Fatos e proveniência">
              <p>
                Fatos preservam a família associada no momento em que ocorreram.
                Cancelamentos e correções permanecem identificados.
              </p>
              <RecordList records={result.data} />
              <nav aria-label="Páginas do histórico">
                <button
                  className="button secondary"
                  disabled={query.page === 1}
                  onClick={() => setQuery({ ...query, page: query.page - 1 })}
                >
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
                </button>
              </nav>
            </Panel>
          )}
        </AsyncView>
        <button
          className="button secondary"
          onClick={() => setRefresh(refresh + 1)}
        >
          Atualizar histórico
        </button>
      </Page>
    </>
  );
}
