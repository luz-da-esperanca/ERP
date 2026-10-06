import { expect, it } from 'vitest';
import { localDateTimeExact, toInstant } from '../../src/shared/time';
it('roundtrips historical timestamps without silently truncating seconds or milliseconds', () => {
  const original = '2026-10-05T12:34:56.789Z';
  expect(localDateTimeExact(original)).toBe('2026-10-05T09:34:56.789');
  expect(toInstant(localDateTimeExact(original))).toBe(original);
  expect(toInstant('2026-10-05T09:34')).toBe('2026-10-05T12:34:00.000Z');
});
