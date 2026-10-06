import type { SocialFieldKey } from '@erp/contracts/social-form-fields';
import type { SocialOption } from './social-forms.js';

const catalogs: Partial<
  Record<SocialFieldKey, readonly (readonly [string, string])[]>
> = {
  'housing.housingTenure': [
    ['OWNED', 'Própria'],
    ['FINANCED', 'Financiada'],
    ['RENTED', 'Alugada'],
    ['PROVIDED', 'Cedida'],
    ['OTHER', 'Outros'],
  ],
  'housing.location': [
    ['URBAN', 'Urbana'],
    ['RURAL', 'Rural'],
  ],
  'housing.dwellingType': [
    ['HOUSE', 'Casa'],
    ['APARTMENT', 'Apartamento'],
    ['ROOM', 'Cômodo'],
    ['OTHER', 'Outro'],
  ],
  'housing.construction': [
    ['BRICK_PLASTERED', 'Tijolo com reboco'],
    ['BRICK_UNPLASTERED', 'Tijolo sem reboco'],
    ['WATTLE_PLASTERED', 'Taipa com reboco'],
    ['WATTLE_UNPLASTERED', 'Taipa sem reboco'],
  ],
  'housing.floorType': [
    ['CEMENT', 'Cimento'],
    ['CERAMIC', 'Cerâmica'],
    ['EARTH', 'Chão batido'],
    ['OTHER', 'Outro'],
  ],
  'housing.electricity': [
    ['BILL_PAID', 'Paga talão'],
    ['NONE', 'Não possui'],
    ['USED_UNPAID', 'Usa e não paga'],
    ['NEIGHBOR_PROVIDED', 'Cedida por vizinho'],
    ['IMPROVISED_METER', 'Contador improvisado'],
    ['SOLAR_PANEL', 'Placa solar'],
  ],
  'housing.waterSupply': [
    ['BILL_PAID', 'Paga talão'],
    ['UNPAID', 'Não paga'],
    ['CISTERN', 'Cisterna'],
    ['WATER_TRUCK', 'Carro-pipa'],
    ['RIVER', 'Rio'],
    ['WELL_SPRING', 'Poço/nascente'],
  ],
  'housing.waterTreatment': [
    ['FILTERED', 'Filtrada'],
    ['BOILED', 'Fervida'],
    ['CHLORINATED', 'Cloração'],
    ['UNTREATED', 'Sem tratamento'],
  ],
  'housing.sewage': [
    ['SEWER', 'Esgoto'],
    ['SEPTIC_TANK', 'Fossa séptica'],
    ['RUDIMENTARY_PIT', 'Fossa rudimentar'],
    ['OPEN_AIR', 'Céu aberto'],
    ['DIRECT_TO_RIVER', 'Direto para o rio'],
  ],
  'housing.wasteDisposal': [
    ['COLLECTED', 'Coletado'],
    ['BURNED_BURIED', 'Queimado/enterrado'],
    ['OPEN_AIR', 'Céu aberto'],
    ['OTHER', 'Outro'],
  ],
  'housing.transportation': [
    ['PUBLIC_TRANSPORT', 'Transporte público'],
    ['MOTORCYCLE_TAXI', 'Moto táxi'],
    ['BICYCLE', 'Bicicleta'],
    ['MOTORCYCLE_CAR', 'Moto/carro'],
  ],
  'housing.hygiene': [
    ['GOOD', 'Boa'],
    ['REGULAR', 'Regular'],
    ['POOR', 'Ruim'],
  ],
  'needs.declaredNeeds': [
    ['FOOD', 'Alimento'],
    ['CLOTHING', 'Vestuário'],
    ['FOOTWEAR', 'Calçado'],
    ['EMPLOYMENT', 'Emprego'],
    ['MEDICAL_SUPPORT', 'Médico'],
    ['OTHER', 'Outros'],
  ],
};
export const initialSocialOptions: Omit<SocialOption, 'id'>[] = Object.entries(
  catalogs,
).flatMap(([fieldKey, options]) =>
  options.map(([code, label]) => ({
    fieldKey: fieldKey as SocialFieldKey,
    code,
    label,
    active: true,
    isOther: code === 'OTHER',
    revision: 1,
  })),
);
