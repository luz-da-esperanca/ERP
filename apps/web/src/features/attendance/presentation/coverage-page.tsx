import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import type { HttpAttendance } from '../infra/http-attendance';
import { useApiQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import { useOperationKey } from '../../../shared/use-operation-key';
import {
  Page,
  Panel,
  Field,
  AsyncView,
  Alert,
  Submit,
  BackLink,
  textValue,
} from '../../../shared/ui';
import { RecordValues } from '../../../shared/record-list';
import { civilToday } from '../../../shared/time';
export function CoveragePage({
  gateway,
  canWrite,
}: {
  gateway: HttpAttendance;
  canWrite: boolean;
}) {
  const { id = '' } = useParams();
  const [today] = useState(civilToday);
  const [period, setPeriod] = useState<{
    from: string;
    toExclusive: string;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(
    () =>
      period
        ? gateway.coverage(id, period.from, period.toExclusive)
        : Promise.resolve(null),
    [gateway, id, period],
  );
  const state = useApiQuery(load, refresh);
  const action = useAction();
  const keyFor = useOperationKey();
  return (
    <>
      <BackLink to={`/activities/${id}/attendance`} />
      <Page title="Cobertura dos encontros">
        <Panel>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setPeriod({
                from: textValue(data, 'from'),
                toExclusive: textValue(data, 'toExclusive'),
              });
            }}
          >
            <Field
              label="Início do período"
              name="from"
              type="date"
              required
              max={today}
            />
            <Field
              label="Fim do período (exclusivo)"
              name="toExclusive"
              type="date"
              required
              max={today}
            />
            <button className="button secondary">Consultar cobertura</button>
          </form>
        </Panel>
        <AsyncView state={state}>
          {(coverage) =>
            coverage && (
              <Panel title="Resultado de cobertura">
                <p>
                  {coverage.isComplete
                    ? 'Cobertura completa'
                    : 'Cobertura incompleta'}
                </p>
                <p>
                  {coverage.periodStart} até {coverage.periodEndExclusive} (fim
                  exclusivo).
                </p>
                <h3>Trechos confirmados</h3>
                <RecordValues value={coverage.confirmedPeriods} />
                <h3>Lacunas</h3>
                <RecordValues value={coverage.gaps} />
                <h3>Declarações</h3>
                <RecordValues value={coverage.declarations} />
                {canWrite && (
                  <form
                    className="form-stack"
                    key={`${coverage.sourceFingerprint}:${coverage.periodStart}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void action.run(async () => {
                        if (data.get('confirmed') !== 'on')
                          throw new Error(
                            'Explicit coverage confirmation is required',
                          );
                        const input = {
                          periodStart: coverage.periodStart,
                          periodEndExclusive: coverage.periodEndExclusive,
                          expectedActivityRevision:
                            coverage.expectedActivityRevision,
                          expectedSourceFingerprint: coverage.sourceFingerprint,
                          confirmed: true as const,
                          reason: textValue(data, 'reason'),
                        };
                        await gateway.declareCoverage(
                          id,
                          input,
                          keyFor(`coverage/${id}`, input),
                        );
                        setRefresh(refresh + 1);
                      });
                    }}
                  >
                    <p>
                      Esta declaração confirma a completude do registro de
                      encontros. Não registra presença nem transforma marcações
                      desconhecidas em ausências.
                    </p>
                    <Field
                      label="Confirmo que todos os encontros do período foram conferidos"
                      name="confirmed"
                      type="checkbox"
                      required
                    />
                    <Field
                      label="Motivo da declaração"
                      name="reason"
                      required
                      maxLength={1000}
                    />
                    {action.error && <Alert error>{action.error}</Alert>}
                    <Submit pending={action.pending}>Declarar cobertura</Submit>
                  </form>
                )}
              </Panel>
            )
          }
        </AsyncView>
        <button
          className="button secondary"
          onClick={() => setRefresh(refresh + 1)}
        >
          Atualizar cobertura
        </button>
      </Page>
    </>
  );
}
