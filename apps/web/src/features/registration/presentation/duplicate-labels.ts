import { displayDate } from '../../../shared/time';
import type { RegistrationRecord } from '../application/data-quality-gateway';

const fieldLabels: Record<string, string> = {
  name: 'Nome',
  birthDate: 'Nascimento',
  sex: 'Sexo',
  cpf: 'CPF',
  rg: 'RG',
  occupation: 'Ocupação',
  educationLevel: 'Escolaridade',
  contactPhone: 'Telefone',
  referenceName: 'Nome de referência',
  address: 'Endereço',
  neighborhood: 'Bairro',
  postalCode: 'CEP',
  location: 'Localização',
  code: 'Código',
};
export const fieldLabel = (field: string) => fieldLabels[field] ?? field;
export function recordLabel(record: RegistrationRecord) {
  return 'name' in record
    ? `${record.name} · ${record.id}`
    : `Família ${record.code} · ${record.referenceName ?? 'Sem nome de referência'} · ${record.id}`;
}
export function recordFields(record: RegistrationRecord) {
  return Object.entries(record).filter(([key]) => key in fieldLabels);
}
export function fieldValue(value: unknown, field?: string) {
  if (
    (field === 'birthDate' || field === 'informedOn') &&
    typeof value === 'string'
  )
    return displayDate(value);
  if (value === null || value === undefined || value === '')
    return 'Não informado';
  if (value === 'URBAN') return 'Urbana';
  if (value === 'RURAL') return 'Rural';
  return String(value);
}
