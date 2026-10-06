import { Link } from 'react-router';
const labels: Record<string, string> = {
  people: 'Pessoas únicas',
  families: 'Famílias únicas',
  sessions: 'Encontros',
  presences: 'Presenças',
  total: 'Total',
  open: 'Abertas',
  resolved: 'Resolvidas',
  participants: 'Participantes',
  sessionCount: 'Encontros',
  presenceCount: 'Presenças',
  absenceCount: 'Ausências',
  unrecordedCount: 'Sem marcação',
  attendanceRate: 'Frequência (%)',
  markingsComplete: 'Marcações completas',
  contextComplete: 'Contextos completos',
  coverageComplete: 'Cobertura completa',
  isComplete: 'Evidência completa',
  completedSessions: 'Encontros realizados',
  canceledSessions: 'Encontros cancelados',
  ELIGIBLE: 'Aptas',
  INELIGIBLE: 'Não aptas',
  PENDING: 'Pendentes',
  personName: 'Pessoa',
  familyCode: 'Código familiar',
  code: 'Código',
  name: 'Nome',
  status: 'Situação',
  occurredAt: 'Data do fato',
  recordedAt: 'Data do lançamento',
  referenceDate: 'Referência',
  valid: 'Válido',
  invalidReason: 'Motivo da invalidade',
  revision: 'Revisão',
  personId: 'Pessoa',
  familyId: 'Família',
  activityId: 'Atividade',
  sourceId: 'Registro de origem',
  sourceType: 'Tipo de origem',
  originFamilyId: 'Família de origem',
  kind: 'Tipo de pendência',
  id: 'Identificador',
  reason: 'Motivo',
  identifiedAt: 'Identificada em',
  resolvedAt: 'Resolvida em',
  policyId: 'Política utilizada',
  type: 'Evento',
  from: 'Início',
  toExclusive: 'Fim exclusivo',
  periodStart: 'Início do período',
  periodEndExclusive: 'Fim exclusivo',
  unit: 'Unidade',
  generatedAt: 'Consulta gerada em',
  method: 'Método',
  denominator: 'Denominador',
  filters: 'Filtros',
  details: 'Detalhes',
  sourceVersions: 'Revisões das fontes',
  evidences: 'Evidências',
  explanation: 'Explicação',
  pendingReasons: 'Motivos de pendência',
  byKind: 'Por tipo',
  byResolution: 'Por resolução',
  POSSIBLE_DUPLICATE: 'Possível duplicidade',
  MISSING_DATA: 'Dados ausentes',
  DISTINCT: 'Distintos',
  MERGED: 'Unificados',
  COMPLETED: 'Completados',
  NOT_TRACKED: 'Sem acompanhamento',
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  SESSION_CANCELED: 'Encontro cancelado',
  SESSION_NOT_COMPLETED: 'Encontro não realizado',
  MEMBERSHIP_STARTED: 'Início de vínculo familiar',
  MEMBERSHIP_ENDED: 'Fim de vínculo familiar',
  ENROLLMENT_STARTED: 'Início de inscrição',
  ENROLLMENT_ENDED: 'Fim de inscrição',
  ATTENDANCE: 'Frequência',
  SOCIAL_FORM: 'Ficha social',
  ELIGIBILITY_ASSESSMENT: 'Avaliação de aptidão',
  OPEN: 'Aberta',
  RESOLVED: 'Resolvida',
};
export function RecordValues({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <>Não informado</>;
  if (typeof value === 'boolean') return <>{value ? 'Sim' : 'Não'}</>;
  if (typeof value === 'string' || typeof value === 'number')
    return <>{labels[String(value)] ?? String(value)}</>;
  if (Array.isArray(value))
    return value.length ? (
      <ul>
        {value.map((item, index) => (
          <li key={index}>
            <RecordValues value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <>Nenhum registro</>
    );
  if (typeof value === 'object')
    return (
      <dl>
        {Object.entries(value)
          .filter(
            ([key]) =>
              key !== 'queryFingerprint' && key !== 'sourceFingerprint',
          )
          .map(([key, item]) => (
            <div key={key}>
              <dt>{labels[key] ?? key}</dt>
              <dd>
                {typeof item === 'string' &&
                key === 'sourceId' &&
                (value as Record<string, unknown>).sourceType ===
                  'EligibilityAssessment' ? (
                  <Link to={`/eligibility-assessments/${item}`}>
                    Consultar avaliação registrada
                  </Link>
                ) : typeof item === 'string' && key === 'policyId' ? (
                  <Link to={`/eligibility-policies/${item}`}>
                    Consultar política utilizada
                  </Link>
                ) : typeof item === 'string' &&
                  [
                    'personId',
                    'familyId',
                    'activityId',
                    'originFamilyId',
                  ].includes(key) ? (
                  <Link
                    to={`/${key === 'personId' ? 'people' : key === 'activityId' ? 'activities' : 'families'}/${item}`}
                  >
                    Consultar registro
                  </Link>
                ) : (
                  <RecordValues value={item} />
                )}
              </dd>
            </div>
          ))}
      </dl>
    );
  return null;
}
export function RecordList({ records }: { records: object[] }) {
  return records.length ? (
    <ol className="form-stack">
      {records.map((record, index) => (
        <li key={index} className="panel">
          <RecordValues value={record} />
        </li>
      ))}
    </ol>
  ) : (
    <p>Nenhum registro no filtro consultado.</p>
  );
}
