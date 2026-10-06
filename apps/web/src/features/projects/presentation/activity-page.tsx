import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { Archive, CheckCircle } from 'lucide-react';
import type { ActivityDetail } from '@erp/contracts/projects';
import { useErp } from '../../../app/erp-provider';
import { useQuery } from '../../../shared/use-query';
import { displayInstant } from '../../../shared/time';
import {
  Alert,
  AsyncView,
  BackLink,
  Empty,
  Page,
  Panel,
  StatusBadge,
} from '../../../shared/ui';

function ServiceTypeInfo({ id }: { id: string }) {
  const { client } = useErp();
  const state = useQuery(client.projects.overview);
  return (
    <>
      <dt className="mb-2 mt-6 text-sm font-semibold">Tipo de atendimento</dt>
      <dd className="break-words">
        <AsyncView state={state}>
          {(overview) =>
            overview.serviceTypes.find((type) => type.id === id)?.name ??
            'Não disponível'
          }
        </AsyncView>
      </dd>
    </>
  );
}

function ActivityProfile({ detail }: { detail: ActivityDetail }) {
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
      <Panel title="Informações da atividade">
        <dl>
          <dt className="mb-2 text-sm font-semibold">Responsável</dt>
          <dd className="break-words">Consulta ainda não disponível</dd>
          <dt className="mb-2 mt-6 text-sm font-semibold">Agenda planejada</dt>
          <dd className="whitespace-pre-wrap break-words">
            {activity.plannedSchedule ?? 'Não informada'}
          </dd>
          {activity.nature === 'ONE_OFF' && activity.serviceTypeId ? (
            <ServiceTypeInfo id={activity.serviceTypeId} />
          ) : null}
          {activity.closedAt ? (
            <>
              <dt className="mb-2 mt-6 text-sm font-semibold">Encerrada em</dt>
              <dd>
                <time dateTime={activity.closedAt}>
                  {displayInstant(activity.closedAt)}
                </time>
              </dd>
            </>
          ) : null}
        </dl>
      </Panel>
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
      {(detail) => <ActivityProfile detail={detail} />}
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
