export const attendanceRuleMessages: Record<string, string> = {
  ROSTER_CHANGED:
    'Participantes ou vínculos mudaram. Atualize a prévia e revise a chamada antes de confirmar.',
  MARKING_CONTEXT_CHANGED:
    'O contexto da marcação mudou. Atualize a prévia e revise o vínculo na data do encontro.',
  MARKING_MISSING:
    'A marcação mudou desde a consulta. Atualize a prévia e revise a chamada.',
  PERSON_WITHOUT_MEMBERSHIP:
    'Regularize o vínculo familiar na data do encontro antes de marcar a pessoa.',
  PERIODIC_ACTIVITY_REQUIRED:
    'Somente atividades periódicas aceitam encontros e chamada.',
  FUTURE_SESSION: 'A data do encontro não pode estar no futuro.',
  SESSION_OUTSIDE_VALIDITY:
    'O encontro deve estar dentro da vigência do projeto e antes do encerramento da atividade.',
  SESSION_CANCELED:
    'O encontro foi cancelado. Atualize a consulta para ver o histórico.',
};
