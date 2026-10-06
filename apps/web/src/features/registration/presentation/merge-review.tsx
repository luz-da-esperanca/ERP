import { useState } from 'react';
import type {
  MergePreviewDto,
  MergeCommandInput,
} from '@erp/contracts/identity-merge-api';
import { mergeCommandSchema } from '@erp/contracts/identity-merge-api';
import type {
  DataQualityGateway,
  RegistrationRecord,
} from '../application/data-quality-gateway';
import { Alert, Field, SelectField } from '../../../shared/ui';
import { useAction } from '../../../shared/use-action';
import { ApiRequestError } from '../../../shared/api-client';
import {
  IntervalResolutionFields,
  AttendanceResolutionFields,
  SizeProfileOptions,
} from './merge-resolution-fields';
import type {
  IntervalSelections,
  AttendanceResolution,
} from './merge-resolution-fields';
import {
  fieldLabel,
  fieldValue,
  recordFields,
  recordLabel,
} from './duplicate-labels';

type FieldChoice = 'SOURCE' | 'TARGET';
export function MergeReview({
  gateway,
  preview,
  source,
  target,
  onBusy,
  onCompleted,
  onRefresh,
}: {
  gateway: DataQualityGateway;
  preview: MergePreviewDto;
  source: RegistrationRecord;
  target: RegistrationRecord;
  onBusy(busy: boolean): void;
  onCompleted(message: string): void;
  onRefresh(): void;
}) {
  const [fieldSelections, setFieldSelections] = useState<
    Record<string, FieldChoice>
  >({});
  const [reason, setReason] = useState('');
  const [memberships, setMemberships] = useState<IntervalSelections>({});
  const [enrollments, setEnrollments] = useState<IntervalSelections>({});
  const [attendances, setAttendances] = useState<
    Record<string, AttendanceResolution>
  >({});
  const [sizes, setSizes] = useState<FieldChoice | ''>('');
  const membershipIds = new Set(
    preview.membershipConflicts.flatMap((conflict) => conflict.ids),
  );
  const enrollmentIds = new Set(
    preview.enrollmentConflicts.flatMap((conflict) => conflict.ids),
  );
  const conflictingMemberships = preview.memberships.filter((record) =>
    membershipIds.has(record.id),
  );
  const conflictingEnrollments = preview.enrollments.filter((record) =>
    enrollmentIds.has(record.id),
  );
  const intervalComplete = (ids: Set<string>, selections: IntervalSelections) =>
    [...ids].every((id) => {
      const selection = selections[id];
      return selection?.action === 'KEEP'
        ? Boolean(selection.validFrom)
        : Boolean(selection?.supersededById);
    });
  const blocked = preview.referenceConflicts.length > 0;
  const resolutionsComplete =
    preview.entityType === 'FAMILY' ||
    (intervalComplete(membershipIds, memberships) &&
      intervalComplete(enrollmentIds, enrollments) &&
      preview.attendanceConflicts.every(
        (conflict) =>
          attendances[conflict.sessionId]?.effectiveAttendanceId &&
          (!conflict.statusesDiffer ||
            attendances[conflict.sessionId]?.reason?.trim()),
      ) &&
      (!preview.sizeProfileConflict || Boolean(sizes)));
  const [confirmation, setConfirmation] = useState<MergeCommandInput | null>(
    null,
  );
  const [attempt, setAttempt] = useState<{
    content: string;
    key: string;
  } | null>(null);
  const [stale, setStale] = useState(false);
  const action = useAction();
  const complete =
    !blocked &&
    resolutionsComplete &&
    preview.fieldConflicts.every(
      (conflict) => fieldSelections[conflict.field],
    ) &&
    Boolean(reason.trim());
  async function confirm() {
    if (!confirmation || action.pending || stale) return;
    const content = JSON.stringify(confirmation);
    const key =
      attempt?.content === content ? attempt.key : crypto.randomUUID();
    setAttempt({ content, key });
    onBusy(true);
    try {
      await action.run(async () => {
        try {
          await gateway.merge(confirmation, key);
        } catch (error) {
          if (error instanceof ApiRequestError && error.status === 409)
            setStale(true);
          throw error;
        }
        onCompleted(
          'Unificação concluída. O registro de destino foi preservado.',
        );
      });
    } finally {
      onBusy(false);
    }
  }
  return (
    <section
      aria-label="Prévia da unificação"
      className="grid gap-4 border-t border-(--color-border) pt-6"
    >
      <h2>Prévia da unificação</h2>
      <p>
        Origem: {recordLabel(source)}
        <br />
        Destino preservado: {recordLabel(target)}
      </p>
      <p>
        Histórico preservado: {preview.preserved.socialForms} fichas sociais e{' '}
        {preview.preserved.eligibilityAssessments} avaliações de aptidão.
      </p>
      {blocked ? (
        <Alert error>
          Corrija a titularidade nas operações de cadastro antes de unificar
          estas famílias. Vínculos envolvidos:{' '}
          {preview.referenceConflicts
            .flatMap((conflict) => conflict.membershipIds)
            .join(', ')}
          .
        </Alert>
      ) : null}
      {preview.adoptedFields.length ? (
        <p>
          Dados complementares preservados da origem:{' '}
          {preview.adoptedFields.map(fieldLabel).join(', ')}.
        </p>
      ) : null}
      <div className="table-wrap">
        <table className="min-w-0">
          <caption className="sr-only">Dados que serão preservados</caption>
          <thead>
            <tr>
              <th scope="col">Campo</th>
              <th scope="col">Valor preservado</th>
              <th scope="col">Origem do valor</th>
            </tr>
          </thead>
          <tbody>
            {recordFields(target).map(([field, currentValue]) => {
              const conflict = preview.fieldConflicts.find(
                (entry) => entry.field === field,
              );
              const choice = fieldSelections[field];
              const adopted = preview.adoptedFields.includes(field);
              const value = conflict
                ? choice
                  ? conflict[choice === 'SOURCE' ? 'source' : 'target']
                  : undefined
                : adopted
                  ? new Map(recordFields(source)).get(field)
                  : currentValue;
              return (
                <tr key={field}>
                  <th scope="row">{fieldLabel(field)}</th>
                  <td className="break-words">
                    {conflict && !choice
                      ? 'Escolha pendente'
                      : fieldValue(value, field)}
                  </td>
                  <td>
                    {conflict
                      ? choice
                        ? choice === 'SOURCE'
                          ? 'Origem escolhida'
                          : 'Destino escolhido'
                        : 'Conflito sem escolha'
                      : adopted
                        ? 'Complemento da origem'
                        : 'Destino preservado'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {confirmation ? (
        <section aria-label="Confirmação da unificação" className="grid gap-4">
          <h3>Confirmar os dados revisados</h3>
          <p>
            A origem será unificada ao destino. Esta operação não pode ser
            desfeita.
          </p>
          <dl>
            {Object.entries(confirmation.fieldSelections).map(
              ([field, choice]) => (
                <div key={field}>
                  <dt>{fieldLabel(field)}</dt>
                  <dd>
                    {fieldValue(
                      preview.fieldConflicts.find(
                        (conflict) => conflict.field === field,
                      )?.[choice === 'SOURCE' ? 'source' : 'target'],
                      field,
                    )}{' '}
                    · {choice === 'SOURCE' ? 'Origem' : 'Destino'}
                  </dd>
                </div>
              ),
            )}
          </dl>
          <p>Motivo: {confirmation.reason}</p>
          <ul className="grid gap-2 break-words">
            {[
              ...(confirmation.membershipResolutions ?? []),
              ...(confirmation.enrollmentResolutions ?? []),
            ].map((resolution) => (
              <li key={resolution.id}>
                {resolution.id}:{' '}
                {resolution.action === 'KEEP'
                  ? `preservar de ${resolution.validFrom} até ${resolution.validUntil ?? 'sem término'}`
                  : `substituir por ${resolution.supersededById}`}
              </li>
            ))}
            {confirmation.attendanceResolutions?.map((resolution) => (
              <li key={resolution.sessionId}>
                Encontro {resolution.sessionId}: marcação preservada{' '}
                {resolution.effectiveAttendanceId}. {resolution.reason}
              </li>
            ))}
            {confirmation.sizeProfileResolution ? (
              <li>
                Perfil de tamanhos:{' '}
                {confirmation.sizeProfileResolution.keep === 'SOURCE'
                  ? 'Origem'
                  : 'Destino'}
              </li>
            ) : null}
          </ul>
          {action.error ? <Alert error>{action.error}</Alert> : null}
          {stale ? (
            <button className="button secondary" onClick={onRefresh}>
              Atualizar prévia
            </button>
          ) : (
            <button
              className="button primary"
              disabled={action.pending}
              onClick={() => {
                void confirm();
              }}
            >
              {action.pending ? 'Unificando…' : 'Confirmar unificação'}
            </button>
          )}
          <button
            className="button secondary"
            disabled={action.pending || stale}
            onClick={() => setConfirmation(null)}
          >
            Voltar à revisão
          </button>
        </section>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!complete || stale) return;
            const command = {
              entityType: preview.entityType,
              sourceId: preview.sourceId,
              targetId: preview.targetId,
              expectedSourceRevision: preview.expectedSourceRevision,
              expectedTargetRevision: preview.expectedTargetRevision,
              expectedSourceFingerprint: preview.sourceFingerprint,
              fieldSelections,
              reason: reason.trim(),
              ...(preview.entityType === 'PERSON'
                ? {
                    membershipResolutions: Object.values(memberships),
                    enrollmentResolutions: Object.values(enrollments),
                    attendanceResolutions: Object.values(attendances),
                    sizeProfileResolution: sizes ? { keep: sizes } : null,
                  }
                : {}),
            };
            void action.run(async () => {
              setConfirmation(mergeCommandSchema.parse(command));
            });
          }}
        >
          {preview.fieldConflicts.map((conflict) => (
            <SelectField
              key={conflict.field}
              label={`Valor preservado: ${fieldLabel(conflict.field)}`}
              name={conflict.field}
              required
              value={fieldSelections[conflict.field] ?? ''}
              onChange={(event) => {
                const choice = event.target.value;
                if (choice === 'SOURCE' || choice === 'TARGET')
                  setFieldSelections({
                    ...fieldSelections,
                    [conflict.field]: choice,
                  });
              }}
            >
              <option value="">Escolha explicitamente</option>
              <option value="SOURCE">
                Origem: {fieldValue(conflict.source, conflict.field)}
              </option>
              <option value="TARGET">
                Destino: {fieldValue(conflict.target, conflict.field)}
              </option>
            </SelectField>
          ))}
          {preview.entityType === 'PERSON' ? (
            <>
              {conflictingMemberships.length ? (
                <section className="grid gap-4">
                  <h3>Conflitos de vínculos</h3>
                  <IntervalResolutionFields
                    records={conflictingMemberships}
                    label="vínculo"
                    selections={memberships}
                    onChange={(id, value) =>
                      setMemberships((current) => {
                        const next = { ...current };
                        if (value) next[id] = value;
                        else delete next[id];
                        return next;
                      })
                    }
                  />
                </section>
              ) : null}
              {conflictingEnrollments.length ? (
                <section className="grid gap-4">
                  <h3>Conflitos de inscrições</h3>
                  <IntervalResolutionFields
                    records={conflictingEnrollments}
                    label="inscrição"
                    selections={enrollments}
                    onChange={(id, value) =>
                      setEnrollments((current) => {
                        const next = { ...current };
                        if (value) next[id] = value;
                        else delete next[id];
                        return next;
                      })
                    }
                  />
                </section>
              ) : null}
              {preview.attendanceConflicts.length ? (
                <section className="grid gap-4">
                  <h3>Conflitos de marcações</h3>
                  <AttendanceResolutionFields
                    preview={preview}
                    selections={attendances}
                    onChange={(id, value) =>
                      setAttendances({ ...attendances, [id]: value })
                    }
                  />
                </section>
              ) : null}
              {preview.sizeProfileConflict ? (
                <SelectField
                  label="Perfil de tamanhos preservado"
                  name="sizes"
                  required
                  value={sizes}
                  onChange={(event) => {
                    if (
                      event.target.value === 'SOURCE' ||
                      event.target.value === 'TARGET'
                    )
                      setSizes(event.target.value);
                    else setSizes('');
                  }}
                >
                  <option value="">Escolha o perfil</option>
                  <SizeProfileOptions preview={preview} />
                </SelectField>
              ) : null}
            </>
          ) : null}
          {action.error ? <Alert error>{action.error}</Alert> : null}
          <Field
            name="reason"
            label="Motivo da unificação"
            value={reason}
            required
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            className="button primary w-fit"
            type="submit"
            disabled={!complete || stale}
          >
            Revisar confirmação
          </button>
        </form>
      )}
    </section>
  );
}
