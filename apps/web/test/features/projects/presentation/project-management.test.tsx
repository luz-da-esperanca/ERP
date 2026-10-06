// @vitest-environment jsdom
import {
  ProjectForm,
  HttpProjects,
  ManagedProjectsPage,
  EnrollmentManagement,
  ManagedActivityPage,
} from '../../../../src/projects';
import type { EnrollmentDto, ProjectDto } from '@erp/contracts/projects-api';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiClient } from '../../../../src/shared/api-client';

afterEach(cleanup);
it('keeps the project command and key when retrying an uncertain write', async () => {
  const user = userEvent.setup();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error('Lost response'));
  render(
    <ProjectForm
      gateway={new HttpProjects(new ApiClient(fetcher))}
      overview={{
        projects: [],
        activities: [],
        serviceTypes: [],
        institutes: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            code: 'CHARITY',
            name: 'Caridade',
            active: true,
            revision: 1,
          },
        ],
      }}
      onCompleted={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText(/^Nome/), 'Projeto sintético');
  await user.selectOptions(
    screen.getByLabelText(/^Instituto/),
    '00000000-0000-4000-8000-000000000001',
  );
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Repetir solicitação' }));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0]).toEqual(fetcher.mock.calls[1]);
  expect(screen.getByLabelText(/^Nome/).matches(':disabled')).toBe(true);
});

const id = '00000000-0000-4000-8000-000000000001';
const project: ProjectDto = {
  id,
  name: 'Projeto sintético',
  instituteId: id,
  description: null,
  startsOn: null,
  endsOn: null,
  status: 'ACTIVE',
  closedAt: null,
  revision: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: id,
  updatedBy: id,
};
it('edits a project through the existing list and reloads its current status', async () => {
  const user = userEvent.setup();
  let current = project;
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (path, options) => {
      if (options?.method === 'PATCH') {
        current = { ...current, name: 'Nome corrigido', revision: 4 };
        return Response.json({ data: current });
      }
      const data = String(path).includes('/projects?')
        ? [current]
        : String(path).includes('/institutes?')
          ? [
              {
                id,
                code: 'CHARITY',
                name: 'Caridade',
                active: true,
                revision: 1,
              },
            ]
          : [];
      return Response.json({
        data,
        pagination: { page: 1, pageSize: 100, total: data.length },
      });
    });
  render(
    <MemoryRouter>
      <ManagedProjectsPage
        gateway={new HttpProjects(new ApiClient(fetcher))}
        capabilities={['projects.read', 'projects.write']}
      />
    </MemoryRouter>,
  );
  await user.click(
    await screen.findByRole('button', { name: 'Editar projeto' }),
  );
  await user.clear(screen.getByLabelText(/^Nome/));
  await user.type(screen.getByLabelText(/^Nome/), 'Nome corrigido');
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(
    await screen.findByRole('button', { name: /Nome corrigido/ }),
  ).toBeTruthy();
  const write = fetcher.mock.calls.find((call) => call[1]?.method === 'PATCH');
  expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({
    expectedRevision: 3,
    name: 'Nome corrigido',
  });
});

