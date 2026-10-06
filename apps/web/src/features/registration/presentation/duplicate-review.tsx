import { useCallback, useState } from 'react';
import type { QualityIssueDto } from '@erp/contracts/data-quality-api';
import type { MergePreviewDto } from '@erp/contracts/identity-merge-api';
import type {
  DataQualityGateway,
  DuplicateEntityType,
  RegistrationRecord,
} from '../application/data-quality-gateway';
import {
  Alert,
  AsyncView,
  Empty,
  Panel,
  SelectField,
} from '../../../shared/ui';
import { useApiQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import { ApiRequestError } from '../../../shared/api-client';
import {
  fieldLabel,
  fieldValue,
  recordFields,
  recordLabel,
} from './duplicate-labels';
import { MergeReview } from './merge-review';
import { DistinctResolution } from './distinct-resolution';

export function DuplicateReview({
  gateway,
  entityType,
  ids,
  issue,
  capabilities,
  onClose,
  onCompleted,
}: {
  gateway: DataQualityGateway;
  entityType: DuplicateEntityType;
  ids: string[];
  issue?: QualityIssueDto;
  capabilities: readonly string[];
  onClose(): void;
  onCompleted(message: string): void;
}) {
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      Promise.all(
        [...new Set(ids)].map((id) => gateway.record(entityType, id)),
      ),
    [gateway, entityType, ids],
  );
  const state = useApiQuery(load);
  return (
    <Panel
      title={`Comparação de ${entityType === 'PERSON' ? 'pessoas' : 'famílias'}`}
    >
      <button
        className="button secondary mb-4"
        type="button"
        disabled={busy}
        onClick={onClose}
      >
        Voltar à consulta
      </button>
      <AsyncView state={state}>
        {(records) => (
          <RecordComparison
            gateway={gateway}
            records={records}
            busy={busy}
            onBusy={setBusy}
            entityType={entityType}
            issue={issue}
            capabilities={capabilities}
            onCompleted={onCompleted}
          />
        )}
      </AsyncView>
    </Panel>
  );
}

function RecordComparison({
  gateway,
  busy,
  onBusy,
  records,
  entityType,
  issue,
  capabilities,
  onCompleted,
}: {
  gateway: DataQualityGateway;
  busy: boolean;
  onBusy(busy: boolean): void;
  records: RegistrationRecord[];
  entityType: DuplicateEntityType;
  issue?: QualityIssueDto;
  capabilities: readonly string[];
  onCompleted(message: string): void;
}) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [distinct, setDistinct] = useState(false);
  const [preview, setPreview] = useState<MergePreviewDto | null>(null);
  const action = useAction();
  const [snapshot, setSnapshot] = useState<{
    source: RegistrationRecord;
    target: RegistrationRecord;
  } | null>(null);
  const source =
    snapshot?.source.id === sourceId
      ? snapshot.source
      : records.find((record) => record.id === sourceId);
  const target =
    snapshot?.target.id === targetId
      ? snapshot.target
      : records.find((record) => record.id === targetId);
  const canonical = new Map(records.map((record) => [record.id, record]));
  async function generatePreview() {
    if (!source || !target || sourceId === targetId || action.pending || busy)
      return;
    setPreview(null);
    setDistinct(false);
    onBusy(true);
    try {
      await action.run(async () => {
        const next = await gateway.preview({ entityType, sourceId, targetId });
        const [currentSource, currentTarget] = await Promise.all([
          gateway.record(entityType, sourceId),
          gateway.record(entityType, targetId),
        ]);
        if (
          currentSource.id !== sourceId ||
          currentTarget.id !== targetId ||
          currentSource.revision !== next.expectedSourceRevision ||
          currentTarget.revision !== next.expectedTargetRevision
        )
          throw new ApiRequestError('REVISION_CONFLICT', 409);
        setSnapshot({ source: currentSource, target: currentTarget });
        setPreview(next);
      });
    } finally {
      onBusy(false);
    }
  }
  return (
    <div className="grid gap-6">
      {issue?.resolvedAt ? (
        <Alert>
          Ocorrência resolvida:{' '}
          {issue.resolution === 'DISTINCT'
            ? 'Registros distintos'
            : issue.resolution === 'MERGED'
              ? 'Unificada'
              : 'Resolvida'}
          . {issue.reason}
        </Alert>
      ) : null}
      {canonical.size < 2 ? (
        <Empty>
          Os candidatos já apontam para o mesmo cadastro. Atualize a consulta.
        </Empty>
      ) : null}
      <div className="form-grid">
        <SelectField
          label="Registro de origem"
          name="sourceId"
          value={sourceId}
          disabled={action.pending || busy}
          onChange={(event) => {
            setSourceId(event.target.value);
            setPreview(null);
          }}
        >
          <option value="">Selecione o registro</option>
          {[...canonical.values()].map((record) => (
            <option
              key={record.id}
              value={record.id}
              disabled={record.id === targetId}
            >
              {recordLabel(record)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Registro que permanecerá"
          name="targetId"
          value={targetId}
          disabled={action.pending || busy}
          onChange={(event) => {
            setTargetId(event.target.value);
            setPreview(null);
          }}
        >
          <option value="">Selecione o destino</option>
          {[...canonical.values()].map((record) => (
            <option
              key={record.id}
              value={record.id}
              disabled={record.id === sourceId}
            >
              {recordLabel(record)}
            </option>
          ))}
        </SelectField>
      </div>
      {source && target ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              record: source,
              title: 'Origem: deixará de ser o cadastro principal',
            },
            { record: target, title: 'Destino: registro que permanecerá' },
          ].map(({ record, title }) => (
            <section key={record.id} aria-label={title} className="min-w-0">
              <h3>{title}</h3>
              <p className="break-words">{recordLabel(record)}</p>
              <dl className="grid gap-2">
                {recordFields(record).map(([field, value]) => (
                  <div key={field}>
                    <dt className="text-sm font-semibold">
                      {fieldLabel(field)}
                    </dt>
                    <dd className="break-words">{fieldValue(value, field)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : (
        <Empty>Selecione dois registros para comparar.</Empty>
      )}
      {issue &&
      !issue.resolvedAt &&
      capabilities.includes('registration.write') ? (
        <section className="grid gap-4">
          <button
            className="button secondary w-fit"
            type="button"
            disabled={busy || action.pending}
            onClick={() => {
              setDistinct(!distinct);
              setPreview(null);
            }}
          >
            Registrar como distintos
          </button>
          {distinct ? (
            <DistinctResolution
              gateway={gateway}
              issue={issue}
              onBusy={onBusy}
              onCompleted={onCompleted}
            />
          ) : null}
        </section>
      ) : null}
      {action.error ? <Alert error>{action.error}</Alert> : null}
      {capabilities.includes('registration.merge') && !issue?.resolvedAt ? (
        <button
          className="button secondary w-fit"
          type="button"
          disabled={
            !source ||
            !target ||
            sourceId === targetId ||
            action.pending ||
            busy
          }
          onClick={() => {
            void generatePreview();
          }}
        >
          {action.pending ? 'Gerando prévia…' : 'Gerar prévia'}
        </button>
      ) : null}
      {preview && source && target ? (
        <MergeReview
          key={preview.sourceFingerprint}
          gateway={gateway}
          preview={preview}
          source={source}
          target={target}
          onBusy={onBusy}
          onCompleted={onCompleted}
          onRefresh={() => {
            void generatePreview();
          }}
        />
      ) : null}
    </div>
  );
}
