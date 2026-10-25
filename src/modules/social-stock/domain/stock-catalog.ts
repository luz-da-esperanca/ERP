import { validationFailedError } from '../../shared/errors.ts';
import { MAX_UNIT_PRECISION } from './quantity.ts';

export type CatalogKind = 'CATEGORY' | 'UNIT' | 'SIZE';

export function requireCatalogName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > 150) {
    throw validationFailedError([{ field: 'name', code: 'INVALID_LENGTH', message: 'Informe um nome entre 1 e 150 caracteres.' }]);
  }
  return value.trim();
}

export function requireUnitPrecision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_UNIT_PRECISION) {
    throw validationFailedError([{ field: 'precision', code: 'INVALID_UNIT_PRECISION', message: 'Informe uma precisão inteira de 0 a 18; zero indica unidade indivisível.' }]);
  }
  return value;
}

export interface CatalogOption {
  readonly id: string;
  readonly name: string;
  readonly precision: number | null;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CatalogReference {
  readonly id: string;
  readonly name: string;
}

export interface StockItemView {
  readonly id: string;
  readonly revisionId: string;
  readonly version: number;
  readonly name: string;
  readonly category: CatalogReference;
  readonly unit: CatalogReference & { readonly precision: number };
  readonly size: CatalogReference | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
