import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiRequestError } from '../../../shared/api-client';
import { useAction } from '../../../shared/use-action';
import { Alert, Submit } from '../../../shared/ui';

export function ManagementForm({
  children,
  save,
  onCompleted,
  onCancel,
  submitLabel = 'Salvar',
}: {
  children: ReactNode;
  save: (data: FormData, key: string) => Promise<unknown>;
  onCompleted: () => void;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const action = useAction();
  const inFlight = useRef(false);
  const [command, setCommand] = useState<{
    data: FormData;
    key: string;
    save: typeof save;
  } | null>(null);
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  async function send(data: FormData) {
    if (inFlight.current || stale) return;
    inFlight.current = true;
    const intent = command ?? { data, key: crypto.randomUUID(), save };
    setRuleMessage(null);
    setConflicts([]);
    const success = await action.run(async () => {
      try {
        await intent.save(intent.data, intent.key);
      } catch (error) {
        if (error instanceof ApiRequestError) {
          if (
            error.status === 0 ||
            error.status >= 500 ||
            error.code === 'INVALID_RESPONSE'
          )
            setCommand(intent);
          else setCommand(null);
          if (
            error.code === 'REVISION_CONFLICT' ||
            error.code === 'IDEMPOTENCY_CONFLICT'
          )
            setStale(true);
          const details = error.details;
          const messages: Record<string, string> = {
            ACTIVITY_HAS_HISTORY:
              'A atividade possui histórico. Preserve a natureza e o projeto; crie outra atividade para um novo contexto.',
            PROJECT_PERIOD_CONFLICT:
              'A vigência informada conflita com inscrições ou encontros. Revise as datas e os registros indicados.',
            CLOSURE_CONFLICT:
              'Existem registros a partir do corte informado. Revise a data e os registros indicados.',
            ENROLLMENT_OVERLAP:
              'A pessoa já possui inscrição nesse período. Consulte o histórico e revise as datas.',
            ENROLLMENT_OUTSIDE_VALIDITY:
              'A inscrição está fora da vigência do projeto ou da atividade. Revise as datas.',
            INVALID_ENROLLMENT_INTERVAL:
              'O fim da inscrição deve ser posterior ao início.',
            PERSON_WITHOUT_MEMBERSHIP:
              'A pessoa precisa ter vínculo familiar conhecido no início da inscrição.',
            FUTURE_EFFECTIVE_DATE: 'A data do fato não pode estar no futuro.',
            INACTIVE_CATALOG: 'Escolha um item ativo do catálogo.',
            INVALID_PROJECT_PERIOD:
              'O fim do projeto não pode anteceder o início.',
            INVALID_ACTIVITY_TYPE:
              'Revise a natureza e o tipo de atendimento. Somente atividades periódicas aceitam inscrições.',
            RECORD_CLOSED:
              'O registro está encerrado. Revise a operação e preserve o histórico.',
          };
          if (
            details &&
            typeof details === 'object' &&
            'rule' in details &&
            typeof details.rule === 'string'
          )
            setRuleMessage(messages[details.rule] ?? null);
          if (
            details &&
            typeof details === 'object' &&
            'ids' in details &&
            Array.isArray(details.ids)
          )
            setConflicts(
              details.ids.filter((id): id is string => typeof id === 'string'),
            );
        }
        throw error;
      }
    });
    inFlight.current = false;
    if (success) onCompleted();
  }
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void send(new FormData(event.currentTarget));
      }}
    >
      <fieldset
        disabled={action.pending || !!command || stale}
        className="grid gap-4 border-0 p-0"
      >
        {children}
      </fieldset>
      {action.error && <Alert error>{ruleMessage ?? action.error}</Alert>}
      {conflicts.length > 0 && (
        <p className="break-words">
          Registros para revisão: {conflicts.join(', ')}.
        </p>
      )}
      {command && (
        <p>
          Resultado não confirmado. Repita a mesma solicitação antes de iniciar
          outra alteração.
        </p>
      )}
      {stale ? (
        <button type="button" className="button secondary" onClick={onCancel}>
          Atualizar e revisar
        </button>
      ) : (
        <Submit pending={action.pending}>
          {command ? 'Repetir solicitação' : submitLabel}
        </Submit>
      )}
      {!command && !stale && (
        <button
          type="button"
          className="button secondary"
          disabled={action.pending}
          onClick={onCancel}
        >
          Cancelar
        </button>
      )}
    </form>
  );
}
