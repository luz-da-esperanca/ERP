import { useCallback, useState } from 'react';
import type { HttpEligibility } from '../infra/http-eligibility';
import type { HttpProjects } from '../../projects/infra/http-projects';
import { useApiQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import { useOperationKey } from '../../../shared/use-operation-key';
import {
  Page,
  Panel,
  Field,
  SelectField,
  AsyncView,
  Alert,
  Submit,
  textValue,
} from '../../../shared/ui';
import { publishPolicySchema } from '@erp/contracts/eligibility-api';
import { displayInstant } from '../../../shared/time';

export function EligibilityPoliciesPage({
  gateway,
  projects,
  canWrite,
}: {
  gateway: HttpEligibility;
  projects: HttpProjects;
  canWrite: boolean;
}) {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(
    async () => ({
      policies: await gateway.listPolicies({ page }),
      overview: canWrite ? await projects.overview() : null,
    }),
    [gateway, projects, canWrite, page],
  );
  const state = useApiQuery(load, refresh);
  const action = useAction();
  const keyFor = useOperationKey();
  const [periodType, setPeriodType] = useState('');
  const [minimumType, setMinimumType] = useState('');
  return (
    <Page title="Políticas de aptidão">
      <AsyncView state={state}>
        {({ policies, overview }) => (
          <>
            <Panel title="Versões publicadas">
              {!policies.data.length && <p>Sem política configurada.</p>}
              {policies.data.map((policy) => (
                <details key={policy.id}>
                  <summary>
                    Vigência: {policy.effectiveFrom} até{' '}
                    {policy.effectiveUntilExclusive ?? 'aberta'} ·{' '}
                    {policy.decisionReference}
                  </summary>
                  <p>
                    Registrada em {displayInstant(policy.recordedAt)} · Motivo:{' '}
                    {policy.reason}
                  </p>
                  <dl>
                    <dt>Período</dt>
                    <dd>
                      {policy.definition.period.type === 'FIXED_PERIOD'
                        ? `${policy.definition.period.start} até ${policy.definition.period.endExclusive} (fim exclusivo)`
                        : `${policy.definition.period.length} ${policy.definition.period.type === 'ROLLING_DAYS' ? 'dias' : 'meses'}`}
                    </dd>
                    <dt>Mínimo</dt>
                    <dd>
                      {policy.definition.minimum.type === 'PRESENCE_COUNT'
                        ? `${policy.definition.minimum.value} presenças`
                        : `${policy.definition.minimum.basisPoints / 100}%`}
                    </dd>
                  </dl>
                  {policy.definition.activityIds.map((id) => (
                    <p key={id}>
                      Atividade:{' '}
                      {overview?.activities.find(
                        (activity) => activity.id === id,
                      )?.name ?? id}
                    </p>
                  ))}
                </details>
              ))}
              <nav aria-label="Páginas de políticas">
                <button
                  className="button secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {page} · {policies.pagination.total} políticas
                </span>
                <button
                  className="button secondary"
                  disabled={
                    page * policies.pagination.pageSize >=
                    policies.pagination.total
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </button>
              </nav>
            </Panel>
            {canWrite && page === 1 && (
              <Panel title="Publicar nova política">
                <form
                  className="form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void action.run(async () => {
                      const input = publishPolicySchema.parse({
                        expectedLatestPolicyId: policies.data[0]?.id ?? null,
                        effectiveFrom: textValue(data, 'effectiveFrom'),
                        decisionReference: textValue(data, 'decisionReference'),
                        reason: textValue(data, 'reason'),
                        retroactive: data.get('retroactive') === 'on',
                        definition: {
                          schemaVersion: 1,
                          period:
                            periodType === 'FIXED_PERIOD'
                              ? {
                                  type: periodType,
                                  start: textValue(data, 'periodStart'),
                                  endExclusive: textValue(data, 'periodEnd'),
                                }
                              : {
                                  type: periodType,
                                  length: Number(
                                    textValue(data, 'periodLength'),
                                  ),
                                },
                          minimum:
                            minimumType === 'PRESENCE_COUNT'
                              ? {
                                  type: minimumType,
                                  value: Number(textValue(data, 'minimum')),
                                }
                              : {
                                  type: minimumType,
                                  basisPoints: Math.round(
                                    Number(textValue(data, 'minimum')) * 100,
                                  ),
                                },
                          activityIds: data.getAll('activityIds'),
                          activityCombination: textValue(data, 'combination'),
                          membershipScope: textValue(data, 'scope'),
                          opportunityRule: textValue(data, 'opportunities'),
                          justificationRule: 'NOT_SUPPORTED',
                          recessRule: 'RECORDED_SESSIONS_ONLY',
                          newParticipantRule: 'OPPORTUNITY_RULE',
                          toleranceRule: 'NONE',
                          incompleteEvidenceRule: 'THREE_VALUED',
                        },
                      });
                      await gateway.publishPolicy(
                        input,
                        keyFor('policy', input),
                      );
                      setRefresh(refresh + 1);
                    });
                  }}
                >
                  <fieldset disabled={action.pending} className="form-grid">
                    <Field
                      label="Início da vigência"
                      name="effectiveFrom"
                      type="date"
                      required
                    />
                    <SelectField
                      label="Período de avaliação"
                      name="periodType"
                      required
                      value={periodType}
                      onChange={(event) => setPeriodType(event.target.value)}
                    >
                      <option value="">Selecione</option>
                      <option value="ROLLING_DAYS">
                        Dias anteriores à referência
                      </option>
                      <option value="CALENDAR_MONTHS">Meses civis</option>
                      <option value="FIXED_PERIOD">Período fixo</option>
                    </SelectField>
                    {periodType === 'FIXED_PERIOD' ? (
                      <>
                        <Field
                          label="Início do período"
                          name="periodStart"
                          type="date"
                          required
                        />
                        <Field
                          label="Fim do período (exclusivo)"
                          name="periodEnd"
                          type="date"
                          required
                        />
                      </>
                    ) : (
                      <Field
                        label="Quantidade de dias ou meses"
                        name="periodLength"
                        type="number"
                        min={1}
                        required
                      />
                    )}
                    <SelectField
                      label="Critério mínimo"
                      name="minimumType"
                      required
                      value={minimumType}
                      onChange={(event) => setMinimumType(event.target.value)}
                    >
                      <option value="">Selecione</option>
                      <option value="PRESENCE_COUNT">
                        Quantidade de presenças
                      </option>
                      <option value="ATTENDANCE_RATE">
                        Percentual de frequência
                      </option>
                    </SelectField>
                    <Field
                      label="Mínimo exigido"
                      name="minimum"
                      type="number"
                      min={minimumType === 'ATTENDANCE_RATE' ? 0.01 : 1}
                      max={minimumType === 'ATTENDANCE_RATE' ? 100 : 100000}
                      step={minimumType === 'ATTENDANCE_RATE' ? 0.01 : 1}
                      required
                    />
                    <SelectField
                      label="Combinação de atividades"
                      name="combination"
                      required
                      defaultValue=""
                    >
                      <option value="">Selecione</option>
                      <option value="ANY_ACTIVITY">
                        Uma atividade suficiente
                      </option>
                      <option value="COMBINED">Atividades combinadas</option>
                    </SelectField>
                    <SelectField
                      label="Composição considerada"
                      name="scope"
                      required
                      defaultValue=""
                    >
                      <option value="">Selecione</option>
                      <option value="CURRENT_ON_REFERENCE">
                        Membros vigentes na referência
                      </option>
                      <option value="ANY_WITHIN_PERIOD">
                        Membros com vínculo no período
                      </option>
                    </SelectField>
                    <SelectField
                      label="Oportunidades consideradas"
                      name="opportunities"
                      required
                      defaultValue=""
                    >
                      <option value="">Selecione</option>
                      <option value="ENROLLMENT_OR_RECORDED">
                        Inscrição ou marcação
                      </option>
                      <option value="ALL_COMPLETED_DURING_MEMBERSHIP">
                        Encontros durante o vínculo
                      </option>
                    </SelectField>
                    <Field
                      label="Referência da decisão institucional"
                      name="decisionReference"
                      maxLength={2000}
                      required
                    />
                    <Field
                      label="Motivo da publicação"
                      name="reason"
                      maxLength={1000}
                      required
                    />
                    <Field
                      label="Confirmo a vigência retroativa quando aplicável"
                      name="retroactive"
                      type="checkbox"
                    />
                  </fieldset>
                  <fieldset disabled={action.pending}>
                    <legend>Atividades válidas</legend>
                    {overview?.activities
                      .filter((activity) => activity.nature === 'PERIODIC')
                      .map((activity) => (
                        <Field
                          key={activity.id}
                          label={activity.name}
                          name="activityIds"
                          type="checkbox"
                          value={activity.id}
                        />
                      ))}
                  </fieldset>
                  <p>
                    Justificativas e tolerância não entram no cálculo. Evidência
                    incompleta pode manter a situação Pendente.
                  </p>
                  {action.error && <Alert error>{action.error}</Alert>}
                  <Submit pending={action.pending}>Publicar política</Submit>
                </form>
              </Panel>
            )}
          </>
        )}
      </AsyncView>
      <button
        className="button secondary"
        onClick={() => setRefresh(refresh + 1)}
      >
        Atualizar políticas
      </button>
    </Page>
  );
}
