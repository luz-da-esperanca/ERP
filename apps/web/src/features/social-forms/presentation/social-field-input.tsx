import { useState } from 'react';
import type {
  FieldSelectionDto,
  SocialFormContextDto,
} from '@erp/contracts/social-forms-api';
import type { SocialFieldKey } from '@erp/contracts/social-form-fields';
import { MaskedField } from '../../../shared/masked-field';
import { YesNoField } from '../../../shared/yes-no-field';
import {
  Field,
  SelectField,
  textValue,
  nullableValue,
} from '../../../shared/ui';

type Definition = FieldSelectionDto['fields'][number];
export const socialFieldLabels: Record<SocialFieldKey, string> = {
  'housing.housingTenure': 'Condição de ocupação da moradia',
  'housing.location': 'Localização da moradia',
  'housing.roomCount': 'Quantidade de cômodos',
  'housing.bedroomCount': 'Quantidade de quartos',
  'housing.riskArea': 'Moradia em área de risco',
  'housing.dwellingType': 'Tipo de moradia',
  'housing.construction': 'Construção da moradia',
  'housing.floorType': 'Tipo de piso',
  'housing.electricity': 'Energia elétrica',
  'housing.waterSupply': 'Abastecimento de água',
  'housing.waterTreatment': 'Tratamento da água',
  'housing.sewage': 'Esgotamento sanitário',
  'housing.wasteDisposal': 'Destino do lixo',
  'housing.transportation': 'Meios de transporte',
  'housing.hygiene': 'Higiene',
  'economy.declaredWorkerCount': 'Trabalhadores declarados',
  'economy.declaredPensionerCount': 'Aposentados declarados',
  'economy.declaredChildCount': 'Crianças declaradas',
  'economy.declaredAdolescentCount': 'Adolescentes declarados',
  'economy.receivesGovernmentBenefit': 'Recebe benefício do governo',
  'economy.governmentBenefitName': 'Nome do benefício do governo',
  'needs.declaredNeeds': 'Necessidades declaradas',
  'needs.hasNeeds': 'Há necessidades de acompanhamento?',
  'needs.otherNeed': 'Outra necessidade',
  'situation.text': 'Situação familiar',
  'situation.hasObservations': 'Há observações para registrar?',
  'situation.observations': 'Doação / Ação / Visita Domiciliar',
  'situation.beneficiarySigned': 'Beneficiário assinou a ficha em papel?',
  'situation.registrationResponsibleName': 'Responsável pelo cadastro',
  'situation.registrationResponsibleSigned':
    'Responsável pelo cadastro assinou a ficha em papel?',
  'members[].economy.worksCurrently': 'Trabalha atualmente',
  'members[].economy.occupationOrIncomeSource': 'Ocupação ou origem da renda',
  'members[].economy.incomeAmount': 'Renda declarada (R$)',
  'members[].education.attendsSchool': 'Frequenta a escola',
  'members[].education.schoolLevelOrGrade': 'Escolaridade ou série',
  'members[].education.studyMode': 'Modalidade de estudo',
  'members[].health.spiritualHealth': 'Saúde espiritual',
  'members[].health.otherSpiritualHealth': 'Outra condição espiritual',
  'members[].health.physicalHealth': 'Saúde física',
  'members[].health.physicalHealthProblems': 'Problemas de saúde física',
  'members[].health.hasPhysicalHealthProblems':
    'Há problemas de saúde física a informar?',
  'members[].health.generalCondition': 'Estado geral',
  'members[].health.healthUnit': 'Unidade de saúde',
  'members[].health.hasHealthUnit': 'Possui posto de saúde de referência?',
  'members[].health.communityHealthAgent': 'Agente comunitário de saúde',
  'members[].health.hasCommunityHealthAgent':
    'Possui agente comunitário de saúde (ACS)?',
  'members[].medications': 'Medicamentos utilizados',
  'members[].religion.participatesInEvangelization':
    'Participa da evangelização',
};
const booleanKeys: SocialFieldKey[] = [
  'needs.hasNeeds',
  'situation.hasObservations',
  'situation.beneficiarySigned',
  'situation.registrationResponsibleSigned',
  'members[].health.hasPhysicalHealthProblems',
  'members[].health.hasHealthUnit',
  'members[].health.hasCommunityHealthAgent',
  'housing.riskArea',
  'economy.receivesGovernmentBenefit',
  'members[].economy.worksCurrently',
  'members[].education.attendsSchool',
  'members[].religion.participatesInEvangelization',
];
const catalogKeys: SocialFieldKey[] = [
  'housing.housingTenure',
  'housing.location',
  'housing.dwellingType',
  'housing.construction',
  'housing.floorType',
  'housing.electricity',
  'housing.waterSupply',
  'housing.waterTreatment',
  'housing.sewage',
  'housing.wasteDisposal',
  'housing.transportation',
  'housing.hygiene',
  'needs.declaredNeeds',
];
const enumChoices: Partial<Record<SocialFieldKey, Record<string, string>>> = {
  'members[].health.spiritualHealth': {
    EQUILIBRATED: 'Equilibrada',
    INFLUENCED: 'Influenciada',
    OTHER: 'Outra',
  },
  'members[].health.physicalHealth': {
    GOOD: 'Boa',
    REGULAR: 'Regular',
    POOR: 'Ruim',
  },
};
export function SocialFieldInput({
  field,
  options,
  prefix,
  label: labelOverride,
}: {
  field: Definition;
  options: SocialFormContextDto['options'];
  prefix: string;
  label?: string;
}) {
  const key = field.fieldKey;
  const name = `${prefix}${key}`;
  const label = labelOverride ?? socialFieldLabels[key];
  const [known, setKnown] = useState(false);
  if (key === 'members[].medications')
    return <MedicationInput field={field} name={name} />;
  if (catalogKeys.includes(key) && field.required)
    return (
      <RequiredCatalogInput
        field={field}
        options={options}
        name={name}
        label={label}
      />
    );
  if (booleanKeys.includes(key) && field.required)
    return <YesNoField label={label} name={name} />;
  if (catalogKeys.includes(key))
    return (
      <div>
        <Field
          label={`${socialFieldLabels[key]} informada`}
          name={`${name}:known`}
          required={field.required}
          type="checkbox"
          checked={known}
          onChange={(event) => setKnown(event.target.checked)}
        />
        {known && (
          <>
            <SelectField
              label={socialFieldLabels[key]}
              name={name}
              multiple={field.cardinality === 'MULTIPLE'}
              required={field.required}
            >
              <option value="">Nenhuma opção</option>
              {options
                .filter((option) => option.fieldKey === key && option.active)
                .map((option) => (
                  <option key={option.id} value={option.code}>
                    {option.label}
                  </option>
                ))}
            </SelectField>
            <Field
              label={`Complemento de outra opção: ${socialFieldLabels[key]}`}
              name={`${name}:other`}
              maxLength={1000}
            />
          </>
        )}
      </div>
    );
  if (booleanKeys.includes(key) || enumChoices[key])
    return (
      <SelectField
        label={label}
        name={name}
        required={field.required}
        defaultValue=""
      >
        <option value="">Não informado</option>
        {booleanKeys.includes(key) ? (
          <>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </>
        ) : (
          Object.entries(enumChoices[key]!).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))
        )}
      </SelectField>
    );
  const count = key.endsWith('Count');
  if (key.endsWith('incomeAmount'))
    return (
      <MaskedField
        mask="currency"
        label={label}
        name={name}
        required={field.required}
      />
    );
  if (key === 'situation.text' || key === 'members[].health.generalCondition')
    return (
      <label className="field">
        <span>
          {label}
          {field.required && <span aria-hidden="true"> *</span>}
        </span>
        <textarea
          name={name}
          required={field.required}
          rows={4}
          maxLength={key === 'situation.text' ? 4000 : 1000}
        />
      </label>
    );
  return (
    <Field
      label={label}
      name={name}
      required={field.required}
      type={count ? 'number' : 'text'}
      min={count ? 0 : undefined}
      step={count ? 1 : undefined}
      maxLength={1000}
    />
  );
}
export function collectSocialFields(
  data: FormData,
  fields: Definition[],
  options: SocialFormContextDto['options'],
  prefix: string,
) {
  const blocks: Record<string, unknown> = {};
  for (const field of fields) {
    const key = field.fieldKey;
    const name = `${prefix}${key}`;
    const text = textValue(data, name);
    let value: unknown = nullableValue(data, name);
    if (booleanKeys.includes(key)) value = text === '' ? null : text === 'true';
    else if (key.endsWith('incomeAmount'))
      value = text === '' ? null : text.replaceAll('.', '').replace(',', '.');
    else if (key.endsWith('Count')) value = text === '' ? null : Number(text);
    else if (catalogKeys.includes(key))
      value =
        field.required || data.get(`${name}:known`) === 'on'
          ? data
              .getAll(name)
              .map(String)
              .filter(Boolean)
              .map((code) => ({
                code,
                ...(options.find(
                  (option) => option.fieldKey === key && option.code === code,
                )?.isOther
                  ? { otherText: nullableValue(data, `${name}:other`) }
                  : {}),
              }))
          : null;
    else if (key === 'situation.observations') {
      const hasObservations = textValue(
        data,
        `${prefix}situation.hasObservations`,
      );
      value =
        hasObservations === 'false'
          ? []
          : hasObservations === 'true'
            ? [...data.keys()]
                .filter((key) => key.startsWith(`${name}:date:`))
                .map((key) => ({
                  occurredOn: textValue(data, key),
                  description: textValue(
                    data,
                    `${name}:description:${key.slice(`${name}:date:`.length)}`,
                  ),
                }))
            : null;
    } else if (key === 'members[].medications') {
      const medicationUse = textValue(data, `${name}:uses`);
      const medicationListKnown = field.required
        ? medicationUse === 'true'
        : data.get(`${name}:known`) === 'on';
      if (field.required && medicationUse === 'false') value = [];
      else
        value = medicationListKnown
          ? [...data.keys()]
              .filter((key) => key.startsWith(`${name}:medication:`))
              .map((key) => {
                const row = key.slice(`${name}:medication:`.length);
                const government = textValue(data, `${name}:government:${row}`);
                return {
                  medicationName: textValue(data, key),
                  providedByGovernment:
                    government === '' ? null : government === 'true',
                };
              })
          : null;
    }
    const path = key.replace('members[].', '').split('.');
    if (path.length === 1) blocks[path[0]!] = value;
    else {
      const block = (blocks[path[0]!] ??= {}) as Record<string, unknown>;
      block[path[1]!] = value;
    }
  }
  return blocks;
}

