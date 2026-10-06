import type { Capability } from '@erp/contracts/access';
import type { ProjectDto } from '@erp/contracts/projects-api';
import type { HttpProjects } from '../infra/http-projects';
import { useApiQuery } from '../../../shared/use-query';
import { textValue } from '../../../shared/ui';
import { displayInstant } from '../../../shared/time';
import {
  ProjectForm,
  ActivityForm,
  ClosureForm,
  instantValue,
} from './project-forms';
import { useId, useState } from 'react';
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

export function ManagedProjectsPage({
  gateway,
  capabilities,
}: {
  gateway: HttpProjects;
  capabilities: Capability[];
}) {
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<{
    kind: 'project' | 'activity' | 'closure';
    project?: ProjectDto;
  } | null>(null);
  const [message, setMessage] = useState('');
  const canRead = capabilities.includes('projects.read');
  const canWrite = capabilities.includes('projects.write');
  function refresh() {
    setSelection(null);
    setRevision((value) => value + 1);
  }
  function completed() {
    setMessage('Alteração salva.');
    refresh();
  }
  return (
    <Page
      title="Projetos e atividades"
      actions={
        canRead &&
        canWrite &&
        !selection && (
          <div className="project-creation-buttons">
            <button
              className="button secondary"
              onClick={() => {
                setMessage('');
                setSelection({ kind: 'activity' });
              }}
            >
              Nova atividade
            </button>
            <button
              className="button primary"
              onClick={() => {
                setMessage('');
                setSelection({ kind: 'project' });
              }}
            >
              Novo projeto
            </button>
          </div>
        )
      }
    >
      {!canRead ? (
        <Alert error>Seu perfil não permite esta operação.</Alert>
      ) : (
        <ManagedProjectContent
          gateway={gateway}
          revision={revision}
          canWrite={canWrite}
          selection={selection}
          select={(value) => {
            setMessage('');
            setSelection(value);
          }}
          onCompleted={completed}
          onCancel={refresh}
        />
      )}
      {message && <Alert>{message}</Alert>}
    </Page>
  );
}

function ManagedProjectContent({
  gateway,
  revision,
  canWrite,
  selection,
  select,
  onCompleted,
  onCancel,
}: {
  gateway: HttpProjects;
  revision: number;
  canWrite: boolean;
  selection: {
    kind: 'project' | 'activity' | 'closure';
    project?: ProjectDto;
  } | null;
  select: (value: NonNullable<typeof selection>) => void;
  onCompleted: () => void;
  onCancel: () => void;
}) {
  const state = useApiQuery(gateway.overview, revision);
  return (
    <AsyncView state={state}>
      {(overview) => (
        <>
          {selection && (
            <Panel
              title={
                selection.kind === 'closure'
                  ? `Encerrar ${selection.project?.name}`
                  : selection.kind === 'activity'
                    ? 'Nova atividade'
                    : selection.project
                      ? 'Editar projeto'
                      : 'Novo projeto'
              }
            >
              {selection.kind === 'project' ? (
                <ProjectForm
                  gateway={gateway}
                  overview={overview}
                  project={selection.project}
                  onCompleted={onCompleted}
                  onCancel={onCancel}
                />
              ) : selection.kind === 'activity' ? (
                <ActivityForm
                  gateway={gateway}
                  overview={overview}
                  projectId={selection.project?.id}
                  onCompleted={onCompleted}
                  onCancel={onCancel}
                />
              ) : (
                selection.project && (
                  <ClosureForm
                    project
                    onCompleted={onCompleted}
                    onCancel={onCancel}
                    save={(data, key) =>
                      gateway.closeProject(
                        selection.project!.id,
                        {
                          expectedRevision: selection.project!.revision,
                          effectiveAt: instantValue(data, 'effectiveAt'),
                          reason: textValue(data, 'reason'),
                        },
                        key,
                      )
                    }
                  />
                )
              )}
            </Panel>
          )}
          {!overview.projects.length ? (
            <Panel>
              <Empty>Nenhum projeto cadastrado.</Empty>
            </Panel>
          ) : (
            <div className="project-list">
              {overview.projects.map((project, index) => (
                <ProjectGroup
                  key={project.id}
                  project={project}
                  activities={overview.activities.filter(
                    (activity) => activity.projectId === project.id,
                  )}
                  initiallyExpanded={index === 0}
                  metadata={
                    <p className="mb-4 text-sm">
                      {
                        overview.institutes.find(
                          (item) => item.id === project.instituteId,
                        )?.name
                      }{' '}
                      · Vigência: {project.startsOn ?? 'Início não informado'}{' '}
                      até {project.endsOn ?? 'Fim não informado'}
                      {project.closedAt
                        ? ` · Encerrado em ${displayInstant(project.closedAt)}`
                        : ''}
                    </p>
                  }
                  actions={
                    canWrite &&
                    !selection && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        <button
                          className="button secondary"
                          onClick={() => select({ kind: 'project', project })}
                        >
                          Editar projeto
                        </button>
                        {project.status === 'ACTIVE' && (
                          <>
                            <button
                              className="button secondary"
                              onClick={() =>
                                select({ kind: 'activity', project })
                              }
                            >
                              Nova atividade neste projeto
                            </button>
                            <button
                              className="button secondary"
                              onClick={() =>
                                select({ kind: 'closure', project })
                              }
                            >
                              Encerrar projeto
                            </button>
                          </>
                        )}
                      </div>
                    )
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </AsyncView>
  );
}
