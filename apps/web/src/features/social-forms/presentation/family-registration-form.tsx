import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { SocialFormContextDto } from '@erp/contracts/social-forms-api';
import { publishSocialFormSchema } from '@erp/contracts/social-forms-api';
import type { SocialFieldKey } from '@erp/contracts/social-form-fields';
import { formatCpfInput } from '@erp/contracts/cpf';
import type { HttpSocialForms } from '../infra/http-social-forms';
import { Field, Alert, textValue } from '../../../shared/ui';
import { MaskedField } from '../../../shared/masked-field';
import { useAction } from '../../../shared/use-action';
import { useOperationKey } from '../../../shared/use-operation-key';
import { civilToday } from '../../../shared/time';
import { SocialFieldInput, collectSocialFields } from './social-field-input';

const childFieldKeys: SocialFieldKey[] = [
  'members[].education.attendsSchool',
  'members[].education.schoolLevelOrGrade',
  'members[].education.studyMode',
  'members[].religion.participatesInEvangelization',
];
const paperLabels: Partial<Record<SocialFieldKey, string>> = {
  'housing.housingTenure': 'Moradia',
  'housing.location': 'Localização',
  'housing.roomCount': 'Nº de Cômodos',
  'housing.bedroomCount': 'Dormitórios',
  'housing.riskArea': 'Local de Risco',
  'housing.dwellingType': 'Domicílio',
  'housing.construction': 'Construção',
  'housing.floorType': 'Piso da Casa',
  'housing.waterTreatment': 'Consumo de Água',
  'housing.sewage': 'Escoamento',
  'housing.transportation': 'Deslocamento',
  'economy.declaredWorkerCount':
    'Quantas pessoas trabalham para manter a família',
  'economy.declaredPensionerCount':
    'Quantas pessoas aposentadas ou pensionistas',
  'economy.receivesGovernmentBenefit': 'Recebe auxílio do governo?',
  'economy.governmentBenefitName': 'Qual auxílio',
  'economy.declaredChildCount': 'Quantidade de Crianças na Casa',
  'economy.declaredAdolescentCount': 'Quantidade de Adolescentes',
  'members[].economy.occupationOrIncomeSource': 'Ocupação / Bico / Pensão',
  'members[].economy.incomeAmount': 'Renda (R$)',
  'members[].education.attendsSchool': 'Estuda S/N',
  'members[].education.schoolLevelOrGrade': 'Escolariz./Série',
  'members[].education.studyMode': 'Modo de Estudo',
  'members[].health.generalCondition': 'Quadro Geral',
  'members[].health.healthUnit': 'Posto de Saúde',
  'members[].health.communityHealthAgent': 'ACS',
  'members[].religion.participatesInEvangelization':
    'Participa da Evangeliz. S/N',
  'needs.declaredNeeds': 'Necessidade',
  'needs.otherNeed': 'Outros: necessidade',
  'situation.text': 'Situação Encontrada',
};

function PaperSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="form-stack">
      <h2>{title}</h2>
      <div className="form-grid">{children}</div>
    </section>
  );
}
function SnapshotField({
  label,
  name,
  value,
  type = 'text',
}: {
  label: string;
  name: string;
  value: string | number | null | undefined;
  type?: string;
}) {
  return (
    <Field
      label={label}
      name={name}
      type={type}
      value={value ?? ''}
      readOnly
      required
    />
  );
}

