import { Link } from 'react-router';
import type { DuplicateCandidate } from '../application/registration-gateway';
import { Field } from '../../../shared/ui';

const reasons = {
  CPF_MATCH: 'CPF coincidente',
  NAME_BIRTH_MATCH: 'Nome e nascimento coincidentes',
  NAME_SIMILAR: 'Nome semelhante',
  ADDRESS_SIMILAR: 'Endereço semelhante',
};
export function DuplicateReview({
  candidates,
}: {
  candidates: DuplicateCandidate[];
}) {
  return (
    <fieldset className="form-stack">
      <legend>Possíveis cadastros duplicados</legend>
      <p>Confira os registros antes de confirmar um novo cadastro.</p>
      <ul>
        {candidates.map((candidate, index) => (
          <li key={candidate.id}>
            <Link
              to={`/${candidate.entityType === 'FAMILY' ? 'families' : 'people'}/${candidate.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar cadastro candidato {index + 1} (nova aba)
            </Link>
            <span>
              {' '}
              · {candidate.reasons.map((reason) => reasons[reason]).join(', ')}
            </span>
          </li>
        ))}
      </ul>
      <Field
        label="Motivo para cadastrar como distinto"
        name="duplicateReason"
        required
        maxLength={1000}
      />
      <Field
        label="Conferi os candidatos e este é um cadastro distinto"
        name="duplicateConfirmed"
        type="checkbox"
        required
      />
    </fieldset>
  );
}
