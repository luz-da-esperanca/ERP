import { ApplicationError } from '@erp/contracts/common';
import type { Activity, Project } from '@erp/contracts/projects';
import { civilToday } from '../../../shared/time';
export function validateActivityFact(
  activity: Activity,
  project: Project,
  occurredAt: string,
  now: string,
) {
  const civilDate = civilToday(new Date(occurredAt));
  if (activity.nature !== 'PERIODIC')
    throw new ApplicationError(
      'DOMAIN_CONFLICT',
      'Only periodic activities accept attendance',
    );
  if (
    Date.parse(occurredAt) > Date.parse(now) ||
    (activity.closedAt &&
      Date.parse(occurredAt) >= Date.parse(activity.closedAt)) ||
    (project.startsOn && civilDate < project.startsOn) ||
    (project.endsOn && civilDate > project.endsOn)
  )
    throw new ApplicationError(
      'DOMAIN_CONFLICT',
      'The event falls outside the activity validity period',
    );
}
