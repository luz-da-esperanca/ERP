import { useState, type FormEvent } from 'react';
import type { AuthService, AuthSession } from './auth-state.ts';

interface FieldErrors {
  readonly loginIdentifier?: string;
  readonly password?: string;
}

interface LoginFormProps {
  readonly authService?: AuthService;
  readonly recoveryMessage?: string;
  readonly onAuthenticated: (session: AuthSession) => void;
}

function validateCredentials(loginIdentifier: string, password: string): FieldErrors {
  const normalizedLogin = loginIdentifier.trim();
  const loginError = normalizedLogin.length === 0
    ? 'Informe seu identificador de acesso.'
    : normalizedLogin.length < 3 || normalizedLogin.length > 120
      ? 'Informe um identificador entre 3 e 120 caracteres.'
      : undefined;
  const passwordError = password.length === 0
    ? 'Informe sua senha.'
    : password.length > 128
      ? 'A senha deve ter no máximo 128 caracteres.'
      : undefined;

  return {
    ...(loginError === undefined ? {} : { loginIdentifier: loginError }),
    ...(passwordError === undefined ? {} : { password: passwordError }),
  };
}

export function LoginForm({ authService, recoveryMessage, onAuthenticated }: LoginFormProps) {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateCredentials(loginIdentifier, password);
    setFieldErrors(errors);
    setSubmissionError(null);

    if (errors.loginIdentifier !== undefined || errors.password !== undefined) return;

    if (authService === undefined) {
      setSubmissionError('Não foi possível acessar o sistema. Tente novamente em instantes.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authService.signIn({ loginIdentifier, password });
      if (result.status === 'authenticated') {
        setIsSubmitting(false);
        onAuthenticated(result.session);
        return;
      }

      setSubmissionError(
        result.status === 'invalid-credentials'
          ? 'Não foi possível acessar com os dados informados. Confira e tente novamente.'
          : 'Não foi possível acessar o sistema. Tente novamente em instantes.',
      );
    } catch {
      setSubmissionError('Não foi possível acessar o sistema. Tente novamente em instantes.');
    }

    setIsSubmitting(false);
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <img className="login-logo" src="/logo-le.jpeg" alt="Luz da Esperança" />
        <h1 id="login-title">Acessar sistema</h1>
        <p className="login-introduction">Informe seu identificador de acesso e sua senha.</p>
        <form className="login-form" noValidate aria-busy={isSubmitting} onSubmit={submit}>
          <div className="login-field">
            <label htmlFor="login-identifier">Identificador de acesso</label>
            <input
              id="login-identifier"
              name="loginIdentifier"
              type="text"
              autoComplete="username"
              minLength={3}
              maxLength={120}
              required
              disabled={isSubmitting}
              aria-invalid={fieldErrors.loginIdentifier !== undefined}
              aria-describedby={fieldErrors.loginIdentifier === undefined ? undefined : 'login-identifier-error'}
              value={loginIdentifier}
              onChange={(event) => {
                setLoginIdentifier(event.target.value);
                setFieldErrors({});
              }}
            />
            {fieldErrors.loginIdentifier === undefined ? null : (
              <span id="login-identifier-error" className="login-field-error" role="alert">{fieldErrors.loginIdentifier}</span>
            )}
          </div>
          <div className="login-field">
            <label htmlFor="password">Senha</label>
            <div className="password-field">
              <input
                id="password"
                name="password"
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="current-password"
                maxLength={128}
                required
                disabled={isSubmitting}
                aria-invalid={fieldErrors.password !== undefined}
                aria-describedby={fieldErrors.password === undefined ? undefined : 'password-error'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors({});
                }}
              />
              <button
                type="button"
                className="password-toggle"
                disabled={isSubmitting}
                aria-label={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={isPasswordVisible}
                onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
              >
                {isPasswordVisible ? <HiddenPasswordIcon /> : <VisiblePasswordIcon />}
              </button>
            </div>
            {fieldErrors.password === undefined ? null : (
              <span id="password-error" className="login-field-error" role="alert">{fieldErrors.password}</span>
            )}
          </div>
          {(submissionError ?? recoveryMessage) === undefined ? null : (
            <p className="login-message login-message-error" role="alert">{submissionError ?? recoveryMessage}</p>
          )}
          <button className="login-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

function VisiblePasswordIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function HiddenPasswordIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 3 18 18" />
      <path d="M10.6 6.1A11.5 11.5 0 0 1 12 6c6.5 0 10 6 10 6a17.5 17.5 0 0 1-3.1 3.8" />
      <path d="M6.2 6.2A17.4 17.4 0 0 0 2 12s3.5 6 10 6c1.4 0 2.6-.3 3.7-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
