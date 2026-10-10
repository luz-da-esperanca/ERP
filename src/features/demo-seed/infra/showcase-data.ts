import { z } from 'zod';
import {
  duplicateCandidateSchema,
  familyDetailSchema,
  personDetailSchema,
} from '@erp/contracts/registration-api';
import {
  activityDetailSchema,
  institutesPageSchema,
  projectDetailSchema,
} from '@erp/contracts/projects-api';
import {
  attendanceContextSchema,
  coverageViewSchema,
  sessionDetailSchema,
} from '@erp/contracts/attendance-api';
import { socialFormContextSchema } from '@erp/contracts/social-forms-api';
import { civilBoundary } from '../../attendance/domain/frequency-rules.js';
import type { SeedClient } from './seed-client.js';

const dayOffset = (day: string, offset: number) =>
  new Date(Date.parse(day) + offset * 86400000).toISOString().slice(0, 10);

export async function seedShowcaseData(
  client: SeedClient,
  referenceDate: string,
  timeZone: string,
  responsibleId: string,
) {
  const day = (offset: number) => dayOffset(referenceDate, offset);
  const at = (offset: number) => civilBoundary(day(offset), timeZone);
  const families: string[] = [];
  const people: string[][] = [];
  const familyNames = [
    'Silva Santos',
    'Oliveira Costa',
    'Ferreira Lima',
    'Alves Pereira',
  ];
  const personNames = [
    ['Maria da Silva Santos', 'João Miguel da Silva Santos'],
    ['Ana Clara de Oliveira', 'Pedro Henrique Costa'],
    ['Antônia Ferreira Lima', 'Lucas Ferreira Lima'],
    ['Francisca Alves Pereira', 'Sofia Alves Pereira'],
  ];
  async function duplicateReview(query: URLSearchParams) {
    const candidates = await client.read(
      `/duplicate-candidates?${query}`,
      z.array(duplicateCandidateSchema),
    );
    return candidates.length
      ? {
          duplicateReview: {
            candidateIds: candidates.map((row) => row.id),
            decision: 'DISTINCT',
            reason:
              'Homônimos confirmados após triagem da assistência social. Pessoas distintas.',
          },
        }
      : {};
  }
  const addresses = [
    'Rua das Flores, 123, Casa 1',
    'Av. Brasil, 456, Bloco B',
    'Rua São José, 789',
    'Rua do Sol, 101, Apto 202',
  ];
  const neighborhoods = [
    'Centro',
    'Bairro Novo',
    'Vila Esperança',
    'Bairro da Paz',
  ];

  for (const [index, name] of familyNames.entries()) {
    const referenceName = `Família ${name}`;
    const address = addresses[index]!;
    const familyId = await client.entity(
      `family:${index}`,
      'Family',
      async () =>
        client.write(`family:${index}`, '/families', {
          referenceName,
          address,
          neighborhood: neighborhoods[index]!,
          location: 'URBAN',
          contactPhone: null,
          ...(await duplicateReview(
            new URLSearchParams({
              entityType: 'FAMILY',
              referenceName,
              address,
            }),
          )),
        }),
    );
    families.push(familyId);
    const members: string[] = [];
    for (const [memberIndex, name] of personNames[index]!.entries()) {
      const step = `person:${index}:${memberIndex}`;
      const personId = await client.entity(step, 'Person', async () => {
        const current = await client.read(
          `/families/${familyId}`,
          familyDetailSchema,
        );
        const birthDate =
          index === 3
            ? null
            : memberIndex === 0
              ? `198${index}-05-12`
              : `201${index}-08-20`;
        return client.write(step, '/people', {
          name,
          birthDate,
          familyId,
          expectedFamilyRevision: current.family.revision,
          validFrom: at(-45),
          isReference: memberIndex === 0,
          relationshipToReference: memberIndex === 0 ? null : 'Filho(a)',
        });
      });
      members.push(personId);
    }
    people.push(members);
  }
  await client.once('quality:selection', () =>
    client.write('quality:selection', '/registration-field-selections', {
      expectedVersion: null,
      personFields: ['birthDate'],
      familyFields: ['contactPhone'],
      decisionReference:
        'ATA-2025-01: Atualização dos campos obrigatórios para cadastro assistencial.',
    }),
  );
  await client.once('quality:duplicate', async () => {
    const { person } = await client.read(
      `/people/${people[3]![1]}`,
      personDetailSchema,
    );
    return client.write(
      'quality:duplicate',
      `/people/${person.id}`,
      { expectedRevision: person.revision, name: personNames[1]![0] },
      'PATCH',
    );
  });

  const institutes = await client.read(
    '/institutes?active=true',
    z.array(institutesPageSchema.shape.data.element),
  );
  const projects: string[] = [];
  for (const [index, name] of [
    'Fortalecimento de Vínculos',
    'Projeto Semeando o Futuro',
  ].entries()) {
    const institute = institutes.find(
      (row) => row.code === (index === 0 ? 'EDUCATION_FAMILY' : 'CHILD'),
    );
    if (!institute) throw new Error('Showcase institute catalog is missing');
    const step = `project:${index}`;
    projects.push(
      await client.entity(step, 'Project', () =>
        client.write(step, '/projects', {
          name,
          instituteId: institute.id,
          description:
            'Acompanhamento de famílias e desenvolvimento infantojuvenil.',
          startsOn: day(-45),
          endsOn: null,
        }),
      ),
    );
  }
  const serviceTypeId = await client.entity(
    'catalog:service-type',
    'ServiceType',
    () =>
      client.write('catalog:service-type', '/service-types', {
        code: 'DEMO_ACTION',
        name: 'Assistência Social',
      }),
  );
  const activities: string[] = [];
  for (const [index, name] of [
    'Oficina de Artesanato para Mães',
    'Reforço Escolar - Turma Manhã',
    'Entrega de Cestas Básicas',
  ].entries()) {
    const projectId = projects[index === 1 ? 1 : 0]!;
    const step = `activity:${index}`;
    activities.push(
      await client.entity(step, 'Activity', async () => {
        const current = await client.read(
          `/projects/${projectId}`,
          projectDetailSchema,
        );
        return client.write(step, `/projects/${projectId}/activities`, {
          expectedProjectRevision: current.project.revision,
          name,
          nature: index === 2 ? 'ONE_OFF' : 'PERIODIC',
          serviceTypeId: index === 2 ? serviceTypeId : null,
          responsibleId,
          plannedSchedule:
            index === 2 ? null : 'Quartas e sextas, período da manhã',
        });
      }),
    );
  }
  for (const [activityIndex, participants] of [
    people.slice(0, 3).flat(),
    [people[0]![1]!, people[2]![1]!],
  ].entries()) {
    const activityId = activities[activityIndex]!;
    for (const [index, personId] of participants.entries()) {
      const step = `enrollment:${activityIndex}:${index}`;
      await client.once(step, async () => {
        const current = await client.read(
          `/activities/${activityId}`,
          activityDetailSchema,
        );
        return client.write(step, `/activities/${activityId}/enrollments`, {
          expectedActivityRevision: current.activity.revision,
          personId,
          validFrom: at(-40),
          validUntil: null,
        });
      });
    }
  }
  for (let index = 0; index < 5; index++) {
    const activityId = activities[index === 4 ? 1 : 0]!;
    const step = `session:${index}`;
    const sessionId = await client.entity(step, 'ActivitySession', async () => {
      const occurredAt = new Date(
        Date.parse(at([-15, -10, -5, -3, -2][index]!)) + 12 * 3600000,
      ).toISOString();
      const preview = await client.read(
        `/activities/${activityId}/attendance-context?occurredAt=${encodeURIComponent(occurredAt)}`,
        attendanceContextSchema,
      );
      const entries = preview.rows.flatMap((row) => {
        if (index !== 3 && people[2]!.includes(row.personId)) return [];
        if (
          row.familyId === null ||
          row.expectedFamilyRevision === null ||
          row.membershipId === null ||
          row.expectedMembershipRevision === null
        )
          throw new Error('Showcase participant has no historical membership');
        return [
          {
            personId: row.personId,
            expectedPersonRevision: row.expectedPersonRevision,
            familyId: row.familyId,
            expectedFamilyRevision: row.expectedFamilyRevision,
            membershipId: row.membershipId,
            expectedMembershipRevision: row.expectedMembershipRevision,
            status:
              people[0]!.includes(row.personId) ||
              index === 3 ||
              (index === 1 && row.personId === people[1]![0])
                ? 'PRESENT'
                : 'ABSENT',
          },
        ];
      });
      return client.write(step, `/activities/${activityId}/sessions`, {
        occurredAt: preview.occurredAt,
        responsibleId,
        expectedActivityRevision: preview.expectedActivityRevision,
        expectedRosterFingerprint: preview.rosterFingerprint,
        entries,
      });
    });
    if (index === 3)
      await client.once('session:cancellation', async () => {
        const current = await client.read(
          `/sessions/${sessionId}`,
          sessionDetailSchema,
        );
        return client.write(
          'session:cancellation',
          `/sessions/${sessionId}/cancellation`,
          {
            expectedSessionRevision: current.session.revision,
            reason:
              'Encontro cancelado devido à forte chuva na região, impossibilitando o acesso ao local.',
          },
        );
      });
  }
  for (const [index, activityId] of activities.slice(0, 2).entries()) {
    const step = `coverage:${index}`;
    await client.once(step, async () => {
      const coverage = await client.read(
        `/activities/${activityId}/coverage?periodStart=${day(-29)}&periodEndExclusive=${day(1)}`,
        coverageViewSchema,
      );
      return client.write(
        step,
        `/activities/${activityId}/coverage-declarations`,
        {
          periodStart: coverage.periodStart,
          periodEndExclusive: coverage.periodEndExclusive,
          expectedActivityRevision: coverage.expectedActivityRevision,
          expectedSourceFingerprint: coverage.sourceFingerprint,
          confirmed: true,
          reason:
            'Diários de frequência conferidos e fechados pelo educador responsável no fim do mês.',
        },
      );
    });
  }
  await client.once('social:selection', () =>
    client.write('social:selection', '/social-form-field-selections', {
      expectedRevision: null,
      decisionReference: 'ATA-2025-02',
      reason:
        'Implementação do novo modelo de avaliação das condições de moradia.',
      fields: [
        {
          fieldKey: 'housing.roomCount',
          included: true,
          required: false,
          appliesTo: 'FAMILY',
          allowedRoleCodes: ['COORDINATION', 'SOCIAL_ASSISTANCE'],
          cardinality: 'SINGLE',
          purpose:
            'Avaliar a adequação do espaço físico para a quantidade de moradores.',
          decisionReference: 'ATA-2025-02',
        },
      ],
    }),
  );
  await client.once('social:housing', () =>
    client.write('social:housing', '/feature-decisions/FIC_HOUSING', {
      enabled: true,
      expectedRevision: null,
      decisionReference: 'ATA-2025-02',
      reason:
        'Acompanhamento das condições de moradia incorporado às entrevistas sociais deste ano.',
    }),
  );
  for (const [index, familyIndex] of [0, 0, 1].entries()) {
    const step = `social:form:${index}`;
    const familyId = families[familyIndex]!;
    await client.once(step, async () => {
      const context = await client.read(
        `/families/${familyId}/social-form-context?occurredAt=${encodeURIComponent(at([-20, -1, -10][index]!))}`,
        socialFormContextSchema,
      );
      return client.write(step, `/families/${familyId}/social-forms`, {
        occurredAt: context.occurredAt,
        expectedFamilyRevision: context.expectedFamilyRevision,
        expectedPreviousVersionId: context.expectedPreviousVersionId,
        fieldSelectionVersionId: context.fieldSelectionVersionId,
        memberRevisions: context.memberRevisions,
        blocks: { housing: { roomCount: index === 0 ? 2 : 3 } },
        members: [],
      });
    });
  }
  await client.once('eligibility:policy', () =>
    client.write('eligibility:policy', '/eligibility-policies', {
      definition: {
        schemaVersion: 1,
        period: { type: 'FIXED_PERIOD', start: day(-29), endExclusive: day(1) },
        minimum: { type: 'PRESENCE_COUNT', value: 2 },
        activityIds: [activities[0]],
        activityCombination: 'ANY_ACTIVITY',
        membershipScope: 'CURRENT_ON_REFERENCE',
        opportunityRule: 'ENROLLMENT_OR_RECORDED',
        justificationRule: 'NOT_SUPPORTED',
        recessRule: 'RECORDED_SESSIONS_ONLY',
        newParticipantRule: 'OPPORTUNITY_RULE',
        toleranceRule: 'NONE',
        incompleteEvidenceRule: 'THREE_VALUED',
      },
      effectiveFrom: day(-29),
      expectedLatestPolicyId: null,
      decisionReference: 'DIR-2025-03',
      reason:
        'Política emergencial de aptidão: exige participação mínima em duas atividades no último ciclo.',
      retroactive: true,
    }),
  );
  for (const [index, familyId] of families.entries())
    await client.once(`eligibility:assessment:${index}`, () =>
      client.write(
        `eligibility:assessment:${index}`,
        `/families/${familyId}/eligibility-assessments`,
        { referenceDate },
      ),
    );
  return {
    referenceDate,
    periodStart: day(-29),
    periodEndExclusive: day(1),
    familyIds: families,
    activityIds: activities,
  };
}
