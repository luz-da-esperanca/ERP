export type CatalogKind = 'CATEGORY' | 'UNIT' | 'SIZE';

export type StockOriginKind =
  | 'INDIVIDUAL_DONOR'
  | 'COMPANY_DONOR'
  | 'CAMPAIGN'
  | 'UNKNOWN'
  | 'BAZAR_TRANSFER';

export type CreatableStockOriginKind = 'INDIVIDUAL_DONOR' | 'COMPANY_DONOR' | 'CAMPAIGN';

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface PaginationInput {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface CatalogOption {
  readonly id: string;
  readonly code: string | null;
  readonly name: string;
  readonly precision: number | null;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CatalogReference {
  readonly id: string;
  readonly code: string | null;
  readonly name: string;
}

export interface StockItem {
  readonly id: string;
  readonly code: string | null;
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

export interface StockOrigin {
  readonly id: string;
  readonly kind: StockOriginKind;
  readonly name: string;
  readonly isExternalDonation: boolean;
  readonly isSystemManaged: boolean;
  readonly createdAt: string;
}

export interface NewCatalogOptionInput {
  readonly name: string;
  readonly precision?: number;
}

export interface NewStockItemInput {
  readonly name: string;
  readonly categoryId: string;
  readonly unitId: string;
  readonly sizeId?: string;
}

export interface NewStockOriginInput {
  readonly kind: CreatableStockOriginKind;
  readonly name: string;
}

export interface StockOriginFilter {
  readonly kind?: StockOriginKind;
  readonly search?: string;
}

export interface MutationOptions {
  readonly idempotencyKey?: string;
}

export interface FieldValidationIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export type StockApiErrorCode =
  | 'INVALID_REQUEST'
  | 'AUTH_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'CSRF_REJECTED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'STALE_VERSION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DUPLICATE_RESOURCE'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'MISSING_CSRF_TOKEN'
  | 'NETWORK_ERROR'
  | 'UNEXPECTED_RESPONSE';

export interface StockApiErrorOptions {
  readonly status: number;
  readonly code: StockApiErrorCode;
  readonly traceId: string | null;
  readonly errors: readonly FieldValidationIssue[];
}

export class StockApiError extends Error {
  readonly status: number;
  readonly code: StockApiErrorCode;
  readonly traceId: string | null;
  readonly errors: readonly FieldValidationIssue[];

  constructor(options: StockApiErrorOptions) {
    super(`Stock request failed with ${options.code}.`);
    this.name = 'StockApiError';
    this.status = options.status;
    this.code = options.code;
    this.traceId = options.traceId;
    this.errors = options.errors;
  }
}

/**
 * Client port over the social-stock HTTP contracts (G-01/G-02). Unknown wire
 * data arrives as null and must be presented as absent, never invented.
 */
export interface StockApi {
  listOptions(kind: CatalogKind, pagination?: PaginationInput): Promise<Page<CatalogOption>>;
  getOption(kind: CatalogKind, id: string): Promise<CatalogOption>;
  createOption(kind: CatalogKind, input: NewCatalogOptionInput, options?: MutationOptions): Promise<CatalogOption>;
  listItems(pagination?: PaginationInput): Promise<Page<StockItem>>;
  getItem(id: string): Promise<StockItem>;
  createItem(input: NewStockItemInput, options?: MutationOptions): Promise<StockItem>;
  listOrigins(filter?: StockOriginFilter, pagination?: PaginationInput): Promise<Page<StockOrigin>>;
  getOrigin(id: string): Promise<StockOrigin>;
  createOrigin(input: NewStockOriginInput, options?: MutationOptions): Promise<StockOrigin>;
}
