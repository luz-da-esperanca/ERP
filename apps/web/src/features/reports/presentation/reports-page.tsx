import { ReportPartyFilter } from './party-filter';
import type { HttpRegistration } from '../../registration/infra/http-registration';
import { useCallback, useState } from 'react';
import type { Capability } from '@erp/contracts/access';
import type { HttpReports } from '../infra/http-reports';
import type { HttpProjects } from '../../projects/infra/http-projects';
import { useApiQuery } from '../../../shared/use-query';
import { useAction } from '../../../shared/use-action';
import { ApiRequestError } from '../../../shared/api-client';
import {
  Page,
  Panel,
  Field,
  SelectField,
  AsyncView,
  Alert,
  textValue,
} from '../../../shared/ui';
import { RecordList, RecordValues } from '../../../shared/record-list';

type Kind = 'reach' | 'frequency' | 'eligibility' | 'quality';
type Query = {
  instituteId: string;
  projectId: string;
  personId: string;
  familyId: string;
  qualityKind: '' | 'MISSING_DATA' | 'POSSIBLE_DUPLICATE';
  qualityStatus: '' | 'OPEN' | 'RESOLVED';
  kind: Kind;
  from: string;
  toExclusive: string;
  referenceDate: string;
  activityId: string;
  dateBasis: 'IDENTIFICATION' | 'RESOLUTION';
};
type Report = Awaited<
  ReturnType<
    | HttpReports['reach']
    | HttpReports['frequency']
    | HttpReports['eligibility']
    | HttpReports['quality']
  >
>;
type Records = Awaited<
  ReturnType<
    | HttpReports['reachRecords']
    | HttpReports['frequencyRecords']
    | HttpReports['eligibilityRecords']
    | HttpReports['qualityRecords']
  >
