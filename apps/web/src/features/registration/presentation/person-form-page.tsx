import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  createRegisteredPersonSchema,
  updatePersonSchema,
} from '@erp/contracts/registration-api';
import type { FamilyDto, PersonDto } from '@erp/contracts/registration-api';
import type { HttpRegistration } from '../infra/http-registration';
import { useQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import {
  Alert,
  AsyncView,
  BackLink,
  Field,
  Page,
  Panel,
  Submit,
  nullableValue,
  textValue,
} from '../../../shared/ui';
import { civilToday } from '../../../shared/time';
import { useRegistrationIntent } from './use-registration-intent';
import { DuplicateReview } from './duplicate-review';

function PersonForm({
  registration,
  family,
  person,
}: {
  registration: HttpRegistration;
  family?: FamilyDto;
  person?: PersonDto;
}) {
  const navigate = useNavigate();
  const action = useAction();
  const intent = useRegistrationIntent();
  const [today] = useState(civilToday);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.run(async () => {
      const fields = {
        name: textValue(form, 'name'),
        birthDate: nullableValue(form, 'birthDate'),
        sex: nullableValue(form, 'sex'),
        cpf: nullableValue(form, 'cpf'),
        rg: nullableValue(form, 'rg'),
        occupation: nullableValue(form, 'occupation'),
        educationLevel: nullableValue(form, 'educationLevel'),
        contactPhone: nullableValue(form, 'contactPhone'),
      };
      if (person) {
        const input = updatePersonSchema.parse({
          ...fields,
          expectedRevision: person.revision,
        });
        const prepared = await intent.prepare(input, form);
        if (!prepared) return;
        await registration.updatePerson(person.id, input, prepared.key);
        navigate(`/people/${person.id}`);
      } else if (family) {
        const input = createRegisteredPersonSchema.parse({
          ...fields,
          familyId: family.id,
          expectedFamilyRevision: family.revision,
          validFrom: `${textValue(form, 'validFrom')}T00:00:00-03:00`,
          relationshipToReference: nullableValue(
            form,
            'relationshipToReference',
          ),
          isReference: form.get('isReference') === 'on',
        });
        const prepared = await intent.prepare(input, form, () =>
          registration.reviewPersonDuplicates(input),
        );
        if (!prepared) return;
        const result = await registration.createRegisteredPerson(
          { ...input, ...prepared.body },
          prepared.key,
        );
        navigate(`/people/${result.person.id}`);
      }
    });
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <p className="muted">
        Informe apenas os dados conhecidos. Nome é obrigatório; documentos e
        nascimento podem ser complementados depois.
      </p>
      {family && (
        <p>
          Família:{' '}
          <Link to={`/families/${family.id}`}>
            {family.referenceName ?? `Família ${family.code}`}
          </Link>{' '}
          · Código {family.code}
        </p>
      )}
      <div className="form-grid">
        <Field
          label="Nome completo"
          name="name"
          required
          maxLength={200}
          defaultValue={person?.name ?? ''}
        />
        <Field
          label="Data de nascimento"
          name="birthDate"
          type="date"
          max={today}
          defaultValue={person?.birthDate ?? ''}
        />
        <Field
          label="Sexo"
          name="sex"
          maxLength={100}
          defaultValue={person?.sex ?? ''}
        />
        <Field
          label="CPF (11 dígitos)"
          name="cpf"
          pattern="[0-9]{11}"
          defaultValue={person?.cpf ?? ''}
        />
        <Field
          label="RG"
          name="rg"
          maxLength={30}
          defaultValue={person?.rg ?? ''}
        />
        <Field
          label="Telefone"
          name="contactPhone"
          maxLength={50}
          defaultValue={person?.contactPhone ?? ''}
        />
        <Field
          label="Ocupação"
          name="occupation"
          maxLength={100}
          defaultValue={person?.occupation ?? ''}
        />
        <Field
          label="Escolaridade"
          name="educationLevel"
          maxLength={100}
          defaultValue={person?.educationLevel ?? ''}
        />
        {family && (
          <>
            <Field
              label="Início do vínculo familiar"
              name="validFrom"
              type="date"
              required
              max={today}
              defaultValue={today}
            />
            <Field
              label="Parentesco com o titular"
              name="relationshipToReference"
              maxLength={100}
            />
            <Field
              label="É titular da família"
              name="isReference"
              type="checkbox"
            />
          </>
        )}
      </div>
      {intent.review && (
        <DuplicateReview candidates={intent.review.candidates} />
      )}
      {action.error && <Alert error>{action.error}</Alert>}
      {action.error && !person && (
        <button
          className="button secondary"
          type="button"
          onClick={intent.reset}
        >
          Consultar candidatos novamente
        </button>
      )}
      <Submit pending={action.pending}>
        {person ? 'Salvar pessoa' : 'Cadastrar pessoa'}
      </Submit>
    </form>
  );
}

export function PersonFormPage({
  registration,
  edit = false,
}: {
  registration: HttpRegistration;
  edit?: boolean;
}) {
  const { id = '' } = useParams();
  const [search] = useSearchParams();
  const familyId = search.get('familyId');
  const load = useCallback(
    async () =>
      edit
        ? {
            person: (await registration.getPerson(id)).person as PersonDto,
            family: undefined,
          }
        : familyId
          ? {
              family: (await registration.getFamily(familyId)).family,
              person: undefined,
            }
          : null,
    [registration, edit, id, familyId],
  );
  const state = useQuery(load);
  return (
    <>
      <BackLink
        to={
          edit
            ? `/people/${id}`
            : familyId
              ? `/families/${familyId}/members`
              : '/families'
        }
      />
      <Page title={edit ? 'Editar pessoa' : 'Nova pessoa'}>
        <AsyncView state={state}>
          {(detail) =>
            detail ? (
              <Panel>
                <PersonForm
                  key={
                    detail.person
                      ? `${detail.person.id}:${detail.person.revision}`
                      : `${detail.family!.id}:${detail.family!.revision}`
                  }
                  registration={registration}
                  {...detail}
                />
              </Panel>
            ) : (
              <Alert error>
                Abra os membros de uma família para adicionar uma pessoa ao
                núcleo.
              </Alert>
            )
          }
        </AsyncView>
      </Page>
    </>
  );
}
