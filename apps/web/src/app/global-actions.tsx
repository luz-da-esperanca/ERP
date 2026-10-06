import { useEffect, useRef, useState } from 'react';
import { Bell, CircleHelp, X } from 'lucide-react';
import { Empty } from '../shared/ui';

type GlobalPanel = 'help' | 'notifications';

export function GlobalActions() {
  const [panel, setPanel] = useState<GlobalPanel | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!panel) return;
    function dismissOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setPanel(null);
      }
    }
    function dismissWithEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setPanel(null);
      const trigger =
        panel === 'help' ? helpTriggerRef : notificationsTriggerRef;
      trigger.current?.focus();
    }
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissWithEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissWithEscape);
    };
  }, [panel]);

  function closePanel() {
    setPanel(null);
    const trigger = panel === 'help' ? helpTriggerRef : notificationsTriggerRef;
    trigger.current?.focus();
  }

  return (
    <div
      className="global-actions"
      ref={containerRef}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setPanel(null);
      }}
    >
      <button
        ref={helpTriggerRef}
        type="button"
        className="icon-button global-action"
        aria-label="Ajuda"
        title="Ajuda"
        aria-expanded={panel === 'help'}
        aria-controls="global-help-panel"
        onClick={() => setPanel(panel === 'help' ? null : 'help')}
      >
        <CircleHelp size={20} aria-hidden="true" />
      </button>
      <button
        ref={notificationsTriggerRef}
        type="button"
        className="icon-button global-action"
        aria-label="Notificações"
        title="Notificações"
        aria-expanded={panel === 'notifications'}
        aria-controls="global-notifications-panel"
        onClick={() =>
          setPanel(panel === 'notifications' ? null : 'notifications')
        }
      >
        <Bell size={20} aria-hidden="true" />
      </button>
      {panel === 'notifications' && (
        <section
          className="global-action-panel"
          id="global-notifications-panel"
          aria-labelledby="global-notifications-title"
        >
          <div className="global-action-heading">
            <h2 id="global-notifications-title">Notificações</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar notificações"
              onClick={closePanel}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <Empty>As notificações ainda não estão disponíveis.</Empty>
        </section>
      )}
      {panel === 'help' && (
        <section
          className="global-action-panel"
          id="global-help-panel"
          aria-labelledby="global-help-title"
        >
          <div className="global-action-heading">
            <h2 id="global-help-title">Ajuda</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar ajuda"
              onClick={closePanel}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <details>
            <summary tabIndex={0}>Como buscar uma pessoa ou família?</summary>
            <p>
              Use a busca no topo da tela. Digite pelo menos dois caracteres do
              nome ou informe o código da família para encontrar o cadastro.
            </p>
          </details>
          <details>
            <summary tabIndex={0}>Onde consultar os cadastros?</summary>
            <p>
              Abra Pessoas e famílias no menu e selecione uma família para
              consultar seus dados e membros.
            </p>
          </details>
          <details>
            <summary tabIndex={0}>
              Onde encontrar projetos e atividades?
            </summary>
            <p>
              Abra Projetos e atividades no menu para consultar os projetos e
              suas atividades.
            </p>
          </details>
          <details>
            <summary tabIndex={0}>Por que uma opção não aparece?</summary>
            <p>
              As opções disponíveis dependem das permissões da sua conta. Se
              precisar de acesso, procure a coordenação.
            </p>
          </details>
        </section>
      )}
    </div>
  );
}
