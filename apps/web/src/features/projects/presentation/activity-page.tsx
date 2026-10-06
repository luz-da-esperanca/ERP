import type { ActivityDto } from '@erp/contracts/projects-api';
import type { Capability } from '@erp/contracts/access';
import type { HttpProjects } from '../infra/http-projects';
import { useApiQuery } from '../../../shared/use-query';
import { Field, textValue } from '../../../shared/ui';
import { ActivityForm, ClosureForm, instantValue } from './project-forms';
import { EnrollmentManagement, localInstant } from './enrollment-management';
import { useCallback, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';
import {
  Archive,
  CalendarCheck,
  CheckCircle,
  Clock,
  Tag,
  UserRound,
} from 'lucide-react';
import type { ActivityDetail } from '@erp/contracts/projects';
import { useErp } from '../../../app/erp-provider';
import { useQuery } from '../../../shared/use-query';
import { displayInstant } from '../../../shared/time';
import { EnrollmentList } from './enrollment-list';
import {
  Alert,
  AsyncView,
  BackLink,
  Empty,
  Page,
  Panel,
  StatusBadge,
} from '../../../shared/ui';

function ActivityInfo({
  label,
  children,
  icon,
}: {
  label: string;
  children: ReactNode;
  icon: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="activity-info">
      <dt id={labelId}>
        <span className="activity-info-icon" aria-hidden="true">
          {icon}
        </span>
        {label}
      </dt>
      <dd aria-labelledby={labelId}>{children}</dd>
    </div>
  );
}

function ServiceTypeInfo({ id }: { id: string }) {
  const { client } = useErp();
  const state = useQuery(client.projects.overview);
  return (
    <ActivityInfo label="Tipo de atendimento" icon={<Tag size={20} />}>
      <AsyncView state={state}>
        {(overview) =>
          overview.serviceTypes.find((type) => type.id === id)?.name ??
          'Não disponível'
        }
      </AsyncView>
    </ActivityInfo>
  );
}

function ActivityProfile({
  detail,
  asOf,
  actions,
  children,
  enrollments,
  serviceTypeName,
  responsibleName,
}: {
  detail: ActivityDetail;
  asOf: string;
  actions?: ReactNode;
  children?: ReactNode;
  enrollments?: ReactNode;
  serviceTypeName?: ReactNode;
  responsibleName?: ReactNode;
}) {
  const { activity, project } = detail;
  const StatusIcon = activity.status === 'ACTIVE' ? CheckCircle : Archive;

  return (
    <Page title={activity.name} description={project.name} actions={actions}>
      {children}
      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge>
          {activity.nature === 'PERIODIC'
            ? 'Atividade periódica'
            : 'Atendimento único'}
        </StatusBadge>
        <StatusBadge icon={<StatusIcon aria-hidden="true" size={14} />}>
          {activity.status === 'ACTIVE' ? 'Ativa' : 'Encerrada'}
        </StatusBadge>
      </div>
      <section
        className="panel activity-summary"
        aria-label="Informações da atividade"
      >
        <dl className="activity-information">
          <ActivityInfo label="Responsável" icon={<UserRound size={20} />}>
            {responsibleName ?? (
              <span className="activity-info-unavailable">
                Consulta ainda não disponível
              </span>
            )}
          </ActivityInfo>
          <ActivityInfo label="Agenda planejada" icon={<Clock size={20} />}>
            {activity.plannedSchedule ?? (
              <span className="activity-info-unavailable">Não informada</span>
            )}
          </ActivityInfo>
          {activity.nature === 'ONE_OFF' && activity.serviceTypeId ? (
            serviceTypeName ? (
              <ActivityInfo
                label="Tipo de atendimento"
                icon={<Tag size={20} />}
              >
                {serviceTypeName}
              </ActivityInfo>
            ) : (
              <ServiceTypeInfo id={activity.serviceTypeId} />
            )
          ) : null}
          {activity.closedAt ? (
            <ActivityInfo
              label="Encerrada em"
              icon={<CalendarCheck size={20} />}
            >
              <time dateTime={activity.closedAt}>
                {displayInstant(activity.closedAt)}
              </time>
            </ActivityInfo>
          ) : null}
        </dl>
      </section>
      {activity.nature === 'PERIODIC' &&
        (enrollments ?? (
          <EnrollmentList participants={detail.participants} asOf={asOf} />
        ))}
      <Panel title="Registros recentes">
        <Empty>
          {activity.nature === 'PERIODIC'
            ? 'A consulta de encontros ainda não está disponível.'
            : 'O registro de atendimentos não está disponível nesta etapa.'}
        </Empty>
      </Panel>
    </Page>
  );
}

function ActivityContent({ id }: { id: string }) {
  const { client } = useErp();
  const [asOf] = useState(() => new Date().toISOString());
  const load = useCallback(
    () => client.projects.getActivity(id, asOf),
    [client, id, asOf],
  );
  const state = useQuery(load);
  return (
    <AsyncView state={state}>
      {(detail) => <ActivityProfile detail={detail} asOf={asOf} />}
    </AsyncView>
  );
}

export function ActivityPage() {
  const { id = '' } = useParams();
  const { session } = useErp();
  const canRead = session?.capabilities.includes('projects.read');

  return (
    <>
      <BackLink to="/projects">Projetos e atividades</BackLink>
      {canRead ? (
        <ActivityContent key={id} id={id} />
      ) : (
        <Alert error>Seu perfil não permite esta operação.</Alert>
      )}
    </>
  );
}

export function ManagedActivityPage({
  gateway,
  capabilities,
  id,
}: {
  gateway: HttpProjects;
  capabilities: Capability[];
  id?: string;
}) {
  const params = useParams();
  const activityId = id ?? params.id ?? '';
  return (
    <>
      <BackLink to="/projects">Projetos e atividades</BackLink>
      {capabilities.includes('projects.read') ? (
        <ManagedActivityContent
          key={activityId}
          gateway={gateway}
          capabilities={capabilities}
          id={activityId}
        />
      ) : (
        <Alert error>Seu perfil não permite esta operação.</Alert>
      )}
    </>
  );
}
function ManagedActivityContent({
  gateway,
  capabilities,
  id,
}: {
  gateway: HttpProjects;
  capabilities: Capability[];
  id: string;
}) {
  const [asOf, setAsOf] = useState(() => new Date().toISOString());
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<'edit' | 'closure' | null>(null);
  const [enrollmentEditing, setEnrollmentEditing] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(
    () => gateway.activity(id, asOf),
    [gateway, id, asOf],
  );
  const state = useApiQuery(load, revision);
  const canWrite = capabilities.includes('projects.write');
  const canEnroll = canWrite || capabilities.includes('attendance.write');
  function refresh() {
    setMode(null);
    setRevision((value) => value + 1);
  }
  function completed() {
    setMessage('Alteração salva.');
    refresh();
  }
  return (
    <AsyncView state={state}>
      {(detail) => (
        <ActivityProfile
          detail={{ ...detail, participants: [] }}
          asOf={detail.asOf}
          serviceTypeName={
            detail.activity.serviceTypeId ? (
              <ManagedServiceType
                gateway={gateway}
                id={detail.activity.serviceTypeId}
              />
            ) : undefined
          }
          responsibleName={
            detail.activity.responsibleId ? (
              canWrite ? (
                <ManagedResponsible
                  gateway={gateway}
                  id={detail.activity.responsibleId}
                />
              ) : (
                'Nome do responsável indisponível para este perfil'
              )
            ) : (
              'Não informado'
            )
          }
          actions={
            canWrite &&
            !mode &&
            !enrollmentEditing && (
              <div className="flex flex-wrap gap-2">
                <button
                  className="button secondary"
                  onClick={() => {
                    setMessage('');
                    setMode('edit');
                  }}
                >
                  Editar atividade
                </button>
                {detail.activity.status === 'ACTIVE' && (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setMessage('');
                      setMode('closure');
                    }}
                  >
                    Encerrar atividade
                  </button>
                )}
              </div>
            )
          }
          enrollments={
            <>
              <form
                className="mb-4 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  setAsOf(instantValue(data, 'asOf'));
                }}
              >
                <Field
                  disabled={enrollmentEditing}
                  label="Referência das inscrições"
                  name="asOf"
                  type="datetime-local"
                  step="0.001"
                  required
                  defaultValue={localInstant(asOf)}
                />
                <button
                  disabled={enrollmentEditing}
                  className="button secondary"
                  type="submit"
                >
                  Consultar
                </button>
              </form>
              <EnrollmentManagement
                gateway={gateway}
                activity={detail.activity}
                asOf={detail.asOf}
                revision={revision}
                canWrite={canEnroll && !mode}
                onCompleted={completed}
                onRefresh={refresh}
                onEditing={setEnrollmentEditing}
              />
            </>
          }
        >
          {message && <Alert>{message}</Alert>}
          {mode === 'closure' && (
            <Panel title="Encerrar atividade">
              <ClosureForm
                onCompleted={completed}
                onCancel={refresh}
                save={(data, key) =>
                  gateway.closeActivity(
                    id,
                    {
                      expectedRevision: detail.activity.revision,
                      effectiveAt: instantValue(data, 'effectiveAt'),
                      reason: textValue(data, 'reason'),
                    },
                    key,
                  )
                }
              />
            </Panel>
          )}
          {mode === 'edit' && (
            <ManagedActivityForm
              gateway={gateway}
              activity={detail.activity}
              onCompleted={completed}
              onCancel={refresh}
            />
          )}
        </ActivityProfile>
      )}
    </AsyncView>
  );
}
function ManagedActivityForm({
  gateway,
  activity,
  onCompleted,
  onCancel,
}: {
  gateway: HttpProjects;
  activity: ActivityDto;
  onCompleted: () => void;
  onCancel: () => void;
}) {
  const state = useApiQuery(gateway.overview);
  return (
    <Panel title="Editar atividade">
      <AsyncView state={state}>
        {(overview) => (
          <ActivityForm
            gateway={gateway}
            overview={overview}
            activity={activity}
            onCompleted={onCompleted}
            onCancel={onCancel}
          />
        )}
      </AsyncView>
    </Panel>
  );
}
function ManagedServiceType({
  gateway,
  id,
}: {
  gateway: HttpProjects;
  id: string;
}) {
  const state = useApiQuery(gateway.overview);
  return (
    <AsyncView state={state}>
      {(overview) =>
        overview.serviceTypes.find((type) => type.id === id)?.name ??
        'Não disponível'
      }
    </AsyncView>
  );
}
function ManagedResponsible({
  gateway,
  id,
}: {
  gateway: HttpProjects;
  id: string;
}) {
  const load = useCallback(() => gateway.responsibleById(id), [gateway, id]);
  const state = useApiQuery(load);
  return (
    <AsyncView state={state}>
      {(people) =>
        people.find((person) => person.id === id)?.displayName ??
        'Não disponível'
      }
    </AsyncView>
  );
}
