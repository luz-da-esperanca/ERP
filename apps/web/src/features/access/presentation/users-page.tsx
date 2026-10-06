import { useCallback, useState } from 'react';
import type { UserDto } from '@erp/contracts/access-api';
import { roleSchema } from '@erp/contracts/access';
import type { HttpUsers } from '../infra/http-users';
import { roleLabels } from './role-labels';
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

function AccountForm({
  gateway,
  account,
  onSaved,
}: {
  gateway: HttpUsers;
  account?: UserDto;
  onSaved: () => void;
}) {
  const action = useAction();
  const keyFor = useOperationKey();
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        void action.run(async () => {
          const fields = {
            displayName: textValue(data, 'displayName'),
            roleCodes: data
              .getAll('roleCodes')
              .map((role) => roleSchema.parse(role)),
          };
          if (account) {
            const input = { ...fields, expectedRevision: account.revision };
            await gateway.update(
              account.id,
              input,
              keyFor(`user/${account.id}`, input),
            );
          } else {
            const input = {
              ...fields,
              login: textValue(data, 'login'),
              initialPassword: textValue(data, 'initialPassword'),
            };
            await gateway.create(input, keyFor('user', input));
          }
          form.reset();
          onSaved();
        });
      }}
    >
      <fieldset disabled={action.pending} className="form-grid">
        <Field
          label="Nome da conta"
          name="displayName"
          defaultValue={account?.displayName ?? ''}
          required
          maxLength={200}
        />
        {!account && (
          <>
            <Field
              label="Login"
              name="login"
              required
              maxLength={100}
              pattern="[a-zA-Z0-9._-]{3,100}"
            />
            <Field
              label="Senha inicial (mínimo 12 caracteres)"
              name="initialPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </>
        )}
      </fieldset>
      <fieldset disabled={action.pending}>
        <legend>Perfis combináveis</legend>
        {roleSchema.options.map((role) => (
          <Field
            label={roleLabels[role]}
            key={role}
            name="roleCodes"
            value={role}
            type="checkbox"
            defaultChecked={account?.roleCodes.includes(role) ?? false}
          />
        ))}
      </fieldset>
      <p>
        Administrar contas não concede acesso automático aos cadastros ou à
        ficha social. O primeiro acesso exige alteração da senha inicial.
      </p>
      {action.error && <Alert error>{action.error}</Alert>}
      <Submit pending={action.pending}>
        {account ? 'Salvar conta' : 'Criar conta'}
      </Submit>
    </form>
  );
}
function AccountCommands({
  gateway,
  account,
  onSaved,
}: {
  gateway: HttpUsers;
  account: UserDto;
  onSaved: () => void;
}) {
  const activation = useAction();
  const password = useAction();
  const activationKey = useOperationKey();
  const passwordKey = useOperationKey();
  return (
    <>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void activation.run(async () => {
            const input = {
              expectedRevision: account.revision,
              active: !account.active,
              reason: textValue(data, 'reason'),
            };
            await gateway.activate(
              account.id,
              input,
              activationKey(`activation/${account.id}`, input),
            );
            onSaved();
          });
        }}
      >
        <Field
          label="Motivo da mudança de ativação"
          name="reason"
          required
          maxLength={1000}
        />
        {activation.error && <Alert error>{activation.error}</Alert>}
        <Submit pending={activation.pending}>
          {account.active ? 'Desativar conta' : 'Ativar conta'}
        </Submit>
      </form>
      <form
        className="form-stack mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          void password.run(async () => {
            const input = {
              expectedRevision: account.revision,
              temporaryPassword: textValue(data, 'temporaryPassword'),
              reason: textValue(data, 'reason'),
            };
            await gateway.resetPassword(
              account.id,
              input,
              passwordKey(`password/${account.id}`, input),
            );
            form.reset();
            onSaved();
          });
        }}
      >
        <Field
          label="Senha temporária (mínimo 12 caracteres)"
          name="temporaryPassword"
          type="password"
          minLength={12}
          required
          autoComplete="new-password"
        />
        <Field
          label="Motivo da redefinição de senha"
          name="reason"
          required
          maxLength={1000}
        />
        {password.error && <Alert error>{password.error}</Alert>}
        <Submit pending={password.pending}>Redefinir senha</Submit>
      </form>
    </>
  );
}
export function UsersPage({ gateway }: { gateway: HttpUsers }) {
  const [filters, setFilters] = useState<{
    q?: string;
    active?: 'true' | 'false';
    page: number;
  }>({ page: 1 });
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const load = useCallback(() => gateway.list(filters), [gateway, filters]);
  const state = useApiQuery(load, refresh);
  const onSaved = () => {
    setSelected(null);
    setRefresh((value) => value + 1);
  };
  return (
    <Page
      title="Usuários e perfis"
      actions={
        <button className="button primary" onClick={() => setSelected('new')}>
          Nova conta
        </button>
      }
    >
      <Panel>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            const q = textValue(new FormData(event.currentTarget), 'q').trim();
            setFilters({ page: 1, ...(q ? { q } : {}) });
          }}
        >
          <Field label="Buscar contas" name="q" minLength={2} maxLength={200} />
          <button className="button secondary">Buscar</button>
        </form>
      </Panel>
      <AsyncView state={state}>
        {(result) => (
          <>
            <Panel title="Contas individuais">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nome / login</th>
                      <th>Perfis</th>
                      <th>Situação</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((account) => (
                      <tr key={account.id}>
                        <td>
                          {account.displayName} · {account.login}
                        </td>
                        <td>
                          {account.roleCodes
                            .map((role) => roleLabels[role])
                            .join(' · ')}
                        </td>
                        <td>
                          {account.active ? 'Ativa' : 'Desativada'}
                          {account.mustChangePassword
                            ? ' · Troca de senha obrigatória'
                            : ''}
                        </td>
                        <td>
                          <button
                            className="text-link"
                            onClick={() => setSelected(account.id)}
                          >
                            Editar {account.displayName}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav aria-label="Páginas de contas">
                <button
                  className="button secondary"
                  disabled={filters.page === 1}
                  onClick={() =>
                    setFilters({ ...filters, page: filters.page - 1 })
                  }
                >
                  Anterior
                </button>
                <span>
                  Página {filters.page} · {result.pagination.total} contas
                </span>
                <button
                  className="button secondary"
                  disabled={
                    filters.page * result.pagination.pageSize >=
                    result.pagination.total
                  }
                  onClick={() =>
                    setFilters({ ...filters, page: filters.page + 1 })
                  }
                >
                  Próxima
                </button>
              </nav>
            </Panel>
            {selected === 'new' ? (
              <Panel title="Nova conta">
                <AccountForm gateway={gateway} onSaved={onSaved} />
              </Panel>
            ) : (
              result.data
                .filter((account) => account.id === selected)
                .map((account) => (
                  <Panel
                    key={`${account.id}:${account.revision}`}
                    title={`Editar ${account.displayName}`}
                  >
                    <AccountForm
                      gateway={gateway}
                      account={account}
                      onSaved={onSaved}
                    />
                    <AccountCommands
                      gateway={gateway}
                      account={account}
                      onSaved={onSaved}
                    />
                  </Panel>
                ))
            )}
          </>
        )}
      </AsyncView>
      <button
        className="button secondary"
        onClick={() => {
          setSelected(null);
          setRefresh(refresh + 1);
        }}
      >
        Atualizar contas
      </button>
    </Page>
  );
}
