import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { FrequencyResultDto } from '@erp/contracts/attendance-api';
import type { HttpAttendance } from '../infra/http-attendance';
import type { HttpProjects } from '../../projects/infra/http-projects';
import { PersonSelection } from '../../projects/presentation/enrollment-management';
import { useApiQuery } from '../../../shared/use-query';
import { Alert, AsyncView, Empty, Field, textValue } from '../../../shared/ui';
import { displayDate, displayInstant, startOfDay } from '../../../shared/time';
import { markingLabel } from './attendance-draft';

type FrequencySelection = {
  personId: string;
  name: string;
  from: string;
  toExclusive: string;
};
export function FrequencyQuery({
  gateway,
  projects,
  activityId,
}: {
  gateway: HttpAttendance;
  projects: HttpProjects;
  activityId: string;
}) {
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<FrequencySelection | null>(null);
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const select = event.currentTarget.elements.namedItem('personId');
          if (!(select instanceof HTMLSelectElement) || !select.value) {
            setError('Selecione uma pessoa para consultar a frequência.');
            return;
          }
          setError('');
          setSelection({
            personId: textValue(data, 'personId'),
            name: select.selectedOptions[0]?.textContent ?? '',
            from: textValue(data, 'from'),
            toExclusive: textValue(data, 'toExclusive'),
          });
          setRefresh((value) => value + 1);
        }}
      >
        <PersonSelection gateway={projects} />
        <Field label="Início do período" name="from" type="date" required />
        <Field
          label="Fim exclusivo do período"
          name="toExclusive"
          type="date"
          required
        />
        {error && <Alert error>{error}</Alert>}
        <button type="submit" className="button secondary">
          Consultar frequência
        </button>
      </form>
      {selection && (
        <FrequencyResults
          gateway={gateway}
          activityId={activityId}
          selection={selection}
          revision={refresh}
        />
      )}
    </>
  );
}
function FrequencyResults({
  gateway,
  activityId,
  selection,
  revision,
}: {
  gateway: HttpAttendance;
  activityId: string;
  selection: FrequencySelection;
  revision: number;
}) {
  const load = useCallback(
    () =>
      gateway.frequency(selection.personId, {
        activityId,
        from: startOfDay(selection.from),
        toExclusive: startOfDay(selection.toExclusive),
      }),
    [gateway, activityId, selection],
  );
  const state = useApiQuery(load, revision);
  return (
    <div className="mt-6">
      <AsyncView state={state}>
        {(result) => (
          <>
            <h3>Frequência de {selection.name}</h3>
            <p>
              {displayInstant(result.from)} até{' '}
              {displayInstant(result.toExclusive)} (fim exclusivo).
            </p>
            <ul>
              <li>Encontros: {result.sessionCount}</li>
              <li>Presenças: {result.presenceCount}</li>
              <li>Ausências: {result.absenceCount}</li>
              <li>Não registrados: {result.unrecordedCount}</li>
              <li>
                Percentual:{' '}
                {result.attendanceRate === null
                  ? 'desconhecido'
                  : `${result.attendanceRate.toLocaleString('pt-BR')}%`}
              </li>
            </ul>
            <p>
              Marcações: {result.markingsComplete ? 'completas' : 'incompletas'}{' '}
              · Cobertura: {result.coverageComplete ? 'completa' : 'incompleta'}{' '}
              · Contexto familiar:{' '}
              {result.contextComplete ? 'completo' : 'incompleto'}.
            </p>
            <p className="muted">
              Contagem por pessoa e encontro com inscrição vigente ou marcação
              avulsa explícita. Encontros cancelados não entram no total.
            </p>
            <OpportunityList result={result} />
            <CoverageResult
              gateway={gateway}
              activityId={activityId}
              from={selection.from}
              toExclusive={selection.toExclusive}
              revision={revision}
            />
          </>
        )}
      </AsyncView>
    </div>
  );
}
function OpportunityList({ result }: { result: FrequencyResultDto }) {
  const opportunities = [
    ...result.opportunities,
    ...result.unresolvedOpportunities.filter(
      (unresolved) =>
        !result.opportunities.some(
          (row) => row.sessionId === unresolved.sessionId,
        ),
    ),
  ];
  return opportunities.length ? (
    <div className="table-wrap mt-4">
      <table aria-label="Encontros considerados">
        <thead>
          <tr>
            <th>Encontro</th>
            <th>Marcação</th>
            <th>Critério</th>
            <th>Contexto familiar</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((row) => (
            <tr key={row.sessionId}>
              <th scope="row">
                <Link
                  className="text-link"
                  to={`/activities/${result.activityId}/attendance/${row.sessionId}`}
                >
                  {displayInstant(row.occurredAt)}
                </Link>
              </th>
              <td>{markingLabel(row.attendance?.status)}</td>
              <td>
                {row.relevance === 'BOTH'
                  ? 'Inscrição e marcação'
                  : row.relevance === 'RECORDED'
                    ? 'Marcação avulsa'
                    : 'Inscrição vigente'}
              </td>
              <td className="break-words">
                {row.contextResolved
                  ? (row.familyId ?? 'Não informado')
                  : 'Não resolvido'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>Nenhum encontro considerado no período.</Empty>
  );
}
function CoverageResult({
  gateway,
  activityId,
  from,
  toExclusive,
  revision,
}: {
  gateway: HttpAttendance;
  activityId: string;
  from: string;
  toExclusive: string;
  revision: number;
}) {
  const load = useCallback(
    () => gateway.coverage(activityId, from, toExclusive),
    [gateway, activityId, from, toExclusive],
  );
  const state = useApiQuery(load, revision);
  return (
    <details className="mt-4">
      <summary>Cobertura dos encontros</summary>
      <AsyncView state={state}>
        {(coverage) => (
          <>
            <p>
              {coverage.isComplete
                ? 'Cobertura completa'
                : 'Cobertura incompleta'}
              : {displayDate(coverage.periodStart)} até{' '}
              {displayDate(coverage.periodEndExclusive)} (fim exclusivo).
            </p>
            <h4>Trechos confirmados</h4>
            {coverage.confirmedPeriods.length ? (
              <ul>
                {coverage.confirmedPeriods.map((period) => (
                  <li key={period.from}>
                    {displayDate(period.from)} até{' '}
                    {displayDate(period.toExclusive)} (fim exclusivo)
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhum trecho confirmado.</p>
            )}
            <h4>Lacunas</h4>
            {coverage.gaps.length ? (
              <ul>
                {coverage.gaps.map((period) => (
                  <li key={period.from}>
                    {displayDate(period.from)} até{' '}
                    {displayDate(period.toExclusive)} (fim exclusivo)
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhuma lacuna no período.</p>
            )}
            <h4>Declarações</h4>
            {coverage.declarations.length ? (
              coverage.declarations.map((declaration) => (
                <div className="mt-4" key={declaration.id}>
                  <p>
                    {displayDate(declaration.periodStart)} até{' '}
                    {displayDate(declaration.periodEndExclusive)} (fim
                    exclusivo) · Revisão {declaration.revision}
                  </p>
                  <p className="break-words">
                    Declarada por {declaration.declaredBy} em{' '}
                    {displayInstant(declaration.declaredAt)}
                  </p>
                  {declaration.invalidatedPeriods.length > 0 && (
                    <>
                      <h4>Trechos invalidados</h4>
                      <ul>
                        {declaration.invalidatedPeriods.map((period, index) => (
                          <li className="break-words" key={index}>
                            {displayDate(period.from)} até{' '}
                            {displayDate(period.toExclusive)} (fim exclusivo) ·{' '}
                            {displayInstant(period.recordedAt)} · Autor:{' '}
                            {period.recordedBy}
                            <p>{period.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ))
            ) : (
              <p>Nenhuma declaração no período.</p>
            )}
          </>
        )}
      </AsyncView>
    </details>
  );
}
