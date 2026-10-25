import { validationFailedError, type FieldValidationError } from '../../shared/errors.ts';

export const STOCK_ORIGIN_KINDS = [
  'INDIVIDUAL_DONOR',
  'COMPANY_DONOR',
  'CAMPAIGN',
  'UNKNOWN',
  'BAZAR_TRANSFER',
] as const;

export type StockOriginKind = (typeof STOCK_ORIGIN_KINDS)[number];

export const CREATABLE_STOCK_ORIGIN_KINDS = [
  'INDIVIDUAL_DONOR',
  'COMPANY_DONOR',
  'CAMPAIGN',
] as const;

export type CreatableStockOriginKind = (typeof CREATABLE_STOCK_ORIGIN_KINDS)[number];

export const UNKNOWN_STOCK_ORIGIN_ID = '01963000-0000-7000-8000-000000000701';
export const BAZAR_TRANSFER_STOCK_ORIGIN_ID = '01963000-0000-7000-8000-000000000702';

export const MAX_STOCK_ORIGIN_NAME_LENGTH = 150;

export interface StockOriginRecord {
  readonly id: string;
  readonly kind: StockOriginKind;
  readonly name: string;
  readonly createdAt: string;
}

export interface StockOriginView {
  readonly id: string;
  readonly kind: StockOriginKind;
  readonly name: string;
  readonly isExternalDonation: boolean;
  readonly isSystemManaged: boolean;
  readonly createdAt: string;
}

export interface StockOriginFilter {
  readonly kind?: StockOriginKind;
  readonly search?: string;
}

export interface StockOriginDefinition {
  readonly id: string;
  readonly kind: StockOriginKind;
  readonly name: string;
}

export const SYSTEM_STOCK_ORIGIN_DEFINITIONS: readonly StockOriginDefinition[] = [
  {
    id: UNKNOWN_STOCK_ORIGIN_ID,
    kind: 'UNKNOWN',
    name: 'Origem desconhecida',
  },
  {
    id: BAZAR_TRANSFER_STOCK_ORIGIN_ID,
    kind: 'BAZAR_TRANSFER',
    name: 'Transferência do Bazar',
  },
] as const;

export function isExternalDonation(kind: StockOriginKind): boolean {
  return kind !== 'BAZAR_TRANSFER';
}

export function isSystemManaged(kind: StockOriginKind): boolean {
  return kind === 'UNKNOWN' || kind === 'BAZAR_TRANSFER';
}

export function toStockOriginView(record: StockOriginRecord): StockOriginView {
  return {
    id: record.id,
    kind: record.kind,
    name: record.name,
    isExternalDonation: isExternalDonation(record.kind),
    isSystemManaged: isSystemManaged(record.kind),
    createdAt: record.createdAt,
  };
}

export function validateCreateStockOriginInput(input: {
  readonly kind: unknown;
  readonly name: unknown;
}): { readonly kind: CreatableStockOriginKind; readonly name: string } {
  const errors: FieldValidationError[] = [];

  let kind: CreatableStockOriginKind | undefined;
  if (typeof input.kind === 'string' && (STOCK_ORIGIN_KINDS as readonly string[]).includes(input.kind)) {
    if ((CREATABLE_STOCK_ORIGIN_KINDS as readonly string[]).includes(input.kind)) {
      kind = input.kind as CreatableStockOriginKind;
    } else {
      errors.push({
        field: 'kind',
        code: 'INVALID_ENUM',
        message: 'A origem informada é gerenciada pelo sistema e não pode ser criada.',
      });
    }
  } else if (input.kind === undefined || input.kind === null) {
    errors.push({
      field: 'kind',
      code: 'REQUIRED_FIELD',
      message: 'A origem é obrigatória.',
    });
  } else {
    errors.push({
      field: 'kind',
      code: 'INVALID_ENUM',
      message: 'A origem deve ser INDIVIDUAL_DONOR, COMPANY_DONOR, CAMPAIGN, UNKNOWN ou BAZAR_TRANSFER.',
    });
  }

  const rawName = typeof input.name === 'string' ? input.name.trim() : '';
  if (input.name === undefined || input.name === null) {
    errors.push({
      field: 'name',
      code: 'REQUIRED_FIELD',
      message: 'O nome da origem é obrigatório.',
    });
  } else if (typeof input.name !== 'string') {
    errors.push({
      field: 'name',
      code: 'INVALID_FORMAT',
      message: 'O nome da origem deve ser um texto.',
    });
  } else if (rawName.length === 0 || rawName.length > MAX_STOCK_ORIGIN_NAME_LENGTH) {
    errors.push({
      field: 'name',
      code: 'INVALID_LENGTH',
      message: `O nome da origem é obrigatório e deve ter entre 1 e ${MAX_STOCK_ORIGIN_NAME_LENGTH} caracteres.`,
    });
  }

  if (errors.length > 0 || kind === undefined) {
    throw validationFailedError(errors);
  }

  return { kind, name: rawName };
}
