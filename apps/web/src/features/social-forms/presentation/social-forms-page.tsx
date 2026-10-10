import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import type {
  SocialFormContextDto,
  SocialFormDto,
} from '@erp/contracts/social-forms-api';
import { publishSocialFormSchema } from '@erp/contracts/social-forms-api';
import type { HttpSocialForms } from '../infra/http-social-forms';
import { useApiQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import { useOperationKey } from '../../../shared/use-operation-key';
import {
  civilToday,
  localDateTime,
  toInstant,
  displayInstant,
  displayDate,
} from '../../../shared/time';
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
  Empty,
} from '../../../shared/ui';
import {
  SocialFieldInput,
  collectSocialFields,
  socialFieldLabels,
} from './social-field-input';
import type { SocialFieldKey } from '@erp/contracts/social-form-fields';
import { FamilyRegistrationForm } from './family-registration-form';
import {
  Plus,
  RefreshCw,
  X,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  Pencil,
} from 'lucide-react';

function SocialBlocksView({
  blocks,
  member = false,
}: {
  blocks: object;
  member?: boolean;
}) {
  return (
    <dl className="record-fields">
      {Object.entries(blocks)
        .flatMap(([block, values]) =>
          block === 'medications'
            ? [[block, values]]
            : Object.entries(values ?? {}).map(([field, value]) => [
                `${block}.${field}`,
                value,
              ]),
        )
        .map(([path, value]) => (
          <div key={String(path)}>
            <dt>
              {
                socialFieldLabels[
                  `${member ? 'members[].' : ''}${path}` as SocialFieldKey
                ]
              }
            </dt>
            <dd>
              {value === null
                ? 'Não informado'
                : typeof value === 'boolean'
                  ? value
                    ? 'Sim'
                    : 'Não'
                  : Array.isArray(value)
                    ? value.length
                      ? value
                          .map((item) =>
                            'medicationName' in item
                              ? `${item.medicationName} (governo: ${item.providedByGovernment === true ? 'Sim' : item.providedByGovernment === false ? 'Não' : 'Não informado'})`
                              : 'occurredOn' in item
                                ? `${displayDate(item.occurredOn)}: ${item.description}`
                                : `${item.label ?? item.code}${item.otherText ? `: ${item.otherText}` : ''}`,
                          )
                          .join(' · ')
                      : 'Nenhum declarado'
                    : path === 'economy.incomeAmount' &&
                        typeof value === 'string'
                      ? new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(Number(value))
                      : String(value)}
            </dd>
          </div>
        ))}
    </dl>
  );
}
function AcknowledgementForm({
  gateway,
  form,
  onSaved,
}: {
  gateway: HttpSocialForms;
  form: SocialFormDto;
  onSaved: () => void;
}) {
  const action = useAction();
  const keyFor = useOperationKey();
  const [today] = useState(civilToday);
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void action.run(async () => {
          const input = {
            method: 'PAPER_SIGNATURE' as const,
            referencePersonId: textValue(data, 'personId'),
            acknowledgedOn: textValue(data, 'acknowledgedOn'),
            expectedRevision: form.acknowledgement?.revision ?? null,
            ...(form.acknowledgement
              ? { reason: textValue(data, 'reason') }
              : {}),
          };
          await gateway.acknowledge(
            form.id,
            input,
            keyFor(`acknowledgement/${form.id}`, input),
          );
          onSaved();
        });
      }}
    >
      <SelectField
        label="Pessoa que assinou o papel"
        name="personId"
        required
        defaultValue={form.acknowledgement?.referencePersonId ?? ''}
      >
        <option value="">Selecione membro desta versão</option>
        {form.members.map((member) => (
          <option key={member.id} value={member.personId}>
            {member.personSnapshot.name}
          </option>
        ))}
      </SelectField>
      <Field
        label="Data conhecida da assinatura em papel"
        name="acknowledgedOn"
        type="date"
        required
        max={today}
        defaultValue={form.acknowledgement?.acknowledgedOn ?? ''}
      />
      {form.acknowledgement && (
        <Field
          label="Motivo da correção da ciência"
          name="reason"
          required
          maxLength={1000}
        />
      )}
      {action.error && <Alert error>{action.error}</Alert>}
      <Submit pending={action.pending}>Registrar ciência</Submit>
    </form>
  );
}
function VersionView({
  gateway,
  id,
  canWrite,
  onCorrect,
}: {
  gateway: HttpSocialForms;
  id: string;
  canWrite: boolean;
  onCorrect: () => void;
}) {
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(() => gateway.get(id), [gateway, id]);
  const state = useApiQuery(load, refresh);
  return (
    <AsyncView state={state}>
      {(form) => (
        <Panel title={`Ficha social — versão ${form.version}`}>
          <p>
            Família registrada:{' '}
            {form.familySnapshot.referenceName ?? form.familySnapshot.code} ·
            Fato em {displayInstant(form.occurredAt)} · Lançada em{' '}
            {displayInstant(form.recordedAt)}.
          </p>
          {form.originFamilyId && (
            <p>Preserva a origem familiar anterior à unificação.</p>
          )}
          {form.reason && <p>Motivo: {form.reason}</p>}
          <SocialBlocksView blocks={form.blocks} />
          {form.members.map((member) => (
            <details className="disclosure" key={member.id}>
              <summary>
                {member.personSnapshot.name} ·{' '}
                {member.relationshipSnapshot.isReference
                  ? 'Titular'
                  : (member.relationshipSnapshot.relationshipToReference ??
                    'Parentesco desconhecido')}
              </summary>
              <p>
                Nascimento: {displayDate(member.personSnapshot.birthDate)} ·
                Calçado: {member.sizeSnapshot?.shoeSize ?? 'Não informado'} ·
                Roupa: {member.sizeSnapshot?.clothingSize ?? 'Não informado'}
              </p>
              <SocialBlocksView blocks={member.blocks} member />
            </details>
          ))}
          <p>
            Ciência em papel:{' '}
            {form.acknowledgement
              ? displayDate(form.acknowledgement.acknowledgedOn)
              : 'Não informada'}
          </p>
          {canWrite && (
            <div className="form-stack">
              <details className="disclosure">
                <summary>Registrar ou corrigir ciência em papel</summary>
                <AcknowledgementForm
                  key={refresh}
                  gateway={gateway}
                  form={form}
                  onSaved={() => setRefresh(refresh + 1)}
                />
              </details>
              <button className="button secondary" onClick={onCorrect}>
                <Pencil size={18} aria-hidden="true" />
                Publicar correção desta versão
              </button>
            </div>
          )}
        </Panel>
      )}
    </AsyncView>
  );
}
function PublishDraft({
  gateway,
  context,
  correctionId,
  onSaved,
}: {
  gateway: HttpSocialForms;
  context: SocialFormContextDto;
  correctionId?: string;
  onSaved: () => void;
}) {
  const action = useAction();
  const keyFor = useOperationKey();
  const fields =
    context.fieldSelection?.fields.filter((field) => field.included) ?? [];
  const familyFields = fields.filter((field) => field.appliesTo === 'FAMILY');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const memberFields = (personId: string) =>
    fields.filter(
      (field) =>
        field.appliesTo === 'ALL_MEMBERS' ||
        (field.appliesTo === 'REFERENCE_MEMBER' &&
          context.referencePersonId === personId) ||
        (field.appliesTo === 'SELECTED_MEMBERS' &&
          selected[`${personId}:${field.fieldKey}`]),
    );
  if (context.fieldSelection?.decisionReference === 'FAMILY_REGISTRATION_2025')
    return (
      <FamilyRegistrationForm
        gateway={gateway}
        context={context}
        correctionId={correctionId}
        onSaved={onSaved}
      />
    );
  if (!context.fieldSelectionVersionId || !fields.length)
    return (
      <Alert>
        Não há campos selecionados e habilitados para publicação com seu perfil.
        A coordenação deve configurar os campos e as decisões.
      </Alert>
    );
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void action.run(async () => {
          const input = publishSocialFormSchema.parse({
            occurredAt: context.occurredAt,
            expectedFamilyRevision: context.expectedFamilyRevision,
            expectedPreviousVersionId: context.expectedPreviousVersionId,
            fieldSelectionVersionId: context.fieldSelectionVersionId,
            memberRevisions: context.memberRevisions,
            referencePersonId: context.referencePersonId,
            blocks: collectSocialFields(
              data,
              familyFields,
              context.options,
              '',
            ),
            members: context.members.map(({ person }) => ({
              personId: person.id,
              ...collectSocialFields(
                data,
                memberFields(person.id),
                context.options,
                `${person.id}:`,
              ),
              selectedFieldKeys: memberFields(person.id)
                .filter((field) => field.appliesTo === 'SELECTED_MEMBERS')
                .map((field) => field.fieldKey),
            })),
            ...(correctionId
              ? {
                  correctionOfFormId: correctionId,
                  reason: textValue(data, 'reason'),
                }
              : {}),
          });
          await gateway.publish(
            context.family.id,
            input,
            keyFor(`form/${context.family.id}`, input),
          );
          onSaved();
        });
      }}
    >
      <p>
        Composição consultada em {displayInstant(context.occurredAt)}. A
        publicação cria uma fotografia completa e preserva as versões
        anteriores. Preencha somente informações conhecidas.
      </p>
      <fieldset disabled={action.pending} className="form-grid">
        <legend>Dados familiares</legend>
        {familyFields.map((field) => (
          <SocialFieldInput
            key={field.fieldKey}
            field={field}
            options={context.options}
            prefix=""
          />
        ))}
      </fieldset>
      {context.members.map(({ person }) => (
        <fieldset
          disabled={action.pending}
          key={person.id}
          className="form-grid"
        >
          <legend>{person.name}</legend>
          {fields
            .filter((field) => field.appliesTo === 'SELECTED_MEMBERS')
            .map((field) => (
              <Field
                key={field.fieldKey}
                label={`Incluir ${socialFieldLabels[field.fieldKey]} para ${person.name}`}
                name={`select:${person.id}:${field.fieldKey}`}
                type="checkbox"
                checked={selected[`${person.id}:${field.fieldKey}`] ?? false}
                onChange={(event) =>
                  setSelected({
                    ...selected,
                    [`${person.id}:${field.fieldKey}`]: event.target.checked,
                  })
                }
              />
            ))}
          {memberFields(person.id).map((field) => (
            <SocialFieldInput
              key={field.fieldKey}
              field={field}
              options={context.options}
              prefix={`${person.id}:`}
            />
          ))}
        </fieldset>
      ))}
      {correctionId && (
        <Field
          label="Motivo da correção da ficha"
          name="reason"
          required
          maxLength={1000}
        />
      )}
      {action.error && <Alert error>{action.error}</Alert>}
      <Submit pending={action.pending}>Publicar ficha</Submit>
    </form>
  );
}
function NewVersion({
  gateway,
  familyId,
  correctionId,
  onSaved,
}: {
  gateway: HttpSocialForms;
  familyId: string;
  correctionId?: string;
  onSaved: () => void;
}) {
  const [now] = useState(() => new Date().toISOString());
  const [occurredAt, setOccurredAt] = useState<string | null>(null);
  const [compositionRevision, setCompositionRevision] = useState(0);
  const action = useAction();
  const keyFor = useOperationKey();
  const load = useCallback(
    () =>
      occurredAt
        ? gateway.context(familyId, { occurredAt })
        : Promise.resolve(null),
    [gateway, familyId, occurredAt],
  );
  const state = useApiQuery(load, compositionRevision);
  return (
    <Panel
      title={correctionId ? 'Correção por nova versão' : 'Nova versão da ficha'}
    >
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          const instant = toInstant(
            textValue(new FormData(event.currentTarget), 'occurredAt'),
          );
          void action.run(async () => {
            await gateway.prepareTemplate(keyFor('familyForm/template', {}));
            setOccurredAt(instant);
            setCompositionRevision((revision) => revision + 1);
          });
        }}
      >
        <Field
          label="Data e hora do fato"
          name="occurredAt"
          type="datetime-local"
          required
          defaultValue={localDateTime(now)}
          max={localDateTime(now)}
        />
        <button className="button secondary" disabled={action.pending}>
          <ClipboardList size={18} aria-hidden="true" />
          Consultar composição
        </button>
      </form>
      {action.error && <Alert error>{action.error}</Alert>}
      <AsyncView state={state}>
        {(context) =>
          context ? (
            <PublishDraft
              key={`${compositionRevision}:${context.occurredAt}:${context.fieldSelectionVersionId}:${context.expectedFamilyRevision}:${context.expectedPreviousVersionId}`}
              gateway={gateway}
              context={context}
              correctionId={correctionId}
              onSaved={onSaved}
            />
          ) : null
        }
      </AsyncView>
    </Panel>
  );
}
export function FamilySocialFormsPage({
  gateway,
  canWrite,
}: {
  gateway: HttpSocialForms;
  canWrite: boolean;
}) {
  const { id = '' } = useParams();
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ correctionId?: string } | null>(null);
  const load = useCallback(
    () => gateway.list(id, { page }),
    [gateway, id, page],
  );
  const state = useApiQuery(load, refresh);
  return (
    <>
      <BackLink to={`/families/${id}`} />
      <Page
        title="Ficha social"
        actions={
          <div className="form-actions">
            {canWrite && !draft && (
              <button
                className="button primary"
                onClick={() => {
                  setDraft({});
                  setSelected(null);
                }}
              >
                <Plus size={18} aria-hidden="true" />
                Nova versão
              </button>
            )}
            {draft && (
              <button
                className="button secondary"
                onClick={() => setDraft(null)}
              >
                <X size={18} aria-hidden="true" />
                Cancelar preenchimento
              </button>
            )}
            <button
              className="button secondary"
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw size={18} aria-hidden="true" />
              Atualizar fichas
            </button>
          </div>
        }
      >
        <AsyncView state={state}>
          {(result) => (
            <Panel title="Versões da ficha">
              {!result.data.length && <Empty>Nenhuma versão publicada.</Empty>}
              {!!result.data.length && (
                <ul className="version-list" aria-label="Versões publicadas">
                  {result.data.map((form) => (
                    <li key={form.id}>
                      <button
                        className="version-row"
                        aria-pressed={selected === form.id}
                        onClick={() => {
                          setSelected(form.id);
                          setDraft(null);
                        }}
                      >
                        <ClipboardList size={20} aria-hidden="true" />
                        <span>
                          <strong>Versão {form.version}</strong>
                          <small>Fato: {displayInstant(form.occurredAt)}</small>
                          <small>
                            Publicada: {displayInstant(form.recordedAt)}
                          </small>
                        </span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <nav className="pagination" aria-label="Páginas de fichas">
                <button
                  className="button secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                  Anterior
                </button>
                <span>
                  Página {page} · {result.pagination.total} versões
                </span>
                <button
                  className="button secondary"
                  disabled={
                    page * result.pagination.pageSize >= result.pagination.total
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </nav>
            </Panel>
          )}
        </AsyncView>
        {selected && (
          <VersionView
            key={`${selected}:${refresh}`}
            gateway={gateway}
            id={selected}
            canWrite={canWrite}
            onCorrect={() => {
              setDraft({ correctionId: selected });
              setSelected(null);
            }}
          />
        )}
        {draft && canWrite && (
          <NewVersion
            key={`${id}:${draft.correctionId ?? 'new'}`}
            gateway={gateway}
            familyId={id}
            correctionId={draft.correctionId}
            onSaved={() => {
              setDraft(null);
              setRefresh((value) => value + 1);
            }}
          />
        )}
      </Page>
    </>
  );
}
