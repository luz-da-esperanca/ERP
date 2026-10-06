import { useCallback, useState } from 'react';
import {
  missingPersonFieldSchema,
  missingFamilyFieldSchema,
  missingDataSelectionInputSchema,
} from '@erp/contracts/data-quality-api';
import type { HttpComposition } from '../infra/http-composition';
import { useApiQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import { useOperationKey } from '../../../shared/use-operation-key';
import {
  Page,
  Panel,
  Field,
  AsyncView,
  Alert,
  Submit,
  textValue,
} from '../../../shared/ui';
const labels = {
  birthDate: 'Data de nascimento',
  sex: 'Sexo',
  cpf: 'CPF',
  rg: 'RG',
  occupation: 'Ocupação',
  educationLevel: 'Escolaridade',
  contactPhone: 'Telefone',
  referenceName: 'Nome de referência',
  address: 'Endereço',
  neighborhood: 'Bairro',
  postalCode: 'CEP',
  location: 'Localização',
};
export function RegistrationConfigurationPage({
  gateway,
}: {
  gateway: HttpComposition;
}) {
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(() => gateway.fields(), [gateway]);
  const state = useApiQuery(load, refresh);
  const action = useAction();
  const keyFor = useOperationKey();
  return (
    <Page title="Campos cadastrais acompanhados">
      <AsyncView state={state}>
        {(selection) => (
          <Panel>
            <form
              key={selection?.id ?? 'new'}
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void action.run(async () => {
                  const input = missingDataSelectionInputSchema.parse({
                    expectedVersion: selection?.version ?? null,
                    personFields: data.getAll('personFields'),
                    familyFields: data.getAll('familyFields'),
                    decisionReference: textValue(data, 'decisionReference'),
                  });
                  await gateway.selectFields(
                    input,
                    keyFor('registrationFields', input),
                  );
                  setRefresh(refresh + 1);
                });
              }}
            >
              <p>
                Campos selecionados geram pendências de dados ausentes. A
                seleção não inventa valores nem impede o cadastro mínimo.
              </p>
              <fieldset disabled={action.pending}>
                <legend>Pessoas</legend>
                {missingPersonFieldSchema.options.map((field) => (
                  <Field
                    key={field}
                    label={`Pessoa: ${labels[field]}`}
                    name="personFields"
                    type="checkbox"
                    value={field}
                    defaultChecked={
                      selection?.personFields.includes(field) ?? false
                    }
                  />
                ))}
              </fieldset>
              <fieldset disabled={action.pending}>
                <legend>Famílias</legend>
                {missingFamilyFieldSchema.options.map((field) => (
                  <Field
                    key={field}
                    label={`Família: ${labels[field]}`}
                    name="familyFields"
                    type="checkbox"
                    value={field}
                    defaultChecked={
                      selection?.familyFields.includes(field) ?? false
                    }
                  />
                ))}
              </fieldset>
              <Field
                label="Referência da decisão cadastral"
                name="decisionReference"
                required
                maxLength={1000}
              />
              {action.error && <Alert error>{action.error}</Alert>}
              <Submit pending={action.pending}>
                Publicar campos acompanhados
              </Submit>
            </form>
          </Panel>
        )}
      </AsyncView>
      <button
        className="button secondary"
        onClick={() => setRefresh(refresh + 1)}
      >
        Atualizar seleção
      </button>
    </Page>
  );
}
