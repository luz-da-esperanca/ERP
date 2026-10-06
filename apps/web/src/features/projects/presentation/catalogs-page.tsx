import { useCallback, useState } from 'react';
import type { InstituteDto } from '@erp/contracts/projects-api';
import type { HttpProjects } from '../infra/http-projects';
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
function CatalogForm({
  gateway,
  item,
  institute,
  onSaved,
}: {
  gateway: HttpProjects;
  item: InstituteDto;
  institute: boolean;
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
            expectedRevision: item.revision,
            name: textValue(data, 'name'),
            active: data.get('active') === 'on',
            reason: textValue(data, 'reason'),
          };
          const key = keyFor(
            `${institute ? 'institute' : 'serviceType'}/${item.id}`,
            input,
          );
          if (institute) await gateway.updateInstitute(item.id, input, key);
          else await gateway.updateServiceType(item.id, input, key);
          onSaved();
        });
      }}
    >
      <Field
        label="Nome no catálogo"
        name="name"
        required
        defaultValue={item.name}
        maxLength={200}
      />
      <Field
        label="Item ativo"
        name="active"
        type="checkbox"
        defaultChecked={item.active}
      />
      <Field
        label="Motivo da alteração do catálogo"
        name="reason"
        required
        maxLength={1000}
      />
      {action.error && <Alert error>{action.error}</Alert>}
      <Submit pending={action.pending}>
        {institute ? 'Salvar instituto' : 'Salvar tipo de atividade'}
      </Submit>
    </form>
  );
}
export function CatalogsPage({ gateway }: { gateway: HttpProjects }) {
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(() => gateway.overview(), [gateway]);
  const state = useApiQuery(load, refresh);
  const action = useAction();
  const keyFor = useOperationKey();
  const onSaved = () => setRefresh((value) => value + 1);
  return (
    <Page title="Catálogos de projetos e atividades">
      <AsyncView state={state}>
        {(overview) => (
          <>
            <Panel title="Institutos">
              <p>
                Os institutos são referências fixas. Desativar preserva vínculos
                e registros anteriores.
              </p>
              {overview.institutes.map((item) => (
                <details key={`${item.id}:${item.revision}`} open>
                  <summary>
                    {item.name} · {item.active ? 'Ativo' : 'Inativo'}
                  </summary>
                  <CatalogForm
                    gateway={gateway}
                    item={item}
                    institute
                    onSaved={onSaved}
                  />
                </details>
              ))}
            </Panel>
            <Panel title="Tipos de atividade pontual">
              {overview.serviceTypes.map((item) => (
                <details key={`${item.id}:${item.revision}`}>
                  <summary>
                    {item.name} · {item.active ? 'Ativo' : 'Inativo'}
                  </summary>
                  <CatalogForm
                    gateway={gateway}
                    item={item}
                    institute={false}
                    onSaved={onSaved}
                  />
                </details>
              ))}
              <form
                className="form-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void action.run(async () => {
                    const input = {
                      code: textValue(data, 'code'),
                      name: textValue(data, 'name'),
                    };
                    await gateway.createServiceType(
                      input,
                      keyFor('serviceType', input),
                    );
                    form.reset();
                    onSaved();
                  });
                }}
              >
                <Field
                  label="Código do novo tipo"
                  name="code"
                  required
                  pattern="[A-Z][A-Z0-9_]*"
                  maxLength={40}
                />
                <Field
                  label="Nome do novo tipo"
                  name="name"
                  required
                  maxLength={200}
                />
                {action.error && <Alert error>{action.error}</Alert>}
                <Submit pending={action.pending}>
                  Criar tipo de atividade
                </Submit>
              </form>
            </Panel>
          </>
        )}
      </AsyncView>
      <button className="button secondary" onClick={onSaved}>
        Atualizar catálogos
      </button>
    </Page>
  );
}
