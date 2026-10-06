import { useRef, useState } from 'react';
import type { z } from 'zod';
import { duplicateReviewSchema } from '@erp/contracts/registration-api';
import type { DuplicateCandidate } from '../application/registration-gateway';

type Review = z.infer<typeof duplicateReviewSchema>;

export function useRegistrationIntent<T extends object>() {
  const [review, setReview] = useState<{
    input: string;
    candidates: DuplicateCandidate[];
  } | null>(null);
  const intent = useRef<{
    fingerprint: string;
    body: T & { duplicateReview?: Review };
    key: string;
  } | null>(null);

  async function prepare(
    input: T,
    form: FormData,
    check?: (input: T) => Promise<DuplicateCandidate[]>,
  ) {
    const reason = form.get('duplicateReason')?.toString().trim() ?? '';
    const confirmed = form.get('duplicateConfirmed') === 'on';
    const fingerprint = JSON.stringify({ input, reason, confirmed });
    // A lost response must replay the original body without discovering the record it may have created.
    if (intent.current?.fingerprint === fingerprint) return intent.current;
    const candidates = check
      ? review?.input === JSON.stringify(input)
        ? review.candidates
        : await check(input)
      : [];
    let duplicateReview: Review | undefined;
    if (candidates.length) {
      const ids = candidates.map((candidate) => candidate.id).sort();
      if (
        review?.input !== JSON.stringify(input) ||
        JSON.stringify(ids) !==
          JSON.stringify(
            review.candidates.map((candidate) => candidate.id).sort(),
          ) ||
        !confirmed
      ) {
        setReview({ input: JSON.stringify(input), candidates });
        return null;
      }
      duplicateReview = duplicateReviewSchema.parse({
        candidateIds: ids,
        decision: 'DISTINCT',
        reason,
      });
    }
    const body = { ...input, ...(duplicateReview ? { duplicateReview } : {}) };
    intent.current = { fingerprint, body, key: crypto.randomUUID() };
    return intent.current;
  }
  function reset() {
    intent.current = null;
    setReview(null);
  }
  return { prepare, review, reset };
}
