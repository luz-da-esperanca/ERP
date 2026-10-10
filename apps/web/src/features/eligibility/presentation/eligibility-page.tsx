import { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import {
  BadgeCheck,
  CircleCheck,
  CircleHelp,
  CircleX,
  RefreshCw,
  SlidersHorizontal,
  UserRound,
  CalendarDays,
} from 'lucide-react';
import type {
  EligibilityPreviewDto,
  AssessmentDto,
} from '@erp/contracts/eligibility-api';
import type { HttpEligibility } from '../infra/http-eligibility';
import { useApiQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import { useOperationKey } from '../../../shared/use-operation-key';
import {
  civilToday,
  displayInstant,
  displayDate,
  addDays,
} from '../../../shared/time';
import {
  Page,
  Panel,
  Field,
  Alert,
  AsyncView,
  BackLink,
  ActionLink,
} from '../../../shared/ui';

export const eligibilityLabels = {
  ELIGIBLE: 'Apta',
  INELIGIBLE: 'Não apta',
  PENDING: 'Pendente',
};
const reasonLabels = {
  POLICY_UNDEFINED: 'Política não configurada',
  REFERENCE_OUTSIDE_PERIOD: 'Referência fora do período da política',
  MEMBERSHIP_UNRESOLVED: 'Composição familiar não resolvida',
  NO_OPPORTUNITIES: 'Sem oportunidades suficientes',
  COVERAGE_INCOMPLETE: 'Cobertura incompleta',
  MARKINGS_INCOMPLETE: 'Marcações incompletas',
};
const statusIcons = {
  ELIGIBLE: CircleCheck,
  INELIGIBLE: CircleX,
  PENDING: CircleHelp,
};

export function EligibilityEvidence({
  result,
}: {
  result: EligibilityPreviewDto;
}) {
  const StatusIcon = statusIcons[result.status];
  return (
    <Panel title="Resultado da consulta">
      <div className="eligibility-summary">
        <p className="eligibility-status" data-status={result.status}>
          <StatusIcon size={24} aria-hidden="true" />
          <strong>{eligibilityLabels[result.status]}</strong>
        </p>
        <dl className="profile-details">
          <dt>Data de referência</dt>
          <dd>{displayDate(result.referenceDate)}</dd>
          <dt>Consultada em</dt>
          <dd>{displayInstant(result.evaluatedAt)}</dd>
        </dl>
      </div>
      <p className="muted">
        Aptidão não implica prioridade nem garantia de benefício.
      </p>
      {result.policyId ? (
        <ActionLink
          icon={SlidersHorizontal}
          to={`/eligibility-policies/${result.policyId}`}
        >
          Consultar política utilizada
        </ActionLink>
      ) : null}
      {!!result.pendingReasons.length && (
        <ul className="pending-reasons">
          {result.pendingReasons.map((reason) => (
            <li key={reason}>{reasonLabels[reason]}</li>
          ))}
        </ul>
      )}
      {result.explanation.period && (
        <p className="period-caption">
          <CalendarDays size={18} aria-hidden="true" /> Período:{' '}
          {displayDate(result.explanation.period.from)} a{' '}
          {displayDate(addDays(result.explanation.period.toExclusive, -1))}.
        </p>
      )}
      {result.evidences.map((evidence, index) => (
        <details className="disclosure" key={`${evidence.personId}:${index}`}>
          <summary>
            Membro {index + 1}: {eligibilityLabels[evidence.status]}
          </summary>
          <ActionLink icon={UserRound} to={`/people/${evidence.personId}`}>
            Consultar membro
          </ActionLink>
          <dl className="evidence-metrics">
            {[
              ['Presenças', evidence.presenceCount],
              ['Ausências', evidence.absenceCount],
              ['Sem marcação', evidence.unrecordedCount],
              ['Encontros', evidence.sessionCount],
            ].map(([label, count]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          <p>
            Período: {displayDate(evidence.periodStart)} a{' '}
            {displayDate(addDays(evidence.periodEndExclusive, -1))}. Cobertura{' '}
            {evidence.coverageComplete ? 'completa' : 'incompleta'}.
          </p>
          {evidence.pendingReason && (
            <p>{reasonLabels[evidence.pendingReason]}</p>
          )}
          <p>
            Faixa de frequência:{' '}
            {evidence.rateLowerBasisPoints === null
              ? 'desconhecida'
              : `${evidence.rateLowerBasisPoints / 100}%`}{' '}
            a{' '}
            {evidence.rateUpperBasisPoints === null
              ? 'desconhecida'
              : `${evidence.rateUpperBasisPoints / 100}%`}
            .
          </p>
          {evidence.activityIds.map((id) => (
            <p key={id}>
              <ActionLink icon={CalendarDays} to={`/activities/${id}`}>
                Consultar atividade utilizada
              </ActionLink>
            </p>
          ))}
          <details className="disclosure">
            <summary>Revisões das fontes utilizadas</summary>
            <pre className="technical-details">
              {JSON.stringify(evidence.sourceVersions, null, 2)}
            </pre>
          </details>
        </details>
      ))}
    </Panel>
  );
}

export function FamilyEligibilityPage({
  gateway,
  canEvaluate,
}: {
  gateway: HttpEligibility;
  canEvaluate: boolean;
}) {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const [today] = useState(civilToday);
  const [referenceDate, setReferenceDate] = useState(
    () => params.get('referenceDate') ?? today,
  );
  const [refresh, setRefresh] = useState(0);
  const [saved, setSaved] = useState<AssessmentDto | null>(null);
  const load = useCallback(
    () => gateway.preview(id, referenceDate),
    [gateway, id, referenceDate],
  );
  const state = useApiQuery(load, refresh);
  const keyFor = useOperationKey();
  const action = useAction();
  return (
    <>
      <BackLink to={`/families/${id}`} />
      <Page
        title="Aptidão familiar"
        actions={
          <ActionLink icon={SlidersHorizontal} to="/eligibility-policies">
            Políticas
          </ActionLink>
        }
      >
        <Panel>
          <div className="query-toolbar">
            <Field
              label="Data de referência"
              name="referenceDate"
              type="date"
              required
              max={today}
              value={referenceDate}
              onChange={(event) => {
                if (event.target.value) {
                  setReferenceDate(event.target.value);
                  setSaved(null);
                }
              }}
            />
            <button
              className="button secondary"
              onClick={() => {
                setRefresh((value) => value + 1);
                setSaved(null);
              }}
            >
              <RefreshCw size={18} aria-hidden="true" />
              Atualizar prévia
            </button>
          </div>
        </Panel>
        <AsyncView state={state}>
          {(result) => (
            <>
              <EligibilityEvidence
                result={saved?.referenceDate === referenceDate ? saved : result}
              />
              {canEvaluate && (
                <button
                  className="button primary"
                  disabled={action.pending}
                  onClick={() => {
                    void action.run(async () => {
                      const assessment = await gateway.assess(
                        id,
                        referenceDate,
                        keyFor(`assessment/${id}`, { referenceDate }),
                      );
                      setSaved(assessment);
                    });
                  }}
                >
                  <BadgeCheck size={18} aria-hidden="true" />
                  {action.pending ? 'Registrando…' : 'Registrar avaliação'}
                </button>
              )}
            </>
          )}
        </AsyncView>
        {saved && <Alert>Avaliação registrada.</Alert>}
        {action.error && <Alert error>{action.error}</Alert>}
      </Page>
    </>
  );
}

export function EligibilityAssessmentPage({
  gateway,
}: {
  gateway: HttpEligibility;
}) {
  const { id = '' } = useParams();
  const load = useCallback(() => gateway.getAssessment(id), [gateway, id]);
  const state = useApiQuery(load);
  return (
    <Page title="Avaliação de aptidão registrada">
      <AsyncView state={state}>
        {(assessment) => (
          <>
            <BackLink to={`/families/${assessment.familyId}/eligibility`} />
            <p>
              Esta avaliação preserva as evidências registradas em{' '}
              {displayInstant(assessment.evaluatedAt)}.
            </p>
            <EligibilityEvidence result={assessment} />
          </>
        )}
      </AsyncView>
    </Page>
  );
}
