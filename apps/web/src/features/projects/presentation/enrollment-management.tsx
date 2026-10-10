import { useCallback, useState } from 'react';
import type {
  ActivityDto,
  EnrollmentsPageDto,
} from '@erp/contracts/projects-api';
import type { HttpProjects } from '../infra/http-projects';
import { localDateTime } from '../../../shared/time';
import { useApiQuery } from '../../../shared/use-query';
import { Alert, AsyncView, Field, Panel, textValue } from '../../../shared/ui';
import { ManagementForm } from './management-form';
import { instantValue } from './project-forms';
import { EnrollmentList } from './enrollment-list';
import { PersonSelection } from './person-selection';

export { PersonSelection };

type EnrollmentItem = EnrollmentsPageDto['data'][number];
export const localInstant = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return `${localDateTime(value)}:${String(date.getUTCSeconds()).padStart(2, '0')}.${String(date.getUTCMilliseconds()).padStart(3, '0')}`;
};
export function EnrollmentManagement({
  gateway,
  activity,
  asOf,
  revision,
  canWrite,
  onCompleted,
  onRefresh,
  onEditing,
}: {
  gateway: HttpProjects;
  activity: ActivityDto;
  asOf: string;
  revision: number;
  canWrite: boolean;
  onCompleted: () => void;
  onRefresh?: () => void;
  onEditing?: (editing: boolean) => void;
}) {
  const [history, setHistory] = useState(false);
  const [selected, setSelected] = useState<{
    mode: 'new' | 'correct' | 'close';
    item?: EnrollmentItem;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(
    () => gateway.enrollments(activity.id, history ? undefined : asOf),
    [gateway, activity.id, history, asOf],
  );
  const state = useApiQuery(load, revision + refresh);
  function select(value: NonNullable<typeof selected>) {
    setSelected(value);
    onEditing?.(true);
  }
  function finish(saved: boolean) {
    setSelected(null);
    setRefresh((value) => value + 1);
    onEditing?.(false);
    if (saved) onCompleted();
    else onRefresh?.();
  }
  return (
    <>
      {!selected && (
        <div className="mb-4 flex flex-wrap gap-2">
          {canWrite && (
            <button
              className="button primary"
              onClick={() => select({ mode: 'new' })}
            >
              Cadastrar participante
            </button>
          )}
          <button
            className="button secondary"
            aria-pressed={history}
            onClick={() => setHistory((value) => !value)}
          >
            {history ? 'Inscrições vigentes' : 'Histórico de inscrições'}
          </button>
        </div>
      )}
      {selected && (
        <Panel
          title={
            selected.mode === 'new'
              ? 'Cadastrar participante'
              : selected.mode === 'correct'
                ? `Corrigir inscrição de ${selected.item?.person.name}`
                : `Encerrar inscrição de ${selected.item?.person.name}`
          }
        >
          <EnrollmentForm
            gateway={gateway}
            activity={activity}
            mode={selected.mode}
            item={selected.item}
            onCompleted={() => finish(true)}
            onCancel={() => finish(false)}
          />
        </Panel>
      )}
      <AsyncView state={state}>
        {(records) => (
          <EnrollmentList
            participants={[]}
            records={records}
            asOf={asOf}
            history={history}
            actions={
              canWrite && !selected
                ? (item) => (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="button secondary"
                        aria-label={`Corrigir inscrição de ${item.person.name}`}
                        onClick={() => select({ mode: 'correct', item })}
                      >
                        Corrigir
                      </button>
                      {(item.enrollment.validUntil === null ||
                        item.enrollment.validUntil > asOf) && (
                        <button
                          className="button secondary"
                          aria-label={`Encerrar inscrição de ${item.person.name}`}
                          onClick={() => select({ mode: 'close', item })}
                        >
                          Encerrar
                        </button>
                      )}
                    </div>
                  )
                : undefined
            }
          />
        )}
      </AsyncView>
    </>
  );
}
function EnrollmentForm({
  gateway,
  activity,
  mode,
  item,
  onCompleted,
  onCancel,
}: {
  gateway: HttpProjects;
  activity: ActivityDto;
  mode: 'new' | 'correct' | 'close';
  item?: EnrollmentItem;
  onCompleted: () => void;
  onCancel: () => void;
}) {
  return (
    <ManagementForm
      onCompleted={onCompleted}
      onCancel={onCancel}
      submitLabel={mode === 'close' ? 'Confirmar encerramento' : 'Salvar'}
      save={(data, key) => {
        const validUntil = textValue(data, 'validUntil')
          ? instantValue(data, 'validUntil')
          : null;
        // The server stamps the start of a new enrollment with its own clock.
        if (mode === 'new')
          return gateway.enroll(
            activity.id,
            {
              expectedActivityRevision: activity.revision,
              personId: textValue(data, 'personId'),
            },
            key,
          );
        if (!item) throw new Error('Enrollment selection is required');
        const input = {
          expectedRevision: item.enrollment.revision,
          reason: textValue(data, 'reason'),
        };
        if (mode === 'close')
          return gateway.closeEnrollment(
            item.enrollment.id,
            { ...input, validUntil: instantValue(data, 'validUntil') },
            key,
          );
        return gateway.correctEnrollment(
          item.enrollment.id,
          { ...input, validFrom: instantValue(data, 'validFrom'), validUntil },
          key,
        );
      }}
    >
      {mode === 'new' && <PersonSelection gateway={gateway} />}
      {mode === 'correct' && (
        <Field
          autoFocus
          label="Início da inscrição (Fortaleza)"
          name="validFrom"
          type="datetime-local"
          step="0.001"
          required
          defaultValue={localInstant(item?.enrollment.validFrom ?? null)}
        />
      )}
      {mode !== 'new' && (
        <Field
          autoFocus={mode === 'close'}
          label="Fim da inscrição (exclusivo, Fortaleza)"
          name="validUntil"
          type="datetime-local"
          step="0.001"
          required={mode === 'close' || activity.status === 'CLOSED'}
          defaultValue={localInstant(item?.enrollment.validUntil ?? null)}
        />
      )}
      {mode !== 'new' && (
        <Field label="Motivo" name="reason" required maxLength={1000} />
      )}
      {mode === 'close' && (
        <Alert>
          O histórico da inscrição e as presenças anteriores serão preservados.
        </Alert>
      )}
    </ManagementForm>
  );
}
