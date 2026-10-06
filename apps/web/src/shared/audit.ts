import type { AuditEntry } from '@erp/contracts/audit';

const auditActionLabels = {
  CREATE: 'Cadastro criado',
  UPDATE: 'Cadastro atualizado',
  CORRECT: 'Registro corrigido',
  MERGE: 'Cadastros unificados',
  CLOSE: 'Registro encerrado',
  CANCEL: 'Registro cancelado',
  PUBLISH: 'Registro publicado',
  ACTIVATE: 'Conta ativada',
  DEACTIVATE: 'Conta desativada',
} as const;

export function auditDescription(entry: AuditEntry) {
  return `${auditActionLabels[entry.action]} — ${entry.entityLabel}`;
}
