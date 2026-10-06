import { useCallback, useState } from 'react';
import {
  socialFieldKeys,
  featureDecisionCodes,
} from '@erp/contracts/social-form-fields';
import { fieldSelectionInputSchema } from '@erp/contracts/social-forms-api';
import type { FieldSelectionDto } from '@erp/contracts/social-forms-api';
import type { HttpSocialForms } from '../infra/http-social-forms';
import { socialFieldLabels } from './social-field-input';
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
  textValue,
} from '../../../shared/ui';
const decisionLabels = [
  'Uso de dados pessoais reais',
  'Moradia',
  'Economia',
  'Necessidades',
  'Situação familiar',
  'Educação',
  'Saúde',
  'Medicamentos',
  'Religião',
];
function SelectionForm({
  gateway,
  selection,
  onSaved,
}: {
  gateway: HttpSocialForms;
  selection: FieldSelectionDto | null;
  onSaved: () => void;
}) {
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      selection?.fields.map((field) => [field.fieldKey, field.included]) ?? [],
    ),
  );
  const action = useAction();
  const keyFor = useOperationKey();
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void action.run(async () => {
          const fields = socialFieldKeys.flatMap((key) => {
            const old = selection?.fields.find(
              (field) => field.fieldKey === key,
            );
            if (!included[key])
              return old ? [{ ...old, included: false, required: false }] : [];
            return [
              {
                fieldKey: key,
                included: true,
                required: data.get(`${key}:required`) === 'on',
                appliesTo: key.startsWith('members[]')
                  ? textValue(data, `${key}:appliesTo`)
                  : 'FAMILY',
                allowedRoleCodes: data.getAll(`${key}:roles`),
                cardinality: textValue(data, `${key}:cardinality`),
                purpose: textValue(data, `${key}:purpose`),
                decisionReference: textValue(data, 'decisionReference'),
              },
            ];
          });
          const input = fieldSelectionInputSchema.parse({
            expectedRevision: selection?.version ?? null,
            decisionReference: textValue(data, 'decisionReference'),
            reason: textValue(data, 'reason'),
            fields,
          });
          await gateway.selectFields(input, keyFor('fieldSelection', input));
          onSaved();
        });
      }}
    >
      <p>
        A publicação substitui a coleção completa. Campos desmarcados são
        excluídos da coleta; definições existentes permanecem na versão
        histórica.
      </p>
      <fieldset disabled={action.pending}>
        {socialFieldKeys.map((key) => {
          const old = selection?.fields.find((field) => field.fieldKey === key);
          const restrictedReference =
            key.startsWith('members[].health') ||
            key === 'members[].medications';
          return (
            <details key={key}>
              <summary>
                {socialFieldLabels[key]} ·{' '}
                {included[key] ? 'Incluído' : 'Excluído'}
              </summary>
              <Field
                label={`Incluir ${socialFieldLabels[key]}`}
                name={`${key}:included`}
                type="checkbox"
                checked={included[key] ?? false}
                onChange={(event) =>
                  setIncluded({ ...included, [key]: event.target.checked })
                }
              />
              {included[key] && (
                <div className="form-grid">
                  <Field
                    label={`Obrigatório: ${socialFieldLabels[key]}`}
                    name={`${key}:required`}
                    type="checkbox"
                    defaultChecked={old?.required ?? false}
                  />
                  {key.startsWith('members[]') && (
                    <SelectField
                      label={`Aplicação: ${socialFieldLabels[key]}`}
                      name={`${key}:appliesTo`}
                      required
                      defaultValue={old?.appliesTo ?? ''}
                    >
                      <option value="">Selecione</option>
                      {!restrictedReference && (
                        <option value="ALL_MEMBERS">Todos os membros</option>
                      )}
                      <option value="REFERENCE_MEMBER">Titular</option>
                      {!restrictedReference && (
                        <option value="SELECTED_MEMBERS">
                          Membros selecionados
                        </option>
                      )}
                    </SelectField>
                  )}
                  <SelectField
                    label={`Cardinalidade: ${socialFieldLabels[key]}`}
                    name={`${key}:cardinality`}
                    required
                    defaultValue={old?.cardinality ?? ''}
                  >
                    <option value="">Selecione</option>
                    <option value="SINGLE">Única</option>
                    <option value="MULTIPLE">
                      Múltipla (somente catálogos ou medicamentos)
                    </option>
                  </SelectField>
                  <Field
                    label={`Finalidade: ${socialFieldLabels[key]}`}
                    name={`${key}:purpose`}
                    required
                    maxLength={1000}
                    defaultValue={old?.purpose ?? ''}
                  />
                  <Field
                    label={`Coordenação: ${socialFieldLabels[key]}`}
                    name={`${key}:roles`}
                    type="checkbox"
                    value="COORDINATION"
                    defaultChecked={
                      old?.allowedRoleCodes.includes('COORDINATION') ?? false
                    }
                  />
                  <Field
                    label={`Assistência Social: ${socialFieldLabels[key]}`}
                    name={`${key}:roles`}
                    type="checkbox"
                    value="SOCIAL_ASSISTANCE"
                    defaultChecked={
                      old?.allowedRoleCodes.includes('SOCIAL_ASSISTANCE') ??
                      false
                    }
                  />
                </div>
              )}
            </details>
          );
        })}
        <Field
          label="Referência da decisão de campos"
          name="decisionReference"
          required
          maxLength={2000}
        />
        <Field
          label="Motivo da nova seleção"
          name="reason"
          required
          maxLength={1000}
        />
      </fieldset>
      {action.error && <Alert error>{action.error}</Alert>}
      <Submit pending={action.pending}>Publicar seleção de campos</Submit>
    </form>
  );
}
export function SocialConfigurationPage({
  gateway,
}: {
  gateway: HttpSocialForms;
}) {
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(() => gateway.configuration(), [gateway]);
  const state = useApiQuery(load, refresh);
  const decisions = useAction();
  const options = useAction();
  const decisionKey = useOperationKey();
  const optionKey = useOperationKey();
  const onSaved = () => setRefresh((value) => value + 1);
  return (
    <Page title="Configuração da ficha social">
      <AsyncView state={state}>
        {(configuration) => (
          <>
            <Panel title="Seleção versionada">
              <SelectionForm
                key={configuration.selection?.id ?? 'new'}
                gateway={gateway}
                selection={configuration.selection}
                onSaved={onSaved}
              />
            </Panel>
            <Panel title="Decisões de habilitação">
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void decisions.run(async () => {
                    const changes = featureDecisionCodes.filter((code) =>
                      textValue(data, code),
                    );
                    if (changes.length !== 1)
                      throw new Error(
                        'Choose exactly one feature decision per operation',
                      );
                    const code = changes[0]!;
                    const current = configuration.decisions.find(
                      (decision) => decision.code === code,
                    );
                    const input = {
                      enabled: textValue(data, code) === 'true',
                      expectedRevision: current?.revision ?? null,
                      decisionReference: textValue(data, 'decisionReference'),
                      reason: textValue(data, 'reason'),
                    };
                    await gateway.decideFeature(
                      code,
                      input,
                      decisionKey(`decision/${code}`, input),
                    );
                    onSaved();
                  });
                }}
              >
                <p>
                  Altere uma decisão por operação. Abrir esta página não
                  habilita coleta.
                </p>
                <fieldset disabled={decisions.pending} className="form-grid">
                  {featureDecisionCodes.map((code, index) => (
                    <SelectField
                      key={code}
                      label={decisionLabels[index]!}
                      name={code}
                      defaultValue=""
                    >
                      <option value="">
                        Preservar (
                        {configuration.decisions.find(
                          (decision) => decision.code === code,
                        )?.enabled
                          ? 'habilitado'
                          : 'desabilitado'}
                        )
                      </option>
                      <option value="true">Habilitar</option>
                      <option value="false">Desabilitar</option>
                    </SelectField>
                  ))}
                  <Field
                    label="Referência da decisão de habilitação"
                    name="decisionReference"
                    required
                    maxLength={2000}
                  />
                  <Field
                    label="Motivo da decisão"
                    name="reason"
                    required
                    maxLength={1000}
                  />
                </fieldset>
                {decisions.error && <Alert error>{decisions.error}</Alert>}
                <Submit pending={decisions.pending}>Registrar decisão</Submit>
              </form>
            </Panel>
            <Panel title="Catálogos de opções">
              <form
                className="form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void options.run(async () => {
                    const input = {
                      fieldKey: socialFieldKeys.find(
                        (key) => key === textValue(data, 'fieldKey'),
                      )!,
                      code: textValue(data, 'code'),
                      label: textValue(data, 'label'),
                      active: data.get('active') === 'on',
                      isOther: data.get('isOther') === 'on',
                      decisionReference: textValue(data, 'decisionReference'),
                    };
                    await gateway.createOption(
                      input,
                      optionKey('option', input),
                    );
                    form.reset();
                    onSaved();
                  });
                }}
              >
                <SelectField
                  label="Campo do catálogo"
                  name="fieldKey"
                  required
                  defaultValue=""
                >
                  <option value="">Selecione</option>
                  {socialFieldKeys.map((key) => (
                    <option key={key} value={key}>
                      {socialFieldLabels[key]}
                    </option>
                  ))}
                </SelectField>
                <Field
                  label="Código da nova opção"
                  name="code"
                  required
                  pattern="[A-Z][A-Z0-9_]*"
                  maxLength={100}
                />
                <Field
                  label="Texto da nova opção"
                  name="label"
                  required
                  maxLength={200}
                />
                <Field label="Opção ativa" name="active" type="checkbox" />
                <Field label="É opção Outro" name="isOther" type="checkbox" />
                <Field
                  label="Referência da decisão do catálogo"
                  name="decisionReference"
                  required
                  maxLength={2000}
                />
                {options.error && <Alert error>{options.error}</Alert>}
                <Submit pending={options.pending}>Criar opção</Submit>
              </form>
              {configuration.options.map((option) => (
                <details key={`${option.id}:${option.revision}`}>
                  <summary>
                    {socialFieldLabels[option.fieldKey]} · {option.label} ·{' '}
                    {option.active ? 'Ativa' : 'Inativa'}
                  </summary>
                  <OptionForm
                    gateway={gateway}
                    option={option}
                    onSaved={onSaved}
                  />
                </details>
              ))}
            </Panel>
          </>
        )}
      </AsyncView>
      <button className="button secondary" onClick={onSaved}>
        Atualizar configuração
      </button>
    </Page>
  );
}
function OptionForm({
  gateway,
  option,
  onSaved,
}: {
  gateway: HttpSocialForms;
  option: Awaited<
    ReturnType<HttpSocialForms['configuration']>
  >['options'][number];
  onSaved: () => void;
}) {
  const action = useAction();
  const keyFor = useOperationKey();
  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void action.run(async () => {
          const input = {
            expectedRevision: option.revision,
            label: textValue(data, 'label'),
            active: data.get('active') === 'on',
            decisionReference: textValue(data, 'decisionReference'),
            reason: textValue(data, 'reason'),
          };
          await gateway.updateOption(
            option.id,
            input,
            keyFor(`option/${option.id}`, input),
          );
          onSaved();
        });
      }}
    >
      <Field
        label="Texto da opção"
        name="label"
        required
        defaultValue={option.label}
        maxLength={200}
      />
      <Field
        label="Ativa"
        name="active"
        type="checkbox"
        defaultChecked={option.active}
      />
      <Field
        label="Referência da alteração da opção"
        name="decisionReference"
        required
        maxLength={1000}
      />
      <Field
        label="Motivo da alteração da opção"
        name="reason"
        required
        maxLength={1000}
      />
      {action.error && <Alert error>{action.error}</Alert>}
      <Submit pending={action.pending}>Salvar opção</Submit>
    </form>
  );
}
