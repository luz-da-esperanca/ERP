import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  CalendarDays,
  Phone,
  CircleCheck,
  History,
  Pencil,
  Ruler,
  UsersRound,
} from 'lucide-react';
import { formatCpfInput } from '@erp/contracts/cpf';
import type {
  FamilyMembership,
  Person,
  PersonDetail,
} from '@erp/contracts/registration';
import { useErp } from '../../../app/erp-provider';
import {
  Alert,
  AsyncView,
  BackLink,
  Empty,
  Panel,
  StatusBadge,
  ActionLink,
} from '../../../shared/ui';
import {
  civilToday,
  displayDate,
  displayInstant,
  isWithin,
} from '../../../shared/time';
import { useQuery } from '../../../shared/use-query';

type PersonMembership = PersonDetail['memberships'][number];

function registrationValue(value: string | null) {
  return value ?? 'Não informado';
}

function relationshipLabel(membership: FamilyMembership) {
  if (membership.isReference) return 'Titular';
  return membership.relationshipToReference ?? 'Parentesco não informado';
}

function MembershipList({
  memberships,
  historical = false,
}: {
  memberships: PersonMembership[];
  historical?: boolean;
}) {
  return (
    <ul
      className="family-members-list"
      aria-label={
        historical
          ? 'Vínculos familiares históricos'
          : 'Vínculos familiares vigentes'
      }
    >
      {memberships.map((membership) => (
        <li key={membership.id} className="family-member-item">
          <div className="family-member-details">
            <Link to={`/families/${membership.familyId}`}>
              Família {membership.familyCode}
            </Link>
            <span>{relationshipLabel(membership)}</span>
          </div>
          <div className="grid min-w-0 gap-2 sm:justify-items-end">
            <StatusBadge
              icon={
                historical ? (
                  <History size={14} aria-hidden="true" />
                ) : (
                  <CircleCheck size={14} aria-hidden="true" />
                )
              }
            >
              {historical ? 'Histórico' : 'Vigente'}
            </StatusBadge>
            <small>
              Início do vínculo: {displayInstant(membership.validFrom)}
              {membership.validUntil
                ? ` · Encerrado em ${displayInstant(membership.validUntil)}`
                : ''}
            </small>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PersonRegistration({ person }: { person: Person }) {
  const fields = [
    { label: 'Nome', value: person.name },
    { label: 'Data de nascimento', value: displayDate(person.birthDate) },
    { label: 'Sexo', value: registrationValue(person.sex) },
    {
      label: 'CPF',
      value: registrationValue(person.cpf ? formatCpfInput(person.cpf) : null),
    },
    { label: 'RG', value: registrationValue(person.rg) },
    { label: 'Contato', value: registrationValue(person.contactPhone) },
    { label: 'Ocupação', value: registrationValue(person.occupation) },
    { label: 'Escolaridade', value: registrationValue(person.educationLevel) },
  ];

  return (
    <Panel title="Dados atuais">
      <dl aria-label="Dados atuais" className="description-grid">
        {fields.map(({ label, value }) => (
          <div
            key={label}
            className="min-w-0 border-b border-(--color-border) pb-4"
          >
            <dt className="mb-2 text-sm font-semibold">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function FamilyMemberships({
  memberships,
  asOf,
}: {
  memberships: PersonMembership[];
  asOf: string;
}) {
  const at = `${asOf}T23:59:59.999-03:00`;
  const current = memberships.filter((membership) =>
    isWithin(at, membership.validFrom, membership.validUntil),
  );
  const historical = memberships.filter(
    (membership) => !isWithin(at, membership.validFrom, membership.validUntil),
  );

  return (
    <Panel title="Vínculos familiares">
      <p className="muted mb-4 text-sm">Vínculo atual</p>
      {current.length > 1 ? (
        <Alert>
          Mais de um vínculo familiar vigente foi encontrado. Nenhuma família
          foi escolhida automaticamente.
        </Alert>
      ) : null}
      {current.length ? (
        <MembershipList memberships={current} />
      ) : (
        <Empty>Nenhum vínculo familiar vigente foi encontrado.</Empty>
      )}
      {historical.length ? (
        <details
          aria-label="Histórico de vínculos"
          className="mt-6 border-t border-(--color-border) pt-4"
        >
          <summary className="text-link mb-4 w-fit cursor-pointer text-sm">
            Ver histórico de vínculos ({historical.length})
          </summary>
          <MembershipList memberships={historical} historical />
        </details>
      ) : null}
    </Panel>
  );
}

function PersonProfile({
  detail,
  allowEdit,
}: {
  detail: PersonDetail;
  allowEdit: boolean;
}) {
  const [asOf] = useState(civilToday);

  return (
    <div className="grid gap-6">
      <header
        className="family-profile-header"
        aria-label="Identificação da pessoa"
      >
        <div className="min-w-0">
          <span className="eyebrow">Cadastro individual</span>
          <h1 className="break-words">{detail.person.name}</h1>
          {detail.person.birthDate || detail.person.contactPhone ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-(--color-text-muted)">
              {detail.person.birthDate ? (
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={16} aria-hidden="true" />
                  <span>
                    Nascimento{' '}
                    <strong className="font-normal text-(--color-text-strong)">
                      {displayDate(detail.person.birthDate)}
                    </strong>
                  </span>
                </span>
              ) : null}
              {detail.person.contactPhone ? (
                <span className="inline-flex items-center gap-2">
                  <Phone size={16} aria-hidden="true" />
                  <span>{detail.person.contactPhone}</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {allowEdit && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <ActionLink icon={Ruler} to={`/people/${detail.person.id}/sizes`}>
              Editar tamanhos
            </ActionLink>
            <ActionLink icon={Pencil} to={`/people/${detail.person.id}/edit`}>
              Editar pessoa
            </ActionLink>
          </div>
        )}
      </header>
      <PersonRegistration person={detail.person} />
      <FamilyMemberships memberships={detail.memberships} asOf={asOf} />
    </div>
  );
}

export function PersonPage({
  allowEdit = false,
  connected = false,
}: {
  allowEdit?: boolean;
  connected?: boolean;
}) {
  const { id = '' } = useParams();
  const { client, session } = useErp();
  const load = useCallback(
    () => client.registration.getPerson(id),
    [client, id],
  );
  const state = useQuery(load);

  return (
    <>
      {connected && (
        <nav className="action-links" aria-label="Ações individuais">
          {session?.capabilities.includes('registration.write') && (
            <ActionLink icon={UsersRound} to={`/people/${id}/memberships`}>
              Gerenciar vínculos
            </ActionLink>
          )}
          {session?.capabilities.includes('reports.read') && (
            <ActionLink icon={History} to={`/people/${id}/history`}>
              Histórico individual
            </ActionLink>
          )}
        </nav>
      )}

      <BackLink to="/families">Pessoas e famílias</BackLink>
      <AsyncView state={state}>
        {(detail) => (
          <PersonProfile
            key={detail.person.id}
            detail={detail}
            allowEdit={
              allowEdit &&
              Boolean(session?.capabilities.includes('registration.write'))
            }
          />
        )}
      </AsyncView>
    </>
  );
}
