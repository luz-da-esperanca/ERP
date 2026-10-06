import { CheckCircle } from 'lucide-react';
import type { Participant } from '@erp/contracts/projects';
import { Empty, Panel, StatusBadge } from '../../../shared/ui';
import { displayInstant } from '../../../shared/time';

export function EnrollmentList({
  participants,
  asOf,
}: {
  participants: Participant[];
  asOf: string;
}) {
  const enrolledParticipants = participants.filter((person) => person.enrolled);

  return (
    <Panel title="Inscrições da atividade">
      <p className="mb-4 text-sm">
        Referência: <time dateTime={asOf}>{displayInstant(asOf)}</time>
      </p>
      {enrolledParticipants.length ? (
        <div className="table-wrap">
          <table
            className="enrollment-table"
            aria-label="Inscrições da atividade"
          >
            <thead>
              <tr>
                <th scope="col">Participante</th>
                <th scope="col">Família na consulta</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {enrolledParticipants.map((person) => (
                <tr key={person.id}>
                  <th scope="row">{person.name}</th>
                  <td>
                    {person.familyCode ?? 'Vínculo familiar não disponível'}
                  </td>
                  <td>
                    <StatusBadge
                      icon={<CheckCircle aria-hidden="true" size={14} />}
                    >
                      Vigente na consulta
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Nenhuma inscrição vigente na data consultada.</Empty>
      )}
    </Panel>
  );
}
