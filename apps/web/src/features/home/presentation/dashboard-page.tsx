import { useCallback } from 'react';
import { Link } from 'react-router';
import { ClipboardList, Clock3, History, Users } from 'lucide-react';
import type { AuditEntry } from '@erp/contracts/audit';
import { useErp } from '../../../app/erp-provider';
import { auditDescription } from '../../../shared/audit';
import { displayInstant } from '../../../shared/time';
import { AsyncView, Empty, Panel, StatusBadge } from '../../../shared/ui';
import { useQuery } from '../../../shared/use-query';

function greeting(name: string) {
  const [firstName] = name.split(/\s|·/);
  return `Olá, ${firstName || 'pessoa usuária'}. Paz e bem.`;
}

function RecentActivity({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length)
    return (
      <Empty>
        As alterações autorizadas aparecerão aqui quando forem registradas.
      </Empty>
    );

  return (
    <ol className="activity-list">
      {entries.slice(0, 5).map((entry) => (
        <li key={entry.id}>
          <History aria-hidden="true" size={16} />
          <div>
            <strong>{auditDescription(entry)}</strong>
            <span>
              {entry.actorName} · {displayInstant(entry.recordedAt)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DashboardPage() {
  const { client, session } = useErp();
  const canReadRegistration = Boolean(
    session?.capabilities.includes('registration.read'),
  );
  const canWriteRegistration = Boolean(
    session?.capabilities.includes('registration.write'),
  );
  const canReadAudit = Boolean(session?.capabilities.includes('audit.read'));
  const loadFamilies = useCallback(
    () =>
      canReadRegistration
        ? client.registration.listFamilies()
        : Promise.resolve([]),
    [canReadRegistration, client],
  );
  const loadAudit = useCallback(
    () => (canReadAudit ? client.audit.list() : Promise.resolve([])),
    [canReadAudit, client],
  );
  const families = useQuery(loadFamilies);
  const audit = useQuery(loadAudit);

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <h1>{greeting(session?.user.displayName ?? '')}</h1>
          <p>Início</p>
        </div>
        <StatusBadge icon={<Clock3 size={14} />}>Dados sintéticos</StatusBadge>
      </header>

      <div className="quick-actions" aria-label="Ações rápidas">
        {canWriteRegistration ? (
          <Link className="button primary" to="/families/new">
            <Users size={17} /> Cadastrar família
          </Link>
        ) : null}
        {canReadRegistration ? (
          <Link className="button secondary" to="/families">
            <ClipboardList size={17} /> Consultar famílias
          </Link>
        ) : null}
      </div>

      <div className="dashboard-grid">
        <Panel title="Para hoje">
          <AsyncView state={families}>
            {(items) =>
              items.length ? (
                <div className="priority-summary">
                  <strong>{items.length} famílias cadastradas</strong>
                  <p>
                    Consulte a composição e os dados cadastrais diretamente na
                    lista de famílias.
                  </p>
                  <Link className="text-link" to="/families">
                    Abrir famílias
                  </Link>
                </div>
              ) : (
                <Empty>Nenhuma família cadastrada para consulta.</Empty>
              )
            }
          </AsyncView>
        </Panel>

        <Panel title="Atividade recente">
          <AsyncView state={audit}>
            {(entries) => <RecentActivity entries={entries} />}
          </AsyncView>
        </Panel>
      </div>
    </div>
  );
}
