import type {
  MergeCommandInput,
  MergePreviewDto,
} from '@erp/contracts/identity-merge-api';
import { Field, SelectField } from '../../../shared/ui';
import { displayInstant } from '../../../shared/time';
import { fieldValue } from './duplicate-labels';

export type IntervalResolution = NonNullable<
  MergeCommandInput['membershipResolutions']
>[number];
export type AttendanceResolution = NonNullable<
  MergeCommandInput['attendanceResolutions']
>[number];
export type IntervalSelections = Record<string, IntervalResolution>;
type IntervalRecord = {
  id: string;
  validFrom: string;
  validUntil: string | null;
  familyId?: string;
  activityId?: string;
  personId: string;
};

const inputInstant = (value: string) =>
  new Date(value).toISOString().slice(0, -1);
const outputInstant = (value: string) => (value ? `${value}Z` : '');

export function IntervalResolutionFields({
  records,
  label,
  selections,
  onChange,
}: {
  records: IntervalRecord[];
  label: 'vínculo' | 'inscrição';
  selections: IntervalSelections;
  onChange(id: string, value: IntervalResolution | undefined): void;
}) {
  return (
    <div className="grid gap-4">
      {records.map((record) => {
        const selected = selections[record.id];
        const updateInterval = (
          field: 'validFrom' | 'validUntil',
          value: string,
        ) => {
          if (selected?.action === 'KEEP')
            onChange(record.id, {
              ...selected,
              [field]: value
                ? outputInstant(value)
                : field === 'validUntil'
                  ? null
                  : '',
            });
        };
        return (
          <fieldset
            key={record.id}
            className="min-w-0 rounded-md border border-(--color-border) p-4"
          >
            <legend className="break-all text-sm font-semibold">
              {label === 'vínculo' ? 'Vínculo' : 'Inscrição'} {record.id}
            </legend>
            <p className="break-all text-sm">
              Pessoa: {record.personId}
              <br />
              {record.familyId
                ? `Família: ${record.familyId}`
                : `Atividade: ${record.activityId}`}
              <br />
              Período atual: {displayInstant(record.validFrom)} até{' '}
              {record.validUntil
                ? displayInstant(record.validUntil)
                : 'sem término'}
            </p>
            <SelectField
              label={`Ação do ${label} ${record.id}`}
              name={`action-${record.id}`}
              value={selected?.action ?? ''}
              onChange={(event) => {
                if (event.target.value === 'KEEP')
                  onChange(record.id, {
                    id: record.id,
                    action: 'KEEP',
                    validFrom: record.validFrom,
                    validUntil: record.validUntil,
                  });
                else if (event.target.value === 'SUPERSEDE')
                  onChange(record.id, {
                    id: record.id,
                    action: 'SUPERSEDE',
                    supersededById: '',
                  });
                else onChange(record.id, undefined);
              }}
            >
              <option value="">Escolha a resolução</option>
              <option value="KEEP">Preservar e revisar período</option>
              <option value="SUPERSEDE">Substituir como duplicata</option>
            </SelectField>
            {selected?.action === 'KEEP' ? (
              <div className="form-grid mt-4">
                <Field
                  name={`from-${record.id}`}
                  label={`Início do ${label} ${record.id} (UTC)`}
                  type="datetime-local"
                  step="0.001"
                  required
                  value={
                    selected.validFrom ? inputInstant(selected.validFrom) : ''
                  }
                  onChange={(event) =>
                    updateInterval('validFrom', event.target.value)
                  }
                />
                <Field
                  name={`until-${record.id}`}
                  label={`Fim do ${label} ${record.id} (UTC)`}
                  type="datetime-local"
                  step="0.001"
                  value={
                    selected.validUntil ? inputInstant(selected.validUntil) : ''
                  }
                  onChange={(event) =>
                    updateInterval('validUntil', event.target.value)
                  }
                />
              </div>
            ) : null}
            {selected?.action === 'SUPERSEDE' ? (
              <SelectField
                label={`${label === 'vínculo' ? 'Vínculo' : 'Inscrição'} que substitui ${record.id}`}
                name={`replacement-${record.id}`}
                required
                value={selected.supersededById}
                onChange={(event) =>
                  onChange(record.id, {
                    ...selected,
                    supersededById: event.target.value,
                  })
                }
              >
                <option value="">Selecione o registro preservado</option>
                {records
                  .filter((candidate) => candidate.id !== record.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.id}
                    </option>
                  ))}
              </SelectField>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}

export function AttendanceResolutionFields({
  preview,
  selections,
  onChange,
}: {
  preview: MergePreviewDto;
  selections: Record<string, AttendanceResolution>;
  onChange(sessionId: string, value: AttendanceResolution): void;
}) {
  return (
    <div className="grid gap-4">
      {preview.attendanceConflicts.map((conflict) => {
        const selected = selections[conflict.sessionId];
        return (
          <fieldset
            key={conflict.sessionId}
            className="min-w-0 rounded-md border border-(--color-border) p-4"
          >
            <legend className="break-all text-sm font-semibold">
              Marcações do encontro {conflict.sessionId}
            </legend>
            <SelectField
              label={`Marcação preservada do encontro ${conflict.sessionId}`}
              name={`attendance-${conflict.sessionId}`}
              value={selected?.effectiveAttendanceId ?? ''}
              required
              onChange={(event) =>
                onChange(conflict.sessionId, {
                  sessionId: conflict.sessionId,
                  effectiveAttendanceId: event.target.value,
                  ...(selected?.reason ? { reason: selected.reason } : {}),
                })
              }
            >
              <option value="">Escolha a marcação efetiva</option>
              {conflict.attendanceIds.map((id) => {
                const attendance = preview.attendances.find(
                  (record) => record.id === id,
                );
                return (
                  <option key={id} value={id}>
                    {id} ·{' '}
                    {attendance?.status === 'PRESENT'
                      ? 'Presença'
                      : attendance?.status === 'ABSENT'
                        ? 'Ausência'
                        : 'Situação não informada'}{' '}
                    · Família {attendance?.familyId}
                  </option>
                );
              })}
            </SelectField>
            {conflict.statusesDiffer ? (
              <Field
                name={`attendance-reason-${conflict.sessionId}`}
                label={`Motivo da marcação do encontro ${conflict.sessionId}`}
                required
                maxLength={1000}
                value={selected?.reason ?? ''}
                onChange={(event) =>
                  onChange(conflict.sessionId, {
                    sessionId: conflict.sessionId,
                    effectiveAttendanceId:
                      selected?.effectiveAttendanceId ?? '',
                    reason: event.target.value,
                  })
                }
              />
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}
export function SizeProfileOptions({ preview }: { preview: MergePreviewDto }) {
  const conflict = preview.sizeProfileConflict;
  if (!conflict) return null;
  return (
    <>
      {(['SOURCE', 'TARGET'] as const).map((choice) => {
        const profile = choice === 'SOURCE' ? conflict.source : conflict.target;
        return (
          <option key={choice} value={choice}>
            {choice === 'SOURCE' ? 'Origem' : 'Destino'}: calçado{' '}
            {fieldValue(profile.shoeSize)}, roupa{' '}
            {fieldValue(profile.clothingSize)}, informado em{' '}
            {fieldValue(profile.informedOn, 'informedOn')}
          </option>
        );
      })}
    </>
  );
}
