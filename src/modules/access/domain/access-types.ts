import { validationFailedError, type FieldValidationError } from '../../shared/errors.ts';

export const ACCESS_PROFILES = [
  'COORDINATOR',
  'SOCIAL_ASSISTANCE',
  'PERIODIC_ACTIVITY',
  'POINT_IN_TIME_SERVICE',
  'STOCK_DISTRIBUTION',
  'BAZAR',
  'ADMIN',
] as const;

export type AccessProfile = (typeof ACCESS_PROFILES)[number];

export type UserStatus = 'ACTIVE' | 'DEACTIVATED';

export interface UserRecord {
  readonly id: string;
  readonly login: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly status: UserStatus;
  readonly profiles: readonly AccessProfile[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deactivatedAt: string | null;
}

export interface UserView {
  readonly id: string;
  readonly loginIdentifier: string;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly profiles: readonly AccessProfile[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deactivatedAt: string | null;
}

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly issuedAt: string;
  readonly lastActivityAt: string;
  readonly idleExpiresAt: string;
  readonly revokedAt: string | null;
}

export interface LoginAttemptStateRecord {
  readonly login: string;
  readonly failedAttempts: number;
  readonly lockedUntil: string | null;
  readonly updatedAt: string;
}

export interface SecurityPolicyConfig {
  readonly maxFailedLoginAttempts: number;
  readonly lockoutDurationSeconds: number;
  readonly sessionIdleTimeoutSeconds: number;
}

export const DEFAULT_SECURITY_POLICY_CONFIG: SecurityPolicyConfig = {
  maxFailedLoginAttempts: 5,
  lockoutDurationSeconds: 900,
  sessionIdleTimeoutSeconds: 1800,
};

const VALID_PROFILES_SET = new Set<string>(ACCESS_PROFILES);

export function validateLoginFields(input: { readonly login: unknown; readonly password: unknown }): {
  readonly normalizedLogin: string; readonly password: string;
} {
  const normalizedLogin = normalizeLoginIdentifier(input.login);
  const password = typeof input.password === 'string' ? input.password : '';
  const errors: FieldValidationError[] = [];
  if (normalizedLogin.length < 3 || normalizedLogin.length > 120 || /\s/.test(normalizedLogin)) {
    errors.push({ field: 'loginIdentifier', code: 'INVALID_FORMAT', message: 'O identificador de login deve ter entre 3 e 120 caracteres sem espaços internos.' });
  }
  if (password.length === 0 || password.length > 128) {
    errors.push({ field: 'password', code: 'INVALID_LENGTH', message: 'Informe uma senha de acesso com no máximo 128 caracteres.' });
  }
  if (errors.length) throw validationFailedError(errors);
  return { normalizedLogin, password };
}

/**
 * Normalizes a login identifier by trimming outer whitespace and lowercasing (VAL-11).
 */
export function normalizeLoginIdentifier(rawLogin: unknown): string {
  if (typeof rawLogin !== 'string') return '';
  return rawLogin.trim().toLowerCase();
}

export function toUserView(record: UserRecord): UserView {
  return {
    id: record.id,
    loginIdentifier: record.login,
    displayName: record.displayName,
    status: record.status,
    profiles: [...record.profiles],
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deactivatedAt: record.deactivatedAt,
  };
}

export function validateProfilesList(
  rawProfiles: unknown,
  field = 'profiles',
): readonly AccessProfile[] {
  if (!Array.isArray(rawProfiles) || rawProfiles.length === 0) {
    throw validationFailedError([
      {
        field,
        code: 'REQUIRED_FIELD',
        message: 'Informe ao menos um perfil de acesso válido para o usuário.',
      },
    ]);
  }

  const seen = new Set<AccessProfile>();
  const errors: FieldValidationError[] = [];

  for (const item of rawProfiles) {
    if (typeof item !== 'string' || !VALID_PROFILES_SET.has(item)) {
      errors.push({
        field,
        code: 'INVALID_ENUM',
        message: 'Um ou mais perfis de acesso informados não são reconhecidos.',
      });
      break;
    }
    const profile = item as AccessProfile;
    if (seen.has(profile)) {
      errors.push({
        field,
        code: 'DUPLICATE_VALUE',
        message: 'A lista de perfis não deve conter perfis duplicados.',
      });
      break;
    }
    seen.add(profile);
  }

  if (errors.length > 0) {
    throw validationFailedError(errors);
  }

  return [...seen];
}

export function validateUserCreationFields(input: {
  readonly login: unknown;
  readonly displayName: unknown;
  readonly password: unknown;
  readonly profiles: unknown;
}): {
  readonly normalizedLogin: string;
  readonly displayName: string;
  readonly password: string;
  readonly profiles: readonly AccessProfile[];
} {
  const errors: FieldValidationError[] = [];
  const normalizedLogin = normalizeLoginIdentifier(input.login);
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (normalizedLogin.length < 3 || normalizedLogin.length > 120 || /\s/.test(normalizedLogin)) {
    errors.push({
      field: 'loginIdentifier',
      code: 'INVALID_FORMAT',
      message: 'O identificador de login deve ter entre 3 e 120 caracteres sem espaços internos.',
    });
  }

  if (displayName.length < 2 || displayName.length > 150) {
    errors.push({
      field: 'displayName',
      code: 'INVALID_LENGTH',
      message: 'O nome de exibição é obrigatório e deve ter entre 2 e 150 caracteres.',
    });
  }

  // VAL-11 / VAL-12: Passwords are never trimmed or normalized
  if (password.length < 8 || password.length > 128) {
    errors.push({
      field: 'password',
      code: 'INVALID_LENGTH',
      message: 'A senha deve possuir entre 8 e 128 caracteres.',
    });
  }

  let profiles: readonly AccessProfile[] = [];
  try {
    profiles = validateProfilesList(input.profiles, 'profiles');
  } catch (err) {
    if (err instanceof Error && 'errors' in err && Array.isArray(err.errors)) {
      errors.push(...(err.errors as FieldValidationError[]));
    }
  }

  if (errors.length > 0) {
    throw validationFailedError(errors);
  }

  return {
    normalizedLogin,
    displayName,
    password,
    profiles,
  };
}
