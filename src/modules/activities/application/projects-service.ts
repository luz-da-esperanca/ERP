import { requireChangeReason } from '../../shared/change-reason.ts';
import { buildPage, DEFAULT_PAGINATION, type Page, type Pagination } from '../../shared/pagination.ts';
import type { MutationContext, TransactionRunner } from '../../shared/transactions.ts';
import {
  resourceNotFoundError,
  staleVersionError,
  validationFailedError,
  type FieldValidationError,
} from '../../shared/errors.ts';
import {
  generateUuidV7,
  isUuidV4OrV7,
  isValidIsoCalendarDate,
  isValidPeriod,
  validateFactDate,
} from '../../shared/identifiers-and-time.ts';
import {
  validateCreateProjectFields,
  validateInstituteIdsList,
  type InstituteView,
  type ProjectInstituteSummary,
  type ProjectRecord,
  type ProjectStatus,
  type ProjectView,
} from '../domain/project-types.ts';

export interface ProjectFilter {
    readonly status?: ProjectStatus;
    readonly instituteId?: string;
    readonly search?: string;

}

export interface ProjectsRepositoryPort {
  listInstitutes(): Promise<readonly InstituteView[]>;
  listProjects(filter?: ProjectFilter, pagination?: Pagination): Promise<readonly ProjectRecord[]>;
  countProjects(filter?: ProjectFilter): Promise<number>;
  findProjectById(id: string): Promise<ProjectRecord | null>;
  createProject(record: ProjectRecord): Promise<ProjectRecord>;
  updateProject(record: ProjectRecord, expectedVersion: number): Promise<ProjectRecord | null>;
}

export interface ProjectsServiceDependencies {
  readonly repository: ProjectsRepositoryPort;
  readonly transactions: TransactionRunner<MutationContext<ProjectsRepositoryPort>>;
  readonly clock?: () => Date;
}

export class ProjectsService {
  private readonly repository: ProjectsRepositoryPort;
  private readonly transactions: TransactionRunner<MutationContext<ProjectsRepositoryPort>>;
  private readonly clock: () => Date;

  constructor(deps: ProjectsServiceDependencies) {
    this.repository = deps.repository;
    this.transactions = deps.transactions;
    this.clock = deps.clock ?? (() => new Date());
  }

  async listInstitutes(): Promise<readonly InstituteView[]> {
    return this.repository.listInstitutes();
  }

  async listProjects(filter?: ProjectFilter, pagination: Pagination = DEFAULT_PAGINATION): Promise<Page<ProjectView>> {
    const [institutes, records, total] = await Promise.all([
      this.repository.listInstitutes(),
      this.repository.listProjects(filter, pagination),
      this.repository.countProjects(filter),
    ]);
    const institutesById = this.buildInstituteMap(institutes);
    return buildPage(records.map((record) => this.toProjectView(record, institutesById)), total, pagination);
  }

  async getProjectById(id: string): Promise<ProjectView> {
    if (!isUuidV4OrV7(id)) {
      throw resourceNotFoundError('Projeto não encontrado.');
    }
    const [institutes, record] = await Promise.all([
      this.repository.listInstitutes(),
      this.repository.findProjectById(id),
    ]);
    if (!record) {
      throw resourceNotFoundError('Projeto não encontrado.');
    }
    return this.toProjectView(record, this.buildInstituteMap(institutes));
  }

