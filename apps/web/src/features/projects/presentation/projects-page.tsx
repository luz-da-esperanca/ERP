import { useId } from 'react';
import { Plus } from 'lucide-react';
import type { Activity, ProjectsOverview } from '@erp/contracts/projects';
import { useErp } from '../../../app/erp-provider';
import { useQuery } from '../../../shared/use-query';
import { Alert, AsyncView, Empty, Page, Panel } from '../../../shared/ui';
import { ProjectGroup } from './project-group';

function ProjectList({ overview }: { overview: ProjectsOverview }) {
  if (!overview.projects.length) {
    return (
      <Panel>
        <Empty>Nenhum projeto cadastrado.</Empty>
      </Panel>
    );
  }

  const activitiesByProject = new Map<string, Activity[]>();
  for (const activity of overview.activities) {
    const activities = activitiesByProject.get(activity.projectId) ?? [];
    activities.push(activity);
    activitiesByProject.set(activity.projectId, activities);
  }

  return (
    <div className="project-list">
      {overview.projects.map((project, index) => (
        <ProjectGroup
          key={project.id}
          project={project}
          activities={activitiesByProject.get(project.id) ?? []}
          initiallyExpanded={index === 0}
        />
      ))}
    </div>
  );
}

function ProjectsContent() {
  const { client } = useErp();
  const state = useQuery(client.projects.overview);
  return (
    <AsyncView state={state}>
      {(overview) => <ProjectList overview={overview} />}
    </AsyncView>
  );
}

export function ProjectsPage() {
  const { session } = useErp();
  const creationHintId = useId();
  const canRead = session?.capabilities.includes('projects.read');
  const canWrite = canRead && session?.capabilities.includes('projects.write');
  return (
    <Page
      title="Projetos e atividades"
      actions={
        canWrite && (
          <div className="project-creation-actions">
            <div className="project-creation-buttons">
              <button
                type="button"
                className="button secondary"
                disabled
                aria-describedby={creationHintId}
              >
                <Plus aria-hidden="true" size={18} />
                Nova atividade
              </button>
              <button
                type="button"
                className="button primary"
                disabled
                aria-describedby={creationHintId}
              >
                <Plus aria-hidden="true" size={18} />
                Novo projeto
              </button>
            </div>
            <p id={creationHintId}>
              Cadastros de projetos e atividades em breve.
            </p>
          </div>
        )
      }
    >
      {canRead ? (
        <ProjectsContent />
      ) : (
        <Alert error>Seu perfil não permite esta operação.</Alert>
      )}
    </Page>
  );
}
