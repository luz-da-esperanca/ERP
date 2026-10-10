import { RecordValues, recordLabel } from '../../../shared/record-list';
import { displayInstant } from '../../../shared/time';

const actionLabels: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  CANCEL: 'Cancelamento',
  CLOSE: 'Encerramento',
  CORRECT: 'Correção',
  INVALIDATE: 'Invalidação',
  MERGE: 'Unificação',
  ACTIVATE: 'Ativação',
  DEACTIVATE: 'Desativação',
  PASSWORD_CHANGE: 'Troca de senha',
  PASSWORD_RESET: 'Redefinição de senha',
};

export interface AuditEntryView {
  id: string;
  action: string;
  revision: number;
  actor?: { displayName: string } | null;
  recordedAt: string;
  occurredAt?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

// Only changed fields are listed, so reviewers do not have to compare two full snapshots.
function changedFields(before: unknown, after: unknown) {
  const previous = asRecord(before);
  const next = asRecord(after);
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .filter(
      (key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]),
    )
    .map((key) => ({ key, before: previous[key], after: next[key] }));
}

export function AuditEntry({ entry }: { entry: AuditEntryView }) {
  const changes = changedFields(entry.before, entry.after);
  return (
    <details className="disclosure audit-entry">
      <summary>
        <span className="status-badge">
          {actionLabels[entry.action] ?? entry.action}
        </span>
        <span>{entry.actor?.displayName ?? 'Sistema'}</span>
        <time dateTime={entry.recordedAt}>
          {displayInstant(entry.recordedAt)}
        </time>
      </summary>
      <dl className="audit-entry-meta">
        <dt>Revisão</dt>
        <dd>{entry.revision}</dd>
        <dt>Data do fato</dt>
        <dd>
          {entry.occurredAt
            ? displayInstant(entry.occurredAt)
            : 'Não informada'}
        </dd>
        <dt>Motivo</dt>
        <dd>{entry.reason ?? 'Não informado'}</dd>
      </dl>
      {changes.length ? (
        <table className="audit-diff">
          <thead>
            <tr>
              <th scope="col">Campo</th>
              <th scope="col">Antes</th>
              <th scope="col">Depois</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.key}>
                <th scope="row">{recordLabel(change.key)}</th>
                <td>
                  <RecordValues value={change.before} />
                </td>
                <td>
                  <RecordValues value={change.after} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Nenhum campo alterado neste lançamento.</p>
      )}
    </details>
  );
}
