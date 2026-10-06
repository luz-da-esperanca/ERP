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
  return (
    <Page title="Projetos e atividades">
      {session?.capabilities.includes('projects.read') ? (
        <ProjectsContent />
      ) : (
        <Alert error>Seu perfil não permite esta operação.</Alert>
      )}
    </Page>
  );
}
