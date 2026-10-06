import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuthentication } from '../../../app/authentication-provider';
import { ApiRequestError } from '../../../shared/api-client';
import { Field, textValue } from '../../../shared/ui';
import { authenticationError } from './authentication-error';

export function ChangePasswordPage() {
  const { authentication, state } = useAuthentication();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  if (state.status !== 'authenticated') return <Navigate to="/login" replace />;
  const session = state.session;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || conflict) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = textValue(data, 'newPassword');
    if (newPassword !== textValue(data, 'confirmation')) {
      setError('A confirmação deve ser igual à nova senha.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await authentication.changePassword({
        expectedRevision: session.user.revision,
        currentPassword: textValue(data, 'currentPassword'),
        newPassword,
      });
      navigate('/login', { replace: true, state: { passwordChanged: true } });
    } catch (cause) {
      setConflict(
        cause instanceof ApiRequestError && cause.code === 'REVISION_CONFLICT',
      );
      setError(authenticationError(cause));
    } finally {
      form.reset();
      setPending(false);
    }
  }

  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await authentication.logout();
    } catch (cause) {
      setError(authenticationError(cause));
    } finally {
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
        <h1>Alterar senha</h1>
        {session.user.mustChangePassword && (
          <p>Troque sua senha para continuar.</p>
        )}
        <p id="password-policy">
          Use pelo menos 12 caracteres e até 72 bytes. Após salvar, entre
          novamente com a nova senha.
        </p>
        {error && (
          <p id="password-error" className="message error" role="alert">
            {error}
          </p>
        )}
        <form className="login-form" onSubmit={submit} aria-busy={pending}>
          <Field
            label="Senha atual"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending || conflict}
            aria-describedby={error ? 'password-error' : undefined}
          />
          <Field
            label="Nova senha"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending || conflict}
            aria-describedby={
              error ? 'password-policy password-error' : 'password-policy'
            }
          />
          <Field
            label="Confirmar nova senha"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            disabled={pending || conflict}
            aria-describedby={error ? 'password-error' : undefined}
          />
          <button
            className="button primary full-button"
            type="submit"
            disabled={pending || conflict}
          >
            {pending ? 'Aguarde…' : 'Salvar nova senha'}
          </button>
        </form>
        <button
          className="button secondary full-button"
          disabled={pending}
          onClick={() => {
            void logout();
          }}
        >
          {conflict ? 'Sair e entrar novamente' : 'Sair'}
        </button>
        {!session.user.mustChangePassword && (
          <Link to="/" className="text-link">
            Voltar
          </Link>
        )}
      </section>
    </main>
  );
}