it('shows ended intervals in history and corrects enrollment dates without recording attendance', async () => {
  const user = userEvent.setup();
  const interval = {
    id,
    activityId: id,
    personId: id,
    validFrom: '2026-01-01T12:00:00.123Z',
    validUntil: '2026-01-02T12:00:00.000Z',
    supersededById: null,
    revision: 3,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    createdBy: id,
    updatedBy: id,
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (path, options) => {
      if (options?.method === 'PATCH')
        return Response.json({ data: { ...interval, revision: 4 } });
      const data = String(path).includes('asOf=')
        ? []
        : [
            {
              enrollment: interval,
              person: {
                id,
                name: 'Pessoa sintética',
                family: { id, code: '1' },
              },
            },
          ];
      return Response.json({
        data,
        pagination: { page: 1, pageSize: 100, total: data.length },
      });
    });
  render(
    <EnrollmentManagement
      gateway={new HttpProjects(new ApiClient(fetcher))}
      activity={{
        ...project,
        projectId: id,
        nature: 'PERIODIC',
        serviceTypeId: null,
        plannedSchedule: null,
        responsibleId: null,
      }}
      asOf="2026-01-03T12:00:00.000Z"
      revision={0}
      canWrite
      onCompleted={vi.fn()}
    />,
  );
  await screen.findByText('Nenhuma inscrição vigente na data consultada.');
  await user.click(
    screen.getByRole('button', { name: 'Histórico de inscrições' }),
  );
  await user.click(
    await screen.findByRole('button', {
      name: 'Corrigir inscrição de Pessoa sintética',
    }),
  );
  await user.type(screen.getByLabelText(/^Motivo/), 'Correção sintética');
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  const write = fetcher.mock.calls.find((call) => call[1]?.method === 'PATCH');
  expect(write?.[0]).toBe('/api/v1/enrollments/' + id);
  expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({
    expectedRevision: 3,
    reason: 'Correção sintética',
    validFrom: '2026-01-01T12:00:00.123Z',
  });
  expect(
    fetcher.mock.calls.every((call) => !String(call[0]).includes('attendance')),
  ).toBe(true);
});

it('does not offer enrollment for one-off activities and closes an activity with its revision', async () => {
  const user = userEvent.setup();
  const activity = {
    id,
    name: project.name,
    projectId: id,
    nature: 'ONE_OFF',
    serviceTypeId: id,
    plannedSchedule: null,
    responsibleId: null,
    status: 'ACTIVE',
    closedAt: null,
    revision: 3,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    createdBy: id,
    updatedBy: id,
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (path, options) => {
      if (options?.method === 'POST')
        return Response.json({
          data: {
            activity: {
              ...activity,
              status: 'CLOSED',
              closedAt: '2026-01-02T12:00:00.000Z',
              revision: 4,
            },
            enrollments: [],
          },
        });
      if (String(path).includes('/activities/' + id))
        return Response.json({
          data: {
            activity,
            project,
            asOf: '2026-01-03T12:00:00.000Z',
            participantCount: 0,
          },
        });
      return Response.json({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 0 },
      });
    });
  render(
    <MemoryRouter>
      <ManagedActivityPage
        id={id}
        gateway={new HttpProjects(new ApiClient(fetcher))}
        capabilities={['projects.read', 'projects.write']}
      />
    </MemoryRouter>,
  );
  await user.click(
    await screen.findByRole('button', { name: 'Encerrar atividade' }),
  );
  expect(
    screen.queryByRole('button', { name: 'Cadastrar participante' }),
  ).toBeNull();
  const date = screen.getByLabelText(/^Data e hora/);
  fireEvent.change(date, { target: { value: '2026-01-02T12:00' } });
  await user.type(screen.getByLabelText(/^Motivo/), 'Encerramento sintético');
  await user.click(
    screen.getByRole('button', { name: 'Confirmar encerramento' }),
  );
  const write = fetcher.mock.calls.find((call) => call[1]?.method === 'POST');
  expect(write?.[0]).toBe('/api/v1/activities/' + id + '/closure');
  expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({
    expectedRevision: 3,
    reason: 'Encerramento sintético',
  });
});

it('explains domain conflicts without retrying or changing history automatically', async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json(
      {
        error: {
          code: 'DOMAIN_CONFLICT',
          requestId: 'test',
          details: { rule: 'PROJECT_PERIOD_CONFLICT', ids: [id] },
        },
      },
      { status: 409 },
    ),
  );
  render(
    <ProjectForm
      gateway={new HttpProjects(new ApiClient(fetcher))}
      overview={{
        projects: [],
        activities: [],
        serviceTypes: [],
        institutes: [
          { id, code: 'CHARITY', name: 'Caridade', active: true, revision: 1 },
        ],
      }}
      project={project}
      onCompleted={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  expect((await screen.findByRole('alert')).textContent).toBe(
    'A vigência informada conflita com inscrições ou encontros. Revise as datas e os registros indicados.',
  );
  expect(screen.getByText('Registros para revisão: ' + id + '.')).toBeTruthy();
  expect(fetcher).toHaveBeenCalledOnce();
});

