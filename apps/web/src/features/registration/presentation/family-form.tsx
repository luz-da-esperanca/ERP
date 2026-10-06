import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { Family, FamilyInput } from '@erp/contracts/registration';
import { familyInputSchema } from '@erp/contracts/registration';
import { useErp } from '../../../app/erp-provider';
import {
  Field,
  SelectField,
  Submit,
  Alert,
  nullableValue,
} from '../../../shared/ui';
import { useAction } from '../../../shared/use-action';
import { useRegistrationIntent } from './use-registration-intent';
import { DuplicateCreationReview as DuplicateReview } from './duplicate-review';
export function FamilyForm({ family }: { family?: Family }) {
  const { client } = useErp();
  const navigate = useNavigate();
  const action = useAction();
  const intent = useRegistrationIntent<FamilyInput>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await action.run(async () => {
      const input: FamilyInput = familyInputSchema.parse({
        referenceName: nullableValue(data, 'referenceName'),
        address: nullableValue(data, 'address'),
        neighborhood: nullableValue(data, 'neighborhood'),
        postalCode: nullableValue(data, 'postalCode'),
        contactPhone: nullableValue(data, 'contactPhone'),
        location: nullableValue(data, 'location'),
      });
      const prepared = await intent.prepare(
        input,
        data,
        family ? undefined : client.registration.reviewFamilyDuplicates,
      );
      if (!prepared) return;
      const saved = family
        ? await client.registration.updateFamily(
            family.id,
            family.revision,
            input,
            prepared.key,
          )
        : await client.registration.createFamily(prepared.body, prepared.key);
      navigate(`/families/${saved.id}`);
    });
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <p className="muted">
        Os dados desta família podem ser complementados depois. Membros são
        adicionados pelo cadastro individual.
      </p>
      <div className="form-grid">
        <Field
          label="Nome de referência"
          name="referenceName"
          maxLength={200}
          defaultValue={family?.referenceName ?? ''}
        />
        <Field
          label="Bairro"
          name="neighborhood"
          maxLength={200}
          defaultValue={family?.neighborhood ?? ''}
        />
        <Field
          label="Endereço"
          name="address"
          maxLength={500}
          defaultValue={family?.address ?? ''}
        />
        <Field
          label="CEP (8 dígitos)"
          name="postalCode"
          pattern="[0-9]{8}"
          defaultValue={family?.postalCode ?? ''}
        />
        <Field
          label="Telefone"
          name="contactPhone"
          maxLength={50}
          defaultValue={family?.contactPhone ?? ''}
        />
        <SelectField
          label="Localização"
          name="location"
          defaultValue={family?.location ?? ''}
        >
          <option value="">Não informado</option>
          <option value="URBAN">Urbana</option>
          <option value="RURAL">Rural</option>
        </SelectField>
      </div>
      {intent.review && (
        <DuplicateReview candidates={intent.review.candidates} />
      )}
      {action.error && <Alert error>{action.error}</Alert>}
      {action.error && !family && (
        <button
          className="button secondary"
          type="button"
          onClick={intent.reset}
        >
          Consultar candidatos novamente
        </button>
      )}
      <Submit pending={action.pending}>
        {family ? 'Salvar cadastro' : 'Criar família'}
      </Submit>
    </form>
  );
}
