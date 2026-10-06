import { useCallback, useRef, useState } from 'react';
import type {
  AttendanceContextDto,
  AttendanceDto,
  SessionDto,
  CreateSessionInput,
  UpdateAttendanceInput,
} from '@erp/contracts/attendance-api';
import type { HttpAttendance } from '../infra/http-attendance';
import type { HttpProjects } from '../../projects/infra/http-projects';
import {
  PersonSelection,
  localInstant,
} from '../../projects/presentation/enrollment-management';
import { ManagementForm } from '../../projects/presentation/management-form';
import { instantValue } from '../../projects/presentation/project-forms';
import { useApiQuery } from '../../../shared/use-query';
import {
  AsyncView,
  Field,
  SelectField,
  Empty,
  Alert,
  textValue,
} from '../../../shared/ui';
import { attendanceRuleMessages } from './attendance-messages';
import { displayInstant } from '../../../shared/time';

type AttendanceStatus = AttendanceDto['status'];
type MarkingChoice = AttendanceStatus | '';
type RosterRow = AttendanceContextDto['rows'][number];
export const markingLabel = (status: MarkingChoice | undefined) =>
  status === 'PRESENT'
    ? 'Presente'
    : status === 'ABSENT'
      ? 'Ausente'
      : 'Não registrado';
const canMark = (row: RosterRow) =>
  !!row.attendance ||
  (row.familyId !== null &&
    row.expectedFamilyRevision !== null &&
    row.membershipId !== null &&
    row.expectedMembershipRevision !== null);
function markingContext(row: RosterRow) {
  if (
    row.familyId === null ||
    row.expectedFamilyRevision === null ||
    row.membershipId === null ||
    row.expectedMembershipRevision === null
  )
    throw new Error('A valid family membership is required');
  return {
    personId: row.personId,
    expectedPersonRevision: row.expectedPersonRevision,
    familyId: row.familyId,
    expectedFamilyRevision: row.expectedFamilyRevision,
    membershipId: row.membershipId,
    expectedMembershipRevision: row.expectedMembershipRevision,
  };
}

export function AttendanceDraft({
  gateway,
  projects,
  activityId,
  responsibleId,
  onCompleted,
  onCancel,
}: {
  gateway: HttpAttendance;
  projects: HttpProjects;
  activityId: string;
  responsibleId: string | null;
  onCompleted: (session: SessionDto) => void;
  onCancel: () => void;
}) {
  const responsible = useApiQuery(projects.responsible);
  const [metadata, setMetadata] = useState<{
    occurredAt: string;
    responsibleId: string;
    responsibleName: string;
  } | null>(null);
  const [now] = useState(() => new Date().toISOString());
  if (metadata)
    return (
      <AttendanceEditor
        gateway={gateway}
        projects={projects}
        activityId={activityId}
        occurredAt={metadata.occurredAt}
        responsibleId={metadata.responsibleId}
        responsibleName={metadata.responsibleName}
        onCompleted={onCompleted}
        onCancel={onCancel}
      />
    );
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const selectedResponsibleId = textValue(data, 'responsibleId');
        setMetadata({
          occurredAt: instantValue(data, 'occurredAt'),
          responsibleId: selectedResponsibleId,
          responsibleName:
            responsible.status === 'success'
              ? (responsible.data.find(
                  (item) => item.id === selectedResponsibleId,
                )?.displayName ?? selectedResponsibleId)
              : selectedResponsibleId,
        });
      }}
    >
      <Field
        autoFocus
        label="Data do encontro (Fortaleza)"
        name="occurredAt"
        type="datetime-local"
        step="0.001"
        defaultValue={localInstant(now)}
        required
      />
      <AsyncView state={responsible}>
        {(items) => (
          <SelectField
            label="Responsável pelo encontro"
            name="responsibleId"
            defaultValue={responsibleId ?? ''}
            required
          >
            <option value="">Selecione</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </SelectField>
        )}
      </AsyncView>
      <button
        className="button primary"
        type="submit"
        disabled={responsible.status !== 'success'}
      >
        Preparar chamada
      </button>
      <button className="button secondary" type="button" onClick={onCancel}>
        Cancelar
      </button>
    </form>
  );
}

