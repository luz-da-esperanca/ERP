import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import type { FamilyDetail } from '@erp/contracts/registration';
import { useErp } from '../../../app/erp-provider';
import { useQuery } from '../../../shared/use-query';
import {
  Page,
  Panel,
  AsyncView,
  BackLink,
  Field,
  Empty,
  StatusBadge,
} from '../../../shared/ui';
import { civilToday, displayInstant } from '../../../shared/time';
import { FamilyForm } from './family-form';
import { FamilyAuditTimeline } from './family-audit-timeline';

interface FamilyProfileContentProps {
  id: string;
  detail: FamilyDetail;
  asOf: string;
  onAsOfChange: (asOf: string) => void;
}

function FamilyProfile({
  actions,
  children,
}: {
  actions?: (id: string) => ReactNode;
  children: (props: FamilyProfileContentProps) => ReactNode;
}) {
  const { id = '' } = useParams();
  const location = useLocation();
  const { client } = useErp();
  const [asOf, setAsOf] = useState(civilToday);
  const at = `${asOf}T23:59:59.999-03:00`;
  const load = useCallback(
    () => client.registration.getFamily(id, at),
    [client, id, at],
  );
  const state = useQuery(load);

  return (
    <>
      <BackLink to="/families">Famílias</BackLink>
      <AsyncView state={state}>
        {(detail) => {
          const { family } = detail;
          const isMembersView = location.pathname.endsWith('/members');

          return (
            <>
              <header className="family-profile-header">
                <div>
                  <span className="eyebrow">Luz da Esperança</span>
                  <h1>{family.referenceName ?? `Família ${family.code}`}</h1>
                  <p className="family-profile-meta">
                    <span>
                      Código <strong>{family.code}</strong>
                    </span>
                    {family.referencePersonName ? (
                      <span>
                        Referência <strong>{family.referencePersonName}</strong>
                      </span>
                    ) : null}
                    {family.neighborhood ? (
                      <span>{family.neighborhood}</span>
                    ) : null}
                  </p>
                </div>
                {actions ? (
                  <div className="family-profile-actions">
                    {actions(family.id)}
                  </div>
                ) : null}
              </header>
              <nav
                className="family-profile-tabs"
                aria-label="Navegação do perfil da família"
              >
                <Link
                  to={`/families/${family.id}`}
                  aria-current={isMembersView ? undefined : 'page'}
                >
                  Visão geral
                </Link>
                <Link
                  to={`/families/${family.id}/members`}
                  aria-current={isMembersView ? 'page' : undefined}
                >
                  Membros
                </Link>
              </nav>
              <div className="family-profile-content">
                {children({
                  id: family.id,
                  detail,
                  asOf,
                  onAsOfChange: setAsOf,
                })}
              </div>
            </>
          );
        }}
      </AsyncView>
    </>
  );
}

