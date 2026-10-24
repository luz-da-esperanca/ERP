import { DEFAULT_PAGINATION, type Pagination } from '../../shared/pagination.ts';
import type { Prisma } from '../../../server/generated/prisma/client.ts';
import type { ProjectFilter } from '../application/projects-service.ts';
import type { ProjectsRepositoryPort } from '../application/projects-service.ts';
import type {
  InstituteCode,
  InstituteView,
  ProjectRecord,
  ProjectStatus,
} from '../domain/project-types.ts';

interface PrismaProjectWithInstitutes {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly closedAt: Date | null;
  readonly institutes: ReadonlyArray<{ readonly instituteId: string }>;
}

function mapProjectRow(row: PrismaProjectWithInstitutes): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status as ProjectStatus,
    instituteIds: row.institutes.map((link) => link.instituteId),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
  };
}

export class PrismaProjectsRepository implements ProjectsRepositoryPort {
  private readonly client: Prisma.TransactionClient;

  constructor(client: Prisma.TransactionClient) {
    this.client = client;
  }

  async listInstitutes(): Promise<readonly InstituteView[]> {
    const rows = await this.client.institute.findMany({
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code as InstituteCode,
      name: row.name,
      description: row.description,
      active: row.active,
    }));
  }

  async listProjects(filter?: ProjectFilter, pagination: Pagination = DEFAULT_PAGINATION): Promise<readonly ProjectRecord[]> {
    const rows = await this.client.project.findMany({
      where: this.buildFilter(filter),
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: {
        institutes: {
          orderBy: { instituteId: 'asc' },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => mapProjectRow(row));
  }

  async findProjectById(id: string): Promise<ProjectRecord | null> {
    const row = await this.client.project.findUnique({
      where: { id },
      include: {
        institutes: {
          orderBy: { instituteId: 'asc' },
        },
      },
    });
    return row ? mapProjectRow(row) : null;
  }

  async createProject(record: ProjectRecord): Promise<ProjectRecord> {
    const linkedAt = new Date(record.createdAt);
    const created = await this.client.project.create({
      data: {
        id: record.id,
        name: record.name,
        description: record.description,
        startDate: record.startDate,
        endDate: record.endDate,
        status: record.status,
        version: record.version,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        closedAt: record.closedAt ? new Date(record.closedAt) : null,
        institutes: {
          create: record.instituteIds.map((instituteId) => ({
            instituteId,
            linkedAt,
          })),
        },
      },
      include: {
        institutes: {
          orderBy: { instituteId: 'asc' },
        },
      },
    });
    return mapProjectRow(created);
  }

  async updateProject(
    record: ProjectRecord,
    expectedVersion: number,
  ): Promise<ProjectRecord | null> {
    const tx = this.client;
    const updatedCount = await tx.project.updateMany({
      where: { id: record.id, version: expectedVersion },
      data: {
        name: record.name,
        description: record.description,
        startDate: record.startDate,
        endDate: record.endDate,
        status: record.status,
        version: record.version,
        updatedAt: new Date(record.updatedAt),
        closedAt: record.closedAt ? new Date(record.closedAt) : null,
      },
    });
    if (updatedCount.count === 0) {
      return null;
    }

    await tx.projectInstitute.deleteMany({
      where: { projectId: record.id },
    });

    const linkedAt = new Date(record.updatedAt);
    for (const instituteId of record.instituteIds) {
      await tx.projectInstitute.create({
        data: {
          projectId: record.id,
          instituteId,
          linkedAt,
        },
      });
    }

    const fresh = await tx.project.findUnique({
      where: { id: record.id },
      include: {
        institutes: {
          orderBy: { instituteId: 'asc' },
        },
      },
    });
    return fresh ? mapProjectRow(fresh) : null;
  }
  async countProjects(filter?: ProjectFilter): Promise<number> {
    return this.client.project.count({ where: this.buildFilter(filter) });
  }

  private buildFilter(filter?: ProjectFilter): Prisma.ProjectWhereInput {
    const search = filter?.search?.trim();
    return {
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.instituteId
          ? { institutes: { some: { instituteId: filter.instituteId } } }
          : {}),
        ...(search
          ? { name: { contains: search, mode: 'insensitive' } }
          : {}),

    };
  }
}
