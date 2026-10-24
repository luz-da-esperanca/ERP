import type { ProjectsRepositoryPort } from '../application/projects-service.ts';
import {
  CANONICAL_INSTITUTES,
  type InstituteView,
  type ProjectRecord,
  type ProjectStatus,
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

  async listProjects(filter?: {
    readonly status?: ProjectStatus;
    readonly instituteId?: string;
    readonly search?: string;
  }): Promise<readonly ProjectRecord[]> {
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
}

