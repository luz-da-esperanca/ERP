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
import { MaskedField } from '../../../shared/masked-field';
import { AddressFields } from './address-fields';
import {
  useRegistrationIntent,
  canRefreshDuplicateReview,
} from './use-registration-intent';
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
        postalCode: nullableValue(data, 'postalCode')?.replace('-', '') ?? null,
        contactPhone:
          nullableValue(data, 'contactPhone')?.replace(/\D/g, '') ?? null,
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
        : await client.registration
            .createFamily(prepared.body, prepared.key)
            .catch((error: unknown) => {
              intent.captureRejectedReview(error);
              throw error;
            });
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
        <AddressFields initial={family} />
        <MaskedField
          mask="phone"
          label="Telefone"
          name="contactPhone"
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
        <DuplicateReview
          key={`${intent.review.input}:${intent.review.candidates.map((candidate) => candidate.id).join()}`}
          candidates={intent.review.candidates}
        />
      )}
      {action.error && <Alert error>{action.error}</Alert>}
      {canRefreshDuplicateReview(action.cause) && !family && (
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
