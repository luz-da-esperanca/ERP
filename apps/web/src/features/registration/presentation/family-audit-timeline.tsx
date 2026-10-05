import { History } from 'lucide-react';
import type { AuditEntry } from '@erp/contracts/audit';
import type { QueryState } from '../../../shared/use-query';
import { displayInstant } from '../../../shared/time';
import { auditDescription } from '../../../shared/audit';
import { AsyncView, Empty, Panel } from '../../../shared/ui';

function FamilyAuditEvents({
  entries,
  familyId,
}: {
  entries: AuditEntry[];
  familyId: string;
}) {
  const familyEntries = entries
    .filter((entry) => entry.entityId === familyId)
    .sort((first, second) => {
      const byRecordedAt =
        Date.parse(second.recordedAt) - Date.parse(first.recordedAt);
      return byRecordedAt || second.id.localeCompare(first.id);
    });

  if (!familyEntries.length)
    return <Empty>Nenhuma alteração disponível para esta família.</Empty>;

  return (
    <ol className="audit-timeline">
      {familyEntries.map((entry) => (
        <li key={entry.id}>
          <span className="audit-timeline-icon">
            <History aria-hidden="true" size={15} />
          </span>
          <div className="audit-timeline-content">
            <strong>{auditDescription(entry)}</strong>
            <span>
              {entry.actorName} · Lançado em {displayInstant(entry.recordedAt)}
            </span>
            {entry.occurredAt && entry.occurredAt !== entry.recordedAt ? (
              <small>Fato em {displayInstant(entry.occurredAt)}</small>
            ) : null}
            {entry.reason ? <p>Motivo: {entry.reason}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function FamilyAuditTimeline({
  state,
  familyId,
}: {
  state: QueryState<AuditEntry[]>;
  familyId: string;
}) {
  return (
    <Panel title="Histórico de alterações">
      <AsyncView state={state}>
        {(entries) => (
          <FamilyAuditEvents entries={entries} familyId={familyId} />
        )}
      </AsyncView>
    </Panel>
  );
}
