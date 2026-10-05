import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useErp } from '../../../app/erp-provider';
import { useQuery } from '../../../shared/use-query';
import {
  Page,
  Panel,
  AsyncView,
  BackLink,
  Field,
  Empty,
} from '../../../shared/ui';
import { civilToday, displayInstant } from '../../../shared/time';
import { FamilyForm } from './family-form';
export function FamilyPage({ edit = false }: { edit?: boolean }) {
  const { id = '' } = useParams();
  const { client } = useErp();
  const [asOf, setAsOf] = useState(civilToday());
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
        {({ family, members }) => (
          <Page
            title={family.referenceName ?? `Família ${family.code}`}
            description={`Código ${family.code}`}
            actions={
              <Link
                className="button secondary"
                to={`/families/${id}${edit ? '' : '/edit'}`}
              >
                {edit ? 'Ver cadastro' : 'Editar cadastro'}
              </Link>
            }
          >
            {edit ? (
              <Panel>
                <FamilyForm family={family} />
              </Panel>
            ) : (
              <>
                <div className="detail-links">
                  <Link
                    className="button secondary"
                    to={`/families/${id}/social-form`}
                  >
                    Ficha social
                  </Link>
                  <Link
                    className="button secondary"
                    to={`/families/${id}/eligibility`}
                  >
                    Aptidão familiar
                  </Link>
                  <Link
                    className="button secondary"
                    to={`/audit?entityId=${id}`}
                  >
                    Histórico de alterações
                  </Link>
                  <Link
                    className="button primary"
                    to={`/people/new?familyId=${id}`}
                  >
                    Adicionar pessoa
                  </Link>
                </div>
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
                  <Panel title="Composição familiar">
                    <Field
                      label="Consultar ao final do dia"
                      name="asOf"
                      type="date"
                      value={asOf}
                      max={civilToday()}
                      onChange={(e) => {
                        if (e.target.value) setAsOf(e.target.value);
                      }}
                    />
                    <p>{family.memberCount} pessoas com vínculo vigente.</p>
                    {members.length === 0 ? (
                      <Empty>
                        Sem membros nesta data. Isso não impede complementar o
                        cadastro.
                      </Empty>
                    ) : (
                      <ul className="record-list">
                        {members.map(({ person, membership }) => (
                          <li key={person.id}>
                            <Link to={`/people/${person.id}`}>
                              {person.name}
                            </Link>
                            <span>
                              {membership.isReference
                                ? 'Titular'
                                : (membership.relationshipToReference ??
                                  'Parentesco não informado')}
                            </span>
                            <small>
                              Vínculo desde{' '}
                              {displayInstant(membership.validFrom)}
                            </small>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </div>
              </>
            )}
          </Page>
        )}
      </AsyncView>
    </>
  );
}
export function NewFamilyPage() {
  const { session } = useErp();
  const canCreateFamily = Boolean(
    session?.capabilities.includes('registration.write'),
  );

  return (
    <div className="family-form-page">
      <BackLink to="/families">Pessoas e famílias</BackLink>
      <Page
        title="Nova família"
        description="Cadastre os dados disponíveis para iniciar o acompanhamento familiar."
      >
        {canCreateFamily ? (
          <Panel>
            <FamilyForm />
          </Panel>
        ) : (
          <Empty>Seu perfil não permite cadastrar famílias.</Empty>
        )}
      </Page>
    </div>
  );
}
