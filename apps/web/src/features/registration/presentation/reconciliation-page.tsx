import { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { reconciliationPlanSchema } from '@erp/contracts/membership-reconciliation-api';
import type {
  ReconciliationPlanInput,
  ReconciliationPreviewDto,
} from '@erp/contracts/membership-reconciliation-api';
import type { FamilyDto } from '@erp/contracts/registration-api';
import type { HttpComposition } from '../infra/http-composition';
import type { HttpRegistration } from '../infra/http-registration';
import type { HttpAttendance } from '../../attendance/infra/http-attendance';
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
  localDateTimeExact,
  localDateTime,
  toInstant,
  displayInstant,
} from '../../../shared/time';
import { RecordList } from '../../../shared/record-list';
import { FamilyLookup } from './family-lookup';
type Source = {
  detail: Awaited<ReturnType<HttpComposition['person']>>;
  initialFamily: FamilyDto | null;
  families: FamilyDto[];
};
type Marking = {
  session: Awaited<ReturnType<HttpAttendance['detail']>>['session'];
  attendance: Awaited<
    ReturnType<HttpAttendance['detail']>
  >['attendances'][number];
};
function ReconciliationForm({
  gateway,
  registration,
  attendance,
  source,
  canCorrectAttendance,
  onSaved,
}: {
  gateway: HttpComposition;
  registration: HttpRegistration;
  attendance: HttpAttendance;
  source: Source;
  canCorrectAttendance: boolean;
  onSaved: () => void;
}) {
  const [now] = useState(() => new Date().toISOString());
  const [target, setTarget] = useState<FamilyDto | null>(null);
  const [additions, setAdditions] = useState<
    Array<{ family: FamilyDto; clientRef: string }>
  >(() =>
    source.initialFamily
      ? [{ family: source.initialFamily, clientRef: crypto.randomUUID() }]
      : [],
  );
  const [review, setReview] = useState<{
    plan: ReconciliationPlanInput;
    preview: ReconciliationPreviewDto;
    markings: Marking[];
  } | null>(null);
  const action = useAction();
  const keyFor = useOperationKey();
  async function previewPlan(plan: ReconciliationPlanInput) {
    const preview = await gateway.preview(source.detail.person.id, plan);
    const markings: Marking[] = [];
    if (preview.conflicts.length && canCorrectAttendance) {
      const sessions = await Promise.all(
        preview.sourceVersions
          .filter((version) => version.entityType === 'ActivitySession')
          .map((version) => attendance.detail(version.entityId)),
      );
      for (const detail of sessions)
        for (const marking of detail.attendances)
          if (preview.conflicts.includes(marking.id))
            markings.push({ session: detail.session, attendance: marking });
    }
    setReview({ plan, preview, markings });
  }
  if (review)
    return (
      <Panel title="Revisão da reconciliação">
        <Alert>Plano conferido.</Alert>
        <RecordList records={review.preview.proposedMemberships} />
        <p>
          {review.preview.affectedAttendanceIds.length} marcações afetadas ·{' '}
          {review.preview.conflicts.length} conflitos de contexto.
        </p>
        {review.preview.conflicts.length ? (
          canCorrectAttendance &&
          review.markings.length === review.preview.conflicts.length ? (
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void action.run(async () => {
                  const attendanceContextChanges = review.markings.map(
                    ({ session, attendance: marking }) => {
                      const membership = textValue(
                        data,
                        `${marking.id}:membership`,
                      );
                      return {
                        attendanceId: marking.id,
                        expectedRevision: marking.revision,
                        sessionId: session.id,
                        expectedSessionRevision: session.revision,
                        membership: membership.startsWith('new:')
                          ? { clientRef: membership.slice(4) }
                          : { id: membership },
                        reason: textValue(data, `${marking.id}:reason`),
                      };
                    },
                  );
                  await previewPlan(
                    reconciliationPlanSchema.parse({
                      ...review.plan,
                      attendanceContextChanges,
                    }),
                  );
                });
              }}
            >
              <p>
                Selecione explicitamente o vínculo familiar de cada marcação na
                data do encontro.
              </p>
              {review.markings.map(({ session, attendance: marking }) => (
                <fieldset key={marking.id}>
                  <legend>
                    Encontro em {displayInstant(session.occurredAt)}
                  </legend>
                  <SelectField
                    label="Vínculo correto da marcação"
                    name={`${marking.id}:membership`}
                    required
                    defaultValue=""
                  >
                    <option value="">Selecione</option>
                    {review.preview.proposedMemberships.map((membership) => (
                      <option key={membership.id} value={membership.id}>
                        Família{' '}
                        {source.families.find(
                          (family) => family.id === membership.familyId,
                        )?.code ??
                          additions.find(
                            (addition) =>
                              addition.family.id === membership.familyId,
                          )?.family.code}{' '}
                        · {displayInstant(membership.validFrom)} até{' '}
                        {membership.validUntil
                          ? displayInstant(membership.validUntil)
                          : 'aberto'}
                      </option>
                    ))}
                  </SelectField>
                  <Field
                    label="Motivo da correção desta marcação"
                    name={`${marking.id}:reason`}
                    required
                    maxLength={1000}
                  />
                </fieldset>
              ))}
              <Submit pending={action.pending}>
                Conferir plano com contextos corrigidos
              </Submit>
            </form>
          ) : (
            <Alert error>
              Os contextos de frequência precisam ser reconciliados por um
              operador com permissão de frequência antes da confirmação.
            </Alert>
          )
        ) : (
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (new FormData(event.currentTarget).get('confirmed') !== 'on')
                return;
              void action.run(async () => {
                const input = {
                  ...review.plan,
                  expectedSourceFingerprint: review.preview.sourceFingerprint,
                };
                await gateway.reconcile(
                  source.detail.person.id,
                  input,
                  keyFor(`reconciliation/${source.detail.person.id}`, input),
                );
                onSaved();
              });
            }}
          >
            <Field
              label="Conferi os vínculos, as datas e os contextos de frequência do plano"
              name="confirmed"
              type="checkbox"
              required
            />
            <Submit pending={action.pending}>Confirmar reconciliação</Submit>
          </form>
        )}
        {action.error && <Alert error>{action.error}</Alert>}
        <button
          className="button secondary"
          disabled={action.pending}
          onClick={() => setReview(null)}
        >
          Revisar plano
        </button>
      </Panel>
    );
  return (
    <Panel title={`Plano para ${source.detail.person.name}`}>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void action.run(async () => {
            const families = [
              ...source.families,
              ...additions.map((row) => row.family),
            ];
            const changes = source.detail.memberships.map((membership) => ({
              membershipId: membership.id,
              expectedRevision: membership.revision,
              validFrom: toInstant(textValue(data, `${membership.id}:from`)),
              validUntil: textValue(data, `${membership.id}:until`)
                ? toInstant(textValue(data, `${membership.id}:until`))
                : null,
              isReference: data.get(`${membership.id}:reference`) === 'on',
              relationshipToReference: nullableValue(
                data,
                `${membership.id}:relationship`,
              ),
            }));
            const added = additions.map(({ family, clientRef }) => ({
              clientRef,
              familyId: family.id,
              validFrom: toInstant(textValue(data, `${clientRef}:from`)),
              validUntil: textValue(data, `${clientRef}:until`)
                ? toInstant(textValue(data, `${clientRef}:until`))
                : null,
              isReference: data.get(`${clientRef}:reference`) === 'on',
              relationshipToReference: nullableValue(
                data,
                `${clientRef}:relationship`,
              ),
            }));
            const plan = reconciliationPlanSchema.parse({
              intent: textValue(data, 'intent'),
              expectedPersonRevision: source.detail.person.revision,
              familyRevisions: [
                ...new Map(
                  families.map((family) => [
                    family.id,
                    { familyId: family.id, expectedRevision: family.revision },
                  ]),
                ).values(),
              ],
              membershipChanges: [...changes, ...added],
              attendanceContextChanges: [],
              reason: textValue(data, 'reason'),
            });
            await previewPlan(plan);
          });
        }}
      >
        <fieldset disabled={action.pending} className="form-stack">
          <SelectField label="Intenção da reconciliação" name="intent">
            <option value="CORRECTION">Correção de histórico</option>
            <option value="TRANSFER">Transferência familiar</option>
          </SelectField>
          {source.detail.memberships.map((membership) => (
            <fieldset key={membership.id}>
              <legend>
                Vínculo existente — Família{' '}
                {
                  source.families.find(
                    (family) => family.id === membership.familyId,
                  )?.code
                }
              </legend>
              <Field
                label="Início do vínculo"
                name={`${membership.id}:from`}
                type="datetime-local"
                step="0.001"
                required
                defaultValue={localDateTimeExact(membership.validFrom)}
                max={localDateTimeExact(now)}
              />
              <Field
                label="Fim do vínculo (exclusivo)"
                name={`${membership.id}:until`}
                type="datetime-local"
                step="0.001"
                defaultValue={
                  membership.validUntil
                    ? localDateTimeExact(membership.validUntil)
                    : ''
                }
                max={localDateTimeExact(now)}
              />
              <Field
                label="Parentesco"
                name={`${membership.id}:relationship`}
                defaultValue={membership.relationshipToReference ?? ''}
                maxLength={100}
              />
              <Field
                label="Titular"
                name={`${membership.id}:reference`}
                type="checkbox"
                defaultChecked={membership.isReference}
              />
            </fieldset>
          ))}
          <FamilyLookup
            registration={registration}
            onSelect={setTarget}
            required={false}
          />
          <button
            type="button"
            className="button secondary"
            disabled={!target}
            onClick={() => {
              if (target) {
                setAdditions([
                  ...additions,
                  { family: target, clientRef: crypto.randomUUID() },
                ]);
                setTarget(null);
              }
            }}
          >
            Adicionar vínculo ao plano
          </button>
          {additions.map(({ family, clientRef }) => (
            <fieldset key={clientRef}>
              <legend>Novo vínculo — Família {family.code}</legend>
              <Field
                label="Início do novo vínculo"
                name={`${clientRef}:from`}
                type="datetime-local"
                step="0.001"
                required
                defaultValue={localDateTime(now)}
                max={localDateTimeExact(now)}
              />
              <Field
                label="Fim do novo vínculo (exclusivo)"
                name={`${clientRef}:until`}
                type="datetime-local"
                step="0.001"
                max={localDateTimeExact(now)}
              />
              <Field
                label="Parentesco do novo vínculo"
                name={`${clientRef}:relationship`}
                maxLength={100}
              />
              <Field
                label="Titular no novo vínculo"
                name={`${clientRef}:reference`}
                type="checkbox"
              />
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  setAdditions(
                    additions.filter((row) => row.clientRef !== clientRef),
                  )
                }
              >
                Retirar vínculo do plano
              </button>
            </fieldset>
          ))}
          <Field
            label="Motivo da reconciliação"
            name="reason"
            required
            maxLength={1000}
          />
        </fieldset>
        {action.error && <Alert error>{action.error}</Alert>}
        <Submit pending={action.pending}>
          Conferir plano de reconciliação
        </Submit>
      </form>
    </Panel>
  );
}
export function ReconciliationPage({
  gateway,
  registration,
  attendance,
  canCorrectAttendance,
}: {
  gateway: HttpComposition;
  registration: HttpRegistration;
  attendance: HttpAttendance;
  canCorrectAttendance: boolean;
}) {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const initialFamilyId = params.get('familyId');
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(async () => {
    const detail = await gateway.person(id);
    const families = await Promise.all(
      [...new Set(detail.memberships.map((row) => row.familyId))].map(
        async (familyId) => (await registration.getFamily(familyId)).family,
      ),
    );
    return {
      detail,
      families,
      initialFamily: initialFamilyId
        ? (await registration.getFamily(initialFamilyId)).family
        : null,
    };
  }, [gateway, registration, id, initialFamilyId]);
  const state = useApiQuery(load, refresh);
  return (
    <>
      <BackLink to={`/people/${id}/memberships`} />
      <Page title="Reconciliação de vínculos e frequência">
        <AsyncView state={state}>
          {(source) => (
            <ReconciliationForm
              key={`${source.detail.person.revision}:${refresh}`}
              gateway={gateway}
              registration={registration}
              attendance={attendance}
              source={source}
              canCorrectAttendance={canCorrectAttendance}
              onSaved={() => setRefresh(refresh + 1)}
            />
          )}
        </AsyncView>
        <button
          className="button secondary"
          onClick={() => setRefresh(refresh + 1)}
        >
          Atualizar fontes do plano
        </button>
      </Page>
    </>
  );
}
