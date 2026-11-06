import { useState, type FormEvent } from 'react';
import {
  StockApiError,
  type CatalogKind,
  type NewCatalogOptionInput,
  type StockApi,
} from './stock-api.ts';

interface CatalogFieldErrors {
  readonly name?: string;
  readonly precision?: string;
}

export interface CatalogFormProps {
  readonly kind: CatalogKind;
  readonly stockApi: StockApi;
  readonly onCreated: () => void;
  readonly onCancel: () => void;
  readonly onSessionExpired?: () => void;
}

const KIND_LABELS: Record<CatalogKind, { title: string; action: string; idPrefix: string }> = {
  CATEGORY: { title: 'Nova categoria', action: 'Criar categoria', idPrefix: 'category' },
  UNIT: { title: 'Nova unidade', action: 'Criar unidade', idPrefix: 'unit' },
  SIZE: { title: 'Nova numeração', action: 'Criar numeração', idPrefix: 'size' },
};

const NAME_LENGTH_MESSAGE = 'Informe um nome entre 1 e 150 caracteres.';
const PRECISION_MESSAGE = 'Informe uma precisão inteira de 0 a 18.';
const ACCESS_DENIED_MESSAGE = 'Seu perfil não possui permissão para esta operação.';
const IDEMPOTENCY_CONFLICT_MESSAGE = 'Esta operação já foi registrada com dados diferentes. Recarregue a lista e confira antes de tentar novamente.';
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar. Tente novamente.';

function validate(name: string, precisionText: string, kind: CatalogKind): CatalogFieldErrors {
  const errors: { name?: string; precision?: string } = {};
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 150) {
    errors.name = NAME_LENGTH_MESSAGE;
  }
  if (kind === 'UNIT') {
    const normalized = precisionText.trim();
    if (!/^\d+$/.test(normalized) || Number(normalized) < 0 || Number(normalized) > 18) {
      errors.precision = PRECISION_MESSAGE;
    }
  }
  return errors;
}

export function CatalogForm({ kind, stockApi, onCreated, onCancel, onSessionExpired }: CatalogFormProps) {
  const labels = KIND_LABELS[kind];
  const [name, setName] = useState('');
  const [precisionText, setPrecisionText] = useState('');
  const [fieldErrors, setFieldErrors] = useState<CatalogFieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // One operation identity per mounted form: retries of the same submission
  // replay instead of duplicating; a new mount starts a new operation.
  const [idempotencyKey] = useState(() => globalThis.crypto.randomUUID());

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate(name, precisionText, kind);
    setFieldErrors(errors);
    setSubmissionError(null);
    if (errors.name !== undefined || errors.precision !== undefined) return;

    setIsSubmitting(true);
    try {
      const input: NewCatalogOptionInput = kind === 'UNIT'
        ? { name: name.trim(), precision: Number(precisionText.trim()) }
        : { name: name.trim() };
      await stockApi.createOption(kind, input, { idempotencyKey });
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
        const fields: { name?: string; precision?: string } = {};
        const rest: string[] = [];
        for (const issue of error.errors) {
          if (issue.field === 'name' && fields.name === undefined) fields.name = issue.message;
          else if (kind === 'UNIT' && issue.field === 'precision' && fields.precision === undefined) {
            fields.precision = issue.message;
          } else rest.push(issue.message);
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
    <section className="stock-card" aria-labelledby={`${labels.idPrefix}-form-title`}>
      <h2 id={`${labels.idPrefix}-form-title`}>{labels.title}</h2>
      <form className="stock-form" noValidate aria-busy={isSubmitting} onSubmit={submit}>
        <div className="stock-field">
          <label htmlFor={`${labels.idPrefix}-name`}>Nome</label>
          <input
            id={`${labels.idPrefix}-name`}
            name="name"
            type="text"
            maxLength={150}
            required
            disabled={isSubmitting}
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={fieldErrors.name === undefined ? undefined : `${labels.idPrefix}-name-error`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFieldErrors({});
            }}
          />
          {fieldErrors.name === undefined ? null : (
            <span id={`${labels.idPrefix}-name-error`} className="stock-field-error" role="alert">
              {fieldErrors.name}
            </span>
          )}
        </div>
        {kind === 'UNIT' ? (
          <div className="stock-field">
            <label htmlFor={`${labels.idPrefix}-precision`}>Precisão (casas decimais)</label>
            <input
              id={`${labels.idPrefix}-precision`}
              name="precision"
              type="number"
              min={0}
              max={18}
              step={1}
              required
              disabled={isSubmitting}
              aria-invalid={fieldErrors.precision !== undefined}
              aria-describedby={fieldErrors.precision === undefined ? undefined : `${labels.idPrefix}-precision-error`}
              value={precisionText}
              onChange={(event) => {
                setPrecisionText(event.target.value);
                setFieldErrors({});
              }}
            />
            {fieldErrors.precision === undefined ? null : (
              <span id={`${labels.idPrefix}-precision-error`} className="stock-field-error" role="alert">
                {fieldErrors.precision}
              </span>
            )}
          </div>
        ) : null}
        {submissionError === null ? null : (
          <p className="stock-message stock-message-error" role="alert">{submissionError}</p>
        )}
        <div className="stock-actions">
          <button className="stock-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : labels.action}
          </button>
          <button className="stock-cancel" type="button" disabled={isSubmitting} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
