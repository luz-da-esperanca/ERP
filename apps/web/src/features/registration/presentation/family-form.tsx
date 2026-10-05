import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
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
export function FamilyForm({ family }: { family?: Family }) {
  const { client } = useErp();
  const navigate = useNavigate();
  const action = useAction();
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
      const saved = family
        ? await client.registration.updateFamily(
            family.id,
            family.revision,
            input,
          )
        : await client.registration.createFamily(input);
      navigate(`/families/${saved.id}`);
    });
  }
  return (
    <form onSubmit={submit} className="form-stack family-form">
      <p className="muted">
        Informe os dados disponíveis. Campos sem informação podem ser
        complementados depois.
      </p>
      <div className="family-form-fields">
        <Field
          label="Nome de referência"
          name="referenceName"
          maxLength={200}
          defaultValue={family?.referenceName ?? ''}
        />
        <Field
          label="Endereço"
          name="address"
          maxLength={500}
          defaultValue={family?.address ?? ''}
        />
        <Field
          label="Bairro"
          name="neighborhood"
          maxLength={200}
          defaultValue={family?.neighborhood ?? ''}
        />
        <Field
          label="CEP"
          name="postalCode"
          pattern="[0-9]{8}"
          inputMode="numeric"
          placeholder="Somente números"
          defaultValue={family?.postalCode ?? ''}
        />
        <Field
          label="Telefone para contato"
          name="contactPhone"
          maxLength={50}
          type="tel"
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
      {action.error && <Alert error>{action.error}</Alert>}
      <div className="family-form-actions">
        <Link
          className="button secondary"
          to={family ? `/families/${family.id}` : '/families'}
        >
          Cancelar
        </Link>
        <Submit pending={action.pending}>
          {family ? 'Salvar cadastro' : 'Criar família'}
        </Submit>
      </div>
    </form>
  );
}
