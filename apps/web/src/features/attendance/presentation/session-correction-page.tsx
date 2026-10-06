import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import type { HttpAttendance } from '../infra/http-attendance';
import type { HttpProjects } from '../../projects/infra/http-projects';
import type { AttendanceContextDto } from '@erp/contracts/attendance-api';
import { sessionCorrectionSchema } from '@erp/contracts/attendance-api';
import { useApiQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import { useOperationKey } from '../../../shared/use-operation-key';
import {
  Page,
  Panel,
  Field,
  SelectField,
  AsyncView,
  Alert,
  Submit,
  BackLink,
  textValue,
} from '../../../shared/ui';
import {
  localDateTimeExact,
  toInstant,
  displayInstant,
} from '../../../shared/time';
type SessionDetailDto = Awaited<ReturnType<HttpAttendance['detail']>>;
function markContext(row: AttendanceContextDto['rows'][number]) {
  if (
    row.familyId === null ||
    row.membershipId === null ||
    row.expectedFamilyRevision === null ||
    row.expectedMembershipRevision === null
  )
    throw new Error(
      'A resolved family context is required for every affected marking',
    );
  return {
    personId: row.personId,
    expectedPersonRevision: row.expectedPersonRevision,
    familyId: row.familyId,
    expectedFamilyRevision: row.expectedFamilyRevision,
    membershipId: row.membershipId,
    expectedMembershipRevision: row.expectedMembershipRevision,
  };
}
function CorrectionForm({
  gateway,
  projects,
  detail,
  onSaved,
}: {
  gateway: HttpAttendance;
  projects: HttpProjects;
  detail: SessionDetailDto;
  onSaved: () => void;
}) {
  const [now] = useState(() => new Date().toISOString());
  const [occurredAt, setOccurredAt] = useState(
    localDateTimeExact(detail.session.occurredAt),
  );
  const [fresh, setFresh] = useState<AttendanceContextDto | null>(null);
  const [freshInput, setFreshInput] = useState<string | null>(null);
  const responsible = useApiQuery(projects.responsible);
  const review = useAction();
  const action = useAction();
  const keyFor = useOperationKey();
  return (
    <>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void action.run(async () => {
            if (
              !fresh ||
              freshInput !== occurredAt ||
              data.get('confirmed') !== 'on'
            )
              throw new Error(
                'Review the current correction context before saving',
              );
            const input = sessionCorrectionSchema.parse({
              expectedSessionRevision: detail.session.revision,
              occurredAt: fresh.occurredAt,
              ...(textValue(data, 'responsibleId')
                ? { responsibleId: textValue(data, 'responsibleId') }
                : {}),
              expectedRosterFingerprint: fresh.rosterFingerprint,
              contextCorrections: fresh.rows
                .filter((row) => row.attendance)
                .map((row) => ({
                  ...markContext(row),
                  expectedRevision: row.attendance!.revision,
                })),
              reason: textValue(data, 'reason'),
            });
            await gateway.correctSession(
              detail.session.id,
              input,
              keyFor(`session/correction/${detail.session.id}`, input),
            );
            onSaved();
          });
        }}
      >
        <p>
          Data anterior: {displayInstant(detail.session.occurredAt)}. A
          alteração de data revalida os vínculos das marcações.
        </p>
        <Field
          label="Data e hora corrigida"
          name="occurredAt"
          type="datetime-local"
          step="0.001"
          value={occurredAt}
          onChange={(event) => {
            setOccurredAt(event.target.value);
            setFresh(null);
          }}
          required
          max={localDateTimeExact(now)}
        />
        <AsyncView state={responsible}>
          {(accounts) => (
            <SelectField
              label="Responsável corrigido (opcional)"
              name="responsibleId"
            >
              <option value="">Preservar responsável</option>
              {accounts
                .filter((account) => account.active)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName}
                  </option>
                ))}
            </SelectField>
          )}
        </AsyncView>
        <button
          type="button"
          className="button secondary"
          disabled={review.pending || !occurredAt}
          onClick={() => {
            void review.run(async () => {
              const value = await gateway.context(
                detail.session.activityId,
                toInstant(occurredAt),
                detail.attendances.map((attendance) => attendance.personId),
                detail.session.id,
              );
              setFresh(value);
              setFreshInput(occurredAt);
            });
          }}
        >
          Conferir contexto da correção
        </button>
        {review.error && <Alert error>{review.error}</Alert>}
        {fresh && (
          <>
            <Alert>Contexto conferido para a nova data.</Alert>
            {fresh.rows
              .filter((row) => row.attendance)
              .map((row) => (
                <p key={row.personId}>
                  {row.name} · Família na nova data:{' '}
                  {row.familyCode ?? 'Não resolvida'} · Vínculo:{' '}
                  {row.membershipId ?? 'Não resolvido'}
                </p>
              ))}
            <Field
              key={`${fresh.rosterFingerprint}:${freshInput}`}
              label="Conferi a data, o responsável e os contextos das marcações"
              name="confirmed"
              type="checkbox"
              required
            />
          </>
        )}
        <Field
          label="Motivo da correção"
          name="reason"
          required
          maxLength={1000}
        />
        {action.error && <Alert error>{action.error}</Alert>}
        <Submit pending={action.pending || !fresh}>
          Confirmar correção do encontro
        </Submit>
      </form>
      <Panel title="Corrigir somente o contexto de uma marcação">
        <p>
          Consulte a composição na data original antes de escolher a marcação.
          Cada operação mantém o status de presença ou ausência.
        </p>
        <ContextCorrections
          gateway={gateway}
          detail={detail}
          onSaved={onSaved}
        />
      </Panel>
    </>
  );
}
function ContextCorrections({
  gateway,
  detail,
  onSaved,
}: {
  gateway: HttpAttendance;
  detail: SessionDetailDto;
  onSaved: () => void;
}) {
  const load = useCallback(
    () =>
      gateway.context(
        detail.session.activityId,
        detail.session.occurredAt,
        detail.attendances.map((attendance) => attendance.personId),
        detail.session.id,
      ),
    [gateway, detail],
  );
  const state = useApiQuery(load);
  const action = useAction();
  const keyFor = useOperationKey();
  return (
    <AsyncView state={state}>
      {(context) => (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void action.run(async () => {
              const row = context.rows.find(
                (row) => row.attendance?.id === textValue(data, 'attendanceId'),
              );
              if (!row?.attendance || data.get('confirmed') !== 'on')
                throw new Error('Choose and confirm a reviewed marking');
              const contextFields = markContext(row);
              const fields = {
                expectedPersonRevision: contextFields.expectedPersonRevision,
                familyId: contextFields.familyId,
                expectedFamilyRevision: contextFields.expectedFamilyRevision,
                membershipId: contextFields.membershipId,
                expectedMembershipRevision:
                  contextFields.expectedMembershipRevision,
              };
              const input = {
                ...fields,
                expectedRevision: row.attendance.revision,
                expectedSessionRevision: detail.session.revision,
                reason: textValue(data, 'reason'),
              };
              await gateway.correctContext(
                row.attendance.id,
                input,
                keyFor(`marking/context/${row.attendance.id}`, input),
              );
              onSaved();
            });
          }}
        >
          <SelectField
            label="Marcação para corrigir o contexto"
            name="attendanceId"
            required
            defaultValue=""
          >
            <option value="">Selecione</option>
            {context.rows
              .filter((row) => row.attendance)
              .map((row) => (
                <option key={row.personId} value={row.attendance!.id}>
                  {row.name} · Família {row.familyCode ?? 'não resolvida'}
                </option>
              ))}
          </SelectField>
          <Field
            label="Conferi a família e o vínculo na data original"
            name="confirmed"
            type="checkbox"
            required
          />
          <Field
            label="Motivo da correção do contexto"
            name="reason"
            required
            maxLength={1000}
          />
          {action.error && <Alert error>{action.error}</Alert>}
          <Submit pending={action.pending}>
            Corrigir contexto da marcação
          </Submit>
        </form>
      )}
    </AsyncView>
  );
}
export function SessionCorrectionPage({
  gateway,
  projects,
}: {
  gateway: HttpAttendance;
  projects: HttpProjects;
}) {
  const { id = '', sessionId = '' } = useParams();
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(
    () => gateway.detail(sessionId),
    [gateway, sessionId],
  );
  const state = useApiQuery(load, refresh);
  return (
    <>
      <BackLink to={`/activities/${id}/attendance/${sessionId}`} />
      <Page title="Corrigir encontro e contextos">
        <AsyncView state={state}>
          {(detail) =>
            detail.session.activityId !== id ? (
              <Alert error>
                O encontro não pertence à atividade selecionada.
              </Alert>
            ) : detail.session.status === 'CANCELED' ? (
              <Alert>
                O encontro cancelado permanece disponível para consulta e não
                aceita alterações.
              </Alert>
            ) : (
              <Panel>
                <CorrectionForm
                  key={`${detail.session.id}:${detail.session.revision}`}
                  gateway={gateway}
                  projects={projects}
                  detail={detail}
                  onSaved={() => setRefresh(refresh + 1)}
                />
              </Panel>
            )
          }
        </AsyncView>
        <button
          className="button secondary"
          onClick={() => setRefresh(refresh + 1)}
        >
          Atualizar encontro
        </button>
      </Page>
    </>
  );
}
