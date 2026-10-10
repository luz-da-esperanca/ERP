import { useState } from 'react';
import type {
  FieldSelectionDto,
  SocialFormContextDto,
} from '@erp/contracts/social-forms-api';
import type { SocialFieldKey } from '@erp/contracts/social-form-fields';
import { MaskedField } from '../../../shared/masked-field';
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
  'needs.otherNeed': 'Outra necessidade',
  'situation.text': 'Situação familiar',
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
  'members[].health.generalCondition': 'Estado geral',
  'members[].health.healthUnit': 'Unidade de saúde',
  'members[].health.communityHealthAgent': 'Agente comunitário de saúde',
  'members[].medications': 'Medicamentos utilizados',
  'members[].religion.participatesInEvangelization':
    'Participa da evangelização',
};
const booleanKeys: SocialFieldKey[] = [
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
}: {
  field: Definition;
  options: SocialFormContextDto['options'];
  prefix: string;
}) {
  const key = field.fieldKey;
  const name = `${prefix}${key}`;
  const [known, setKnown] = useState(false);
  if (key === 'members[].medications')
    return <MedicationInput field={field} name={name} />;
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
        label={socialFieldLabels[key]}
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
        label={socialFieldLabels[key]}
        name={name}
        required={field.required}
      />
    );
  return (
    <Field
      label={socialFieldLabels[key]}
      name={name}
      required={field.required}
      type={count ? 'number' : 'text'}
      min={count ? 0 : undefined}
      step={count ? 1 : undefined}
      maxLength={key === 'situation.text' ? 4000 : 1000}
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
        data.get(`${name}:known`) === 'on'
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
    else if (key === 'members[].medications')
      value =
        data.get(`${name}:known`) === 'on'
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
    const path = key.replace('members[].', '').split('.');
    if (path.length === 1) blocks[path[0]!] = value;
    else {
      const block = (blocks[path[0]!] ??= {}) as Record<string, unknown>;
      block[path[1]!] = value;
    }
  }
  return blocks;
}

function MedicationInput({ field, name }: { field: Definition; name: string }) {
  const [known, setKnown] = useState(false);
  const [rows, setRows] = useState<number[]>([]);
  const [sequence, setSequence] = useState(0);
  return (
    <div>
      <Field
        label="Medicamentos conhecidos"
        name={`${name}:known`}
        type="checkbox"
        required={field.required}
        checked={known}
        onChange={(event) => setKnown(event.target.checked)}
      />
      {known && (
        <>
          <p>
            Sem linhas significa nenhum medicamento declarado. Medicamento
            desconhecido permanece não informado.
          </p>
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
              >
                <option value="">Não informado</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </SelectField>
              <button
                type="button"
                className="button secondary"
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
