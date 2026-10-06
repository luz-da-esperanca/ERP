// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@erp/contracts/common';
import type { ProjectsOverview } from '@erp/contracts/projects';
import { ErpProvider } from '../../../../src/app/erp-provider';
import { createDemoClient } from '../../../../src/demo/create-demo-client';
import { ProjectsPage } from '../../../../src/projects';

const overview: ProjectsOverview = {
  institutes: [],
  serviceTypes: [],
  projects: [
    {
      id: 'project-1',
      name: 'Community project',
      instituteId: 'institute-1',
      description: null,
      startsOn: null,
      endsOn: null,
      status: 'ACTIVE',
      closedAt: null,
      revision: 1,
    },
  ],
  activities: [
    {
      id: 'activity-1',
      projectId: 'project-1',
      name: 'Reading workshop',
      nature: 'PERIODIC',
      serviceTypeId: null,
      plannedSchedule: null,
      status: 'ACTIVE',
      closedAt: null,
      revision: 1,
    },
  ],
};

function renderPage(
  load: () => Promise<ProjectsOverview>,
  role = 'COORDINATION',
) {
  const client = createDemoClient();
  const account = client.access
    .demoAccounts()
    .find((candidate) =>
      candidate.roles.some((candidateRole) => candidateRole === role),
    );
  if (!account) throw new Error('Demo account was not found');
  client.access.enterDemo(account.id);
  client.projects.overview = load;
  return render(
    <ErpProvider client={client}>
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>
    </ErpProvider>,
  );
}

describe('ProjectsPage', () => {
  afterEach(cleanup);

  it('shows planned creation actions with an accessible explanation even without projects', async () => {
    renderPage(async () => ({ ...overview, projects: [], activities: [] }));
    await screen.findByText('Nenhum projeto cadastrado.');
    const explanation = screen.getByText(
      'Cadastros de projetos e atividades em breve.',
    );
    for (const name of ['Novo projeto', 'Nova atividade']) {
      const button = screen.getByRole('button', { name });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(button.getAttribute('aria-describedby')).toBe(explanation.id);
    }
  });

  it('hides creation actions from profiles without project write permission', async () => {
    renderPage(async () => overview, 'ACTIVITY_MANAGER');
    await screen.findByText('Community project');
    expect(screen.queryByRole('button', { name: 'Novo projeto' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nova atividade' })).toBeNull();
    expect(
      screen.queryByText('Cadastros de projetos e atividades em breve.'),
    ).toBeNull();
  });

  it('loads projects and displays their activities using the existing contracts', async () => {
    let resolveOverview!: (data: ProjectsOverview) => void;
    renderPage(
      () =>
        new Promise((resolve) => {
          resolveOverview = resolve;
        }),
    );
    expect(screen.getByRole('status').textContent).toBe(
      'Carregando registros…',
    );
    resolveOverview(overview);
    expect(await screen.findByText('Community project')).toBeTruthy();
    expect(
      screen.getByRole('table', { name: 'Atividades de Community project' }),
    ).toBeTruthy();
    expect(screen.getByText('Reading workshop')).toBeTruthy();
    expect(screen.getByText('Atividade periódica')).toBeTruthy();
    expect(screen.getByText('Ativo')).toBeTruthy();
    expect(screen.getByText('Ativa')).toBeTruthy();
  });

  it('groups activities by project and preserves closed records and both natures', async () => {
    const user = userEvent.setup();
    renderPage(async () => ({
      ...overview,
      projects: [
        ...overview.projects,
        {
          ...overview.projects[0],
          id: 'project-2',
          name: 'Archived project',
          status: 'CLOSED',
          closedAt: '2026-10-01T12:00:00Z',
        },
      ],
      activities: [
        ...overview.activities,
        {
          ...overview.activities[0],
          id: 'activity-2',
          projectId: 'project-2',
          name: 'Community meeting',
          nature: 'ONE_OFF',
          serviceTypeId: 'type-1',
          status: 'CLOSED',
          closedAt: '2026-10-01T12:00:00Z',
        },
      ],
    }));
    const firstTable = await screen.findByRole('table', {
      name: 'Atividades de Community project',
    });
    expect(within(firstTable).queryByText('Community meeting')).toBeNull();
    expect(
      screen.queryByRole('table', { name: 'Atividades de Archived project' }),
    ).toBeNull();
    const toggle = screen.getByRole('button', { name: /Archived project/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    const secondTable = screen.getByRole('table', {
      name: 'Atividades de Archived project',
    });
    expect(within(secondTable).getByText('Community meeting')).toBeTruthy();
    expect(within(secondTable).getByText('Atendimento único')).toBeTruthy();
    expect(within(secondTable).getByText('Encerrada')).toBeTruthy();
    expect(within(secondTable).queryByText('Reading workshop')).toBeNull();
    expect(toggle.textContent).toContain('Encerrado');
  });

  it('collapses and expands activities with the keyboard', async () => {
    const user = userEvent.setup();
    renderPage(async () => overview);
    const toggle = await screen.findByRole('button', {
      name: /Community project/,
    });
    await user.tab();
    expect(document.activeElement).toBe(toggle);
    await user.keyboard('{Enter}');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('table')).toBeNull();
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('shows a project without activities as an empty group', async () => {
    renderPage(async () => ({ ...overview, activities: [] }));
    expect(
      await screen.findByText('Nenhuma atividade cadastrada neste projeto.'),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the empty state when there are no projects', async () => {
    renderPage(async () => ({ ...overview, projects: [], activities: [] }));
    expect(await screen.findByText('Nenhum projeto cadastrado.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows query errors using the shared feedback', async () => {
    renderPage(async () => {
      throw new Error('Unable to load projects');
    });
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não foi possível concluir a operação. Tente novamente.',
    );
    expect(screen.queryByText('Nenhum projeto cadastrado.')).toBeNull();
  });

  it('shows permission denied when the gateway rejects the query', async () => {
    renderPage(async () => {
      throw new ApplicationError('FORBIDDEN', 'Access denied');
    });
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Seu perfil não permite esta operação.',
    );
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('does not query projects when the current profile lacks read permission', () => {
    const load = vi.fn(async () => overview);
    renderPage(load, 'ADMINISTRATOR');
    expect(screen.getByRole('alert').textContent).toBe(
      'Seu perfil não permite esta operação.',
    );
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Novo projeto' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Nova atividade' })).toBeNull();
  });
});
