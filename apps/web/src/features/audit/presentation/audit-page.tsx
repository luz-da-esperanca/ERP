import { useCallback, useState } from 'react';
import type { Capability } from '@erp/contracts/access';
import { authorizedAuditQuerySchema } from '@erp/contracts/audit-api';
import type { z } from 'zod';
import type { HttpAudit } from '../infra/http-audit';
import { useAction } from '../../../shared/use-action';
import { useApiQuery } from '../../../shared/use-query';
import {
  Page,
  Panel,
  Field,
  SelectField,
  AsyncView,
  Alert,
  textValue,
} from '../../../shared/ui';
import { toInstant } from '../../../shared/time';
import { AuditEntry } from './audit-entry';
const scopes: Array<{ entity: string; label: string; capability: Capability }> =
  [
    { entity: 'UserAccount', label: 'Contas', capability: 'accounts.manage' },
    { entity: 'Family', label: 'Famílias', capability: 'registration.read' },
    { entity: 'Person', label: 'Pessoas', capability: 'registration.read' },
    {
      entity: 'FamilyMembership',
      label: 'Vínculos familiares',
      capability: 'registration.read',
    },
    {
      entity: 'SizeProfile',
      label: 'Tamanhos',
      capability: 'registration.read',
    },
    {
      entity: 'DataQualityIssue',
      label: 'Qualidade cadastral',
      capability: 'registration.read',
    },
    {
      entity: 'IdentityMerge',
      label: 'Unificação',
      capability: 'registration.read',
    },
    { entity: 'Project', label: 'Projetos', capability: 'projects.read' },
    { entity: 'Activity', label: 'Atividades', capability: 'projects.read' },
    { entity: 'Institute', label: 'Institutos', capability: 'projects.read' },
    {
      entity: 'ServiceType',
      label: 'Tipos de atividade pontual',
      capability: 'projects.read',
    },
    {
      entity: 'ParticipantEnrollment',
      label: 'Inscrições',
      capability: 'projects.read',
    },
    {
      entity: 'ActivitySession',
      label: 'Encontros',
      capability: 'attendance.read',
    },
    { entity: 'Attendance', label: 'Marcações', capability: 'attendance.read' },
    {
      entity: 'AttendanceCoverage',
      label: 'Cobertura',
      capability: 'attendance.read',
    },
    {
      entity: 'EligibilityPolicy',
      label: 'Políticas de aptidão',
      capability: 'eligibility.read',
    },
    {
      entity: 'EligibilityAssessment',
      label: 'Avaliações de aptidão',
      capability: 'eligibility.read',
    },
    {
      entity: 'SocialForm',
      label: 'Ficha social',
      capability: 'socialForms.read',
    },
    {
      entity: 'Acknowledgement',
      label: 'Ciência em papel',
      capability: 'socialForms.read',
    },
    {
      entity: 'FieldSelectionVersion',
      label: 'Seleção de campos da ficha',
      capability: 'featureDecisions.manage',
    },
    {
      entity: 'SocialFormOption',
      label: 'Opções da ficha',
      capability: 'featureDecisions.manage',
    },
    {
      entity: 'FeatureDecision',
      label: 'Decisões de habilitação',
      capability: 'featureDecisions.manage',
    },
    {
      entity: 'RegistrationFieldSelection',
      label: 'Campos cadastrais',
      capability: 'featureDecisions.manage',
    },
  ];
export function AuditPage({
  gateway,
  capabilities,
}: {
  gateway: HttpAudit;
  capabilities: Capability[];
}) {
  const allowed = scopes.filter((scope) =>
    capabilities.includes(scope.capability),
  );
  const [query, setQuery] = useState<
    z.input<typeof authorizedAuditQuerySchema>
  >(() =>
    authorizedAuditQuerySchema.parse({
      entityType: allowed[0]?.entity ?? 'UserAccount',
      page: 1,
    }),
  );
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(() => gateway.query(query), [gateway, query]);
  const state = useApiQuery(load, refresh);
  const action = useAction();
  return (
    <Page title="Auditoria">
      <Panel>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void action.run(async () => {
              setQuery(
                authorizedAuditQuerySchema.parse({
                  entityType: textValue(data, 'entityType'),
                  page: 1,
                  ...(textValue(data, 'from')
                    ? { from: toInstant(textValue(data, 'from')) }
                    : {}),
                  ...(textValue(data, 'to')
                    ? { to: toInstant(textValue(data, 'to')) }
                    : {}),
                  ...(textValue(data, 'entityId')
                    ? { entityId: textValue(data, 'entityId') }
                    : {}),
                  ...(textValue(data, 'actorId')
                    ? { actorId: textValue(data, 'actorId') }
                    : {}),
                }),
              );
            });
          }}
        >
          <SelectField label="Tipo de registro" name="entityType">
            {allowed.map((scope) => (
              <option key={scope.entity} value={scope.entity}>
                {scope.label}
              </option>
            ))}
          </SelectField>
          <Field
            label="Lançamentos a partir de"
            name="from"
            type="datetime-local"
          />
          <Field label="Lançamentos antes de" name="to" type="datetime-local" />
          <Field
            label="Identificador do registro (opcional)"
            name="entityId"
            pattern="[0-9a-fA-F-]{36}"
          />
          <Field
            label="Identificador do autor (opcional)"
            name="actorId"
            pattern="[0-9a-fA-F-]{36}"
          />
          <button className="button primary">Consultar auditoria</button>
        </form>
      </Panel>
      {action.error && <Alert error>{action.error}</Alert>}
      <AsyncView state={state}>
        {(result) => (
          <Panel title="Alterações autorizadas">
            {!result.data.length && (
              <p>Nenhuma alteração no filtro consultado.</p>
            )}
            {result.data.map((entry) => (
              <AuditEntry key={entry.id} entry={entry} />
            ))}
            <nav className="pagination" aria-label="Páginas da auditoria">
              <button
                className="button secondary"
                disabled={Number(query.page ?? 1) === 1}
                onClick={() =>
                  setQuery({ ...query, page: Number(query.page ?? 1) - 1 })
                }
              >
                Anterior
              </button>
              <span>
                Página {String(query.page ?? 1)} · {result.pagination.total}{' '}
                alterações
              </span>
              <button
                className="button secondary"
                disabled={
                  Number(query.page ?? 1) * result.pagination.pageSize >=
                  result.pagination.total
                }
                onClick={() =>
                  setQuery({ ...query, page: Number(query.page ?? 1) + 1 })
                }
              >
                Próxima
              </button>
            </nav>
          </Panel>
        )}
      </AsyncView>
      <button
        className="button secondary"
        onClick={() => setRefresh(refresh + 1)}
      >
        Atualizar auditoria
      </button>
    </Page>
  );
}
