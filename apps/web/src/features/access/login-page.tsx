import { Navigate, useNavigate } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { useErp } from '../../app/erp-provider';
import { roleLabels } from './role-labels';
export function LoginPage() {
  const { client, session } = useErp();
  const navigate = useNavigate();
  if (session) return <Navigate to="/" replace />;
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark">L</div>
        <span className="eyebrow">ERP Social</span>
        <h1>Luz da Esperança</h1>
        <p>
          Escolha uma conta fictícia para explorar os fluxos e as permissões.
        </p>
        <p className="message">
          Demonstração com dados sintéticos. Os registros ficam em memória e são
          reiniciados ao recarregar a página. Este acesso não autentica contas
          reais.
        </p>
        <div className="demo-accounts">
          {client.access.demoAccounts().map((account) => (
            <button
              className="demo-account"
              key={account.id}
              onClick={() => {
                client.access.enterDemo(account.id);
                navigate('/', { replace: true });
              }}
            >
              <ShieldCheck size={22} />
              <span>
                <strong>{account.displayName}</strong>
                <small>
                  {account.roles.map((role) => roleLabels[role]).join(' + ')}
                </small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
