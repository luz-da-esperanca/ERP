import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from 'react';
import { Link } from 'react-router';
import type { QueryState } from './use-query';
import { errorMessage } from './use-action';

export function Page({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Luz da Esperança</span>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </>
  );
}
export function Panel({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Alert({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      className={error ? 'message error' : 'message'}
      role={error ? 'alert' : 'status'}
    >
      {children}
    </p>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
export function AsyncView<T>({
  state,
  children,
}: {
  state: QueryState<T>;
  children: (data: T) => ReactNode;
}) {
  if (state.status === 'loading')
    return (
      <p role="status" className="loading">
        Carregando registros…
      </p>
    );
  if (state.status === 'error')
    return <Alert error>{errorMessage(state.error)}</Alert>;
  return children(state.data);
}
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <label className="field">
      {label}
      {props.required && <span aria-hidden="true"> *</span>}
      <input {...props} />
    </label>
  );
}
export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string }) {
  return (
    <label className="field">
      {label}
      {props.required && <span aria-hidden="true"> *</span>}
      <select {...props}>{children}</select>
    </label>
  );
}
export function Submit({
  pending,
  children = 'Salvar',
}: {
  pending: boolean;
  children?: ReactNode;
}) {
  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? 'Salvando…' : children}
    </button>
  );
}
export function PendingBadge() {
  return <span className="status pending">Pendente</span>;
}
export function BackLink({
  to,
  children = 'Voltar',
}: {
  to: string;
  children?: ReactNode;
}) {
  return (
    <Link className="text-link back-link" to={to}>
      ← {children}
    </Link>
  );
}
export const textValue = (data: FormData, key: string) =>
  data.get(key)?.toString() ?? '';
export const nullableValue = (data: FormData, key: string) =>
  textValue(data, key).trim() || null;
