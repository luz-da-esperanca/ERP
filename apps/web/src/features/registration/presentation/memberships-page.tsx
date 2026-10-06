import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { MembershipDto, FamilyDto } from '@erp/contracts/registration-api';
import type { HttpComposition } from '../infra/http-composition';
import type { HttpRegistration } from '../infra/http-registration';
import { useApiQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import { useOperationKey } from '../../../shared/use-operation-key';
import {
  Page,
  Panel,
  Field,
  SelectField,
  AsyncView,
  Alert,
  Submit,
  BackLink,
  textValue,
  nullableValue,
} from '../../../shared/ui';
import {
  displayInstant,
  localDateTimeExact,
  localDateTime,
  toInstant,
} from '../../../shared/time';
import { FamilyLookup } from './family-lookup';
function MembershipActions({
  gateway,
  registration,
  membership,
  family,
  onSaved,
}: {
  gateway: HttpComposition;
  registration: HttpRegistration;
  membership: MembershipDto;
  family: FamilyDto;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState('close');
  const [target, setTarget] = useState<FamilyDto | null>(null);
  const [now] = useState(() => new Date().toISOString());
  const action = useAction();
  const keyFor = useOperationKey();
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void action.run(async () => {
          const reason = textValue(data, 'reason');
          const effectiveAt = toInstant(textValue(data, 'effectiveAt'));
          if (mode === 'close') {
            const input = {
              expectedRevision: membership.revision,
              expectedFamilyRevision: family.revision,
              validUntil: effectiveAt,
              reason,
            };
            await gateway.close(
              membership.id,
              input,
              keyFor(`membership/close/${membership.id}`, input),
            );
          } else if (mode === 'reference') {
            const input = {
              membershipId: membership.id,
              expectedRevision: family.revision,
              effectiveAt,
              reason,
            };
            await gateway.reference(
              family.id,
              input,
              keyFor(`reference/${family.id}`, input),
            );
          } else if (mode === 'transfer') {
            if (!target)
              throw new Error('A reviewed target family is required');
            const input = {
              membershipId: membership.id,
              targetFamilyId: target.id,
              expectedMembershipRevision: membership.revision,
              expectedSourceFamilyRevision: family.revision,
              expectedTargetFamilyRevision: target.revision,
              effectiveAt,
              relationshipToReference: nullableValue(data, 'relationship'),
              isReference: data.get('isReference') === 'on',
              reason,
            };
            await gateway.transfer(
              membership.personId,
              input,
              keyFor(`transfer/${membership.personId}`, input),
            );
          } else {
            const input = {
              expectedRevision: membership.revision,
              expectedFamilyRevision: family.revision,
              validFrom: toInstant(textValue(data, 'validFrom')),
              validUntil: textValue(data, 'validUntil')
                ? toInstant(textValue(data, 'validUntil'))
                : null,
              relationshipToReference: nullableValue(data, 'relationship'),
              isReference: data.get('isReference') === 'on',
              reason,
            };
            await gateway.correct(
              membership.id,
              input,
              keyFor(`membership/correct/${membership.id}`, input),
            );
          }
          onSaved();
        });
      }}
    >
      <fieldset disabled={action.pending} className="form-stack">
        <SelectField
          label="Operação sobre o vínculo"
          name="mode"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="close">Encerrar vínculo</option>
          <option value="transfer">Transferir para outra família</option>
          <option value="reference">Definir como titular</option>
          <option value="correct">Corrigir dados do vínculo</option>
        </SelectField>
        {mode !== 'correct' && (
          <Field
            label="Data e hora de efeito"
            name="effectiveAt"
            type="datetime-local"
            step="0.001"
            required
            defaultValue={localDateTime(now)}
            max={localDateTimeExact(now)}
          />
        )}
        {mode === 'transfer' && (
          <>
            <FamilyLookup registration={registration} onSelect={setTarget} />
            {target && (
              <p>
                Destino confirmado: {target.referenceName ?? target.code} ·
                revisão {target.revision}.
              </p>
            )}
          </>
        )}
        {mode === 'correct' && (
          <>
            <Field
              label="Início corrigido do vínculo"
              name="validFrom"
              type="datetime-local"
              step="0.001"
              required
              defaultValue={localDateTimeExact(membership.validFrom)}
              max={localDateTimeExact(now)}
            />
            <Field
              label="Fim corrigido do vínculo (exclusivo)"
              name="validUntil"
              type="datetime-local"
              step="0.001"
              defaultValue={
                membership.validUntil
                  ? localDateTimeExact(membership.validUntil)
                  : ''
              }
              max={localDateTimeExact(now)}
            />
          </>
        )}
        {(mode === 'correct' || mode === 'transfer') && (
          <>
            <Field
              label="Parentesco com o titular"
              name="relationship"
              maxLength={100}
              defaultValue={
                mode === 'correct'
                  ? (membership.relationshipToReference ?? '')
                  : ''
              }
            />
            <Field
              label="É titular"
              name="isReference"
              type="checkbox"
              defaultChecked={mode === 'correct' && membership.isReference}
            />
          </>
        )}
        <Field
          label="Motivo da operação"
          name="reason"
          required
          maxLength={1000}
        />
      </fieldset>
      {action.error && <Alert error>{action.error}</Alert>}
      <Submit pending={action.pending}>Confirmar operação</Submit>
      <p>
        Alterações preservam o histórico. Conflitos com marcações exigem
        reconciliação explícita.
      </p>
      <Link to={`/people/${membership.personId}/reconciliation`}>
        Reconciliar vínculos e contextos de frequência
      </Link>
    </form>
  );
}
export function MembershipsPage({
  gateway,
  registration,
}: {
  gateway: HttpComposition;
  registration: HttpRegistration;
}) {
  const { id = '' } = useParams();
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(async () => {
    const detail = await gateway.person(id);
    const families = await Promise.all(
      [
        ...new Set(detail.memberships.map((membership) => membership.familyId)),
      ].map(
        async (familyId) => (await registration.getFamily(familyId)).family,
      ),
    );
    return { detail, families };
  }, [gateway, registration, id]);
  const state = useApiQuery(load, refresh);
  return (
    <>
      <BackLink to={`/people/${id}`} />
      <Page title="Gestão de vínculos familiares">
        <AsyncView state={state}>
          {({ detail, families }) => {
            const membership =
              detail.memberships.find((row) => row.id === selected) ??
              detail.memberships[0];
            const family = families.find(
              (row) => row.id === membership?.familyId,
            );
            return (
              <>
                <Panel title={detail.person.name}>
                  {detail.memberships.map((row) => (
                    <p key={row.id}>
                      <button
                        className="text-link"
                        onClick={() => setSelected(row.id)}
                      >
                        Família{' '}
                        {
                          families.find((family) => family.id === row.familyId)
                            ?.code
                        }{' '}
                        · {displayInstant(row.validFrom)} até{' '}
                        {row.validUntil
                          ? displayInstant(row.validUntil)
                          : 'vigência aberta'}
                      </button>
                    </p>
                  ))}
                  {!membership && (
                    <p>
                      Nenhum vínculo cadastrado. Abra a reconciliação para
                      vincular esta pessoa a uma família.
                    </p>
                  )}
                  <Link to={`/people/${id}/reconciliation`}>
                    Vincular existente ou reconciliar histórico
                  </Link>
                </Panel>
                {membership && family && (
                  <Panel
                    title={`Família ${family.code} — revisão ${family.revision}`}
                  >
                    <MembershipActions
                      key={`${membership.id}:${membership.revision}:${family.revision}`}
                      gateway={gateway}
                      registration={registration}
                      membership={membership}
                      family={family}
                      onSaved={() => setRefresh(refresh + 1)}
                    />
                  </Panel>
                )}
              </>
            );
          }}
        </AsyncView>
        <button
          className="button secondary"
          onClick={() => setRefresh(refresh + 1)}
        >
          Atualizar vínculos
        </button>
      </Page>
    </>
  );
}