it('does not fetch protected projects without read access', () => {
  const fetcher = vi.fn<typeof fetch>();
  render(
    <MemoryRouter>
      <ManagedProjectsPage
        gateway={new HttpProjects(new ApiClient(fetcher))}
        capabilities={[]}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole('alert').textContent).toBe(
    'Seu perfil não permite esta operação.',
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it('does not report a canceled enrollment form as saved', async () => {
  const user = userEvent.setup();
  const completed = vi.fn();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      data: [],
      pagination: { page: 1, pageSize: 100, total: 0 },
    }),
  );
  render(
    <EnrollmentManagement
      gateway={new HttpProjects(new ApiClient(fetcher))}
      activity={{
        id,
        name: 'Oficina sintética',
        projectId: id,
        nature: 'PERIODIC',
        serviceTypeId: null,
        plannedSchedule: null,
        responsibleId: null,
        status: 'ACTIVE',
        closedAt: null,
        revision: 3,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        createdBy: id,
        updatedBy: id,
      }}
      asOf="2026-01-03T12:00:00.000Z"
      revision={0}
      canWrite
      onCompleted={completed}
    />,
  );
  await user.click(
    screen.getByRole('button', { name: 'Cadastrar participante' }),
  );
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(completed).not.toHaveBeenCalled();
});

it('requires explicit review after a revision conflict', async () => {
  const user = userEvent.setup();
  const refresh = vi.fn();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json(
        { error: { code: 'REVISION_CONFLICT', requestId: 'test' } },
        { status: 409 },
      ),
    );
  render(
    <ProjectForm
      gateway={new HttpProjects(new ApiClient(fetcher))}
      overview={{
        projects: [],
        activities: [],
        serviceTypes: [],
        institutes: [
          { id, code: 'CHARITY', name: 'Caridade', active: true, revision: 1 },
        ],
      }}
      project={project}
      onCompleted={vi.fn()}
      onCancel={refresh}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Atualizar e revisar' }));
  expect(refresh).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledOnce();
});

it('selects an existing person, creates a dated enrollment and closes it without deleting its history', async () => {
  const user = userEvent.setup();
  const activity = {
    id,
    name: 'Oficina sintética',
    projectId: id,
    nature: 'PERIODIC' as const,
    serviceTypeId: null,
    plannedSchedule: null,
    responsibleId: null,
    status: 'ACTIVE' as const,
    closedAt: null,
    revision: 3,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    createdBy: id,
    updatedBy: id,
  };
  let interval: EnrollmentDto | null = null;
  const person = { id, name: 'Pessoa sintética', family: { id, code: '1' } };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (path, options) => {
      if (options?.method === 'POST') {
        const input = JSON.parse(String(options.body));
        interval = {
          id,
          activityId: id,
          personId: id,
          validFrom: input.validFrom ?? interval!.validFrom,
          validUntil: input.validUntil ?? null,
          supersededById: null,
          revision: interval ? 2 : 1,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          createdBy: id,
          updatedBy: id,
        };
        return Response.json({ data: interval });
      }
      const data = String(path).includes('/people?')
        ? [person]
        : interval
          ? [{ enrollment: interval, person }]
          : [];
      return Response.json({
        data,
        pagination: { page: 1, pageSize: 100, total: data.length },
      });
    });
  render(
    <EnrollmentManagement
      gateway={new HttpProjects(new ApiClient(fetcher))}
      activity={activity}
      asOf="2026-01-03T12:00:00.000Z"
      revision={0}
      canWrite
      onCompleted={vi.fn()}
    />,
  );
  await user.click(
    screen.getByRole('button', { name: 'Cadastrar participante' }),
  );
  await user.type(screen.getByLabelText(/^Buscar pessoa/), 'Pessoa');
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await screen.findByRole('option', { name: /Pessoa sintética/ });
  await user.selectOptions(screen.getByLabelText(/^Participante/), id);
  fireEvent.change(screen.getByLabelText(/^Início da inscrição/), {
    target: { value: '2026-01-01T09:00' },
  });
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  await user.click(
    await screen.findByRole('button', {
      name: 'Encerrar inscrição de Pessoa sintética',
    }),
  );
  fireEvent.change(screen.getByLabelText(/^Fim da inscrição/), {
    target: { value: '2026-01-02T09:00' },
  });
  await user.type(screen.getByLabelText(/^Motivo/), 'Saída sintética');
  await user.click(
    screen.getByRole('button', { name: 'Confirmar encerramento' }),
  );
  const writes = fetcher.mock.calls.filter(
    (call) => call[1]?.method === 'POST',
  );
  expect(writes.map((call) => call[0])).toEqual([
    '/api/v1/activities/' + id + '/enrollments',
    '/api/v1/enrollments/' + id + '/closure',
  ]);
  expect(JSON.parse(String(writes[0]?.[1]?.body))).toEqual({
    expectedActivityRevision: 3,
    personId: id,
    validFrom: '2026-01-01T12:00:00.000Z',
    validUntil: null,
  });
  expect(JSON.parse(String(writes[1]?.[1]?.body))).toEqual({
    expectedRevision: 1,
    validUntil: '2026-01-02T12:00:00.000Z',
    reason: 'Saída sintética',
  });
});

