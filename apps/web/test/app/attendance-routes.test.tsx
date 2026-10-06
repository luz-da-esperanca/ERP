// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { ConnectedApp } from '../../src/app/connected-app';
import { HttpErpClient } from '../../src/app/http-erp-client';
import { HttpAuthentication } from '../../src/access';
import { ApiClient } from '../../src/shared/api-client';
import { id, session, context } from '../support/attendance-fixtures';

afterEach(cleanup);
it.each(['api', 'client'] as const)(
  'navigates from an existing activity to encounters and an existing encounter detail through the %s client',
  async (composition) => {
    const user = userEvent.setup();
    const metadata = {
      id,
      revision: 1,
      createdAt: session.recordedAt,
      updatedAt: session.recordedAt,
      createdBy: id,
      updatedBy: id,
    };
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (path) => {
      const url = String(path);
      if (url.endsWith('/auth/session'))
        return Response.json({
          data: {
            user: {
              id,
              login: 'synthetic.operator',
              displayName: 'Operador Sintético',
              active: true,
              mustChangePassword: false,
              revision: 1,
              roleCodes: ['COORDINATION'],
              createdAt: session.recordedAt,
              updatedAt: session.recordedAt,
            },
            roles: ['COORDINATION'],
            capabilities: [
              'projects.read',
              'attendance.read',
              'participants.lookup',
            ],
          },
        });
      if (url.includes('/sessions/'))
        return Response.json({
          data: { session, attendances: [], context: { ...context, session } },
        });
      if (url.includes('/sessions?'))
        return Response.json({
          data: [session],
          pagination: { page: 1, pageSize: 20, total: 1 },
        });
      if (url.includes('/enrollments?'))
        return Response.json({
          data: [],
          pagination: { page: 1, pageSize: 100, total: 0 },
        });
      const asOf =
        new URL(url, 'http://localhost').searchParams.get('asOf') ??
        session.occurredAt;
      return Response.json({
        data: {
          activity: {
            ...metadata,
            projectId: id,
            name: 'Oficina Sintética',
            nature: 'PERIODIC',
            serviceTypeId: null,
            plannedSchedule: null,
            responsibleId: null,
            status: 'ACTIVE',
            closedAt: null,
          },
          project: {
            ...metadata,
            name: 'Projeto Sintético',
            instituteId: id,
            description: null,
            startsOn: null,
            endsOn: null,
            status: 'ACTIVE',
            closedAt: null,
          },
          asOf,
          participantCount: 0,
        },
      });
    });
    const api = new ApiClient(fetcher);
    render(
      <MemoryRouter initialEntries={['/activities/' + id]}>
        <ConnectedApp
          authentication={new HttpAuthentication(api)}
          {...(composition === 'api'
            ? { api }
            : { client: new HttpErpClient(api) })}
        />
      </MemoryRouter>,
    );
    await user.click(
      await screen.findByRole('link', { name: 'Encontros e frequência' }),
    );
    await user.click(await screen.findByRole('link', { name: 'Ver encontro' }));
    expect(
      await screen.findByRole('heading', { name: 'Detalhe do encontro' }),
    ).toBeTruthy();
    expect(screen.getAllByText('Não registrado').length).toBeGreaterThan(0);
    expect(fetcher.mock.calls.every((call) => call[1]?.method === 'GET')).toBe(
      true,
    );
  },
);
