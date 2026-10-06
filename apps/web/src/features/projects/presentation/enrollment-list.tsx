import type { ReactNode } from 'react';
import type { EnrollmentsPageDto } from '@erp/contracts/projects-api';
import { CheckCircle } from 'lucide-react';
import type { Participant } from '@erp/contracts/projects';
import { Empty, Panel, StatusBadge } from '../../../shared/ui';
import { displayInstant } from '../../../shared/time';

export function EnrollmentList({
  participants,
  asOf,
  records,
  actions,
  history = false,
}: {
  participants: Participant[];
  asOf: string;
  records?: EnrollmentsPageDto['data'];
  actions?: (item: EnrollmentsPageDto['data'][number]) => ReactNode;
  history?: boolean;
}) {
  const enrolledParticipants = participants.filter((person) => person.enrolled);

  const rows = records
    ? records.map((item) => ({
        key: item.enrollment.id,
        person: {
          id: item.person.id,
          name: item.person.name,
          familyCode: item.person.family?.code ?? null,
        },
        item,
      }))
    : enrolledParticipants.map((person) => ({
        key: person.id,
        person,
        item: undefined,
      }));
  return (
    <Panel
      title={history ? 'Histórico de inscrições' : 'Inscrições da atividade'}
    >
      <p className="mb-4 text-sm">
        {history ? (
          'Intervalos efetivos, incluindo encerrados.'
        ) : (
          <>
            Referência: <time dateTime={asOf}>{displayInstant(asOf)}</time>
          </>
        )}
      </p>
      {rows.length ? (
        <div className="table-wrap">
          <table
            className="enrollment-table"
            aria-label="Inscrições da atividade"
          >
            <thead>
              <tr>
                <th scope="col">Participante</th>
                <th scope="col">Família na consulta</th>
                <th scope="col">{records ? 'Vigência' : 'Situação'}</th>
                {actions && <th scope="col">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, person, item }) => (
                <tr key={key}>
                  <th scope="row">{person.name}</th>
                  <td>
                    {person.familyCode ?? 'Vínculo familiar não disponível'}
                  </td>
                  <td>
                    {item ? (
                      <>
                        <time dateTime={item.enrollment.validFrom}>
                          {displayInstant(item.enrollment.validFrom)}
                        </time>{' '}
                        até{' '}
                        {item.enrollment.validUntil ? (
                          <time dateTime={item.enrollment.validUntil}>
                            {displayInstant(item.enrollment.validUntil)} (fim
                            exclusivo)
                          </time>
                        ) : (
                          'sem término informado'
                        )}
                      </>
                    ) : (
                      <StatusBadge
                        icon={<CheckCircle aria-hidden="true" size={14} />}
                      >
                        Vigente na consulta
                      </StatusBadge>
                    )}
                  </td>
                  {actions && item && <td>{actions(item)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>
          {history
            ? 'Nenhuma inscrição registrada.'
            : 'Nenhuma inscrição vigente na data consultada.'}
        </Empty>
      )}
    </Panel>
  );
}
