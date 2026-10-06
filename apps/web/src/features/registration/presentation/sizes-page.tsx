import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
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
  BackLink,
  nullableValue,
} from '../../../shared/ui';
import { civilToday } from '../../../shared/time';
export function SizesPage({ gateway }: { gateway: HttpComposition }) {
  const { id = '' } = useParams();
  const [refresh, setRefresh] = useState(0);
  const [today] = useState(civilToday);
  const [saved, setSaved] = useState(false);
  const load = useCallback(() => gateway.person(id), [gateway, id]);
  const state = useApiQuery(load, refresh);
  const action = useAction();
  const keyFor = useOperationKey();
  return (
    <>
      <BackLink to={`/people/${id}`} />
      <Page title="Perfil de tamanhos">
        <AsyncView state={state}>
          {(detail) => (
            <Panel title={detail.person.name}>
              <form
                key={`${id}:${detail.sizeProfile?.revision ?? 'new'}`}
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void action.run(async () => {
                    const input = {
                      expectedRevision: detail.sizeProfile?.revision ?? null,
                      shoeSize: nullableValue(data, 'shoeSize'),
                      clothingSize: nullableValue(data, 'clothingSize'),
                      informedOn: nullableValue(data, 'informedOn'),
                    };
                    await gateway.sizes(
                      id,
                      input,
                      keyFor(`sizes/${id}`, input),
                    );
                    setSaved(true);
                    setRefresh(refresh + 1);
                  });
                }}
              >
                <fieldset disabled={action.pending} className="form-grid">
                  <Field
                    label="Tamanho de calçado"
                    name="shoeSize"
                    maxLength={30}
                    defaultValue={detail.sizeProfile?.shoeSize ?? ''}
                  />
                  <Field
                    label="Tamanho de roupa"
                    name="clothingSize"
                    maxLength={30}
                    defaultValue={detail.sizeProfile?.clothingSize ?? ''}
                  />
                  <Field
                    label="Data conhecida da informação"
                    name="informedOn"
                    type="date"
                    max={today}
                    defaultValue={detail.sizeProfile?.informedOn ?? ''}
                  />
                </fieldset>
                <p>
                  Não informado é diferente de tamanho zero. Quando houver
                  tamanho conhecido, informe a data em que ele foi informado.
                </p>
                {action.error && <Alert error>{action.error}</Alert>}
                <Submit pending={action.pending}>Salvar tamanhos</Submit>
              </form>
            </Panel>
          )}
        </AsyncView>
        {saved && <Alert>Tamanhos registrados.</Alert>}
        <button
          className="button secondary"
          onClick={() => setRefresh(refresh + 1)}
        >
          Atualizar tamanhos
        </button>
      </Page>
    </>
  );
}