it('creates and edits an activity using project and activity revisions', async () => {
  const user = userEvent.setup();
  let activity = {
    id,
    name: 'Oficina sintética',
    projectId: id,
    nature: 'PERIODIC' as const,
    serviceTypeId: null,
    plannedSchedule: null,
    responsibleId: null,
    status: 'ACTIVE' as const,
    closedAt: null,
    revision: 1,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    createdBy: id,
    updatedBy: id,
  };
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async (path, options) => {
      if (options?.method === 'POST') return Response.json({ data: activity });
      if (options?.method === 'PATCH') {
        activity = { ...activity, name: 'Oficina corrigida', revision: 2 };
        return Response.json({ data: activity });
      }
      if (String(path).includes('/activities/' + id + '?'))
        return Response.json({
          data: {
            activity,
            project,
            asOf: '2026-01-03T12:00:00.000Z',
            participantCount: 0,
          },
        });
      const data = String(path).includes('/projects?') ? [project] : [];
      return Response.json({
        data,
        pagination: { page: 1, pageSize: 100, total: data.length },
      });
    });
  const gateway = new HttpProjects(new ApiClient(fetcher));
  const view = render(
    <MemoryRouter>
      <ManagedProjectsPage
        gateway={gateway}
        capabilities={['projects.read', 'projects.write']}
      />
    </MemoryRouter>,
  );
  await user.click(
    await screen.findByRole('button', { name: 'Nova atividade' }),
  );
  await user.type(await screen.findByLabelText(/^Nome/), 'Oficina sintética');
  await user.selectOptions(
    screen.getByRole('combobox', { name: /^Projeto/ }),
    id,
  );
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  await screen.findByText('Alteração salva.');
  const create = fetcher.mock.calls.find((call) => call[1]?.method === 'POST');
  expect(create?.[0]).toBe('/api/v1/projects/' + id + '/activities');
  expect(JSON.parse(String(create?.[1]?.body))).toMatchObject({
    expectedProjectRevision: 3,
    name: 'Oficina sintética',
    nature: 'PERIODIC',
    serviceTypeId: null,
  });
  view.unmount();
  render(
    <MemoryRouter>
      <ManagedActivityPage
        id={id}
        gateway={gateway}
        capabilities={['projects.read', 'projects.write']}
      />
    </MemoryRouter>,
  );
  await user.click(
    await screen.findByRole('button', { name: 'Editar atividade' }),
  );
  const field = await screen.findByLabelText(/^Nome/);
  await user.clear(field);
  await user.type(field, 'Oficina corrigida');
  await user.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(
    await screen.findByRole('heading', { name: 'Oficina corrigida', level: 1 }),
  ).toBeTruthy();
  const edit = fetcher.mock.calls.find((call) => call[1]?.method === 'PATCH');
  expect(edit?.[0]).toBe('/api/v1/activities/' + id);
  expect(JSON.parse(String(edit?.[1]?.body))).toMatchObject({
    expectedRevision: 1,
    name: 'Oficina corrigida',
  });
});
