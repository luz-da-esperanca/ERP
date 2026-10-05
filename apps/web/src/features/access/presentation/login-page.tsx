import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useErp } from '../../../app/erp-provider';

export function LoginPage() {
  const { client, session } = useErp();
  const navigate = useNavigate();
  const accounts = client.access.demoAccounts();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [showPassword, setShowPassword] = useState(false);
  if (session) return <Navigate to="/" replace />;

  function enterDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountId) return;
    client.access.enterDemo(accountId);
    navigate('/', { replace: true });
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
        <form onSubmit={enterDemo} className="login-form">
          <label className="field" htmlFor="demo-account">
            Conta de demonstração
            <select
              id="demo-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="demo-password">
            Senha
            <span className="password-field">
              <input
                id="demo-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Acesso simulado"
                readOnly
                value="demonstração"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
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
          <button className="button primary full-button" type="submit">
            Entrar
          </button>
        </form>
        <p className="login-note">
          <ShieldCheck aria-hidden="true" size={16} /> Dados sintéticos. O
          acesso real ainda não está conectado nesta interface.
        </p>
      </section>
    </main>
  );
}
