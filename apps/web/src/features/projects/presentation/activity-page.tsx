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
}: {
  detail: ActivityDetail;
  asOf: string;
}) {
  const { activity, project } = detail;
  const StatusIcon = activity.status === 'ACTIVE' ? CheckCircle : Archive;

  return (
    <Page title={activity.name} description={project.name}>
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
            <span className="activity-info-unavailable">
              Consulta ainda não disponível
            </span>
          </ActivityInfo>
          <ActivityInfo label="Agenda planejada" icon={<Clock size={20} />}>
            {activity.plannedSchedule ?? (
              <span className="activity-info-unavailable">Não informada</span>
            )}
          </ActivityInfo>
          {activity.nature === 'ONE_OFF' && activity.serviceTypeId ? (
            <ServiceTypeInfo id={activity.serviceTypeId} />
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
      {activity.nature === 'PERIODIC' && (
        <EnrollmentList participants={detail.participants} asOf={asOf} />
      )}
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
