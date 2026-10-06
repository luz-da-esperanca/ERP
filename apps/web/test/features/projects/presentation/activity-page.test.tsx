// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationError } from '@erp/contracts/common';
import type { ActivityDetail } from '@erp/contracts/projects';
import type { Role } from '@erp/contracts/access';
import { ErpProvider } from '../../../../src/app/erp-provider';
import { createDemoClient } from '../../../../src/demo/create-demo-client';
import { ActivityPage, ProjectsPage } from '../../../../src/projects';

const detail: ActivityDetail = {
  activity: {
    id: 'activity-1',
    projectId: 'project-1',
    name: 'Oficina de leitura',
    nature: 'PERIODIC',
    serviceTypeId: null,
    plannedSchedule: 'Terças e quintas, das 14h às 16h30',
    status: 'ACTIVE',
    closedAt: null,
    revision: 1,
  },
  project: {
    id: 'project-1',
    name: 'Projeto Luz',
    instituteId: 'institute-1',
    description: null,
    startsOn: null,
    endsOn: null,
    status: 'ACTIVE',
    closedAt: null,
    revision: 1,
  },
  participants: [],
};

function renderPage(
  load: (id: string, asOf: string) => Promise<ActivityDetail>,
  role: Role = 'COORDINATION',
) {
  const client = createDemoClient();
  const account = client.access
    .demoAccounts()
    .find((candidate) =>
      candidate.roles.some((candidateRole) => candidateRole === role),
    );
  if (!account) throw new Error('Demo account was not found');
  client.access.enterDemo(account.id);
  client.projects.getActivity = load;
  client.projects.overview = async () => ({
    projects: [detail.project],
    activities: [detail.activity],
    institutes: [],
    serviceTypes: [],
  });
  render(
    <ErpProvider client={client}>
      <MemoryRouter initialEntries={['/activities/activity-1']}>
        <Routes>
          <Route path="activities/:id" element={<ActivityPage />} />
          <Route path="projects" element={<ProjectsPage />} />
        </Routes>
      </MemoryRouter>
    </ErpProvider>,
  );
  return client;
}

afterEach(cleanup);

