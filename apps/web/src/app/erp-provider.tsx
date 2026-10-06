import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@erp/contracts/access';
import type { ErpViewClient } from './erp-client';

interface ErpContextValue {
  client: ErpViewClient;
  session: Session | null;
  revision: number;
}
const ErpContext = createContext<ErpContextValue | null>(null);
export function ErpProvider({
  client,
  children,
  session,
}: {
  client: ErpViewClient;
  children: ReactNode;
  session?: Session;
}) {
  const revision = useSyncExternalStore(
    client.subscribe,
    client.getVersion,
    client.getVersion,
  );
  return (
    <ErpContext
      value={{
        client,
        session: session ?? client.access?.session() ?? null,
        revision,
      }}
    >
      {children}
    </ErpContext>
  );
}
export function useErp() {
  const value = useContext(ErpContext);
  if (!value) throw new Error('ERP provider is required');
  return value;
}
