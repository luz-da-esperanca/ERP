import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@erp/contracts/access';
import type { ErpClient } from './erp-client';

interface ErpContextValue {
  client: ErpClient;
  session: Session | null;
  revision: number;
}
const ErpContext = createContext<ErpContextValue | null>(null);
export function ErpProvider({
  client,
  children,
}: {
  client: ErpClient;
  children: ReactNode;
}) {
  const revision = useSyncExternalStore(
    client.subscribe,
    client.getVersion,
    client.getVersion,
  );
  return (
    <ErpContext value={{ client, session: client.access.session(), revision }}>
      {children}
    </ErpContext>
  );
}
export function useErp() {
  const value = useContext(ErpContext);
  if (!value) throw new Error('ERP provider is required');
  return value;
}
