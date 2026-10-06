import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { Capability } from '@erp/contracts/access';
import type { HttpErpClient } from '../../../app/http-erp-client';
import { useApiQuery } from '../../../shared/use-query';
import { Page, Panel, AsyncView } from '../../../shared/ui';
import { displayInstant } from '../../../shared/time';
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
  return (
    <Page title="Início" description={`Olá, ${displayName}.`}>
      <div className="quick-actions">
        {capabilities.includes('registration.write') && (
          <Link className="button primary" to="/families/new">
            Cadastrar família
          </Link>
        )}
        {capabilities.includes('projects.read') && (
          <Link className="button secondary" to="/projects">
            Projetos e atividades
          </Link>
        )}
        {capabilities.includes('reports.read') && (
          <Link className="button secondary" to="/reports">
            Consultar relatórios
          </Link>
        )}
      </div>
      {!canRead && (
        <Panel>
          <p>Escolha uma área no menu para consultar os dados do sistema.</p>
        </Panel>
      )}
      {canRead && (
        <div className="dashboard-grid">
          <Panel title="Cadastros">
            <AsyncView state={families}>
              {(result) =>
                result && (
                  <>
                    <strong>
                      {result.pagination.total} famílias cadastradas
                    </strong>
                    <p>
                      Famílias únicas no cadastro · Composição consultada em{' '}
                      {displayInstant(asOf)}.
                    </p>
                    <Link to="/families">Recuperar famílias do total</Link>
                  </>
                )
              }
            </AsyncView>
          </Panel>
          {canReadAudit && (
            <Panel title="Alterações familiares recentes">
              <AsyncView state={audit}>
                {(result) =>
                  result && (
                    <>
                      <ol>
                        {result.data.map((entry) => (
                          <li key={entry.id}>
                            <Link to={`/families/${entry.entityId}`}>
                              Consultar família alterada
                            </Link>
                            <p>
                              {entry.actor?.displayName ?? 'Sistema'} ·{' '}
                              {displayInstant(entry.recordedAt)}
                            </p>
                            {entry.reason && <p>{entry.reason}</p>}
                          </li>
                        ))}
                      </ol>
                      {!result.data.length && (
                        <p>Nenhuma alteração familiar registrada.</p>
                      )}
                      <Link to="/audit">Consultar auditoria</Link>
                    </>
                  )
                }
              </AsyncView>
            </Panel>
          )}
        </div>
      )}
    </Page>
  );
}
