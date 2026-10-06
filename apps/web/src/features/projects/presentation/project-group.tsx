import { useId, useState } from 'react';
import { Archive, CheckCircle, ChevronDown } from 'lucide-react';
import { Link } from 'react-router';
import type {
  Activity,
  ActivityNature,
  Project,
} from '@erp/contracts/projects';
import { Empty, Panel, StatusBadge } from '../../../shared/ui';

const natureLabels: Record<ActivityNature, string> = {
  PERIODIC: 'Atividade periódica',
  ONE_OFF: 'Atendimento único',
};

export function ProjectGroup({
  project,
  activities,
  initiallyExpanded,
}: {
  project: Project;
  activities: Activity[];
  initiallyExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const contentId = useId();
  const headingId = useId();
  const ProjectIcon = project.status === 'ACTIVE' ? CheckCircle : Archive;

  return (
    <Panel>
      <h2 className="project-heading">
        <button
          type="button"
          className="project-toggle"
          id={headingId}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown
            aria-hidden="true"
            size={20}
            className={
              expanded ? 'project-chevron expanded' : 'project-chevron'
            }
          />
          <span className="project-name">{project.name}</span>
          <StatusBadge icon={<ProjectIcon aria-hidden="true" size={14} />}>
            {project.status === 'ACTIVE' ? 'Ativo' : 'Encerrado'}
          </StatusBadge>
          <span className="project-count">
            {activities.length}{' '}
            {activities.length === 1
              ? 'atividade cadastrada'
              : 'atividades cadastradas'}
          </span>
        </button>
      </h2>
      <div
        id={contentId}
        role="region"
        aria-labelledby={headingId}
        hidden={!expanded}
      >
        {activities.length ? (
          <div className="table-wrap">
            <table className="project-activities-table">
              <caption className="sr-only">
                Atividades de {project.name}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Natureza</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => {
                  const ActivityIcon =
                    activity.status === 'ACTIVE' ? CheckCircle : Archive;
                  return (
                    <tr key={activity.id}>
                      <td>
                        <Link
                          className="text-link"
                          to={`/activities/${activity.id}`}
                        >
                          {activity.name}
                        </Link>
                      </td>
                      <td>{natureLabels[activity.nature]}</td>
                      <td>
                        <StatusBadge
                          icon={<ActivityIcon aria-hidden="true" size={14} />}
                        >
                          {activity.status === 'ACTIVE' ? 'Ativa' : 'Encerrada'}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Nenhuma atividade cadastrada neste projeto.</Empty>
        )}
      </div>
    </Panel>
  );
}