describe('ActivityPage', () => {
  it('replaces the enrollment context when navigating to another activity', async () => {
    const user = userEvent.setup();
    const secondActivity = {
      ...detail.activity,
      id: 'activity-2',
      name: 'Oficina de escrita',
    };
    const client = renderPage(async (id) => ({
      ...detail,
      activity: id === secondActivity.id ? secondActivity : detail.activity,
      participants: [
        {
          id: 'person-1',
          name: id === secondActivity.id ? 'Bruno Luz' : 'Ana Luz',
          familyCode: 'FAM-001',
          enrolled: true,
        },
      ],
    }));
    client.projects.overview = async () => ({
      projects: [detail.project],
      activities: [detail.activity, secondActivity],
      institutes: [],
      serviceTypes: [],
    });
    await screen.findByText('Ana Luz');
    await user.click(
      screen.getByRole('link', { name: /Projetos e atividades/ }),
    );
    const link = await screen.findByRole('link', { name: secondActivity.name });
    link.focus();
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('heading', { name: secondActivity.name }),
    ).toBeTruthy();
    expect(await screen.findByText('Bruno Luz')).toBeTruthy();
    expect(screen.queryByText('Ana Luz')).toBeNull();
  });
  it('uses the same reference instant for the activity query and the enrollment list', async () => {
    const load = vi.fn<(id: string, asOf: string) => Promise<ActivityDetail>>(
      async () => detail,
    );
    renderPage(load);
    await screen.findByRole('heading', { name: 'Inscrições da atividade' });
    const reference = document.querySelector('time');
    expect(reference?.getAttribute('datetime')).toBe(load.mock.calls[0]?.[1]);
    expect(load.mock.calls[0]?.[0]).toBe(detail.activity.id);
  });
  it('shows an empty enrollment state when nobody is enrolled without listing other people', async () => {
    renderPage(async () => ({
      ...detail,
      participants: [
        {
          id: 'person-1',
          name: 'Ana Luz',
          familyCode: 'FAM-001',
          enrolled: false,
        },
      ],
    }));
    expect(
      await screen.findByText('Nenhuma inscrição vigente na data consultada.'),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Ana Luz')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('preserves enrolled participants with an unavailable family without inventing a family', async () => {
    renderPage(async () => ({
      ...detail,
      participants: [
        { id: 'person-1', name: 'Ana Luz', familyCode: null, enrolled: true },
      ],
    }));
    const table = await screen.findByRole('table', {
      name: 'Inscrições da atividade',
    });
    expect(within(table).getByText('Ana Luz')).toBeTruthy();
    expect(
      within(table).getByText('Vínculo familiar não disponível'),
    ).toBeTruthy();
    expect(
      within(table).queryByRole('columnheader', { name: 'Data de início' }),
    ).toBeNull();
  });
  it('does not offer enrollment management for one-off activities', async () => {
    renderPage(async () => ({
      ...detail,
      activity: {
        ...detail.activity,
        nature: 'ONE_OFF',
        serviceTypeId: 'type-1',
      },
      participants: [
        {
          id: 'person-1',
          name: 'Ana Luz',
          familyCode: 'FAM-001',
          enrolled: true,
        },
      ],
    }));
    await screen.findByText('Atendimento único');
    expect(
      screen.queryByRole('heading', { name: 'Inscrições da atividade' }),
    ).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('lists only enrolled participants in the periodic activity with their family context at the query instant', async () => {
    renderPage(async () => ({
      ...detail,
      participants: [
        {
          id: 'person-1',
          name: 'Ana Luz',
          familyCode: 'FAM-001',
          enrolled: true,
        },
        {
          id: 'person-2',
          name: 'Bruno Luz',
          familyCode: null,
          enrolled: false,
        },
      ],
    }));
    const table = await screen.findByRole('table', {
      name: 'Inscrições da atividade',
    });
    expect(within(table).getByText('Ana Luz')).toBeTruthy();
    expect(within(table).getByText('FAM-001')).toBeTruthy();
    expect(
      within(table).getByRole('columnheader', { name: 'Família na consulta' }),
    ).toBeTruthy();
    expect(within(table).getByText('Vigente na consulta')).toBeTruthy();
    expect(screen.queryByText('Bruno Luz')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Inscrever participante/ }),
    ).toBeNull();
  });
  it('groups responsible and schedule values in the activity summary with explicit accessible labels', async () => {
    renderPage(async () => detail);
    await screen.findByRole('heading', { name: detail.activity.name });
    const summary = screen.getByRole('region', {
      name: 'Informações da atividade',
    });
    const schedule = within(summary).getByRole('definition', {
      name: 'Agenda planejada',
    });
    expect(schedule.textContent).toBe(detail.activity.plannedSchedule);
    const responsible = within(summary).getByRole('definition', {
      name: 'Responsável',
    });
    expect(
      responsible.compareDocumentPosition(schedule) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
  it('identifies the unavailable responsible query without assuming an unassigned activity', async () => {
    renderPage(async () => detail);
    await screen.findByRole('heading', { name: detail.activity.name });
    const term = screen.getByText('Responsável', { selector: 'dt' });
    expect(term.nextElementSibling?.textContent).toBe(
      'Consulta ainda não disponível',
    );
  });
  it.each([
    ['PERIODIC', 'A consulta de encontros ainda não está disponível.'],
    ['ONE_OFF', 'O registro de atendimentos não está disponível nesta etapa.'],
  ] as const)(
    'explains recent record unavailability for %s without claiming an empty history',
    async (nature, message) => {
      renderPage(async () => ({
        ...detail,
        activity: {
          ...detail.activity,
          nature,
          serviceTypeId: nature === 'ONE_OFF' ? 'type-1' : null,
        },
      }));
      expect(
        await screen.findByRole('heading', { name: 'Registros recentes' }),
      ).toBeTruthy();
      expect(screen.getByText(message)).toBeTruthy();
      expect(screen.queryByText('Nenhum registro encontrado.')).toBeNull();
    },
  );
  it('loads the activity and displays its project, nature, status and planned schedule', async () => {
    let resolveDetail!: (value: ActivityDetail) => void;
    renderPage(
      () =>
        new Promise((resolve) => {
          resolveDetail = resolve;
        }),
    );
    expect(screen.getByRole('status').textContent).toBe(
      'Carregando registros…',
    );
    resolveDetail(detail);
    expect(
      await screen.findByRole('heading', {
        name: 'Oficina de leitura',
        level: 1,
      }),
    ).toBeTruthy();
    expect(screen.getByText('Projeto Luz')).toBeTruthy();
    expect(screen.getByText('Atividade periódica')).toBeTruthy();
    expect(screen.getByText('Ativa')).toBeTruthy();
    expect(screen.getByText('Terças e quintas, das 14h às 16h30')).toBeTruthy();
  });
  it('keeps closed activities readable and identifies an unknown planned schedule', async () => {
    renderPage(async () => ({
      ...detail,
      activity: {
        ...detail.activity,
        status: 'CLOSED',
        closedAt: '2026-10-01T15:00:00Z',
        plannedSchedule: null,
      },
    }));
    expect(await screen.findByText('Encerrada')).toBeTruthy();
    expect(screen.getByText('Não informada')).toBeTruthy();
    expect(screen.getByText('01/10/2026, 12:00')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: detail.activity.name }),
    ).toBeTruthy();
  });
  it('shows the catalog label of a one-off activity even when its service type is inactive', async () => {
    const client = renderPage(async () => ({
      ...detail,
      activity: {
        ...detail.activity,
        nature: 'ONE_OFF',
        serviceTypeId: 'type-1',
      },
    }));
    client.projects.overview = async () => ({
      projects: [],
      activities: [],
      institutes: [],
      serviceTypes: [
        { id: 'type-1', name: 'Visita domiciliar', active: false },
      ],
    });
    expect(await screen.findByText('Atendimento único')).toBeTruthy();
    expect(await screen.findByText('Visita domiciliar')).toBeTruthy();
  });
  it('navigates back to projects and opens the activity from its name using the keyboard', async () => {
    const user = userEvent.setup();
    renderPage(async () => detail);
    await screen.findByRole('heading', { name: detail.activity.name });
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('link', { name: /Projetos e atividades/ }),
    );
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { name: 'Projetos e atividades' });
    const link = await screen.findByRole('link', {
      name: detail.activity.name,
    });
    expect(link.getAttribute('href')).toBe('/activities/activity-1');
    link.focus();
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('heading', { name: detail.activity.name }),
    ).toBeTruthy();
  });
  it.each([
    [
      'NOT_FOUND',
      'O registro não está disponível. Verifique a seleção e tente novamente.',
    ],
    ['FORBIDDEN', 'Seu perfil não permite esta operação.'],
    [
      'INTERNAL_ERROR',
      'Não foi possível concluir a operação. Tente novamente.',
    ],
  ] as const)(
    'shows the existing %s error state and preserves the return link',
    async (code, message) => {
      renderPage(async () => {
        throw new ApplicationError(code, 'Activity request failed');
      });
      expect((await screen.findByRole('alert')).textContent).toBe(message);
      expect(
        screen
          .getByRole('link', { name: /Projetos e atividades/ })
          .getAttribute('href'),
      ).toBe('/projects');
      expect(
        screen.queryByRole('heading', { name: detail.activity.name }),
      ).toBeNull();
    },
  );
  it('denies access without loading activity data when the profile lacks project read permission', async () => {
    const load = vi.fn(async () => detail);
    renderPage(load, 'ADMINISTRATOR');
    expect(screen.getByRole('alert').textContent).toBe(
      'Seu perfil não permite esta operação.',
    );
    expect(load).not.toHaveBeenCalled();
  });
});
