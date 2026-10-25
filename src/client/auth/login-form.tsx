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
    <main>
      <h1>Acessar sistema</h1>
      <form noValidate aria-busy={isSubmitting} onSubmit={submit}>
        <p>Informe seu identificador de acesso e sua senha.</p>
        <p>
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
            <span id="login-identifier-error" role="alert">{fieldErrors.loginIdentifier}</span>
          )}
        </p>
        <p>
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
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
          {fieldErrors.password === undefined ? null : (
            <span id="password-error" role="alert">{fieldErrors.password}</span>
          )}
        </p>
        {(submissionError ?? recoveryMessage) === undefined ? null : <p role="alert">{submissionError ?? recoveryMessage}</p>}
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
