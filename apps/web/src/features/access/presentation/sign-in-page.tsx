import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthentication } from '../../../app/authentication-provider';
import { Alert, textValue } from '../../../shared/ui';
import { authenticationError } from './authentication-error';

export function SignInPage() {
  const { authentication, state } = useAuthentication();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (state.status === 'authenticated')
    return (
      <Navigate
        to={state.session.user.mustChangePassword ? '/change-password' : '/'}
        replace
      />
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    try {
      await authentication.login({
        login: textValue(data, 'login'),
        password: textValue(data, 'password'),
      });
    } catch (cause) {
      setError(authenticationError(cause, 'login'));
    } finally {
      const password = form.elements.namedItem('password');
      if (password instanceof HTMLInputElement) password.value = '';
      setPending(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <img
          src="/logo-le.jpeg"
          alt="Luz da Esperança"
          className="login-logo"
        />
        <h1>Gestão Social</h1>
        {location.state?.passwordChanged === true && (
          <Alert>Senha alterada. Entre com a nova senha.</Alert>
        )}
        {error && (
          <p id="sign-in-error" className="message error" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={submit} className="login-form" aria-busy={pending}>
          <label className="field" htmlFor="login">
            Login <span aria-hidden="true">*</span>
            <input
              id="login"
              name="login"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={pending}
              aria-describedby={error ? 'sign-in-error' : undefined}
            />
          </label>
          <label className="field" htmlFor="password">
            Senha <span aria-hidden="true">*</span>
            <span className="password-field">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                disabled={pending}
                aria-describedby={error ? 'sign-in-error' : undefined}
              />
              <button
                type="button"
                className="password-toggle"
                disabled={pending}
                onClick={() => setShowPassword(!showPassword)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" size={19} />
                ) : (
                  <Eye aria-hidden="true" size={19} />
                )}
              </button>
            </span>
          </label>
          <button
            type="submit"
            className="button primary full-button"
            disabled={pending}
          >
            {pending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
