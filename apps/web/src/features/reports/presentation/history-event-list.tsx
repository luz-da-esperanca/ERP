import { Link } from 'react-router';
import {
  BadgeCheck,
  CalendarCheck,
  ClipboardList,
  UserPlus,
  UserMinus,
  UsersRound,
  LogOut,
  ArrowUpRight,
} from 'lucide-react';
import type { HistoryEventDto } from '@erp/contracts/reports-api';
import { displayInstant, displayDate } from '../../../shared/time';
import { Empty, StatusBadge } from '../../../shared/ui';
import { RecordValues } from '../../../shared/record-list';

export const historyEventLabels: Record<HistoryEventDto['type'], string> = {
  MEMBERSHIP_STARTED: 'Início de vínculo familiar',
  MEMBERSHIP_ENDED: 'Fim de vínculo familiar',
  ENROLLMENT_STARTED: 'Início de inscrição',
  ENROLLMENT_ENDED: 'Fim de inscrição',
  ATTENDANCE: 'Frequência',
  SOCIAL_FORM: 'Ficha social',
  ELIGIBILITY_ASSESSMENT: 'Avaliação de aptidão',
};
const eventIcons = {
  MEMBERSHIP_STARTED: UsersRound,
  MEMBERSHIP_ENDED: LogOut,
  ENROLLMENT_STARTED: UserPlus,
  ENROLLMENT_ENDED: UserMinus,
  ATTENDANCE: CalendarCheck,
  SOCIAL_FORM: ClipboardList,
  ELIGIBILITY_ASSESSMENT: BadgeCheck,
};

export function HistoryEventList({ records }: { records: HistoryEventDto[] }) {
  if (!records.length)
    return (
      <Empty>Nenhum registro no período e nos filtros selecionados.</Empty>
    );
  return (
    <ol className="history-event-list" aria-label="Registros do histórico">
      {records.map((record, index) => {
        const Icon = eventIcons[record.type];
        return (
          <li
            className="history-event"
            key={`${record.type}:${record.sourceId}:${index}`}
          >
            <span className="history-event-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <div className="history-event-content">
              <div className="history-event-heading">
                <h3>{historyEventLabels[record.type]}</h3>
                {record.valid === false && (
                  <StatusBadge>
                    {record.invalidReason === 'SESSION_CANCELED'
                      ? 'Encontro cancelado'
                      : record.invalidReason === 'SUPERSEDED'
                        ? 'Registro corrigido'
                        : 'Registro inválido'}
                  </StatusBadge>
                )}
              </div>
              <time dateTime={record.occurredAt}>
                {displayInstant(record.occurredAt)}
              </time>
              {record.referenceDate && (
                <p className="muted">
                  Referência: {displayDate(record.referenceDate)}
                </p>
              )}
              <div className="history-record-links">
                {record.sourceType === 'EligibilityAssessment' && (
                  <Link
                    className="text-link record-link"
                    to={`/eligibility-assessments/${record.sourceId}`}
                  >
                    Consultar avaliação registrada
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                )}
                {record.personId && (
                  <Link
                    className="text-link record-link"
                    to={`/people/${record.personId}`}
                  >
                    Consultar pessoa
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                )}
                {record.familyId && (
                  <Link
                    className="text-link record-link"
                    to={`/families/${record.familyId}`}
                  >
                    Consultar família
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                )}
                {record.activityId && (
                  <Link
                    className="text-link record-link"
                    to={`/activities/${record.activityId}`}
                  >
                    Consultar atividade
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                )}
              </div>
              <details className="disclosure">
                <summary>Detalhes do registro</summary>
                <dl className="profile-details">
                  <dt>Registro de origem</dt>
                  <dd>
                    <code>{record.sourceId}</code>
                  </dd>
                  <dt>Data do lançamento</dt>
                  <dd>
                    {record.recordedAt
                      ? displayInstant(record.recordedAt)
                      : 'Não informada'}
                  </dd>
                </dl>
                {record.details && <RecordValues value={record.details} />}
              </details>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
