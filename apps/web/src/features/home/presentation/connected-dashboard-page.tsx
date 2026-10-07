import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  ChartColumnIncreasing,
  CircleCheck,
  FolderKanban,
  History,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Capability } from '@erp/contracts/access';
import type { AuditEntryDto } from '@erp/contracts/audit-api';
import type { HttpErpClient } from '../../../app/http-erp-client';
import { useApiQuery } from '../../../shared/use-query';
import { Panel, AsyncView, Empty } from '../../../shared/ui';
import { auditDescription } from '../../../shared/audit';
import { appTimezone, civilToday, displayInstant } from '../../../shared/time';

const workLinks: {
  capability: Capability;
  title: string;
  description: string;
  to: string;
  label: string;
  icon: LucideIcon;
}[] = [
  {
    capability: 'projects.read',
    title: 'Acompanhar projetos e atividades',
    description: 'Inscrições, encontros e frequência',
    to: '/projects',
    label: 'Abrir projetos',
    icon: FolderKanban,
  },
  {
    capability: 'reports.read',
    title: 'Consultar históricos e relatórios',
    description: 'Consultas e relatórios',
    to: '/reports',
    label: 'Ver relatórios',
    icon: ChartColumnIncreasing,
  },
];

function greeting(name: string, instant: string) {
  const hour = Number(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: appTimezone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(instant)),
  );
  const salutation =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  return `${salutation}, ${name}. Paz e bem.`;
}

function RecentFamilyActivity({ entries }: { entries: AuditEntryDto[] }) {
  if (!entries.length)
    return <Empty>Nenhuma alteração familiar registrada.</Empty>;
  return (
    <ol className="activity-list">
      {entries.map(
        (entry) =>
          entry.entityType === 'Family' && (
            <li key={entry.id}>
              <CircleCheck size={16} aria-hidden="true" />
              <div>
                <strong>
                  <Link
                    className="dashboard-activity-link"
                    to={`/families/${entry.entityId}`}
                  >
                    {auditDescription({
                      action: entry.action,
                      entityLabel: `Família ${entry.after.code}`,
                    })}
                  </Link>
                </strong>
                <span>
                  {entry.actor?.displayName ?? 'Sistema'} ·{' '}
                  {displayInstant(entry.recordedAt)}
                </span>
              </div>
            </li>
          ),
      )}
    </ol>
  );
}

export function ConnectedDashboardPage({
  client,
  capabilities,
  displayName,
}: {
  client: HttpErpClient;
  capabilities: Capability[];
  displayName: string;
}) {
  const [asOf] = useState(() => new Date().toISOString());
  const canRead = capabilities.includes('registration.read');
  const loadFamilies = useCallback(
    () =>
      canRead
        ? client.registration.searchFamilies({ page: 1, pageSize: 1, asOf })
        : Promise.resolve(null),
    [client, canRead, asOf],
  );
  const canReadAudit = canRead && capabilities.includes('audit.read');
  const loadAudit = useCallback(
    () =>
      canReadAudit
        ? client.audit.query({ entityType: 'Family', pageSize: 5 })
        : Promise.resolve(null),
    [client, canReadAudit],
  );
  const families = useApiQuery(loadFamilies);
  const audit = useApiQuery(loadAudit);
  const hasQuickActions = capabilities.some((capability) =>
    ['registration.write', 'projects.read', 'reports.read'].includes(
      capability,
    ),
  );
  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <h1>{greeting(displayName, asOf)}</h1>
        <time dateTime={civilToday(new Date(asOf))}>
          {new Intl.DateTimeFormat('pt-BR', {
            timeZone: appTimezone,
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(asOf))}
        </time>
      </header>
      {hasQuickActions && (
        <nav className="quick-actions" aria-label="Ações rápidas">
          {capabilities.includes('registration.write') && (
            <Link className="button primary" to="/families/new">
              <Users size={17} aria-hidden="true" /> Cadastrar família
            </Link>
          )}
          {capabilities.includes('projects.read') && (
            <Link className="button secondary" to="/projects">
              <FolderKanban size={17} aria-hidden="true" /> Projetos e
              atividades
            </Link>
          )}
          {capabilities.includes('reports.read') && (
            <Link className="button secondary" to="/reports">
              <ChartColumnIncreasing size={17} aria-hidden="true" /> Consultar
              relatórios
            </Link>
          )}
        </nav>
      )}
      {!canRead && (
        <Panel>
          <p>Escolha uma área no menu para consultar os dados do sistema.</p>
        </Panel>
      )}
      {canRead && (
        <div
          className={`dashboard-grid${canReadAudit ? '' : ' dashboard-grid-single'}`}
        >
          <Panel>
            <div className="dashboard-panel-heading">
              <h2>Para hoje</h2>
              <span>Rotina de trabalho</span>
            </div>
            <ul className="dashboard-tasks">
              <li className="dashboard-task">
                <AsyncView state={families}>
                  {(result) =>
                    result && (
                      <>
                        <div className="dashboard-task-content">
                          <strong>
                            {result.pagination.total} famílias cadastradas
                          </strong>
                          <p>
                            <Users size={14} aria-hidden="true" /> Famílias
                            únicas · Composição em {displayInstant(asOf)}.
                          </p>
                        </div>
                        <Link
                          className="button secondary dashboard-task-action"
                          to="/families"
                        >
                          Consultar famílias{' '}
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      </>
                    )
                  }
                </AsyncView>
              </li>
              {workLinks
                .filter((item) => capabilities.includes(item.capability))
                .map(({ title, description, to, label, icon: Icon }) => (
                  <li className="dashboard-task" key={to}>
                    <div className="dashboard-task-content">
                      <strong>{title}</strong>
                      <p>
                        <Icon size={14} aria-hidden="true" /> {description}
                      </p>
                    </div>
                    <Link
                      className="button secondary dashboard-task-action"
                      to={to}
                    >
                      {label} <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
            </ul>
          </Panel>
          {canReadAudit && (
            <Panel>
              <div className="dashboard-panel-heading">
                <h2>Atividade recente</h2>
                <History size={18} aria-hidden="true" />
              </div>
              <AsyncView state={audit}>
                {(result) =>
                  result && (
                    <>
                      <RecentFamilyActivity entries={result.data} />
                      <Link
                        className="text-link dashboard-audit-link"
                        to="/audit"
                      >
                        Consultar auditoria{' '}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </>
                  )
                }
              </AsyncView>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