function RequiredCatalogInput({
  field,
  options,
  name,
  label,
}: {
  field: Definition;
  options: SocialFormContextDto['options'];
  name: string;
  label: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const available = options.filter(
    (option) => option.fieldKey === field.fieldKey && option.active,
  );
  const hasOther = available.some(
    (option) => option.isOther && selected.includes(option.code),
  );
  return (
    <div className="field">
      <SelectField
        label={label}
        name={name}
        required
        multiple={field.cardinality === 'MULTIPLE'}
        defaultValue={field.cardinality === 'MULTIPLE' ? [] : ''}
        onChange={(event) =>
          setSelected(
            [...event.target.selectedOptions].map((option) => option.value),
          )
        }
      >
        {field.cardinality === 'SINGLE' && <option value="">Selecione</option>}
        {available.map((option) => (
          <option key={option.id} value={option.code}>
            {option.label}
          </option>
        ))}
      </SelectField>
      {hasOther && field.fieldKey !== 'needs.declaredNeeds' && (
        <Field
          label={`Outros: ${label}`}
          name={`${name}:other`}
          required
          maxLength={1000}
        />
      )}
    </div>
  );
}

function MedicationInput({ field, name }: { field: Definition; name: string }) {
  const [known, setKnown] = useState(false);
  const [usesMedication, setUsesMedication] = useState<boolean | null>(null);
  const [rows, setRows] = useState<number[]>(field.required ? [0] : []);
  const [sequence, setSequence] = useState(field.required ? 1 : 0);
  return (
    <div>
      {field.required ? (
        <fieldset>
          <legend>Faz uso de medicamentos?</legend>
          <Field
            label="Sim"
            name={`${name}:uses`}
            type="radio"
            value="true"
            required
            checked={usesMedication === true}
            onChange={() => setUsesMedication(true)}
          />
          <Field
            label="Não"
            name={`${name}:uses`}
            type="radio"
            value="false"
            required
            checked={usesMedication === false}
            onChange={() => setUsesMedication(false)}
          />
        </fieldset>
      ) : (
        <Field
          label="Medicamentos conhecidos"
          name={`${name}:known`}
          type="checkbox"
          checked={known}
          onChange={(event) => setKnown(event.target.checked)}
        />
      )}
      {(field.required ? usesMedication === true : known) && (
        <>
          {!field.required && (
            <p>
              Sem linhas significa nenhum medicamento declarado. Medicamento
              desconhecido permanece não informado.
            </p>
          )}
          {rows.map((row, index) => (
            <fieldset key={row}>
              <legend>Medicamento {index + 1}</legend>
              <Field
                label={`Nome do medicamento ${index + 1}`}
                name={`${name}:medication:${row}`}
                required
                maxLength={200}
              />
              <SelectField
                label={`Fornecido pelo governo — medicamento ${index + 1}`}
                name={`${name}:government:${row}`}
                defaultValue=""
                required={field.required}
              >
                <option value="">
                  {field.required ? 'Selecione' : 'Não informado'}
                </option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </SelectField>
              <button
                type="button"
                className="button secondary"
                disabled={field.required && rows.length === 1}
                onClick={() => setRows(rows.filter((value) => value !== row))}
              >
                Retirar medicamento {index + 1}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={field.cardinality === 'SINGLE' && rows.length >= 1}
            onClick={() => {
              setRows([...rows, sequence]);
              setSequence(sequence + 1);
            }}
          >
            Adicionar medicamento
          </button>
        </>
      )}
    </div>
  );
}
