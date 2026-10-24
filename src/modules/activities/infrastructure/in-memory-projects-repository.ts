import { DEFAULT_PAGINATION, type Pagination } from '../../shared/pagination.ts';
import type { ProjectFilter } from '../application/projects-service.ts';
import type { ProjectsRepositoryPort } from '../application/projects-service.ts';
import {
  CANONICAL_INSTITUTES,
  type InstituteView,
  type ProjectRecord,
} from '../domain/project-types.ts';

export class InMemoryProjectsRepository implements ProjectsRepositoryPort {
  private readonly institutes: readonly InstituteView[];
  private readonly projectsById = new Map<string, ProjectRecord>();

  constructor(institutes: readonly InstituteView[] = CANONICAL_INSTITUTES) {
    this.institutes = [...institutes];
  }

  async listInstitutes(): Promise<readonly InstituteView[]> {
    return [...this.institutes];
  }

  async listProjects(filter?: ProjectFilter, pagination: Pagination = DEFAULT_PAGINATION): Promise<readonly ProjectRecord[]> {
    const offset = (pagination.page - 1) * pagination.pageSize;
    return this.matchingProjects(filter).slice(offset, offset + pagination.pageSize);
  }

  async countProjects(filter?: ProjectFilter): Promise<number> {
    return this.matchingProjects(filter).length;
  }

  private matchingProjects(filter?: ProjectFilter): readonly ProjectRecord[] {
    const normalizedSearch = filter?.search?.trim().toLowerCase();
    const normalizedInstituteId = filter?.instituteId?.trim().toLowerCase();

    return [...this.projectsById.values()]
      .filter((project) => {
        if (filter?.status && project.status !== filter.status) return false;
        if (
          normalizedInstituteId &&
          !project.instituteIds.some((id) => id.toLowerCase() === normalizedInstituteId)
        ) {
          return false;
        }
        if (normalizedSearch && !project.name.toLowerCase().includes(normalizedSearch)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async findProjectById(id: string): Promise<ProjectRecord | null> {
    return this.projectsById.get(id.toLowerCase()) ?? this.projectsById.get(id) ?? null;
  }

  async createProject(record: ProjectRecord): Promise<ProjectRecord> {
    this.projectsById.set(record.id.toLowerCase(), record);
    return record;
  }

  async updateProject(record: ProjectRecord, expectedVersion: number): Promise<ProjectRecord | null> {
    const key = record.id.toLowerCase();
    const existing = this.projectsById.get(key);
    if (!existing || existing.version !== expectedVersion) {
      return null;
    }
    this.projectsById.set(key, record);
    return record;
  }
  checkpoint(): () => void {
    const projectsById = structuredClone(this.projectsById);
    return () => {
      this.projectsById.clear();
      for (const [key, value] of projectsById) this.projectsById.set(key, value);
    };
  }
}
