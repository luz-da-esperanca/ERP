import { useCallback, useState } from 'react';
import { CircleCheck, Clock } from 'lucide-react';
import type { QualityIssueDto } from '@erp/contracts/data-quality-api';
import type {
  DataQualityGateway,
  QualityQuery,
  DuplicateEntityType,
} from '../application/data-quality-gateway';
import {
  Alert,
  AsyncView,
  Empty,
  Page,
  Panel,
  SelectField,
  StatusBadge,
} from '../../../shared/ui';
import { useApiQuery } from '../../../shared/use-query';
import { displayInstant } from '../../../shared/time';
import { DuplicateReview } from './duplicate-review';
import { DuplicateCandidateSearch } from './duplicate-candidate-search';

type ReviewSelection = {
  entityType: DuplicateEntityType;
  ids: string[];
  issue?: QualityIssueDto;
};
export function DataQualityPage(props: {
  gateway: DataQualityGateway;
  capabilities: readonly string[];
}) {
  if (!props.capabilities.includes('registration.read'))
    return (
      <Page title="Duplicidades e qualidade">
        <Panel>
          <Empty>Seu perfil não permite acessar esta área.</Empty>
        </Panel>
      </Page>
    );
  return <QualityWorkspace {...props} />;
}
function QualityWorkspace({
  gateway,
  capabilities,
}: {
  gateway: DataQualityGateway;
  capabilities: readonly string[];
}) {
  const [selected, setSelected] = useState<ReviewSelection | null>(null);
  const [search, setSearch] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  if (selected)
    return (
      <Page title="Duplicidades e qualidade">
        <DuplicateReview
          gateway={gateway}
          {...selected}
          capabilities={capabilities}
          onClose={() => setSelected(null)}
          onCompleted={(message) => {
            setSelected(null);
            setSuccess(message);
            setRevision(revision + 1);
          }}
        />
      </Page>
    );
  return (
    <Page
      title="Duplicidades e qualidade"
      actions={
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setSearch(!search);
            setSuccess(null);
          }}
        >
          {search ? 'Ver ocorrências' : 'Buscar candidatos'}
        </button>
      }
    >
      {success ? <Alert>{success}</Alert> : null}
      {search ? (
        <DuplicateCandidateSearch
          gateway={gateway}
          onCompare={(entityType, ids) => setSelected({ entityType, ids })}
        />
      ) : (
        <IssueList
          gateway={gateway}
          revision={revision}
          onSelect={(issue) => {
            setSelected({
              entityType: issue.entityType,
              ids: [issue.entityId, ...issue.candidateIds],
              issue,
            });
            setSuccess(null);
          }}
        />
      )}
    </Page>
  );
}
function IssueList({
  gateway,
  revision,
  onSelect,
}: {
  gateway: DataQualityGateway;
  revision: number;
  onSelect(issue: QualityIssueDto): void;
}) {
  const [query, setQuery] = useState<QualityQuery>({
    page: 1,
    pageSize: 20,
    kind: 'POSSIBLE_DUPLICATE',
    status: 'OPEN',
  });
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(() => gateway.issues(query), [gateway, query]);
  const state = useApiQuery(load, revision + refresh);
  return (
    <Panel>
      <div className="form-grid mb-6">
        <SelectField
          name="entityType"
          label="Tipo de registro"
          value={query.entityType ?? ''}
          onChange={(event) =>
            setQuery({
              ...query,
              page: 1,
              entityType:
                event.target.value === 'PERSON' ||
                event.target.value === 'FAMILY'
                  ? event.target.value
                  : undefined,
            })
          }
        >
          <option value="">Pessoas e famílias</option>
          <option value="PERSON">Pessoa</option>
          <option value="FAMILY">Família</option>
        </SelectField>
        <SelectField
          name="status"
          label="Situação da análise"
          value={query.status ?? ''}
          onChange={(event) =>
            setQuery({
              ...query,
              page: 1,
              status:
                event.target.value === 'OPEN' ||
                event.target.value === 'RESOLVED'
                  ? event.target.value
                  : undefined,
            })
          }
        >
          <option value="">Todas</option>
          <option value="OPEN">Em aberto</option>
          <option value="RESOLVED">Resolvidas</option>
        </SelectField>
      </div>
      <AsyncView state={state}>
        {(result) => (
          <>
            {result.data.length ? (
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">
                    Ocorrências de possível duplicidade
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Tipo</th>
                      <th scope="col">Registro</th>
                      <th scope="col">Identificada em</th>
                      <th scope="col">Situação</th>
                      <th scope="col">Análise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((issue) => (
                      <tr key={issue.id}>
                        <td>
                          {issue.entityType === 'PERSON' ? 'Pessoa' : 'Família'}
                        </td>
                        <td className="break-all">
                          {issue.entityId}
                          <br />
                          <small>{issue.candidateIds.length} candidatos</small>
                        </td>
                        <td>{displayInstant(issue.identifiedAt)}</td>
                        <td>
                          <StatusBadge
                            icon={
                              issue.resolvedAt ? (
                                <CircleCheck size={14} aria-hidden="true" />
                              ) : (
                                <Clock size={14} aria-hidden="true" />
                              )
                            }
                          >
                            {issue.resolvedAt
                              ? issue.resolution === 'DISTINCT'
                                ? 'Distintos'
                                : issue.resolution === 'MERGED'
                                  ? 'Unificada'
                                  : 'Resolvida'
                              : 'Em aberto'}
                          </StatusBadge>
                        </td>
                        <td>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => onSelect(issue)}
                          >
                            {issue.resolvedAt ? 'Ver análise' : 'Analisar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Nenhuma ocorrência encontrada.</Empty>
            )}
            <nav
              aria-label="Paginação das ocorrências"
              className="mt-4 flex flex-wrap items-center gap-4"
            >
              <button
                className="button secondary"
                disabled={result.pagination.page <= 1}
                onClick={() =>
                  setQuery({ ...query, page: result.pagination.page - 1 })
                }
              >
                Página anterior
              </button>
              <span>
                Página {result.pagination.page} de{' '}
                {Math.max(
                  1,
                  Math.ceil(
                    result.pagination.total / result.pagination.pageSize,
                  ),
                )}{' '}
                · {result.pagination.total} ocorrências
              </span>
              <button
                className="button secondary"
                disabled={
                  result.pagination.page * result.pagination.pageSize >=
                  result.pagination.total
                }
                onClick={() =>
                  setQuery({ ...query, page: result.pagination.page + 1 })
                }
              >
                Próxima página
              </button>
            </nav>
          </>
        )}
      </AsyncView>
      {state.status === 'error' ? (
        <button
          className="button secondary"
          onClick={() => setRefresh(refresh + 1)}
        >
          Tentar novamente
        </button>
      ) : null}
    </Panel>
  );
}