export function FamilyPage({
  edit = false,
  connected = false,
}: {
  edit?: boolean;
  connected?: boolean;
}) {
  const { session } = useErp();
  const canReadAudit = Boolean(session?.capabilities.includes('audit.read'));

  return (
    <FamilyProfile
      actions={(id) =>
        session?.capabilities.includes('registration.write') ? (
          <Link
            className="button secondary"
            to={`/families/${id}${edit ? '' : '/edit'}`}
          >
            {edit ? 'Ver cadastro' : 'Editar cadastro'}
          </Link>
        ) : null
      }
    >
      {({ detail: { family, members }, asOf, onAsOfChange }) =>
        edit ? (
          <Panel>
            <FamilyForm
              key={`${family.id}:${family.revision}`}
              family={family}
            />
          </Panel>
        ) : (
          <>
            {connected && (
              <nav
                className="flex flex-wrap gap-4 mb-4"
                aria-label="Consultas da família"
              >
                {session?.capabilities.includes('reports.read') && (
                  <Link to={`/families/${family.id}/history`}>
                    Histórico consolidado
                  </Link>
                )}
                {session?.capabilities.includes('socialForms.read') && (
                  <Link to={`/families/${family.id}/social-forms`}>
                    Ficha social
                  </Link>
                )}
                {session?.capabilities.includes('eligibility.read') && (
                  <Link to={`/families/${family.id}/eligibility`}>
                    Aptidão familiar
                  </Link>
                )}
              </nav>
            )}
            <div className="two-columns">
              <Panel title="Dados cadastrais">
                <dl>
                  <dt>Endereço</dt>
                  <dd>{family.address ?? 'Não informado'}</dd>
                  <dt>Bairro</dt>
                  <dd>{family.neighborhood ?? 'Não informado'}</dd>
                  <dt>Contato</dt>
                  <dd>{family.contactPhone ?? 'Não informado'}</dd>
                  <dt>Titular na referência</dt>
                  <dd>{family.referencePersonName ?? 'Não informado'}</dd>
                </dl>
              </Panel>
              <section
                className="panel family-composition"
                aria-labelledby="family-composition-title"
              >
                <div className="family-composition-header">
                  <div>
                    <h2 id="family-composition-title">Composição familiar</h2>
                    <p>Pessoas com vínculo vigente na data selecionada.</p>
                  </div>
                  <Field
                    label="Data da consulta"
                    name="asOf"
                    type="date"
                    value={asOf}
                    max={civilToday()}
                    onChange={(e) => {
                      if (e.target.value) onAsOfChange(e.target.value);
                    }}
                  />
                </div>
                <p className="family-composition-count" role="status">
                  {family.memberCount}{' '}
                  {family.memberCount === 1 ? 'pessoa' : 'pessoas'} com vínculo
                  vigente.
                </p>
                {members.length === 0 ? (
                  <Empty>
                    Sem membros nesta data. Isso não impede complementar o
                    cadastro.
                  </Empty>
                ) : (
                  <ul
                    className="family-members-list"
                    aria-label="Membros com vínculo vigente"
                  >
                    {members.map(({ person, membership }) => (
                      <li key={person.id} className="family-member-item">
                        <div className="family-member-details">
                          <Link to={`/people/${person.id}`}>{person.name}</Link>
                          <span>
                            {membership.isReference
                              ? 'Titular'
                              : (membership.relationshipToReference ??
                                'Parentesco não informado')}
                          </span>
                        </div>
                        <small>
                          Vínculo iniciado em{' '}
                          {displayInstant(membership.validFrom)}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            {canReadAudit ? (
              <div className="family-detail-history">
                <CanonicalFamilyAudit familyId={family.id} />
              </div>
            ) : null}
          </>
        )
      }
    </FamilyProfile>
  );
}

function CanonicalFamilyAudit({ familyId }: { familyId: string }) {
  const { client } = useErp();
  const load = useCallback(
    () => client.audit.list(familyId),
    [client, familyId],
  );
  const state = useQuery(load);
  return <FamilyAuditTimeline state={state} familyId={familyId} />;
}

function FamilyMembersTable({ detail }: { detail: FamilyDetail }) {
  const { family, members } = detail;

  if (members.length === 0)
    return <Empty>Sem membros com vínculo vigente nesta data.</Empty>;

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">
          Membros vigentes da família {family.code}
        </caption>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Parentesco</th>
            <th>Referência</th>
            <th>Início do vínculo</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {members.map(({ person, membership }) => (
            <tr key={membership.id}>
              <td>{person.name}</td>
              <td>
                {membership.isReference
                  ? 'Titular'
                  : (membership.relationshipToReference ?? 'Não informado')}
              </td>
              <td>{membership.isReference ? 'Sim' : 'Não'}</td>
              <td>{displayInstant(membership.validFrom)}</td>
              <td>
                <StatusBadge>Ativo</StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FamilyMembersPage({
  connected = false,
}: {
  connected?: boolean;
}) {
  const { session } = useErp();
  return (
    <FamilyProfile>
      {({ id, detail, asOf, onAsOfChange }) => (
        <Panel>
          <div className="members-heading">
            <div>
              <h2>Membros da família</h2>
              <p className="muted">
                Vínculos vigentes em {asOf.split('-').reverse().join('/')}.
              </p>
            </div>
            <div
              className="members-heading-actions"
              role="group"
              aria-label="Consulta de membros"
            >
              <Field
                label="Consultar membros em"
                name="asOf"
                type="date"
                value={asOf}
                max={civilToday()}
                onChange={(event) => {
                  if (event.target.value) onAsOfChange(event.target.value);
                }}
              />
              {connected &&
                session?.capabilities.includes('registration.write') && (
                  <Link
                    className="button secondary"
                    to={`/families/${id}/members/link`}
                  >
                    Vincular pessoa existente
                  </Link>
                )}
              {session?.capabilities.includes('registration.write') && (
                <Link
                  className="button primary"
                  to={`/people/new?familyId=${id}`}
                >
                  Adicionar pessoa
                </Link>
              )}
            </div>
          </div>
          <FamilyMembersTable detail={detail} />
        </Panel>
      )}
    </FamilyProfile>
  );
}
export function NewFamilyPage() {
  return (
    <>
      <BackLink to="/families" />
      <Page
        title="Nova família"
        description="Busque o cadastro existente antes de criar um novo núcleo."
      >
        <Panel>
          <FamilyForm />
        </Panel>
      </Page>
    </>
  );
}