>;
export function ReportsPage({
  gateway,
  capabilities,
  projects,
  registration,
}: {
  gateway: HttpReports;
  capabilities: Capability[];
  projects?: HttpProjects;
  registration?: HttpRegistration;
}) {
  const kinds: Kind[] = [
    ...(capabilities.includes('attendance.read')
      ? ['reach' as const, 'frequency' as const]
      : []),
    ...(capabilities.includes('eligibility.read')
      ? ['eligibility' as const]
      : []),
    ...(capabilities.includes('registration.read') ? ['quality' as const] : []),
  ];
  const [kind, setKind] = useState<Kind>(kinds[0] ?? 'reach');
  const [query, setQuery] = useState<Query | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [records, setRecords] = useState<Records | null>(null);
  const [detail, setDetail] = useState<{ unit: string; page: number } | null>(
    null,
  );
  const action = useAction();
  const loadProjects = useCallback(
    () =>
      projects && capabilities.includes('projects.read')
        ? projects.overview()
        : Promise.resolve(null),
    [projects, capabilities],
  );
  const overview = useApiQuery(loadProjects);
  async function consult(next: Query) {
    setReport(null);
    setRecords(null);
    setDetail(null);
    setQuery(next);
    await action.run(async () => {
      const period = { from: next.from, toExclusive: next.toExclusive };
      const result =
        next.kind === 'reach'
          ? await gateway.reach({
              ...period,
              ...(next.activityId ? { activityId: next.activityId } : {}),
              ...(next.instituteId ? { instituteId: next.instituteId } : {}),
              ...(next.projectId ? { projectId: next.projectId } : {}),
            })
          : next.kind === 'frequency'
            ? await gateway.frequency({
                ...period,
                activityId: next.activityId,
                ...(next.personId ? { personId: next.personId } : {}),
                ...(next.familyId ? { familyId: next.familyId } : {}),
              })
            : next.kind === 'eligibility'
              ? await gateway.eligibility({
                  referenceDate: next.referenceDate,
                  ...(next.familyId ? { familyId: next.familyId } : {}),
                })
              : await gateway.quality({
                  ...period,
                  dateBasis: next.dateBasis,
                  ...(next.qualityKind ? { kind: next.qualityKind } : {}),
                  ...(next.qualityStatus ? { status: next.qualityStatus } : {}),
                });
      setReport(result);
    });
  }
  async function drilldown(unit: string, page = 1) {
    if (!query || !report) return;
    setRecords(null);
    setDetail({ unit, page });
    await action.run(async () => {
      try {
        const common = {
          expectedQueryFingerprint: report.queryFingerprint,
          page,
        };
        const period = { from: query.from, toExclusive: query.toExclusive };
        const result =
          query.kind === 'reach'
            ? await gateway.reachRecords({
                ...period,
                ...(query.activityId ? { activityId: query.activityId } : {}),
                ...(query.instituteId
                  ? { instituteId: query.instituteId }
                  : {}),
                ...(query.projectId ? { projectId: query.projectId } : {}),
                ...common,
                unit: unit as 'PERSON' | 'FAMILY' | 'SESSION' | 'PRESENCE',
              })
            : query.kind === 'frequency'
              ? await gateway.frequencyRecords({
                  ...period,
                  activityId: query.activityId,
                  ...(query.personId ? { personId: query.personId } : {}),
                  ...(query.familyId ? { familyId: query.familyId } : {}),
                  ...common,
                  unit: unit as 'OPPORTUNITY' | 'SESSION',
                })
              : query.kind === 'eligibility'
                ? await gateway.eligibilityRecords({
                    referenceDate: query.referenceDate,
                    ...(query.familyId ? { familyId: query.familyId } : {}),
                    status: unit as 'ELIGIBLE' | 'INELIGIBLE' | 'PENDING',
                    ...common,
                  })
                : await gateway.qualityRecords({
                    ...period,
                    dateBasis: query.dateBasis,
                    ...(query.qualityKind ? { kind: query.qualityKind } : {}),
                    ...(query.qualityStatus
                      ? { status: query.qualityStatus }
                      : {}),
                    ...common,
                  });
        setRecords(result);
      } catch (error) {
        if (
          error instanceof ApiRequestError &&
          error.code === 'REPORT_CHANGED'
        ) {
          setReport(null);
          setRecords(null);
          setDetail(null);
        }
        throw error;
      }
    });
  }
  return (
    <Page title="Consultas e relatórios">
      <Panel>
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void consult({
              instituteId: textValue(data, 'instituteId'),
              projectId: textValue(data, 'projectId'),
              personId: textValue(data, 'personId'),
              familyId: textValue(data, 'familyId'),
              qualityKind: textValue(
                data,
                'qualityKind',
              ) as Query['qualityKind'],
              qualityStatus: textValue(
                data,
                'qualityStatus',
              ) as Query['qualityStatus'],
              kind,
              from: textValue(data, 'from'),
              toExclusive: textValue(data, 'toExclusive'),
              referenceDate: textValue(data, 'referenceDate'),
              activityId: textValue(data, 'activityId'),
              dateBasis:
                textValue(data, 'dateBasis') === 'RESOLUTION'
                  ? 'RESOLUTION'
                  : 'IDENTIFICATION',
            });
          }}
        >
          <fieldset
            disabled={action.pending}
            className="form-grid report-filters"
          >
            <SelectField
              label="Relatório"
              name="kind"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as Kind);
                setReport(null);
                setRecords(null);
              }}
            >
              {kinds.map((value) => (
                <option key={value} value={value}>
                  {value === 'reach'
                    ? 'Alcance'
                    : value === 'frequency'
                      ? 'Frequência'
                      : value === 'eligibility'
                        ? 'Aptidão'
                        : 'Qualidade cadastral'}
                </option>
              ))}
            </SelectField>
            {kind === 'eligibility' ? (
              <Field
                label="Data de referência"
                name="referenceDate"
                type="date"
                required
              />
            ) : (
              <>
                <Field
                  label="Início do período"
                  name="from"
                  type="date"
                  required
                />
                <Field
                  label="Fim do período (exclusivo)"
                  name="toExclusive"
                  type="date"
                  required
                />
              </>
            )}
            {(kind === 'reach' || kind === 'frequency') && (
              <AsyncView state={overview}>
                {(data) => (
                  <SelectField
                    label="Atividade"
                    name="activityId"
                    required={kind === 'frequency'}
                  >
                    <option value="">
                      {kind === 'reach'
                        ? 'Todas as atividades'
                        : 'Selecione atividade periódica'}
                    </option>
                    {data?.activities
                      .filter(
                        (activity) =>
                          kind !== 'frequency' ||
                          activity.nature === 'PERIODIC',
                      )
                      .map((activity) => (
                        <option key={activity.id} value={activity.id}>
                          {activity.name}
                        </option>
                      ))}
                  </SelectField>
                )}
              </AsyncView>
            )}
            {kind === 'reach' && (
              <AsyncView state={overview}>
                {(data) => (
                  <>
                    <SelectField label="Instituto" name="instituteId">
                      <option value="">Todos os institutos</option>
                      {data?.institutes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField label="Projeto" name="projectId">
                      <option value="">Todos os projetos</option>
                      {data?.projects.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </SelectField>
                  </>
                )}
              </AsyncView>
            )}
            {kind === 'frequency' && <ReportPartyFilter projects={projects} />}
            {(kind === 'frequency' || kind === 'eligibility') && (
              <ReportPartyFilter
                family
                projects={projects}
                registration={
                  capabilities.includes('registration.read')
                    ? registration
                    : undefined
                }
              />
            )}
            {kind === 'quality' && (
              <>
                <SelectField label="Tipo de pendência" name="qualityKind">
                  <option value="">Todos</option>
                  <option value="MISSING_DATA">Dados ausentes</option>
                  <option value="POSSIBLE_DUPLICATE">
                    Possível duplicidade
                  </option>
                </SelectField>
                <SelectField label="Situação da pendência" name="qualityStatus">
                  <option value="">Todas</option>
                  <option value="OPEN">Aberta</option>
                  <option value="RESOLVED">Resolvida</option>
                </SelectField>
              </>
            )}
            {kind === 'quality' && (
              <SelectField label="Data considerada" name="dateBasis">
                <option value="IDENTIFICATION">
                  Identificação da pendência
                </option>
                <option value="RESOLUTION">Resolução da pendência</option>
              </SelectField>
            )}
          </fieldset>
          <div className="form-actions">
            <button
              className="button primary"
              disabled={action.pending || !kinds.length}
            >
              {action.pending ? 'Consultando…' : 'Consultar relatório'}
            </button>
          </div>
        </form>
      </Panel>
      {action.error && <Alert error>{action.error}</Alert>}
      {report && query && (
        <Panel
          title={`Totais de ${query.kind === 'reach' ? 'alcance' : query.kind === 'frequency' ? 'frequência' : query.kind === 'eligibility' ? 'aptidão' : 'qualidade cadastral'}`}
        >
          <RecordValues value={report.filters} />
          <p>
            Gerado em {report.generatedAt}. Contagens e registros refletem
            correções e cancelamentos.
          </p>
          <RecordValues value={report.totals} />
          {query.kind === 'reach' ? (
            [
              ['PERSON', 'pessoas'],
              ['FAMILY', 'famílias'],
              ['SESSION', 'encontros'],
              ['PRESENCE', 'presenças'],
            ].map(([unit, label]) => (
              <button
                key={unit}
                className="button secondary"
                disabled={action.pending}
                onClick={() => {
                  void drilldown(unit!);
                }}
              >
                Ver {label}
              </button>
            ))
          ) : query.kind === 'frequency' ? (
            [
              ['OPPORTUNITY', 'oportunidades'],
              ['SESSION', 'encontros'],
            ].map(([unit, label]) => (
              <button
                key={unit}
                className="button secondary"
                disabled={action.pending}
                onClick={() => {
                  void drilldown(unit!);
                }}
              >
                Ver {label}
              </button>
            ))
          ) : query.kind === 'eligibility' ? (
            [
              ['ELIGIBLE', 'aptas'],
              ['INELIGIBLE', 'não aptas'],
              ['PENDING', 'pendentes'],
            ].map(([unit, label]) => (
              <button
                key={unit}
                className="button secondary"
                disabled={action.pending}
                onClick={() => {
                  void drilldown(unit!);
                }}
              >
                Ver famílias {label}
              </button>
            ))
          ) : (
            <button
              className="button secondary"
              disabled={action.pending}
              onClick={() => {
                void drilldown('ISSUE');
              }}
            >
              Ver pendências
            </button>
          )}
        </Panel>
      )}
      {records && detail && (
        <Panel title="Registros que compõem o total">
          <RecordList records={records.data} />
          <nav aria-label="Páginas do detalhe">
            <button
              className="button secondary"
              disabled={action.pending || detail.page === 1}
              onClick={() => {
                void drilldown(detail.unit, detail.page - 1);
              }}
            >
              Anterior
            </button>
            <span>
              Página {detail.page} · {records.pagination.total} registros
            </span>
            <button
              className="button secondary"
              disabled={
                action.pending ||
                detail.page * records.pagination.pageSize >=
                  records.pagination.total
              }
              onClick={() => {
                void drilldown(detail.unit, detail.page + 1);
              }}
            >
              Próxima
            </button>
          </nav>
        </Panel>
      )}
    </Page>
  );
}
