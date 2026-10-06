import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import type { AttendancePageProps } from './attendance-page';
import { AttendanceEditor, markingLabel } from './attendance-draft';
import { attendanceRuleMessages } from './attendance-messages';
import { SessionHistory } from './session-history';
import { ManagementForm } from '../../projects/presentation/management-form';
import { useApiQuery } from '../../../shared/use-query';
import {
  Alert,
  AsyncView,
  BackLink,
  Field,
  Page,
  Panel,
  StatusBadge,
  textValue,
} from '../../../shared/ui';
import { displayInstant } from '../../../shared/time';

export function SessionPage(props: AttendancePageProps) {
  const { id = '', sessionId = '' } = useParams();
  return (
    <>
      <BackLink to={`/activities/${id}/attendance`}>
        Encontros e frequência
      </BackLink>
      {props.capabilities.includes('attendance.read') ? (
        <SessionContent
          key={sessionId}
          {...props}
          activityId={id}
          sessionId={sessionId}
        />
      ) : (
        <Alert error>Seu perfil não permite consultar este encontro.</Alert>
      )}
    </>
  );
}
function SessionContent({
  gateway,
  projects,
  capabilities,
  activityId,
  sessionId,
}: AttendancePageProps & { activityId: string; sessionId: string }) {
  const [refresh, setRefresh] = useState(0);
  const [mode, setMode] = useState<'correct' | 'cancel' | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(
    () => gateway.detail(sessionId),
    [gateway, sessionId],
  );
  const state = useApiQuery(load, refresh);
  function reload(saved = false) {
    setMode(null);
    setRefresh((value) => value + 1);
    setMessage(saved ? 'Operação confirmada. Histórico preservado.' : '');
  }
  return (
    <AsyncView state={state}>
      {(detail) => {
        if (detail.session.activityId !== activityId)
          return (
            <Alert error>
              O encontro não pertence à atividade selecionada.
            </Alert>
          );
        const session = detail.session;
        return (
          <Page
            title="Detalhe do encontro"
            description={displayInstant(session.occurredAt)}
          >
            {message && <Alert>{message}</Alert>}
            <Panel>
              <StatusBadge>
                {session.status === 'CANCELED' ? 'Cancelado' : 'Realizado'}
              </StatusBadge>
              <dl className="mt-4 grid gap-2">
                <div>
                  <dt>Encontro</dt>
                  <dd className="break-words">{session.id}</dd>
                </div>
                <div>
                  <dt>Data do fato</dt>
                  <dd>
                    <time dateTime={session.occurredAt}>
                      {displayInstant(session.occurredAt)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>Data do lançamento</dt>
                  <dd>
                    <time dateTime={session.recordedAt}>
                      {displayInstant(session.recordedAt)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>Responsável pelo encontro</dt>
                  <dd className="break-words">{session.responsibleId}</dd>
                </div>
                <div>
                  <dt>Revisão</dt>
                  <dd>{session.revision}</dd>
                </div>
              </dl>
              {capabilities.includes('attendance.write') &&
                session.status !== 'CANCELED' &&
                !mode && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="button primary"
                      onClick={() => setMode('correct')}
                    >
                      Corrigir chamada
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setMode('cancel')}
                    >
                      Cancelar encontro
                    </button>
                  </div>
                )}
            </Panel>
            {mode === 'correct' ? (
              <Panel title="Corrigir chamada">
                <AttendanceEditor
                  gateway={gateway}
                  projects={projects}
                  activityId={activityId}
                  occurredAt={session.occurredAt}
                  responsibleId={session.responsibleId}
                  session={session}
                  onCompleted={() => reload(true)}
                  onCancel={() => reload()}
                />
              </Panel>
            ) : mode === 'cancel' ? (
              <Panel title="Cancelar encontro">
                <ManagementForm
                  refreshOnConflict
                  ruleMessages={attendanceRuleMessages}
                  submitLabel="Confirmar cancelamento"
                  onCompleted={() => reload(true)}
                  onCancel={() => reload()}
                  save={(data, key) =>
                    gateway.cancel(
                      session.id,
                      session.revision,
                      textValue(data, 'reason'),
                      key,
                    )
                  }
                >
                  <p>
                    O encontro será retirado das contagens. As marcações e o
                    histórico serão preservados.
                  </p>
                  <Field
                    autoFocus
                    label="Motivo do cancelamento"
                    name="reason"
                    required
                    maxLength={1000}
                  />
                </ManagementForm>
              </Panel>
            ) : (
              <Panel title="Chamada">
                <div className="table-wrap">
                  <table aria-label="Chamada registrada">
                    <thead>
                      <tr>
                        <th>Pessoa</th>
                        <th>Família no fato</th>
                        <th>Marcação</th>
                        <th>Lançamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.context.rows.map((row) => (
                        <tr key={row.personId}>
                          <th scope="row">{row.name}</th>
                          <td className="break-words">
                            {row.attendance
                              ? row.familyId === row.attendance.familyId &&
                                row.familyCode
                                ? row.familyCode
                                : row.attendance.familyId
                              : (row.familyCode ?? 'Não informado')}
                          </td>
                          <td>{markingLabel(row.attendance?.status)}</td>
                          <td>
                            {row.attendance
                              ? displayInstant(row.attendance.recordedAt)
                              : 'Não registrado'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!detail.context.rows.length && (
                  <p>Nenhuma marcação neste encontro.</p>
                )}
                {detail.attendances.some((row) => row.supersededById) && (
                  <details className="mt-4">
                    <summary>Marcações substituídas por unificação</summary>
                    <ul>
                      {detail.attendances
                        .filter((row) => row.supersededById)
                        .map((row) => (
                          <li className="break-words" key={row.id}>
                            {row.personId} · {markingLabel(row.status)} ·
                            substituída por {row.supersededById}
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </Panel>
            )}
            {!mode &&
              (capabilities.includes('audit.read') ? (
                <Panel>
                  <SessionHistory
                    key={refresh}
                    gateway={gateway}
                    sessionId={sessionId}
                    attendances={detail.attendances}
                    names={Object.fromEntries(
                      detail.context.rows.map((row) => [
                        row.personId,
                        row.name,
                      ]),
                    )}
                  />
                </Panel>
              ) : (
                <p className="muted">
                  Histórico de correções disponível para perfis com acesso à
                  auditoria.
                </p>
              ))}
          </Page>
        );
      }}
    </AsyncView>
  );
}
