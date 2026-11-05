import type { CreatableStockOriginKind, StockOriginKind } from './stock-api.ts';

export const STOCK_ORIGIN_KIND_LABELS: Record<StockOriginKind, string> = {
  INDIVIDUAL_DONOR: 'Doador pessoa física',
  COMPANY_DONOR: 'Doador empresa',
  CAMPAIGN: 'Campanha',
  UNKNOWN: 'Origem desconhecida',
  BAZAR_TRANSFER: 'Transferência do Bazar',
};

export const CREATABLE_STOCK_ORIGIN_KINDS: readonly CreatableStockOriginKind[] = [
  'INDIVIDUAL_DONOR',
  'COMPANY_DONOR',
  'CAMPAIGN',
];

export const ALL_STOCK_ORIGIN_KINDS: readonly StockOriginKind[] = [
  'INDIVIDUAL_DONOR',
  'COMPANY_DONOR',
  'CAMPAIGN',
  'UNKNOWN',
  'BAZAR_TRANSFER',
];

export function toStockOriginKind(value: string): StockOriginKind | null {
  for (const kind of ALL_STOCK_ORIGIN_KINDS) {
    if (kind === value) return kind;
  }
  return null;
}

export function toCreatableStockOriginKind(value: string): CreatableStockOriginKind | null {
  for (const kind of CREATABLE_STOCK_ORIGIN_KINDS) {
    if (kind === value) return kind;
  }
  return null;
}
