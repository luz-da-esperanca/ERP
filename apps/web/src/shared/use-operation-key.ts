import { useRef } from 'react';

export function useOperationKey() {
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  return (operation: string, body: unknown) => {
    const fingerprint = JSON.stringify({ operation, body });
    if (intent.current?.fingerprint !== fingerprint)
      intent.current = { fingerprint, key: crypto.randomUUID() };
    return intent.current.key;
  };
}
