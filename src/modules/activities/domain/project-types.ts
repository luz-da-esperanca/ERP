import { validationFailedError, type FieldValidationError } from '../../shared/errors.ts';
import {
  isUuidV4OrV7,
  isValidIsoCalendarDate,
  isValidPeriod,
} from '../../shared/identifiers-and-time.ts';

export type InstituteCode =
  | 'CRIANCA'
  | 'JOVEM'
  | 'ESCLARECIMENTO_E_FAMILIA'
  | 'CARIDADE'
  | 'DIVULGACAO'
  | 'MEDIUNIDADE';

export interface InstituteView {
  readonly id: string;
  readonly code: InstituteCode;
  readonly name: string;
  readonly description: string;
  readonly active: boolean;
}

export const CANONICAL_INSTITUTES: readonly InstituteView[] = [
  {
    id: '01963000-0000-7000-8000-000000000601',
    code: 'CRIANCA',
    name: 'Criança',
    description: 'Instituto da Criança',
    active: true,
  },
  {
    id: '01963000-0000-7000-8000-000000000602',
    code: 'JOVEM',
    name: 'Jovem',
    description: 'Instituto do Jovem',
    active: true,
  },
  {
    id: '01963000-0000-7000-8000-000000000603',
    code: 'ESCLARECIMENTO_E_FAMILIA',
    name: 'Esclarecimento e Família',
    description: 'Instituto do Esclarecimento e da Família',
    active: true,
  },
  {
    id: '01963000-0000-7000-8000-000000000604',
    code: 'CARIDADE',
    name: 'Caridade',
    description: 'Instituto da Caridade',
    active: true,
  },
  {
    id: '01963000-0000-7000-8000-000000000605',
    code: 'DIVULGACAO',
    name: 'Divulgação',
    description: 'Instituto da Divulgação',
    active: true,
  },
  {
    id: '01963000-0000-7000-8000-000000000606',
    code: 'MEDIUNIDADE',
    name: 'Mediunidade',
    description: 'Instituto da Mediunidade',
    active: true,
  },
] as const;

export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED';

export interface ProjectInstituteSummary {
  readonly id: string;
  readonly code: InstituteCode;
  readonly name: string;
}

export interface ProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: ProjectStatus;
  readonly instituteIds: readonly string[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
}

export interface ProjectView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: ProjectStatus;
  readonly institutes: readonly ProjectInstituteSummary[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
}

export function validateInstituteIdsList(
  rawInstituteIds: unknown,
  knownInstitutesById: ReadonlyMap<string, InstituteView>,
  errors: FieldValidationError[],
): readonly string[] {
  if (rawInstituteIds === undefined) {
    return [];
  }
  if (!Array.isArray(rawInstituteIds)) {
    errors.push({
      field: 'instituteIds',
      code: 'INVALID_FORMAT',
      message: 'A lista de institutos deve ser um vetor de identificadores UUID.',
    });
    return [];
  }

  const seen = new Set<string>();
  for (const item of rawInstituteIds) {
    if (!isUuidV4OrV7(item)) {
      errors.push({
        field: 'instituteIds',
        code: 'INVALID_FORMAT',
        message: 'Cada identificador de instituto deve ser um UUID válido.',
      });
      return [];
    }
    const normalizedId = item.toLowerCase();
    if (seen.has(normalizedId)) {
      errors.push({
        field: 'instituteIds',
        code: 'DUPLICATE_VALUE',
        message: 'A lista de institutos vinculados não deve conter itens repetidos.',
      });
      return [];
    }
    const institute = knownInstitutesById.get(normalizedId);
    if (!institute || !institute.active) {
      errors.push({
        field: 'instituteIds',
        code: 'REFERENCE_NOT_FOUND',
        message: 'Um ou mais institutos informados não existem ou estão inativos.',
      });
      return [];
    }
    seen.add(normalizedId);
  }

  return [...seen];
}

export function validateCreateProjectFields(
  input: {
    readonly name: unknown;
    readonly description?: unknown;
    readonly startDate: unknown;
    readonly endDate?: unknown;
    readonly status?: unknown;
    readonly instituteIds?: unknown;
  },
  knownInstitutesById: ReadonlyMap<string, InstituteView>,
): {
  readonly name: string;
  readonly description: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: 'PLANNED' | 'ACTIVE';
  readonly instituteIds: readonly string[];
} {
  const errors: FieldValidationError[] = [];

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 3 || name.length > 150) {
    errors.push({
      field: 'name',
      code: 'INVALID_LENGTH',
      message: 'O nome do projeto é obrigatório e deve ter entre 3 e 150 caracteres.',
    });
  }

  let description: string | null = null;
  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== 'string') {
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
      description = trimmed.length > 0 ? trimmed : null;
    }
  }

  const startDate = typeof input.startDate === 'string' ? input.startDate : '';
  if (!isValidIsoCalendarDate(startDate)) {
    errors.push({
      field: 'startDate',
      code: 'INVALID_FORMAT',
      message: 'A data inicial deve ser uma data válida no formato AAAA-MM-DD.',
    });
  }

  let endDate: string | null = null;
  if (input.endDate !== undefined && input.endDate !== null) {
    if (!isValidIsoCalendarDate(input.endDate)) {
      errors.push({
        field: 'endDate',
        code: 'INVALID_FORMAT',
        message: 'A data final deve ser uma data válida no formato AAAA-MM-DD.',
      });
    } else {
      endDate = input.endDate;
      if (isValidIsoCalendarDate(startDate) && !isValidPeriod(startDate, endDate)) {
        errors.push({
          field: 'endDate',
          code: 'INVALID_PERIOD',
          message: 'A data final deve ser posterior à data inicial.',
        });
      }
    }
  }

  let status: 'PLANNED' | 'ACTIVE' = 'ACTIVE';
  if (input.status !== undefined) {
    if (input.status !== 'PLANNED' && input.status !== 'ACTIVE') {
      errors.push({
        field: 'status',
        code: 'INVALID_ENUM',
        message: 'O status inicial do projeto deve ser PLANNED ou ACTIVE.',
      });
    } else {
      status = input.status;
    }
  }

  const instituteIds = validateInstituteIdsList(
    input.instituteIds,
    knownInstitutesById,
    errors,
  );

  if (errors.length > 0) {
    throw validationFailedError(errors);
  }

  return {
    name,
    description,
    startDate,
    endDate,
    status,
    instituteIds,
  };
}
