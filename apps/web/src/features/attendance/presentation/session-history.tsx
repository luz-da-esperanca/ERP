import { useCallback, useState } from 'react';
import type { AttendanceDto } from '@erp/contracts/attendance-api';
import type {
  HttpAttendance,
  SessionHistoryEntity,
} from '../infra/http-attendance';
import { useApiQuery } from '../../../shared/use-query';
import { AsyncView, Empty, SelectField } from '../../../shared/ui';
import { displayInstant } from '../../../shared/time';
import { markingLabel } from './attendance-draft';

export function SessionHistory({
  gateway,
  sessionId,
  attendances,
  names,
}: {
  gateway: HttpAttendance;
  sessionId: string;
  attendances: AttendanceDto[];
  names: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [entityId, setEntityId] = useState(sessionId);
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Histórico de operações</summary>
      {open && (
        <>
          <SelectField
            label="Registro do histórico"
            name="history"
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
          >
            <option value={sessionId}>Encontro</option>
            {attendances.map((row) => (
              <option key={row.id} value={row.id}>
                {names[row.personId] ?? row.personId}
                {row.supersededById ? ' · marcação substituída' : ''}
              </option>
            ))}
          </SelectField>
          <HistoryEntries
            key={entityId}
            gateway={gateway}
            entityId={entityId}
            entityType={
              entityId === sessionId ? 'ActivitySession' : 'Attendance'
            }
          />
        </>
      )}
    </details>
  );
}
function HistoryEntries({
  gateway,
  entityId,
  entityType,
}: {
  gateway: HttpAttendance;
  entityId: string;
  entityType: SessionHistoryEntity;
}) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(
    () => gateway.history(entityType, entityId, page),
    [gateway, entityId, entityType, page],
  );
  const state = useApiQuery(load, refresh);
  const actions = {
    CREATE: 'Criação',
    CORRECT: 'Correção',
    CANCEL: 'Cancelamento',
    INVALIDATE: 'Invalidação',
    MERGE: 'Unificação',
  };
  return (
    <>
      <AsyncView state={state}>
        {(result) => (
          <>
            {result.data.length ? (
              <ol className="grid gap-4">
                {result.data.map((entry) => (
                  <li key={entry.id}>
                    <p>
                      {actions[entry.action]} · Revisão {entry.revision} ·{' '}
                      {displayInstant(entry.recordedAt)}
                    </p>
                    <p>
                      Autor: {entry.actor?.displayName ?? 'Não informado'}
                      {entry.actor && !entry.actor.active
                        ? ' (conta desativada)'
                        : ''}
                    </p>
                    {entry.occurredAt && (
                      <p>Data do fato: {displayInstant(entry.occurredAt)}</p>
                    )}
                    {entry.entityType === 'Attendance' && (
                      <>
                        <p>
                          {entry.before
                            ? markingLabel(entry.before.status)
                            : 'Não registrado'}{' '}
                          → {markingLabel(entry.after.status)}
                        </p>
                        <p className="break-words">
                          Família no fato:{' '}
                          {entry.before?.familyId ?? 'Não informado'} →{' '}
                          {entry.after.familyId}
                        </p>
                      </>
                    )}
                    {entry.entityType === 'ActivitySession' && (
                      <>
                        <p>
                          {entry.before
                            ? entry.before.status === 'CANCELED'
                              ? 'Cancelado'
                              : 'Realizado'
                            : 'Não registrado'}{' '}
                          →{' '}
                          {entry.after.status === 'CANCELED'
                            ? 'Cancelado'
                            : 'Realizado'}
                        </p>
                        <p>
                          Data do encontro:{' '}
                          {entry.before
                            ? displayInstant(entry.before.occurredAt)
                            : 'Não informado'}{' '}
                          → {displayInstant(entry.after.occurredAt)}
                        </p>
                        <p className="break-words">
                          Responsável:{' '}
                          {entry.before?.responsibleId ?? 'Não informado'} →{' '}
                          {entry.after.responsibleId}
                        </p>
                      </>
                    )}
                    {entry.reason && <p>{entry.reason}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>Nenhuma operação no histórico consultado.</Empty>
            )}
            <nav
              className="mt-4 flex items-center gap-4"
              aria-label="Páginas do histórico"
            >
              <button
                className="button secondary"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </button>
              <span>Página {page}</span>
              <button
                className="button secondary"
                disabled={
                  page * result.pagination.pageSize >= result.pagination.total
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Próxima
              </button>
            </nav>
          </>
        )}
      </AsyncView>
      {state.status === 'error' && (
        <button
          className="button secondary"
          onClick={() => setRefresh((value) => value + 1)}
        >
          Tentar novamente
        </button>
      )}
    </>
  );
}
