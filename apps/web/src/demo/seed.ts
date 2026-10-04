import type { DemoState } from './state';
import { addDays, civilToday, startOfDay } from '../shared/time';

export function createSeed(now: Date, id: () => string): DemoState {
  const today = civilToday(now);
  const start = startOfDay(addDays(today, -30));
  const yesterday = `${addDays(today, -1)}T14:00:00-03:00`;
  const accounts: DemoState['accounts'] = [
    {
      id: id(),
      login: 'demo.coordination',
      displayName: 'Coordenação · demonstração',
      roles: ['COORDINATION'],
      active: true,
      revision: 1,
    },
    {
      id: id(),
      login: 'demo.social',
      displayName: 'Assistência Social · demonstração',
      roles: ['SOCIAL_ASSISTANCE'],
      active: true,
      revision: 1,
    },
    {
      id: id(),
      login: 'demo.activity',
      displayName: 'Atividade · demonstração',
      roles: ['ACTIVITY_MANAGER'],
      active: true,
      revision: 1,
    },
    {
      id: id(),
      login: 'demo.admin',
      displayName: 'Administração · demonstração',
      roles: ['ADMINISTRATOR'],
      active: true,
      revision: 1,
    },
    {
      id: id(),
      login: 'demo.combined',
      displayName: 'Administração e Assistência · demonstração',
      roles: ['ADMINISTRATOR', 'SOCIAL_ASSISTANCE'],
      active: true,
      revision: 1,
    },
  ];
  const coordinator = accounts[0]!;
  const familyA = {
    id: id(),
    code: '1',
    referenceName: 'Família Ipê (fictícia)',
    address: null,
    neighborhood: 'Bairro de demonstração',
    postalCode: null,
    location: null,
    contactPhone: null,
    revision: 1,
    createdAt: start,
    updatedAt: start,
  };
  const familyB = {
    ...familyA,
    id: id(),
    code: '2',
    referenceName: 'Família Girassol (fictícia)',
    neighborhood: null,
  };
  const ana = {
    id: id(),
    name: 'Ana Exemplo',
    birthDate: null,
    sex: null,
    cpf: null,
    rg: null,
    occupation: null,
    educationLevel: null,
    contactPhone: null,
    revision: 1,
    updatedAt: start,
  };
  const pedro = { ...ana, id: id(), name: 'Pedro Exemplo' };
  const clara = { ...ana, id: id(), name: 'Clara Exemplo' };
  const anaMembership = {
    id: id(),
    personId: ana.id,
    familyId: familyA.id,
    relationshipToReference: null,
    isReference: true,
    validFrom: start,
    validUntil: null,
    revision: 1,
  };
  const memberships = [
    anaMembership,
    {
      ...anaMembership,
      id: id(),
      personId: pedro.id,
      isReference: false,
      relationshipToReference: 'Filho',
    },
    {
      ...anaMembership,
      id: id(),
      personId: clara.id,
      familyId: familyB.id,
      isReference: false,
    },
  ];
  const institutes = [
    'Criança',
    'Jovem',
    'Esclarecimento e Família',
    'Caridade',
    'Divulgação',
    'Mediunidade',
  ].map((name, index) => ({
    id: id(),
    code: [
      'CHILD',
      'YOUTH',
      'EDUCATION_FAMILY',
      'CHARITY',
      'COMMUNICATION',
      'MEDIUMSHIP',
    ][index]!,
    name,
    active: true,
  }));
  const project: DemoState['projects'][number] = {
    id: id(),
    name: 'Convivência (demonstração)',
    instituteId: institutes[2]!.id,
    description: 'Projeto fictício para explorar o cadastro e a chamada.',
    startsOn: null,
    endsOn: null,
    status: 'ACTIVE',
    closedAt: null,
    revision: 1,
  };
  const activity: DemoState['activities'][number] = {
    id: id(),
    projectId: project.id,
    name: 'Oficina de convivência',
    nature: 'PERIODIC',
    serviceTypeId: null,
    plannedSchedule: 'Horário a confirmar',
    status: 'ACTIVE',
    closedAt: null,
    revision: 1,
  };
  return {
    accounts,
    families: [familyA, familyB],
    people: [ana, pedro, clara],
    memberships,
    institutes,
    serviceTypes: [
      'Doação de itens',
      'Médico',
      'Psicológico',
      'Fisioterapia',
      'Visita domiciliar',
      'Outro',
    ].map((name) => ({ id: id(), name, active: true })),
    projects: [project],
    activities: [activity],
    enrollments: [ana, pedro].map((p) => ({
      id: id(),
      activityId: activity.id,
      personId: p.id,
      validFrom: start,
      validUntil: null,
      revision: 1,
    })),
    sessions: [
      {
        id: id(),
        activityId: activity.id,
        responsibleId: coordinator.id,
        occurredAt: yesterday,
        recordedAt: yesterday,
        recordedBy: coordinator.id,
        status: 'COMPLETED',
        entries: [
          {
            personId: ana.id,
            familyId: familyA.id,
            membershipId: anaMembership.id,
            status: 'PRESENT',
          },
        ],
        revision: 1,
      },
    ],
    socialForms: [],
    audit: [],
  };
}
