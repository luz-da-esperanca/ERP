import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type {
  EligibilityPreviewDto,
  AssessmentDto,
} from '@erp/contracts/eligibility-api';
import type { HttpEligibility } from '../infra/http-eligibility';
import { useApiQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import { useOperationKey } from '../../../shared/use-operation-key';
import { civilToday, displayInstant } from '../../../shared/time';
import {
  Page,
  Panel,
  Field,
  Alert,
  AsyncView,
  BackLink,
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

export function EligibilityEvidence({
  result,
}: {
  result: EligibilityPreviewDto;
}) {
  return (
    <Panel title={`Situação: ${eligibilityLabels[result.status]}`}>
      <p>
        Referência: {result.referenceDate} · Consulta:{' '}
        {displayInstant(result.evaluatedAt)}
      </p>
      <p>Aptidão não implica prioridade nem garantia de benefício.</p>
      {result.policyId ? (
        <Link to={`/eligibility-policies/${result.policyId}`}>
          Consultar política utilizada
        </Link>
      ) : null}
      {result.pendingReasons.map((reason) => (
        <p key={reason}>{reasonLabels[reason]}</p>
      ))}
      {result.explanation.period && (
        <p>
          Período: {result.explanation.period.from} até{' '}
          {result.explanation.period.toExclusive} (fim exclusivo).
        </p>
      )}
      {result.evidences.map((evidence, index) => (
        <details key={`${evidence.personId}:${index}`}>
          <summary>
            Membro {index + 1}: {eligibilityLabels[evidence.status]}
          </summary>
          <Link to={`/people/${evidence.personId}`}>Consultar membro</Link>
          <p>
            {evidence.presenceCount} presenças · {evidence.absenceCount}{' '}
            ausências · {evidence.unrecordedCount} sem marcação ·{' '}
            {evidence.sessionCount} encontros.
          </p>
          <p>
            Período: {evidence.periodStart} até {evidence.periodEndExclusive}{' '}
            (fim exclusivo). Cobertura{' '}
            {evidence.coverageComplete ? 'completa' : 'incompleta'}.
          </p>
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
              <Link to={`/activities/${id}`}>
                Consultar atividade utilizada
              </Link>
            </p>
          ))}
          <details>
            <summary>Revisões das fontes utilizadas</summary>
            <pre className="overflow-auto">
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
        actions={<Link to="/eligibility-policies">Políticas</Link>}
      >
        <Panel>
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
            Atualizar prévia
          </button>
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