  async createProject(input: {
    readonly actorId: string;
    readonly operationId: string;
    readonly name: unknown;
    readonly description?: unknown;
    readonly startDate: unknown;
    readonly endDate?: unknown;
    readonly status?: unknown;
    readonly instituteIds?: unknown;
    readonly factDate?: string;
  }): Promise<{ readonly statusCode: number; readonly body: ProjectView }> {
    validateFactDate(input.factDate);
    const institutes = await this.repository.listInstitutes();
    const institutesById = this.buildInstituteMap(institutes);
    const validated = validateCreateProjectFields(input, institutesById);

    const result = await this.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      operationType: 'CREATE_PROJECT',
      actorId: input.actorId,
      operationId: input.operationId,
      payload: {
        name: validated.name,
        description: validated.description,
        startDate: validated.startDate,
        endDate: validated.endDate,
        status: validated.status,
        instituteIds: validated.instituteIds,
        factDate: input.factDate ?? null,
      },
      run: async () => {
        const now = this.clock();
        const nowIso = now.toISOString();
        const record: ProjectRecord = {
          id: generateUuidV7(now.getTime()),
          name: validated.name,
          description: validated.description,
          startDate: validated.startDate,
          endDate: validated.endDate,
          status: validated.status,
          instituteIds: validated.instituteIds,
          version: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
          closedAt: null,
        };

        const saved = await repository.createProject(record);
        const view = this.toProjectView(saved, institutesById);

        await auditTrail.record({
          actorId: input.actorId,
          ...(input.factDate !== undefined ? { factDate: input.factDate } : {}),
          entityType: 'PROJECT',
          entityId: saved.id,
          action: 'CREATE',
          before: null,
          after: { ...view },
          operationId: input.operationId,
        });

        return { statusCode: 201, body: view };
      },
    }));

    return { statusCode: result.statusCode, body: result.body };
  }

  async updateProject(input: {
    readonly actorId: string;
    readonly operationId: string;
    readonly projectId: string;
    readonly version: unknown;
    readonly name?: unknown;
    readonly description?: unknown;
    readonly startDate?: unknown;
    readonly endDate?: unknown;
    readonly status?: unknown;
    readonly instituteIds?: unknown;
    readonly reason: unknown;
    readonly factDate?: string;
  }): Promise<ProjectView> {
    validateFactDate(input.factDate);
    if (!isUuidV4OrV7(input.projectId)) {
      throw resourceNotFoundError('Projeto não encontrado.');
    }
    const expectedVersion = this.requirePositiveIntegerVersion(input.version);
    const reason = requireChangeReason(input.reason);

    const result = await this.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      operationType: 'UPDATE_PROJECT',
      actorId: input.actorId,
      operationId: input.operationId,
      payload: {
        projectId: input.projectId,
        version: expectedVersion,
        name: input.name,
        description: input.description,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        instituteIds: input.instituteIds,
        reason,
        factDate: input.factDate ?? null,
      },
      run: async () => {
        const [institutes, current] = await Promise.all([
          repository.listInstitutes(),
          repository.findProjectById(input.projectId),
        ]);
        if (!current) {
          throw resourceNotFoundError('Projeto não encontrado.');
        }
        if (current.version !== expectedVersion) {
          throw staleVersionError();
        }
        if (current.status === 'CLOSED') {
          throw validationFailedError([
            {
              field: 'status',
              code: 'PROJECT_CLOSED',
              message: 'Projetos encerrados não podem ser editados.',
            },
          ]);
        }

        const institutesById = this.buildInstituteMap(institutes);
        const errors: FieldValidationError[] = [];

        let nextName = current.name;
        if (input.name !== undefined) {
          const trimmed = typeof input.name === 'string' ? input.name.trim() : '';
          if (trimmed.length < 3 || trimmed.length > 150) {
            errors.push({
              field: 'name',
              code: 'INVALID_LENGTH',
              message: 'O nome do projeto deve ter entre 3 e 150 caracteres.',
            });
          } else {
            nextName = trimmed;
          }
        }

        let nextDescription = current.description;
        if (input.description !== undefined) {
          if (input.description === null) {
            nextDescription = null;
          } else if (typeof input.description !== 'string') {
            errors.push({
              field: 'description',
              code: 'INVALID_FORMAT',
              message: 'A descrição do projeto deve ser um texto.',
            });
          } else {
            const trimmed = input.description.trim();
            if (trimmed.length > 1000) {
              errors.push({
                field: 'description',
                code: 'INVALID_LENGTH',
                message: 'A descrição do projeto deve ter no máximo 1000 caracteres.',
              });
            }
            nextDescription = trimmed.length > 0 ? trimmed : null;
          }
        }

        let nextStartDate = current.startDate;
        if (input.startDate !== undefined) {
          if (!isValidIsoCalendarDate(input.startDate)) {
            errors.push({
              field: 'startDate',
              code: 'INVALID_FORMAT',
              message: 'A data inicial deve ser uma data válida no formato AAAA-MM-DD.',
            });
          } else {
            nextStartDate = input.startDate;
          }
        }

        let nextEndDate = current.endDate;
        if (input.endDate !== undefined) {
          if (input.endDate === null) {
            nextEndDate = null;
          } else if (!isValidIsoCalendarDate(input.endDate)) {
            errors.push({
              field: 'endDate',
              code: 'INVALID_FORMAT',
              message: 'A data final deve ser uma data válida no formato AAAA-MM-DD.',
            });
          } else {
            nextEndDate = input.endDate;
          }
        }

        if (
          isValidIsoCalendarDate(nextStartDate) &&
          nextEndDate !== null &&
          isValidIsoCalendarDate(nextEndDate) &&
          !isValidPeriod(nextStartDate, nextEndDate)
        ) {
          errors.push({
            field: 'endDate',
            code: 'INVALID_PERIOD',
            message: 'A data final deve ser posterior à data inicial.',
          });
        }

        let nextStatus: ProjectStatus = current.status;
        if (input.status !== undefined) {
          if (input.status !== 'PLANNED' && input.status !== 'ACTIVE') {
            errors.push({
              field: 'status',
              code: 'INVALID_ENUM',
              message: 'Use o endpoint de encerramento para encerrar um projeto.',
            });
          } else {
            nextStatus = input.status;
          }
        }

        const nextInstituteIds =
          input.instituteIds !== undefined
            ? validateInstituteIdsList(input.instituteIds, institutesById, errors)
            : current.instituteIds;

        if (errors.length > 0) {
          throw validationFailedError(errors);
        }

        const nowIso = this.clock().toISOString();
        const updatedRecord: ProjectRecord = {
          ...current,
          name: nextName,
          description: nextDescription,
          startDate: nextStartDate,
          endDate: nextEndDate,
          status: nextStatus,
          instituteIds: nextInstituteIds,
          version: current.version + 1,
          updatedAt: nowIso,
        };

        const saved = await repository.updateProject(updatedRecord, expectedVersion);
        if (!saved) {
          throw staleVersionError();
        }

        const beforeView = this.toProjectView(current, institutesById);
        const afterView = this.toProjectView(saved, institutesById);

        await auditTrail.record({
          actorId: input.actorId,
          ...(input.factDate !== undefined ? { factDate: input.factDate } : {}),
          entityType: 'PROJECT',
          entityId: saved.id,
          action: 'UPDATE',
          before: { ...beforeView },
          after: { ...afterView },
          reason,
          operationId: input.operationId,
        });

        return { statusCode: 200, body: afterView };
      },
    }));

    return result.body;
  }

  async closeProject(input: {
    readonly actorId: string;
    readonly operationId: string;
    readonly projectId: string;
    readonly version: unknown;
    readonly endDate?: unknown;
    readonly reason: unknown;
    readonly factDate?: string;
  }): Promise<ProjectView> {
    validateFactDate(input.factDate);
    if (!isUuidV4OrV7(input.projectId)) {
      throw resourceNotFoundError('Projeto não encontrado.');
    }
    const expectedVersion = this.requirePositiveIntegerVersion(input.version);
    const reason = requireChangeReason(input.reason);

    const result = await this.transactions(({ repository, auditTrail, idempotency }) => idempotency.execute({
      operationType: 'CLOSE_PROJECT',
      actorId: input.actorId,
      operationId: input.operationId,
      payload: {
        projectId: input.projectId,
        version: expectedVersion,
        endDate: input.endDate,
        reason,
        factDate: input.factDate ?? null,
      },
      run: async () => {
        const [institutes, current] = await Promise.all([
          repository.listInstitutes(),
          repository.findProjectById(input.projectId),
        ]);
        if (!current) {
          throw resourceNotFoundError('Projeto não encontrado.');
        }
        if (current.version !== expectedVersion) {
          throw staleVersionError();
        }

        const institutesById = this.buildInstituteMap(institutes);
        let nextEndDate = current.endDate;
        if (input.endDate !== undefined && input.endDate !== null) {
          if (!isValidIsoCalendarDate(input.endDate)) {
            throw validationFailedError([
              {
                field: 'endDate',
                code: 'INVALID_FORMAT',
                message: 'A data final deve ser uma data válida no formato AAAA-MM-DD.',
              },
            ]);
          }
          if (!isValidPeriod(current.startDate, input.endDate)) {
            throw validationFailedError([
              {
                field: 'endDate',
                code: 'INVALID_PERIOD',
                message: 'A data final deve ser posterior à data inicial.',
              },
            ]);
          }
          nextEndDate = input.endDate;
        }

        const nowIso = this.clock().toISOString();
        const closedRecord: ProjectRecord = {
          ...current,
          status: 'CLOSED',
          endDate: nextEndDate,
          closedAt: current.closedAt ?? nowIso,
          version: current.version + 1,
          updatedAt: nowIso,
        };

        const saved = await repository.updateProject(closedRecord, expectedVersion);
        if (!saved) {
          throw staleVersionError();
        }

        const beforeView = this.toProjectView(current, institutesById);
        const afterView = this.toProjectView(saved, institutesById);

        await auditTrail.record({
          actorId: input.actorId,
          ...(input.factDate !== undefined ? { factDate: input.factDate } : {}),
          entityType: 'PROJECT',
          entityId: saved.id,
          action: 'CLOSE',
          before: { ...beforeView },
          after: { ...afterView },
          reason,
          operationId: input.operationId,
        });

        return { statusCode: 200, body: afterView };
      },
    }));

    return result.body;
  }

  private buildInstituteMap(
    institutes: readonly InstituteView[],
  ): ReadonlyMap<string, InstituteView> {
    const map = new Map<string, InstituteView>();
    for (const inst of institutes) {
      map.set(inst.id.toLowerCase(), inst);
    }
    return map;
  }

  private toProjectView(
    record: ProjectRecord,
    institutesById: ReadonlyMap<string, InstituteView>,
  ): ProjectView {
    const institutes: ProjectInstituteSummary[] = [];
    for (const id of record.instituteIds) {
      const found = institutesById.get(id.toLowerCase());
      if (found) {
        institutes.push({
          id: found.id,
          code: found.code,
          name: found.name,
        });
      }
    }

    return {
      id: record.id,
      name: record.name,
      description: record.description,
      startDate: record.startDate,
      endDate: record.endDate,
      status: record.status,
      institutes,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      closedAt: record.closedAt,
    };
  }

  private requirePositiveIntegerVersion(version: unknown): number {
    if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
      throw validationFailedError([
        {
          field: 'version',
          code: 'INVALID_FORMAT',
          message: 'A versão do registro é obrigatória e deve ser um número inteiro positivo.',
        },
      ]);
    }
    return version;
  }

}
