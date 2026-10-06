import { useState } from 'react';
import type { QualityIssueDto } from '@erp/contracts/data-quality-api';
import type { DataQualityGateway } from '../application/data-quality-gateway';
import { Alert, Field } from '../../../shared/ui';
import { useAction } from '../../../shared/use-action';

export function DistinctResolution({
  gateway,
  issue,
  onBusy,
  onCompleted,
}: {
  gateway: DataQualityGateway;
  issue: QualityIssueDto;
  onBusy(busy: boolean): void;
  onCompleted(message: string): void;
}) {
  const [reason, setReason] = useState('');
  const [attempt, setAttempt] = useState<{
    reason: string;
    key: string;
  } | null>(null);
  const action = useAction();
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!reason.trim() || action.pending) return;
        const normalized = reason.trim();
        const key =
          attempt?.reason === normalized ? attempt.key : crypto.randomUUID();
        setAttempt({ reason: normalized, key });
        onBusy(true);
        void action
          .run(async () => {
            await gateway.resolve(
              issue.id,
              {
                expectedRevision: issue.revision,
                resolution: 'DISTINCT',
                reason: normalized,
              },
              key,
            );
            onCompleted(
              'Análise concluída. Os registros foram classificados como distintos.',
            );
          })
          .finally(() => onBusy(false));
      }}
    >
      <p>
        Esta análise classificará o registro e todos os candidatos desta
        ocorrência como distintos.
      </p>
      <Field
        label="Motivo da análise"
        name="distinctReason"
        required
        maxLength={1000}
        value={reason}
        disabled={action.pending}
        onChange={(event) => setReason(event.target.value)}
      />
      {action.error ? <Alert error>{action.error}</Alert> : null}
      <button
        className="button primary w-fit"
        type="submit"
        disabled={action.pending || !reason.trim()}
      >
        {action.pending ? 'Registrando…' : 'Confirmar registros distintos'}
      </button>
    </form>
  );
}
