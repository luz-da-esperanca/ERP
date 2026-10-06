import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import type { HttpEligibility } from '../infra/http-eligibility';
import { useApiQuery } from '../../../shared/use-query';
import { Page, Panel, AsyncView, BackLink } from '../../../shared/ui';
import { displayInstant } from '../../../shared/time';
export function EligibilityPolicyPage({
  gateway,
}: {
  gateway: HttpEligibility;
}) {
  const { id = '' } = useParams();
  const load = useCallback(() => gateway.getPolicy(id), [gateway, id]);
  const state = useApiQuery(load);
  return (
    <>
      <BackLink to="/eligibility-policies" />
      <Page title="Versão da política de aptidão">
        <AsyncView state={state}>
          {(policy) => (
            <Panel title={policy.decisionReference}>
              <p>
                Vigência: {policy.effectiveFrom} até{' '}
                {policy.effectiveUntilExclusive ?? 'aberta'} (fim exclusivo).
              </p>
              <p>
                Registrada em {displayInstant(policy.recordedAt)} · Motivo:{' '}
                {policy.reason}
              </p>
              <dl>
                <dt>Período de avaliação</dt>
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
                <dt>Combinação de atividades</dt>
                <dd>
                  {policy.definition.activityCombination === 'COMBINED'
                    ? 'Combinadas'
                    : 'Basta uma atividade'}
                </dd>
                <dt>Composição considerada</dt>
                <dd>
                  {policy.definition.membershipScope === 'CURRENT_ON_REFERENCE'
                    ? 'Vigente na referência'
                    : 'Vigente durante o período'}
                </dd>
                <dt>Oportunidades consideradas</dt>
                <dd>
                  {policy.definition.opportunityRule ===
                  'ENROLLMENT_OR_RECORDED'
                    ? 'Inscrição vigente ou marcação explícita'
                    : 'Encontros realizados durante o vínculo'}
                </dd>
              </dl>
              {policy.definition.activityIds.map((activityId) => (
                <p key={activityId}>
                  <Link to={`/activities/${activityId}`}>
                    Consultar atividade utilizada
                  </Link>
                </p>
              ))}
              <p>
                Justificativas não compõem a avaliação. A política utiliza os
                encontros registrados e mantém evidência insuficiente como
                Pendente.
              </p>
            </Panel>
          )}
        </AsyncView>
      </Page>
    </>
  );
}
