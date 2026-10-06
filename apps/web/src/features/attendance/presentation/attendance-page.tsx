import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Capability } from '@erp/contracts/access';
import type { HttpAttendance, SessionStatus } from '../infra/http-attendance';
import type { HttpProjects } from '../../projects/infra/http-projects';
import { AttendanceDraft } from './attendance-draft';
import { FrequencyQuery } from './frequency-query';
import { localInstant } from '../../projects/presentation/enrollment-management';
import { instantValue } from '../../projects/presentation/project-forms';
import { useApiQuery } from '../../../shared/use-query';
import {
  Alert,
  AsyncView,
  BackLink,
  Empty,
  Field,
  Page,
  Panel,
  SelectField,
  StatusBadge,
  textValue,
} from '../../../shared/ui';
import { displayInstant } from '../../../shared/time';

export interface AttendancePageProps {
  gateway: HttpAttendance;
  projects: HttpProjects;
  capabilities: Capability[];
}
export function AttendancePage(props: AttendancePageProps) {
  const { id = '' } = useParams();
  return (
    <>
      <Link className="text-link" to={`/activities/${id}/coverage`}>
        Consultar e declarar cobertura
      </Link>
      <BackLink to={`/activities/${id}`}>Atividade</BackLink>
      {props.capabilities.includes('attendance.read') ? (
        <AttendanceContent key={id} {...props} activityId={id} />
      ) : (
        <Alert error>
          Seu perfil não permite consultar encontros e frequência.
        </Alert>
      )}
    </>
  );
}
function AttendanceContent({
  gateway,
  projects,
  capabilities,
  activityId,
}: AttendancePageProps & { activityId: string }) {
  const navigate = useNavigate();
  const [asOf] = useState(() => new Date().toISOString());
  const [creating, setCreating] = useState(false);
  const readActivity = capabilities.includes('projects.read');
  const load = useCallback(
    () =>
      readActivity
        ? projects.activity(activityId, asOf)
        : Promise.resolve(null),
    [projects, activityId, asOf, readActivity],
  );
  const state = useApiQuery(load);
  return (
    <AsyncView state={state}>
      {(detail) => (
        <Page
          title="Encontros e frequência"
          description={detail?.activity.name}
          actions={
            capabilities.includes('attendance.write') &&
            !creating &&
            detail?.activity.nature !== 'ONE_OFF' ? (
              <button
                className="button primary"
                onClick={() => setCreating(true)}
              >
                Criar encontro
              </button>
            ) : undefined
          }
        >
          {detail?.activity.nature === 'ONE_OFF' ? (
            <Panel>
              <Empty>
                Encontros e chamada estão disponíveis para atividades
                periódicas.
              </Empty>
            </Panel>
          ) : creating ? (
            <Panel title="Criar encontro">
              <AttendanceDraft
                gateway={gateway}
                projects={projects}
                activityId={activityId}
                responsibleId={detail?.activity.responsibleId ?? null}
                onCancel={() => setCreating(false)}
                onCompleted={(session) =>
                  navigate(`/activities/${activityId}/attendance/${session.id}`)
                }
              />
            </Panel>
          ) : (
            <SessionList gateway={gateway} activityId={activityId} />
          )}
          {!creating && detail?.activity.nature !== 'ONE_OFF' && (
            <Panel title="Consulta de frequência">
              <FrequencyQuery
                gateway={gateway}
                projects={projects}
                activityId={activityId}
              />
            </Panel>
          )}
        </Page>
      )}
    </AsyncView>
  );
}
function SessionList({
  gateway,
  activityId,
}: {
  gateway: HttpAttendance;
  activityId: string;
}) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [filters, setFilters] = useState<{
    from?: string;
    toExclusive?: string;
    status?: SessionStatus;
  }>({});
  const load = useCallback(
    () => gateway.sessions(activityId, page, filters),
    [gateway, activityId, page, filters],
  );
  const state = useApiQuery(load, refresh);
  return (
    <Panel title="Encontros">
      <form
        className="mb-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const from = textValue(data, 'from');
          const to = textValue(data, 'toExclusive');
          const status = textValue(data, 'status') as typeof filters.status;
          setFilters({
            ...(from ? { from: instantValue(data, 'from') } : {}),
            ...(to ? { toExclusive: instantValue(data, 'toExclusive') } : {}),
            ...(status ? { status } : {}),
          });
          setPage(1);
          setRefresh((value) => value + 1);
        }}
      >
        <Field
          label="Início (Fortaleza)"
          name="from"
          type="datetime-local"
          step="0.001"
          defaultValue={localInstant(filters.from ?? null)}
        />
        <Field
          label="Fim exclusivo (Fortaleza)"
          name="toExclusive"
          type="datetime-local"
          step="0.001"
          defaultValue={localInstant(filters.toExclusive ?? null)}
        />
        <SelectField label="Situação" name="status" defaultValue="">
          <option value="">Todas</option>
          <option value="COMPLETED">Realizado</option>
          <option value="CANCELED">Cancelado</option>
        </SelectField>
        <button className="button secondary" type="submit">
          Consultar encontros
        </button>
      </form>
      <AsyncView state={state}>
        {(result) => (
          <>
            {result.data.length ? (
              <div className="table-wrap">
                <table aria-label="Encontros da atividade">
                  <thead>
                    <tr>
                      <th>Data do fato</th>
                      <th>Lançamento</th>
                      <th>Situação</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((session) => (
                      <tr key={session.id}>
                        <th scope="row">
                          <time dateTime={session.occurredAt}>
                            {displayInstant(session.occurredAt)}
                          </time>
                        </th>
                        <td>
                          <time dateTime={session.recordedAt}>
                            {displayInstant(session.recordedAt)}
                          </time>
                        </td>
                        <td>
                          <StatusBadge>
                            {session.status === 'CANCELED'
                              ? 'Cancelado'
                              : 'Realizado'}
                          </StatusBadge>
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            to={`/activities/${activityId}/attendance/${session.id}`}
                          >
                            Ver encontro
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Nenhum encontro no período consultado.</Empty>
            )}
            <nav
              className="mt-4 flex flex-wrap items-center gap-4"
              aria-label="Páginas de encontros"
            >
              <button
                className="button secondary"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </button>
              <span>
                Página {page} · {result.pagination.total} encontros
              </span>
              <button
                className="button secondary"
                disabled={
                  page * result.pagination.pageSize >= result.pagination.total
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Próxima
              </button>
            </nav>
          </>
        )}
      </AsyncView>
      {state.status === 'error' && (
        <button
          className="button secondary"
          onClick={() => setRefresh((value) => value + 1)}
        >
          Tentar novamente
        </button>
      )}
    </Panel>
  );
}
