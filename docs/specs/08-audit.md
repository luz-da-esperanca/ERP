# SPEC-AUD — Auditoria, autoria e reconstrução histórica

Versão 1.0 · Dependências: [SPEC-CORE](00-foundation.md) e [SPEC-ACS](01-access.md). Fontes: PRD 1.1 OBJ-06, CAP-11, RN-08/09/15; ERS RF-ACS-04/05/06, AC-08/18 e RNF-SEG-04/06; modelagem §1.2 e D-10. Auditoria de leitura RF-ACS-07 é desejável e não faz parte desta entrega.

## 1. Responsabilidade

Reconstruir quem criou, alterou, corrigiu, encerrou, cancelou ou unificou cada registro relevante do MVP, quando e por quê, sem substituir a história pela situação atual. O módulo oferece escrita interna na transação de domínio e consulta autorizada. Não oferece API pública para criar, editar ou apagar eventos.

Abrange cadastro, vínculos, titulares, numerações, versões da ficha, institutos, projetos, atividades, inscrições, encontros, marcações, políticas, avaliações persistidas, contas/perfis e decisões de habilitação. Senhas e sessões não têm seu conteúdo auditado; troca/reset registram a ação, autor/alvo/data e motivo quando exigido, sem credenciais.

## 2. Contrato de persistência

`AuditEntry`: `id`, `operationId`, `entityType`, `entityId`, `revision`, `action`, `actorType`, `actorId?`, `recordedAt`, `occurredAt?`, `before`, `after`, `reason?`, `classification`. `operationId` referencia o `OperationRecord` da operação, inclusive correlação interna de troca de senha/bootstrap. `actorType=USER` exige `actorId` com FK à conta, preservada após desativação; `SYSTEM_BOOTSTRAP` exige `actorId=null`, somente para a primeira conta. Todos os comandos posteriores exigem conta identificada.

`action` usa `CREATE`, `UPDATE`, `CORRECT`, `CLOSE`, `CANCEL`, `MERGE`, `ACTIVATE`, `DEACTIVATE`, `PUBLISH`, `PASSWORD_CHANGE` ou `PASSWORD_RESET`, conforme a operação. `classification` identifica o domínio e blocos/campos sujeitos à projeção, sem conceder acesso por si só. `(entityType, entityId, revision)` é único e representa sempre a revisão de estado. Troca/reset de senha também incrementam a revisão da conta; não existe uma segunda sequência administrativa que possa colidir com `readRevision`.

Criação tem `before=null`; versão anterior e nova preservam os valores necessários para reconstrução. Valores ausentes mantêm `null`, e razões anteriores não são apagadas. Mudança temporal de vínculo pode produzir evento para o vínculo encerrado e para o aberto na mesma operação. Uma chamada pode produzir eventos do encontro e das marcações. Os eventos pertencem à mesma transação e operação, sem inventar ordem por relógios diferentes.

Eventos de `PASSWORD_CHANGE/RESET` preservam snapshots dos campos não secretos da conta, incluindo `mustChangePassword` e revisões, e metadado `{ passwordChanged: true }`; jamais senha, hash, salt, token, cookie, fingerprint de operação com senha ou configuração de chave. `readRevision` da conta reconstrói apenas estado não secreto, não credenciais anteriores. Logs de operação não são cópia do snapshot. `before/after` de blocos sensíveis seguem a proteção definida em SPEC-FIC.

Decisão técnica: estado corrente mutável mais revisões preservadas em auditoria, exceto entidades que a spec já define como versões imutáveis. O contrato interno `readRevision(entityType, entityId, revision)` reconstrói exatamente a revisão pedida, validando acesso aos campos. Referências de evidências e replay de operações apontam essas revisões. Para versões imutáveis, a referência aponta a própria versão.

## 3. Escrita atômica e correções

O contrato `appendAudit(transaction, entry)` usa a transação fornecida pelo módulo de origem; não abre outra transação nem grava por Redis. Falha de auditoria impede confirmar a mutação. Auditoria nunca é um efeito opcional após responder sucesso.

Correção, cancelamento, encerramento de vínculo, troca de titular, unificação e reset de senha exigem motivo não vazio. Cadastro inicial ou avaliação automática não inventa justificativa; ainda registra autor e data. Um no-op não incrementa revisão nem cria falsa alteração; replay idempotente não cria eventos adicionais.

