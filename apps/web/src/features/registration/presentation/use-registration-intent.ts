import { useRef, useState } from 'react';
import { z } from 'zod';
import { ApiRequestError } from '../../../shared/api-client';
import { duplicateReviewSchema } from '@erp/contracts/registration-api';
import type { DuplicateCandidate } from '../application/registration-gateway';

type Review = z.infer<typeof duplicateReviewSchema>;

export function useRegistrationIntent<T extends object>(
  entityType: 'PERSON' | 'FAMILY' = 'FAMILY',
) {
  const [review, setReview] = useState<{
    input: string;
    candidates: DuplicateCandidate[];
  } | null>(null);
  const intent = useRef<{
    fingerprint: string;
    input: T;
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
    intent.current = { fingerprint, input, body, key: crypto.randomUUID() };
    return intent.current;
  }
  function captureRejectedReview(error: unknown) {
    if (
      !canRefreshDuplicateReview(error) ||
      !intent.current ||
      !(error instanceof ApiRequestError)
    )
      return;
    const result = z
      .object({ ids: z.array(z.uuid()).min(1) })
      .safeParse(error.details);
    if (!result.success) return;
    setReview({
      input: JSON.stringify(intent.current.input),
      candidates: result.data.ids.map((id) => ({
        id,
        entityType,
        reasons: [],
      })),
    });
    intent.current = null;
  }
  function reset() {
    intent.current = null;
    setReview(null);
  }
  return { prepare, review, reset, captureRejectedReview };
}

export function canRefreshDuplicateReview(error: unknown) {
  const metadata = z
    .object({
      rule: z.enum(['DUPLICATE_REVIEW_REQUIRED', 'DUPLICATE_REVIEW_CHANGED']),
    })
    .safeParse(error instanceof ApiRequestError ? error.details : null);
  return (
    error instanceof ApiRequestError &&
    error.status === 409 &&
    error.code === 'DOMAIN_CONFLICT' &&
    metadata.success
  );
}