export function AttendanceEditor({
  gateway,
  projects,
  activityId,
  occurredAt,
  responsibleId,
  responsibleName,
  session,
  onCompleted,
  onCancel,
}: {
  gateway: HttpAttendance;
  projects: HttpProjects;
  activityId: string;
  occurredAt: string;
  responsibleId: string;
  responsibleName?: string;
  session?: SessionDto;
  onCompleted: (session: SessionDto) => void;
  onCancel: () => void;
}) {
  const resultSession = useRef<SessionDto | null>(null);
  const [guests, setGuests] = useState<string[]>([]);
  const [choices, setChoices] = useState<Record<string, MarkingChoice>>({});
  const [refresh, setRefresh] = useState(0);
  const [review, setReview] = useState(false);
  const [addingGuest, setAddingGuest] = useState(false);
  const load = useCallback(
    () => gateway.context(activityId, occurredAt, guests, session?.id),
    [gateway, activityId, occurredAt, guests, session?.id],
  );
  const state = useApiQuery(load, refresh);
  function revise() {
    setReview(false);
    setChoices({});
    setRefresh((value) => value + 1);
  }
  return (
    <>
      <p>Data do fato: {displayInstant(occurredAt)}</p>
      {responsibleName && <p>Responsável: {responsibleName}</p>}
      <AsyncView state={state}>
        {(context) => {
          const currentSession = context.session ?? session;
          if (currentSession?.status === 'CANCELED')
            return (
              <Alert error>
                Encontro cancelado. A chamada permanece no histórico.
              </Alert>
            );
          const entries = context.rows.flatMap((row) => {
            const status = choices[row.personId];
            if (!status || !canMark(row) || row.attendance?.status === status)
              return [];
            return [{ row, status }];
          });
          const createEntries: CreateSessionInput['entries'] = currentSession
            ? []
            : entries.map(({ row, status }) => ({
                ...markingContext(row),
                status,
              }));
          // Existing markings retain their factual family context during status corrections.
          const updateEntries: UpdateAttendanceInput['entries'] = entries.map(
            ({ row, status }) =>
              row.attendance
                ? {
                    personId: row.personId,
                    expectedRevision: row.attendance.revision,
                    status,
                  }
                : { ...markingContext(row), expectedRevision: null, status },
          );
          return (
            <>
              <div className="table-wrap">
                <table
                  aria-label={
                    review ? 'Revisão da chamada' : 'Chamada do encontro'
                  }
                >
                  <thead>
                    <tr>
                      <th>Pessoa</th>
                      <th>Família no encontro</th>
                      <th>Participação</th>
                      <th>Marcação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {context.rows.map((row) => (
                      <tr key={row.personId}>
                        <th scope="row">{row.name}</th>
                        <td>
                          {row.attendance
                            ? row.familyId === row.attendance.familyId &&
                              row.familyCode
                              ? row.familyCode
                              : `Família ${row.attendance.familyId}`
                            : (row.familyCode ??
                              'Vínculo familiar não disponível')}
                        </td>
                        <td>
                          {row.enrollmentIds.length ? 'Inscrito' : 'Avulso'}
                        </td>
                        <td>
                          {review ? (
                            markingLabel(
                              choices[row.personId] || row.attendance?.status,
                            )
                          ) : (
                            <SelectField
                              label={`Marcação de ${row.name}`}
                              name={`status-${row.personId}`}
                              value={
                                choices[row.personId] ??
                                row.attendance?.status ??
                                ''
                              }
                              disabled={!canMark(row)}
                              onChange={(event) =>
                                setChoices((current) => ({
                                  ...current,
                                  [row.personId]: event.target
                                    .value as MarkingChoice,
                                }))
                              }
                            >
                              <option value="" disabled={!!row.attendance}>
                                Não registrado
                              </option>
                              <option value="PRESENT">Presente</option>
                              <option value="ABSENT">Ausente</option>
                            </SelectField>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!context.rows.length && (
                <Empty>Nenhum participante no contexto consultado.</Empty>
              )}
              {context.rows.some((row) => !canMark(row)) && (
                <p className="muted">
                  Regularize o vínculo familiar na data do encontro antes de
                  marcar essas pessoas.
                </p>
              )}
              {review ? (
                <ManagementForm
                  refreshOnConflict
                  ruleMessages={attendanceRuleMessages}
                  submitLabel={
                    session ? 'Confirmar correção' : 'Confirmar encontro'
                  }
                  onCancel={revise}
                  onCompleted={() => {
                    if (resultSession.current)
                      onCompleted(resultSession.current);
                  }}
                  save={async (data, key) => {
                    const result = currentSession
                      ? await gateway.correct(
                          currentSession.id,
                          {
                            expectedSessionRevision: currentSession.revision,
                            expectedRosterFingerprint:
                              context.rosterFingerprint,
                            guestPersonIds: guests,
                            reason: textValue(data, 'reason'),
                            entries: updateEntries,
                          },
                          key,
                        )
                      : await gateway.create(
                          activityId,
                          {
                            occurredAt: context.occurredAt,
                            responsibleId,
                            expectedActivityRevision:
                              context.expectedActivityRevision,
                            expectedRosterFingerprint:
                              context.rosterFingerprint,
                            guestPersonIds: guests,
                            entries: createEntries,
                          },
                          key,
                        );
                    resultSession.current = result.session;
                  }}
                >
                  <p>
                    {entries.length} marcações serão enviadas. Pessoas sem
                    marcação continuam não registradas.
                  </p>
                  {session && (
                    <Field
                      autoFocus
                      label="Motivo da correção"
                      name="reason"
                      required
                      maxLength={1000}
                    />
                  )}
                </ManagementForm>
              ) : (
                <>
                  {addingGuest ? (
                    <form
                      className="form-stack"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const personId = textValue(
                          new FormData(event.currentTarget),
                          'personId',
                        );
                        if (!personId) return;
                        setGuests((current) =>
                          current.includes(personId)
                            ? current
                            : [...current, personId],
                        );
                        setAddingGuest(false);
                      }}
                    >
                      <PersonSelection gateway={projects} />
                      <button className="button secondary" type="submit">
                        Incluir na prévia
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => setAddingGuest(false)}
                      >
                        Cancelar inclusão
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="button primary"
                        disabled={!!session && entries.length === 0}
                        onClick={() => setReview(true)}
                      >
                        Revisar chamada
                      </button>
                      <button
                        className="button secondary"
                        disabled={guests.length >= 1000}
                        onClick={() => setAddingGuest(true)}
                      >
                        Adicionar pessoa avulsa
                      </button>
                      <button className="button secondary" onClick={revise}>
                        Atualizar prévia
                      </button>
                      <button className="button secondary" onClick={onCancel}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          );
        }}
      </AsyncView>
      {state.status === 'error' && (
        <div className="flex gap-2">
          <button className="button secondary" onClick={revise}>
            Atualizar prévia
          </button>
          <button className="button secondary" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      )}
    </>
  );
}
