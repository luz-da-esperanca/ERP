import { describe, expect, it } from 'vitest';
import {
  identifyDuplicateCandidates,
  assertDuplicateReview,
} from '../../../../src/features/registration/domain/duplicate-rules.js';

describe('Duplicate candidate signals', () => {
  it('requires the exact candidate set again when a reviewed search becomes stale', () => {
    const candidate = {
      id: 'first',
      entityType: 'PERSON' as const,
      reasons: ['CPF_MATCH' as const],
    };
    const review = {
      candidateIds: ['first'],
      decision: 'DISTINCT' as const,
      reason: 'Synthetic namesakes',
    };
    expect(() => assertDuplicateReview([candidate])).toThrow(
      expect.objectContaining({ rule: 'DUPLICATE_REVIEW_REQUIRED' }),
    );
    expect(() => assertDuplicateReview([candidate], review)).not.toThrow();
    expect(() =>
      assertDuplicateReview(
        [candidate, { ...candidate, id: 'new-candidate' }],
        review,
      ),
    ).toThrow(expect.objectContaining({ rule: 'DUPLICATE_REVIEW_CHANGED' }));
    expect(() => assertDuplicateReview([], review)).toThrow(
      expect.objectContaining({ rule: 'DUPLICATE_REVIEW_CHANGED' }),
    );
  });
  it('orders document matches before name and birth matches without treating them as the same identity', () => {
    const record = { entityType: 'PERSON' as const, address: null };
    expect(
      identifyDuplicateCandidates(
        [
          {
            ...record,
            id: 'a',
            name: 'Ana Sintética',
            birthDate: null,
            cpf: null,
          },
          {
            ...record,
            id: 'b',
            name: 'Ana Sintética',
            birthDate: '2000-01-01',
            cpf: null,
          },
          {
            ...record,
            id: 'c',
            name: 'Different Person',
            birthDate: null,
            cpf: '12345678900',
          },
        ],
        {
          entityType: 'PERSON',
          name: 'Ana Sintetica',
          birthDate: '2000-01-01',
          cpf: '12345678900',
        },
      ),
    ).toEqual([
      { id: 'c', entityType: 'PERSON', reasons: ['CPF_MATCH'] },
      {
        id: 'b',
        entityType: 'PERSON',
        reasons: ['NAME_BIRTH_MATCH', 'NAME_SIMILAR'],
      },
      { id: 'a', entityType: 'PERSON', reasons: ['NAME_SIMILAR'] },
    ]);
  });
});
