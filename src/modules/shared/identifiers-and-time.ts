import { randomBytes } from 'node:crypto';
import { validationFailedError } from './errors.ts';

export function validateFactDate(value: string | undefined): void {
  if (value !== undefined && !isValidIsoCalendarDate(value)) {
    throw validationFailedError([{
      field: 'factDate', code: 'INVALID_FORMAT',
      message: 'A data do fato deve ser uma data de calendário válida no formato AAAA-MM-DD.',
    }]);
  }
}

const UUID_V4_OR_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Generates an RFC 9562 version 7 UUID with a 48-bit Unix epoch millisecond timestamp
 * followed by cryptographically random bits.
 */
export function generateUuidV7(nowMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  const timestamp = BigInt(Math.max(0, Math.trunc(nowMs)));

  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function isUuidV4OrV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_OR_V7_REGEX.test(value);
}

/**
 * Validates that a string is a real Gregorian calendar date in YYYY-MM-DD format (VAL-03).
 */
export function isValidIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE_REGEX.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Validates that a half-open period [startDate, endDate) has real calendar dates
 * and endDate > startDate when endDate is informed (VAL-04).
 */
export function isValidPeriod(startDate: string, endDate: string | null | undefined): boolean {
  if (!isValidIsoCalendarDate(startDate)) return false;
  if (endDate === null || endDate === undefined) return true;
  if (!isValidIsoCalendarDate(endDate)) return false;
  return startDate < endDate;
}

/**
 * Formats a Date into YYYY-MM-DD in the America/Sao_Paulo business time zone (ADR-0003).
 */
export function currentBusinessDateInSaoPaulo(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}
