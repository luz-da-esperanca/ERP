import { useState } from 'react';
import type { ProjectDto, ActivityDto } from '@erp/contracts/projects-api';
import type { HttpProjects } from '../infra/http-projects';
import { toInstant } from '../../../shared/time';
import { useApiQuery } from '../../../shared/use-query';
import {
  AsyncView,
  Field,
  SelectField,
  nullableValue,
  textValue,
} from '../../../shared/ui';
import { ManagementForm } from './management-form';

export type Overview = Awaited<ReturnType<HttpProjects['overview']>>;
type FormProps = {
  gateway: HttpProjects;
  overview: Overview;
  onCompleted: () => void;
  onCancel: () => void;
};
export function ProjectForm({
  gateway,
  overview,
  project,
  onCompleted,
  onCancel,
}: FormProps & { project?: ProjectDto }) {
  return (
    <ManagementForm
      onCompleted={onCompleted}
      onCancel={onCancel}
      save={(data, key) => {
        const input = {
          name: textValue(data, 'name'),
          instituteId: textValue(data, 'instituteId'),
          description: nullableValue(data, 'description'),
          startsOn: nullableValue(data, 'startsOn'),
          endsOn: nullableValue(data, 'endsOn'),
        };
        return project
          ? gateway.updateProject(
              project.id,
              { ...input, expectedRevision: project.revision },
              key,
            )
          : gateway.createProject(input, key);
      }}
    >
      <Field
        autoFocus
        label="Nome"
        name="name"
        required
        maxLength={200}
        defaultValue={project?.name}
      />
      <SelectField
        label="Instituto"
        name="instituteId"
        required
        defaultValue={project?.instituteId ?? ''}
      >
        <option value="">Selecione</option>
        {overview.institutes
          .filter((item) => item.active || item.id === project?.instituteId)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {!item.active ? ' (inativo)' : ''}
            </option>
          ))}
      </SelectField>
      <Field
        label="Descrição"
        name="description"
        maxLength={4000}
        defaultValue={project?.description ?? ''}
      />
      <Field
        label="Início do projeto"
        name="startsOn"
        type="date"
        defaultValue={project?.startsOn ?? ''}
      />
      <Field
        label="Fim do projeto"
        name="endsOn"
        type="date"
        defaultValue={project?.endsOn ?? ''}
      />
    </ManagementForm>
  );
}
export function ActivityForm({
  gateway,
  overview,
  activity,
  projectId,
  onCompleted,
  onCancel,
}: FormProps & { activity?: ActivityDto; projectId?: string }) {
  const [nature, setNature] = useState(activity?.nature ?? 'PERIODIC');
  const responsible = useApiQuery(gateway.responsible);
  return (
    <ManagementForm
      onCompleted={onCompleted}
      onCancel={onCancel}
      save={(data, key) => {
        const selectedProjectId = textValue(data, 'projectId');
        const project = overview.projects.find(
          (item) => item.id === selectedProjectId,
        );
        if (!project) throw new Error('Project selection is required');
        const input = {
          name: textValue(data, 'name'),
          nature,
          serviceTypeId:
            nature === 'PERIODIC' ? null : nullableValue(data, 'serviceTypeId'),
          plannedSchedule: nullableValue(data, 'plannedSchedule'),
          responsibleId: nullableValue(data, 'responsibleId'),
        };
        return activity
          ? gateway.updateActivity(
              activity.id,
              {
                ...input,
                ...(selectedProjectId === activity.projectId
                  ? {}
                  : { projectId: selectedProjectId }),
                expectedRevision: activity.revision,
              },
              key,
            )
          : gateway.createActivity(
              selectedProjectId,
              { ...input, expectedProjectRevision: project.revision },
              key,
            );
      }}
    >
      <Field
        autoFocus
        label="Nome"
        name="name"
        required
        maxLength={200}
        defaultValue={activity?.name}
      />
      <SelectField
        label="Projeto"
        name="projectId"
        disabled={activity?.status === 'CLOSED'}
        required
        defaultValue={activity?.projectId ?? projectId ?? ''}
      >
        <option value="">Selecione</option>
        {overview.projects
          .filter(
            (item) =>
              item.status === 'ACTIVE' || item.id === activity?.projectId,
          )
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
      </SelectField>
      {activity?.status === 'CLOSED' && (
        <input type="hidden" name="projectId" value={activity.projectId} />
      )}
      <SelectField
        disabled={activity?.status === 'CLOSED'}
        label="Natureza"
        name="nature"
        value={nature}
        onChange={(event) =>
          setNature(event.target.value === 'ONE_OFF' ? 'ONE_OFF' : 'PERIODIC')
        }
      >
        <option value="PERIODIC">Atividade periódica</option>
        <option value="ONE_OFF">Atendimento único</option>
      </SelectField>
      {nature === 'ONE_OFF' && (
        <SelectField
          label="Tipo de atendimento"
          name="serviceTypeId"
          required
          defaultValue={activity?.serviceTypeId ?? ''}
        >
          <option value="">Selecione</option>
          {overview.serviceTypes
            .filter(
              (item) => item.active || item.id === activity?.serviceTypeId,
            )
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {!item.active ? ' (inativo)' : ''}
              </option>
            ))}
        </SelectField>
      )}
      <Field
        label="Agenda planejada"
        name="plannedSchedule"
        maxLength={500}
        defaultValue={activity?.plannedSchedule ?? ''}
      />
      <AsyncView state={responsible}>
        {(items) => (
          <SelectField
            label="Responsável"
            name="responsibleId"
            defaultValue={activity?.responsibleId ?? ''}
          >
            <option value="">Não informado</option>
            {activity?.responsibleId &&
              !items.some((item) => item.id === activity.responsibleId) && (
                <option value={activity.responsibleId}>
                  Responsável registrado
                </option>
              )}
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </SelectField>
        )}
      </AsyncView>
      {responsible.status !== 'success' && (
        <input
          type="hidden"
          name="responsibleId"
          value={activity?.responsibleId ?? ''}
        />
      )}
      <p className="muted">
        A natureza e o projeto só podem mudar quando o histórico permitir.
      </p>
    </ManagementForm>
  );
}
export const instantValue = (data: FormData, name: string) => {
  const value = textValue(data, name);
  return value.length === 16
    ? toInstant(value)
    : new Date(`${value}-03:00`).toISOString();
};
export function ClosureForm({
  save,
  onCompleted,
  onCancel,
  project = false,
}: {
  save: (data: FormData, key: string) => Promise<unknown>;
  onCompleted: () => void;
  onCancel: () => void;
  project?: boolean;
}) {
  return (
    <ManagementForm
      save={save}
      onCompleted={onCompleted}
      onCancel={onCancel}
      submitLabel="Confirmar encerramento"
    >
      <p>
        {project
          ? 'O encerramento alcança atividades ainda ativas e suas inscrições vigentes no corte.'
          : 'O encerramento termina as inscrições vigentes no corte.'}{' '}
        O histórico será preservado.
      </p>
      <Field
        autoFocus
        label="Data e hora do encerramento (Fortaleza)"
        name="effectiveAt"
        type="datetime-local"
        required
      />
      <Field label="Motivo" name="reason" required maxLength={1000} />
    </ManagementForm>
  );
}
