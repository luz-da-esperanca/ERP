import { describe, expect, it, vi } from 'vitest';
import { HttpProjects } from '../../../../src/projects';
import { ApiClient } from '../../../../src/shared/api-client';

const ids = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
];
const metadata = {
  revision: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: ids[0],
  updatedBy: ids[0],
};
const project = {
  ...metadata,
  id: ids[0],
  name: 'Synthetic project',
  instituteId: ids[1],
  description: null,
  startsOn: null,
  endsOn: null,
  status: 'ACTIVE',
  closedAt: null,
};
const activity = {
  ...metadata,
  id: ids[1],
  name: 'Synthetic activity',
  projectId: ids[0],
  nature: 'PERIODIC',
  serviceTypeId: null,
  plannedSchedule: null,
  responsibleId: null,
  status: 'ACTIVE',
  closedAt: null,
};

describe('HTTP projects', () => {
  it('creates and edits projects using caller revisions and keys, preserving the key after network uncertainty', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json({ data: project }, { status: 201 }),
      );
    const onChange = vi.fn();
    const projects = new HttpProjects(new ApiClient(fetcher), onChange);
    const key = '00000000-0000-4000-8000-000000000010';
    const input = {
      name: 'Synthetic project',
      instituteId: ids[1]!,
      description: null,
      startsOn: null,
      endsOn: null,
    };
    await projects.createProject(input, key);
    expect(fetcher.mock.lastCall?.[0]).toBe('/api/v1/projects');
    expect(fetcher.mock.lastCall?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'Idempotency-Key': key },
    });
    fetcher.mockRejectedValueOnce(new TypeError('Lost response'));
    await expect(
      projects.updateProject(ids[0]!, { ...input, expectedRevision: 1 }, key),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await projects.updateProject(
      ids[0]!,
      { ...input, expectedRevision: 1 },
      key,
    );
    expect(fetcher.mock.calls[1]?.[1]).toEqual(fetcher.mock.calls[2]?.[1]);
    expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toMatchObject({
      expectedRevision: 1,
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('loads projects, activities and catalogs from their public paginated endpoints', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      const data = url.pathname.endsWith('/projects')
        ? [project]
        : url.pathname.endsWith('/activities')
          ? [activity]
          : [
              {
                id: ids[1],
                code: 'SYNTHETIC',
                name: 'Synthetic catalog',
                active: true,
                revision: 1,
              },
            ];
      return Response.json({
        data,
        pagination: { page: 1, pageSize: 100, total: 1 },
      });
    });
    const overview = await new HttpProjects(new ApiClient(fetcher)).overview();
    expect(overview.projects[0]?.name).toBe('Synthetic project');
    expect(overview.activities[0]?.name).toBe('Synthetic activity');
    expect(overview.institutes[0]?.code).toBe('SYNTHETIC');
    expect(overview.serviceTypes[0]?.active).toBe(true);
  });

  it('loads every page of enrollment identities at the same reference without requesting personal registration data', async () => {
    const at = '2026-10-05T12:00:00.000Z';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (value) => {
      const url = new URL(String(value), 'http://localhost');
      if (!url.pathname.endsWith('/enrollments'))
        return Response.json({
          data: { project, activity, asOf: at, participantCount: 2 },
        });
      const page = Number(url.searchParams.get('page'));
      const personId = page === 1 ? ids[1] : ids[2];
      return Response.json({
        data: [
          {
            enrollment: {
              ...metadata,
              id: personId,
              personId,
              activityId: ids[1],
              validFrom: metadata.createdAt,
              validUntil: null,
              supersededById: null,
            },
            person: {
              id: personId,
              name: `Synthetic participant ${page}`,
              family: { id: ids[0], code: '1' },
            },
          },
        ],
        pagination: { page, pageSize: 1, total: 2 },
      });
    });
    const detail = await new HttpProjects(new ApiClient(fetcher)).getActivity(
      ids[1]!,
      at,
    );
    expect(detail.participants.map((person) => person.name)).toEqual([
      'Synthetic participant 1',
      'Synthetic participant 2',
    ]);
    expect(detail.participants[0]).toMatchObject({
      familyCode: '1',
      enrolled: true,
    });
    expect(
      fetcher.mock.calls.every(([url]) =>
        String(url).includes(encodeURIComponent(at)),
      ),
    ).toBe(true);
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes('/people')),
    ).toBe(false);
  });
});

const id = '00000000-0000-4000-8000-000000000001';
describe('Projects HTTP management', () => {
  it('sends closure as a dated command with revision, reason and the supplied retry key', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: { code: 'REVISION_CONFLICT', requestId: 'test' } },
          { status: 409 },
        ),
      );
    const gateway = new HttpProjects(new ApiClient(fetcher));
    const input = {
      expectedRevision: 3,
      effectiveAt: '2026-01-02T12:00:00.000Z',
      reason: 'Synthetic closure',
    };
    await expect(gateway.closeProject(id, input, id)).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
    expect(fetcher.mock.lastCall).toEqual([
      '/api/v1/projects/' + id + '/closure',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(input),
        headers: expect.objectContaining({ 'Idempotency-Key': id }),
      }),
    ]);
  });
});
it('updates catalogs with a reason and revision, and rejects incomplete server pagination', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json(
        { error: { code: 'REVISION_CONFLICT', requestId: 'catalog' } },
        { status: 409 },
      ),
    );
  const gateway = new HttpProjects(new ApiClient(fetcher));
  await expect(
    gateway.updateInstitute(
      ids[1]!,
      {
        expectedRevision: 3,
        active: false,
        reason: 'Synthetic catalog correction',
      },
      ids[0]!,
    ),
  ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
  expect(fetcher.mock.lastCall?.[0]).toBe(`/api/v1/institutes/${ids[1]}`);
  fetcher.mockImplementation(async () =>
    Response.json({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 21 },
    }),
  );
  await expect(gateway.enrollments(ids[1]!)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});
it('rejects an empty final page that claims existing records instead of silently returning an incomplete list', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({
        data: [],
        pagination: { page: 1, pageSize: 100, total: 1 },
      }),
    );
  await expect(
    new HttpProjects(new ApiClient(fetcher)).enrollments(ids[1]!),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
