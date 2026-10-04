export const appTimezone = 'America/Fortaleza';
export const civilToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: appTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
export function addDays(value: string, count: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export const startOfDay = (date: string) => `${date}T00:00:00-03:00`;
export const localDateTime = (value: string) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: appTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(value))
    .replace(' ', 'T');
export const toInstant = (value: string) =>
  new Date(`${value}:00-03:00`).toISOString();
export const displayDate = (value: string | null) =>
  value ? value.split('-').reverse().join('/') : 'Não informado';
export const displayInstant = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: appTimezone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
export const isWithin = (instant: string, from: string, until: string | null) =>
  Date.parse(from) <= Date.parse(instant) &&
  (until === null || Date.parse(instant) < Date.parse(until));