export function FamilyRegistrationForm({
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
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [children, setChildren] = useState<string[]>([]);
  const [observations, setObservations] = useState([0]);
  const [sequence, setSequence] = useState(1);
  const [today] = useState(civilToday);
  const fields =
    context.fieldSelection?.fields.filter((field) => field.included) ?? [];
  const reference = context.members.find(
    (member) => member.person.id === context.referencePersonId,
  );
  const answeredYes = (name: string) => answers[name]?.[0] === 'true';
  const renderField = (key: SocialFieldKey, personId?: string) => {
    const field = fields.find((definition) => definition.fieldKey === key);
    if (!field) return null;
    const prefix = personId ? `${personId}:` : '';
    const dependency: Partial<Record<SocialFieldKey, SocialFieldKey>> = {
      'economy.governmentBenefitName': 'economy.receivesGovernmentBenefit',
      'members[].health.physicalHealthProblems':
        'members[].health.hasPhysicalHealthProblems',
      'members[].health.healthUnit': 'members[].health.hasHealthUnit',
      'members[].health.communityHealthAgent':
        'members[].health.hasCommunityHealthAgent',
      'members[].education.schoolLevelOrGrade':
        'members[].education.attendsSchool',
      'members[].education.studyMode': 'members[].education.attendsSchool',
    };
    const driver = dependency[key];
    if (driver && !answeredYes(`${prefix}${driver}`)) return null;
    if (
      key === 'members[].health.otherSpiritualHealth' &&
      answers[`${prefix}members[].health.spiritualHealth`]?.[0] !== 'OTHER'
    )
      return null;
    if (key === 'needs.declaredNeeds' && !answeredYes('needs.hasNeeds'))
      return null;
    if (
      key === 'needs.otherNeed' &&
      (!answeredYes('needs.hasNeeds') ||
        !answers['needs.declaredNeeds']?.includes('OTHER'))
    )
      return null;
    return (
      <SocialFieldInput
        key={`${prefix}${key}`}
        field={field}
        options={context.options}
        prefix={prefix}
        label={paperLabels[key]}
      />
    );
  };
  const memberFields = (personId: string) =>
    fields.filter(
      (field) =>
        field.appliesTo === 'ALL_MEMBERS' ||
        (field.appliesTo === 'REFERENCE_MEMBER' &&
          personId === context.referencePersonId) ||
        (field.appliesTo === 'SELECTED_MEMBERS' && children.includes(personId)),
    );
  if (!reference)
    return (
      <Alert>
        Defina o titular da família antes de preencher a ficha.{' '}
        <Link to={`/families/${context.family.id}/members`}>
          Abrir membros da família
        </Link>
      </Alert>
    );
  const missingSources: string[] = [];
  const requireSource = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === '')
      missingSources.push(label);
  };
  for (const [label, value] of Object.entries({
    Endereço: context.family.address,
    Bairro: context.family.neighborhood,
    CEP: context.family.postalCode,
    CPF: reference.person.cpf,
    RG: reference.person.rg,
    'Nível Escolar': reference.person.educationLevel,
    'Fone de contato':
      reference.person.contactPhone ?? context.family.contactPhone,
  }))
    requireSource(label, value);
  if (answeredYes(`${reference.person.id}:members[].economy.worksCurrently`))
    requireSource('Ocupação', reference.person.occupation);
  for (const { person, membership, sizeProfile } of context.members) {
    requireSource(`Data de nascimento de ${person.name}`, person.birthDate);
    if (!membership.isReference)
      requireSource(
        `Parentesco de ${person.name}`,
        membership.relationshipToReference,
      );
    if (children.includes(person.id)) {
      requireSource(`Sexo de ${person.name}`, person.sex);
      requireSource(`Calçado de ${person.name}`, sizeProfile?.shoeSize);
      requireSource(`Vestuário de ${person.name}`, sizeProfile?.clothingSize);
    }
  }
  return (
    <form
      className="form-stack family-registration-form"
      aria-label="Ficha de Cadastro de Famílias"
      onChange={(event) => {
        const next: Record<string, string[]> = {};
        for (const [name, value] of new FormData(event.currentTarget))
          (next[name] ??= []).push(String(value));
        setAnswers(next);
      }}
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
              fields.filter((field) => field.appliesTo === 'FAMILY'),
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
              selectedFieldKeys: children.includes(person.id)
                ? childFieldKeys
                : [],
            })),
            ...(data.get('situation.beneficiarySigned') === 'true'
              ? {
                  acknowledgement: {
                    referencePersonId: reference.person.id,
                    method: 'PAPER_SIGNATURE',
                    acknowledgedOn: textValue(data, 'acknowledgedOn'),
                  },
                }
              : {}),
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
            keyFor(`familyForm/${context.family.id}`, input),
          );
          onSaved();
        });
      }}
    >
      <p>Instituto da Caridade — Luz da Esperança</p>
      <p>
        Confira os dados de identificação no cadastro.{' '}
        <Link to={`/families/${context.family.id}/edit`}>Editar família</Link> ·{' '}
        <Link to={`/people/${reference.person.id}/edit`}>
          Editar beneficiário
        </Link>
      </p>
      {!!missingSources.length && (
        <Alert error>
          Complete os dados cadastrais obrigatórios e consulte a composição
          novamente: {missingSources.join(' · ')}.
        </Alert>
      )}
      <fieldset disabled={action.pending} className="form-stack">
        <div className="form-grid">
          <SnapshotField
            label="Nº Família"
            name="source:familyCode"
            value={context.family.code}
          />
          <SnapshotField
            label="Nº Pessoas"
            name="source:memberCount"
            value={context.members.length}
          />
          <SnapshotField
            label="Data"
            name="source:date"
            type="date"
            value={civilToday(new Date(context.occurredAt))}
          />
        </div>
        <PaperSection title="Identificação do Beneficiário">
          <SnapshotField
            label="Beneficiário(a)"
            name="source:name"
            value={reference.person.name}
          />
          <SnapshotField
            label="Data de Nascimento"
            name="source:birthDate"
            type="date"
            value={reference.person.birthDate}
          />
          <SnapshotField
            label="CPF"
            name="source:cpf"
            value={formatCpfInput(reference.person.cpf ?? '')}
          />
          <SnapshotField
            label="RG"
            name="source:rg"
            value={reference.person.rg}
          />
          <SnapshotField
            label="Endereço"
            name="source:address"
            value={context.family.address}
          />
          <SnapshotField
            label="Bairro"
            name="source:neighborhood"
            value={context.family.neighborhood}
          />
          <MaskedField
            mask="postalCode"
            label="CEP"
            name="source:postalCode"
            defaultValue={context.family.postalCode ?? ''}
            readOnly
            required
          />
          {renderField('members[].economy.worksCurrently', reference.person.id)}
          {answeredYes(
            `${reference.person.id}:members[].economy.worksCurrently`,
          ) && (
            <SnapshotField
              label="Ocupação"
              name="source:occupation"
              value={reference.person.occupation}
            />
          )}
          <SnapshotField
            label="Nível Escolar"
            name="source:educationLevel"
            value={reference.person.educationLevel}
          />
          <MaskedField
            mask="phone"
            label="Fone de contato"
            name="source:contactPhone"
            defaultValue={
              reference.person.contactPhone ?? context.family.contactPhone ?? ''
            }
            readOnly
            required
          />
        </PaperSection>
        <PaperSection title="Situação Domiciliar">
          {fields
            .filter((field) => field.fieldKey.startsWith('housing.'))
            .map((field) => renderField(field.fieldKey))}
        </PaperSection>
        <PaperSection title="Composição Familiar e Econômica do(a) Beneficiário(a)">
          {[
            'economy.declaredWorkerCount',
            'economy.declaredPensionerCount',
            'economy.receivesGovernmentBenefit',
            'economy.governmentBenefitName',
          ].map((key) => renderField(key as SocialFieldKey))}
          {context.members.map(({ person, membership }) => (
            <fieldset className="form-grid" key={person.id}>
              <legend>{person.name}</legend>
              <SnapshotField
                label="Nome"
                name={`source:${person.id}:name`}
                value={person.name}
              />
              <SnapshotField
                label="Data Nasc."
                name={`source:${person.id}:birthDate`}
                type="date"
                value={person.birthDate}
              />
              <SnapshotField
                label="Parent."
                name={`source:${person.id}:relationship`}
                value={
                  membership.isReference
                    ? 'Beneficiário(a)'
                    : membership.relationshipToReference
                }
              />
              {renderField(
                'members[].economy.occupationOrIncomeSource',
                person.id,
              )}
              {renderField('members[].economy.incomeAmount', person.id)}
              <Link to={`/people/${person.id}/edit`}>
                Editar cadastro de {person.name}
              </Link>
            </fieldset>
          ))}
        </PaperSection>
        <PaperSection title="Situação de Saúde do(a) Beneficiário(a)">
          {[
            'members[].health.spiritualHealth',
            'members[].health.otherSpiritualHealth',
            'members[].health.physicalHealth',
            'members[].health.hasPhysicalHealthProblems',
            'members[].health.physicalHealthProblems',
            'members[].health.generalCondition',
          ].map((key) =>
            renderField(key as SocialFieldKey, reference.person.id),
          )}
        </PaperSection>
        <PaperSection title="Situação Encontrada">
          {renderField('situation.text')}
        </PaperSection>
        <PaperSection title="Posto de Saúde e Medicamentos">
          {[
            'members[].health.hasHealthUnit',
            'members[].health.healthUnit',
            'members[].health.hasCommunityHealthAgent',
            'members[].health.communityHealthAgent',
            'members[].medications',
          ].map((key) =>
            renderField(key as SocialFieldKey, reference.person.id),
          )}
        </PaperSection>
        <PaperSection title="Composição Familiar — Crianças e Adolescentes">
          {renderField('economy.declaredChildCount')}
          {renderField('economy.declaredAdolescentCount')}
          {context.members.map(({ person, membership, sizeProfile }) => (
            <fieldset className="form-grid" key={person.id}>
              <legend>{person.name}</legend>
              <Field
                type="checkbox"
                label="Incluir na composição de crianças e adolescentes"
                name={`child:${person.id}`}
                checked={children.includes(person.id)}
                onChange={(event) =>
                  setChildren(
                    event.target.checked
                      ? [...children, person.id]
                      : children.filter((id) => id !== person.id),
                  )
                }
              />
              {children.includes(person.id) && (
                <>
                  <SnapshotField
                    label="Nome"
                    name={`childSource:${person.id}:name`}
                    value={person.name}
                  />
                  <SnapshotField
                    label="Sexo"
                    name={`childSource:${person.id}:sex`}
                    value={person.sex}
                  />
                  <SnapshotField
                    label="Data Nasc."
                    name={`childSource:${person.id}:birthDate`}
                    type="date"
                    value={person.birthDate}
                  />
                  {childFieldKeys
                    .slice(0, 3)
                    .map((key) => renderField(key, person.id))}
                  <SnapshotField
                    label="Parent."
                    name={`childSource:${person.id}:relationship`}
                    value={
                      membership.isReference
                        ? 'Beneficiário(a)'
                        : membership.relationshipToReference
                    }
                  />
                  <SnapshotField
                    label="Nº Calçado"
                    name={`childSource:${person.id}:shoeSize`}
                    value={sizeProfile?.shoeSize}
                  />
                  <SnapshotField
                    label="Vestuário"
                    name={`childSource:${person.id}:clothingSize`}
                    value={sizeProfile?.clothingSize}
                  />
                  {renderField(
                    'members[].religion.participatesInEvangelization',
                    person.id,
                  )}
                  <Link to={`/people/${person.id}/sizes`}>
                    Editar calçado e vestuário
                  </Link>
                </>
              )}
            </fieldset>
          ))}
        </PaperSection>
        <PaperSection title="Acompanhamento">
          {renderField('needs.hasNeeds')}
          {renderField('needs.declaredNeeds')}
          {renderField('needs.otherNeed')}
        </PaperSection>
        <PaperSection title="Observações">
          {renderField('situation.hasObservations')}
          {answeredYes('situation.hasObservations') && (
            <>
              {observations.map((row, index) => (
                <fieldset className="form-grid" key={row}>
                  <legend>Observação {index + 1}</legend>
                  <Field
                    label="Data"
                    name={`situation.observations:date:${row}`}
                    type="date"
                    required
                    max={today}
                  />
                  <Field
                    label="Doação / Ação / Visita Domiciliar"
                    name={`situation.observations:description:${row}`}
                    required
                    maxLength={2000}
                  />
                  <button
                    type="button"
                    className="button secondary"
                    disabled={observations.length === 1}
                    onClick={() =>
                      setObservations(observations.filter((id) => id !== row))
                    }
                  >
                    Retirar observação {index + 1}
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                className="button secondary"
                disabled={observations.length >= 100}
                onClick={() => {
                  setObservations([...observations, sequence]);
                  setSequence(sequence + 1);
                }}
              >
                Adicionar observação
              </button>
            </>
          )}
        </PaperSection>
        <PaperSection title="Assinaturas">
          {renderField('situation.beneficiarySigned')}
          {answeredYes('situation.beneficiarySigned') && (
            <Field
              label="Data conhecida da assinatura do beneficiário"
              name="acknowledgedOn"
              type="date"
              required
              max={today}
            />
          )}
          {renderField('situation.registrationResponsibleName')}
          {renderField('situation.registrationResponsibleSigned')}
        </PaperSection>
        {correctionId && (
          <Field
            label="Motivo da correção da ficha"
            name="reason"
            required
            maxLength={1000}
          />
        )}
      </fieldset>
      {action.error && <Alert error>{action.error}</Alert>}
      <button
        type="submit"
        className="button primary"
        disabled={action.pending || missingSources.length > 0}
      >
        {action.pending ? 'Publicando…' : 'Publicar ficha'}
      </button>
    </form>
  );
}
