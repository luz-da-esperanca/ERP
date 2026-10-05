export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Authentication required');
  }
}

export class LoginBlockedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Login temporarily blocked');
  }
}
