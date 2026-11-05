import { useState, type FormEvent } from 'react';
import { CREATABLE_STOCK_ORIGIN_KINDS, STOCK_ORIGIN_KIND_LABELS, toCreatableStockOriginKind } from './origin-labels.ts';
import { StockApiError, type StockApi } from './stock-api.ts';

interface OriginFieldErrors {
  readonly kind?: string;
  readonly name?: string;
}

export interface OriginFormProps {
  readonly stockApi: StockApi;
  readonly onCreated: () => void;
  readonly onCancel: () => void;
  readonly onSessionExpired?: () => void;
}

const KIND_MESSAGE = 'Selecione o tipo de origem.';
const NAME_LENGTH_MESSAGE = 'Informe um nome entre 1 e 150 caracteres.';
const ACCESS_DENIED_MESSAGE = 'Seu perfil não possui permissão para esta operação.';
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar. Tente novamente.';

function validate(kind: string, name: string): OriginFieldErrors {
  const errors: { kind?: string; name?: string } = {};
  if (toCreatableStockOriginKind(kind) === null) {
    errors.kind = KIND_MESSAGE;
  }
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 150) {
    errors.name = NAME_LENGTH_MESSAGE;
  }
  return errors;
}

export function OriginForm({ stockApi, onCreated, onCancel, onSessionExpired }: OriginFormProps) {
  const [kind, setKind] = useState('');
  const [name, setName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<OriginFieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate(kind, name);
    setFieldErrors(errors);
    setSubmissionError(null);
    if (errors.kind !== undefined || errors.name !== undefined) return;

    const creatableKind = toCreatableStockOriginKind(kind);
    if (creatableKind === null) {
      setFieldErrors({ ...errors, kind: KIND_MESSAGE });
      return;
    }

    setIsSubmitting(true);
    try {
      await stockApi.createOrigin({ kind: creatableKind, name: name.trim() });
    } catch (error) {
      if (error instanceof StockApiError && error.code === 'AUTH_REQUIRED') {
        setIsSubmitting(false);
        onSessionExpired?.();
        return;
      }
      if (error instanceof StockApiError && error.code === 'FORBIDDEN') {
        setSubmissionError(ACCESS_DENIED_MESSAGE);
      } else if (error instanceof StockApiError && error.code === 'VALIDATION_FAILED') {
        const fields: { kind?: string; name?: string } = {};
        const rest: string[] = [];
        for (const issue of error.errors) {
          if (issue.field === 'kind' && fields.kind === undefined) fields.kind = issue.message;
          else if (issue.field === 'name' && fields.name === undefined) fields.name = issue.message;
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
    <section className="stock-card" aria-labelledby="origin-form-title">
      <h2 id="origin-form-title">Nova origem</h2>
      <form className="stock-form" noValidate aria-busy={isSubmitting} onSubmit={submit}>
        <div className="stock-field">
          <label htmlFor="origin-kind">Tipo de origem</label>
          <select
            id="origin-kind"
            name="kind"
            required
            disabled={isSubmitting}
            aria-invalid={fieldErrors.kind !== undefined}
            aria-describedby={fieldErrors.kind === undefined ? undefined : 'origin-kind-error'}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setFieldErrors({});
            }}
          >
            <option value="">Selecione…</option>
            {CREATABLE_STOCK_ORIGIN_KINDS.map((creatable) => (
              <option key={creatable} value={creatable}>{STOCK_ORIGIN_KIND_LABELS[creatable]}</option>
            ))}
          </select>
          {fieldErrors.kind === undefined ? null : (
            <span id="origin-kind-error" className="stock-field-error" role="alert">{fieldErrors.kind}</span>
          )}
        </div>
        <div className="stock-field">
          <label htmlFor="origin-name">Nome</label>
          <input
            id="origin-name"
            name="name"
            type="text"
            maxLength={150}
            required
            disabled={isSubmitting}
            aria-invalid={fieldErrors.name !== undefined}
            aria-describedby={fieldErrors.name === undefined ? undefined : 'origin-name-error'}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFieldErrors({});
            }}
          />
          {fieldErrors.name === undefined ? null : (
            <span id="origin-name-error" className="stock-field-error" role="alert">{fieldErrors.name}</span>
          )}
        </div>
        {submissionError === null ? null : (
          <p className="stock-message stock-message-error" role="alert">{submissionError}</p>
        )}
        <div className="stock-actions">
          <button className="stock-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Criar origem'}
          </button>
          <button className="stock-cancel" type="button" disabled={isSubmitting} onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
