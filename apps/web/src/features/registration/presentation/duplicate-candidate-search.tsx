import { useCallback, useState } from 'react';
import { duplicateQuerySchema } from '@erp/contracts/registration-api';
import type {
  DataQualityGateway,
  DuplicateEntityType,
  DuplicateQuery,
} from '../application/data-quality-gateway';
import {
  Alert,
  AsyncView,
  Empty,
  Field,
  Panel,
  SelectField,
} from '../../../shared/ui';
import { useApiQuery } from '../../../shared/use-query';
import { recordLabel } from './duplicate-labels';

const matchLabels = {
  CPF_MATCH: 'CPF igual',
  NAME_BIRTH_MATCH: 'Nome e nascimento iguais',
  NAME_SIMILAR: 'Nome semelhante',
  ADDRESS_SIMILAR: 'Endereço semelhante',
};
export function DuplicateCandidateSearch({
  gateway,
  onCompare,
}: {
  gateway: DataQualityGateway;
  onCompare(entityType: DuplicateEntityType, ids: string[]): void;
}) {
  const [entityType, setEntityType] = useState<DuplicateEntityType>('PERSON');
  const [query, setQuery] = useState<DuplicateQuery | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel title="Buscar candidatos">
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const values = Object.fromEntries(
            [...form.entries()].filter(([, value]) => String(value).trim()),
          );
          const parsed = duplicateQuerySchema.safeParse({
            ...values,
            entityType,
          });
          if (!parsed.success) {
            setError(
              entityType === 'PERSON'
                ? 'Informe nome com pelo menos dois caracteres ou CPF com 11 dígitos. Revise a data, se informada.'
                : 'Informe nome de referência ou endereço com pelo menos dois caracteres.',
            );
            return;
          }
          setError(null);
          setQuery(parsed.data);
        }}
      >
        <SelectField
          label="Tipo da busca"
          name="entityType"
          value={entityType}
          onChange={(event) => {
            setEntityType(
              event.target.value === 'FAMILY' ? 'FAMILY' : 'PERSON',
            );
            setQuery(null);
            setError(null);
          }}
        >
          <option value="PERSON">Pessoa</option>
          <option value="FAMILY">Família</option>
        </SelectField>
        <div key={entityType} className="form-grid">
          {entityType === 'PERSON' ? (
            <>
              <Field name="name" label="Nome da pessoa" maxLength={200} />
              <Field name="cpf" label="CPF" maxLength={14} />
              <Field name="birthDate" label="Nascimento" type="date" />
            </>
          ) : (
            <>
              <Field
                name="referenceName"
                label="Nome de referência"
                maxLength={200}
              />
              <Field name="address" label="Endereço" maxLength={200} />
            </>
          )}
        </div>
        {error ? <Alert error>{error}</Alert> : null}
        <button className="button secondary w-fit" type="submit">
          Consultar candidatos
        </button>
      </form>
      {query ? (
        <CandidateResults
          key={JSON.stringify(query)}
          gateway={gateway}
          query={query}
          onCompare={onCompare}
        />
      ) : null}
    </Panel>
  );
}
function CandidateResults({
  gateway,
  query,
  onCompare,
}: {
  gateway: DataQualityGateway;
  query: DuplicateQuery;
  onCompare(entityType: DuplicateEntityType, ids: string[]): void;
}) {
  const load = useCallback(async () => {
    const candidates = await gateway.candidates(query);
    return Promise.all(
      candidates.map(async (candidate) => ({
        ...candidate,
        record: await gateway.record(candidate.entityType, candidate.id),
      })),
    );
  }, [gateway, query]);
  const state = useApiQuery(load);
  return (
    <div className="mt-6">
      <AsyncView state={state}>
        {(candidates) =>
          candidates.length ? (
            <>
              <ul className="grid gap-4">
                {candidates.map((candidate) => (
                  <li
                    key={candidate.id}
                    className="min-w-0 border-b border-(--color-border) pb-4"
                  >
                    <p className="break-words font-semibold">
                      {recordLabel(candidate.record)}
                    </p>
                    <ul className="text-sm">
                      {candidate.reasons.map((reason) => (
                        <li key={reason}>{matchLabels[reason]}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <button
                className="button secondary mt-4"
                type="button"
                disabled={
                  new Set(candidates.map((candidate) => candidate.record.id))
                    .size < 2
                }
                onClick={() =>
                  onCompare(
                    query.entityType,
                    candidates.map((candidate) => candidate.record.id),
                  )
                }
              >
                Comparar candidatos
              </button>
            </>
          ) : (
            <Empty>Nenhum candidato encontrado.</Empty>
          )
        }
      </AsyncView>
    </div>
  );
}
