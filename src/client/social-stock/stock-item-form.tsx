import { useState, type FormEvent } from 'react';
import {
  StockApiError,
  type CatalogOption,
  type NewStockItemInput,
  type StockApi,
} from './stock-api.ts';

interface StockItemFieldErrors {
  readonly name?: string;
  readonly categoryId?: string;
  readonly unitId?: string;
}

export interface StockItemFormProps {
  readonly stockApi: StockApi;
  readonly categories: readonly CatalogOption[];
  readonly units: readonly CatalogOption[];
  readonly sizes: readonly CatalogOption[];
  readonly onCreated: () => void;
  readonly onCancel: () => void;
  readonly onSessionExpired?: () => void;
}

const NAME_LENGTH_MESSAGE = 'Informe um nome entre 1 e 150 caracteres.';
const ACCESS_DENIED_MESSAGE = 'Seu perfil não possui permissão para esta operação.';
const IDEMPOTENCY_CONFLICT_MESSAGE = 'Esta operação já foi registrada com dados diferentes. Recarregue a lista e confira antes de tentar novamente.';
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar. Tente novamente.';

function validate(name: string, categoryId: string, unitId: string): StockItemFieldErrors {
  const errors: { name?: string; categoryId?: string; unitId?: string } = {};
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 150) {
    errors.name = NAME_LENGTH_MESSAGE;
  }
  if (categoryId === '') {
    errors.categoryId = 'Selecione uma categoria.';
  }
  if (unitId === '') {
    errors.unitId = 'Selecione uma unidade.';
  }
  return errors;
}

function activeOptions(options: readonly CatalogOption[]): readonly CatalogOption[] {
  return options.filter((option) => option.isActive);
}

export function StockItemForm({
  stockApi, categories, units, sizes, onCreated, onCancel, onSessionExpired,
}: StockItemFormProps) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<StockItemFieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // One operation identity per mounted form: retries of the same submission
  // replay instead of duplicating; a new mount starts a new operation.
  const [idempotencyKey] = useState(() => globalThis.crypto.randomUUID());

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate(name, categoryId, unitId);
    setFieldErrors(errors);
    setSubmissionError(null);
    if (errors.name !== undefined || errors.categoryId !== undefined || errors.unitId !== undefined) return;

    setIsSubmitting(true);
    try {
      const input: NewStockItemInput = sizeId === ''
        ? { name: name.trim(), categoryId, unitId }
        : { name: name.trim(), categoryId, unitId, sizeId };
      await stockApi.createItem(input, { idempotencyKey });
    } catch (error) {
      if (error instanceof StockApiError && error.code === 'AUTH_REQUIRED') {
        setIsSubmitting(false);
        onSessionExpired?.();
        return;
      }
      if (error instanceof StockApiError && error.code === 'FORBIDDEN') {
        setSubmissionError(ACCESS_DENIED_MESSAGE);
      } else if (error instanceof StockApiError && error.code === 'IDEMPOTENCY_CONFLICT') {
        setSubmissionError(IDEMPOTENCY_CONFLICT_MESSAGE);
      } else if (error instanceof StockApiError && error.code === 'VALIDATION_FAILED') {
        const fields: { name?: string; categoryId?: string; unitId?: string } = {};
        const rest: string[] = [];
        for (const issue of error.errors) {
          if (issue.field === 'name' && fields.name === undefined) fields.name = issue.message;
          else if (issue.field === 'categoryId' && fields.categoryId === undefined) fields.categoryId = issue.message;
          else if (issue.field === 'unitId' && fields.unitId === undefined) fields.unitId = issue.message;
          else rest.push(issue.message);
        }
        setFieldErrors(fields);
        if (rest.length > 0) setSubmissionError(rest.join(' '));
      } else {
        setSubmissionError(SAVE_ERROR_MESSAGE);
      }
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onCreated();
  };

  return (
    <section className="stock-card" aria-labelledby="item-form-title">
      <h2 id="item-form-title">Novo item</h2>
      <form className="stock-form" noValidate aria-busy={isSubmitting} onSubmit={submit}>
        <div className="stock-field">
          <label htmlFor="item-name">Nome</label>
          <input
            id="item-name"
            name="name"
            type="text"
            maxLength={150}
            required
            disabled={isSubmitting}
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={fieldErrors.name === undefined ? undefined : 'item-name-error'}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFieldErrors({});
            }}
          />
          {fieldErrors.name === undefined ? null : (
            <span id="item-name-error" className="stock-field-error" role="alert">{fieldErrors.name}</span>
          )}
        </div>
        <div className="stock-field">
          <label htmlFor="item-category">Categoria</label>
          <select
            id="item-category"
            name="categoryId"
            required
            disabled={isSubmitting}
            aria-invalid={fieldErrors.categoryId !== undefined}
            aria-describedby={fieldErrors.categoryId === undefined ? undefined : 'item-category-error'}
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setFieldErrors({});
            }}
          >
            <option value="">Selecione…</option>
            {activeOptions(categories).map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
          {fieldErrors.categoryId === undefined ? null : (
            <span id="item-category-error" className="stock-field-error" role="alert">{fieldErrors.categoryId}</span>
          )}
        </div>
        <div className="stock-field">
          <label htmlFor="item-unit">Unidade</label>
          <select
            id="item-unit"
            name="unitId"
            required
            disabled={isSubmitting}
            aria-invalid={fieldErrors.unitId !== undefined}
            aria-describedby={fieldErrors.unitId === undefined ? undefined : 'item-unit-error'}
            value={unitId}
            onChange={(event) => {
              setUnitId(event.target.value);
              setFieldErrors({});
            }}
          >
            <option value="">Selecione…</option>
            {activeOptions(units).map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
          {fieldErrors.unitId === undefined ? null : (
            <span id="item-unit-error" className="stock-field-error" role="alert">{fieldErrors.unitId}</span>
          )}
        </div>
        <div className="stock-field">
          <label htmlFor="item-size">Tamanho (opcional)</label>
          <select
            id="item-size"
            name="sizeId"
            disabled={isSubmitting}
            value={sizeId}
            onChange={(event) => { setSizeId(event.target.value); }}
          >
            <option value="">Sem tamanho</option>
            {activeOptions(sizes).map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </div>
        {submissionError === null ? null : (
          <p className="stock-message stock-message-error" role="alert">{submissionError}</p>
        )}
        <div className="stock-actions">
          <button className="stock-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Criar item'}
          </button>
          <button className="stock-cancel" type="button" disabled={isSubmitting} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