`occurredAt` registra a referência do fato quando pertinente, e `recordedAt` usa o instante atual. Lançamento tardio não troca as datas. Alterar conteúdo de um evento anterior não é a forma de corrigir: a operação de domínio publica outro evento/revisão. Fatos cancelados ficam recuperáveis, com a causa e revisão do cancelamento.

## 4. Consulta e interface

| Rota | Filtros e saída |
| --- | --- |
| `GET /audit-entries` | `entityType`, `entityId?`, `actorId?`, `from?`, `to?`, `action?`, paginação; somente tipos de entidade que o usuário pode consultar |
| `GET /audit-entries/:entryId` | Evento e snapshots projetados; 404 se fora do universo autorizado |
| `GET /:resource/:id/revisions/:revision` | Contrato de leitura de revisão implementado pelo módulo proprietário, quando exposto por sua spec |

Filtros `from/to` são instantes para `recordedAt`, com fim exclusivo. Ordenação: `recordedAt desc`, `id desc`. A API retorna ação, autor identificável, datas e diferenças somente de campos permitidos. Um evento composto mostra apenas a parte autorizada; motivo livre só aparece se o operador pode ler todos os campos/blocos afetados, pois pode revelar a parte ocultada. Evento sem alteração visível autorizada é excluído antes da contagem/paginação, inclusive por detalhe/ID; não expor sua existência por metadados. A habilitação atual de blocos participa dessa projeção. Ser operador da alteração não concede acesso futuro se suas permissões forem removidas.

O detalhe do registro possui aba “Histórico de alterações”, com antes/depois autorizados, motivo e distinção entre data do fato e do lançamento. Usuário desativado aparece identificado como tal. A página `/audit` usa o mesmo filtro/projeção, sem abrir acesso irrestrito a snapshots pelo ID.

## 5. Guarda e proteção

Histórico não é retenção indefinida. Prazos e procedimento de eliminação pertencem a DEC-08/LAC-08 e devem abranger registros, revisões, auditoria, referências idempotentes, backup e dados de teste. O MVP não implementa botão de eliminação administrativa geral; a futura execução de política de guarda precisa preservar ou eliminar coerentemente as referências, com autorização específica.

Saúde e religião desabilitadas para coleta não devem ser recuperáveis por caminhos de auditoria que burlem a habilitação/proteção atual. Backup e leitura de revisões recebem o mesmo controle de acesso dos dados originais. O módulo não usa cópia em Redis como auditoria persistente.

## 6. Critérios de aceite

| ID | Dado / quando / resultado |
| --- | --- |
| AUD-AC01 | Ao cadastrar pessoa com vínculo, ambos têm autoria identificável na mesma operação; rollback não deixa evento órfão |
| AUD-AC02 | Ao corrigir presença com motivo, valor anterior, novo, autor e datas são reconstruídos (ERS AC-08) |
| AUD-AC03 | Ao lançar chamada dias depois, data do encontro e lançamento permanecem distintas (ERS AC-18) |
| AUD-AC04 | Ao desativar autor, seus eventos continuam com a mesma identidade |
| AUD-AC05 | Perfil de frequência tenta recuperar renda, saúde ou religião por ID/revisão/filtro: dados não são expostos |
| AUD-AC06 | Ao repetir comando ou enviar no-op, nenhuma nova revisão/evento de alteração é criado |
| AUD-AC07 | Uma falha de escrita de auditoria desfaz dados de negócio e idempotência, comprovada em PostgreSQL |
| AUD-AC08 | Uma evidência aponta revisão antiga; a leitura autorizada reconstrói aquela revisão, mesmo após correção posterior |
| AUD-AC09 | Criação, troca e reset de senha não deixam credenciais nos snapshots ou logs |
| AUD-AC10 | Motivo que pode revelar um bloco restrito é ocultado; evento sem diferença autorizada não aparece em contagem, lista ou detalhe |
| AUD-AC11 | Bootstrap tem autor de sistema explicitamente limitado; troca/reset usam revisões de conta sem colisão e correlação atômica |

Testes usam operações dos módulos e inspeção autorizada da auditoria, não chamadas artificiais que só reproduzam sua função interna.
