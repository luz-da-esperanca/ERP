import { useState } from 'react';
import { Link } from 'react-router';
import type { FamilySummary } from '@erp/contracts/registration';
import { useErp } from '../../app/erp-provider';
import { useQuery } from '../../shared/use-query';
import {
  Page,
  Panel,
  AsyncView,
  Empty,
  Field,
  PendingBadge,
} from '../../shared/ui';
import { normalizeSearch } from './domain/memberships';
import { displayInstant } from '../../shared/time';
export function FamilyTable({ families }: { families: FamilySummary[] }) {
  if (!families.length) return <Empty>Nenhuma família encontrada.</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">
          Famílias cadastradas e composição vigente
        </caption>
        <thead>
          <tr>
            <th>Família</th>
            <th>Bairro</th>
            <th>Membros vigentes</th>
            <th>Titular</th>
            <th>Aptidão</th>
            <th>Atualização</th>
          </tr>
        </thead>
        <tbody>
          {families.map((family) => (
            <tr key={family.id}>
              <td>
                <Link to={`/families/${family.id}`}>
                  {family.referenceName ?? `Família ${family.code}`}
                </Link>
                <small>Código {family.code}</small>
              </td>
              <td>{family.neighborhood ?? 'Não informado'}</td>
              <td>{family.memberCount}</td>
              <td>{family.referencePersonName ?? 'Não informado'}</td>
              <td>
                <PendingBadge />
              </td>
              <td>{displayInstant(family.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function FamiliesPage() {
  const { client, session } = useErp();
  const state = useQuery(client.registration.listFamilies);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  return (
    <Page
      title="Famílias"
      description="Cadastro, composição vigente e histórico familiar."
      actions={
        session?.capabilities.includes('registration.write') && (
          <Link className="button primary" to="/families/new">
            Nova família
          </Link>
        )
      }
    >
      <Field
        label="Buscar famílias"
        name="q"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder="Nome, código ou bairro"
      />
      <AsyncView state={state}>
        {(families) => {
          const filtered = families.filter((f) =>
            normalizeSearch(
              `${f.code} ${f.referenceName ?? ''} ${f.neighborhood ?? ''}`,
            ).includes(normalizeSearch(query)),
          );
          return (
            <Panel>
              <p className="muted">
                {filtered.length} famílias · Aptidão pendente: critério não
                configurado.
              </p>
              <FamilyTable
                families={filtered.slice((page - 1) * 20, page * 20)}
              />
              <div className="pagination">
                <button
                  className="button secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>
                <span>Página {page}</span>
                <button
                  className="button secondary"
                  disabled={page * 20 >= filtered.length}
                  onClick={() => setPage(page + 1)}
                >
                  Próxima
                </button>
              </div>
            </Panel>
          );
        }}
      </AsyncView>
    </Page>
  );
}
