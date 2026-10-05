export class DependencyUnavailableError extends Error {
  constructor() {
    super('Required dependency unavailable');
  }
}

export class ResourceNotFoundError extends Error {
  constructor() {
    super('Resource not found');
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was used with different content or author');
  }
}

export class FeatureNotEnabledError extends Error {
  constructor() {
    super('Real personal data requires an institutional decision');
  }
}
