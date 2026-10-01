# SPEC-CORE — Contratos comuns do MVP

Versão 1.0 · Base: PRD 1.1, ERS 1.0, modelagem 1.1 e recorte do [AGENTS.md](../../AGENTS.md).

## 1. Objetivo e autoridade

Esta especificação define os contratos técnicos compartilhados. O comportamento de cada módulo pertence à sua spec; políticas institucionais pertencem ao PRD e às decisões DEC/LAC. Uma capacidade estar pronta para desenvolvimento não libera seu uso com dados reais. As decisões técnicas abaixo são propostas de implementação para a stack escolhida, não afirmações extraídas do levantamento.

Fontes: [PRD §9.2](../PRD-ERP-Luz-da-Esperanca-v1.1.md), [ERS §§3.1, 3.4–3.6](<../ERS — ERP Social Luz da Esperança.md>) e [modelagem §1.2, D-10](../MODELAGEM-DO-SISTEMA.md).

## 2. Organização e responsabilidades

Monorepo TypeScript, com `apps/web`, `apps/api` e `packages/contracts`. O frontend é uma SPA React, Tailwind CSS e React Router em modo declarativo. O backend é uma única aplicação Fastify organizada em módulos `access`, `registration`, `socialForms`, `projects`, `attendance`, `eligibility`, `reports` e `audit`. PostgreSQL e Prisma concentram a persistência. Redis mantém sessões e controles temporários de autenticação; não mantém cadastros, trilha de auditoria ou a única cópia de uma política.

`packages/contracts` exporta schemas Zod de entrada e DTOs de saída, tipos e códigos de erro. Não exporta entidades Prisma, acesso ao banco, hashes, chaves nem implementações de autorização. Cada módulo do backend expõe operações de aplicação; as rotas tratam HTTP e validação, e as operações tratam transação, autorização e regras. Consultas entre módulos usam seus contratos ou projeções de leitura do monólito, sem chamadas HTTP internas.

As specs não exigem interfaces de repositório por entidade, filas, event sourcing ou serviços independentes. A trilha de auditoria exigida não é um barramento de eventos.

Gerenciador proposto: pnpm workspaces. A implementação inicial deve fixar versões compatíveis de Node.js e dependências, e registrar scripts reais no README da aplicação. Os comandos desta seção descrevem entregáveis a criar, não comandos disponíveis hoje: `dev`, `build`, `typecheck`, `lint`, `test`, `test:integration`, `db:migrate` e `db:seed`. `test:integration` usa Vitest com PostgreSQL e Redis próprios de teste; nenhum teste pode depender de dados reais.

## 3. Tipos, limites e datas

| Contrato | Definição |
| --- | --- |
| `Id` | UUID; gerado no backend, salvo nas chaves de idempotência geradas pelo cliente |
| `Revision` | Inteiro positivo; criação inicia em 1; alteração efetiva incrementa em 1 |
| `CivilDate` | String `YYYY-MM-DD` válida, persistida como `date`; não converter em data local do navegador |
| `Instant` | RFC 3339 com offset obrigatório; normalizado em UTC e persistido como `timestamptz` |
| `Money` | Decimal não negativo enviado como string com até duas casas; PostgreSQL `numeric(14,2)`; nunca ponto flutuante para renda |
| Nome ou título | Texto após trim, de 1 a 200 caracteres |
| Código de família | Gerado por sequência PostgreSQL, exibido como string; único e imutável; lacunas numéricas são permitidas |
| Texto livre | Até 4.000 caracteres; sem conteúdo interpretado como HTML |
| Motivo | Texto após trim, de 1 a 1.000 caracteres, obrigatório nas operações indicadas pela spec |
| Pesquisa textual | Até 200 caracteres; mínimo 2 para busca por nome/endereço; IDs, código e documentos têm busca exata |

Os limites são decisões técnicas para validação, não critérios de acesso à assistência. Dados opcionais ausentes são `null` nas saídas; em PATCH, campo omitido preserva o valor, `null` remove um valor opcional e string vazia é normalizada em `null` apenas para campos opcionais. Booleano ausente permanece `null`. Entradas Zod rejeitam chaves desconhecidas; campos sem permissão não são aceitos silenciosamente.

`APP_TIMEZONE` define o fuso civil da instituição; o exemplo de desenvolvimento é `America/Fortaleza`. A configuração é única para backend e frontend. Datas são exibidas em `dd/mm/aaaa` e moeda em BRL. Os intervalos temporais usam `[início, fim)`, com fim `null` para vigência aberta. A conversão entre dia civil e instante deve usar esse fuso, inclusive em testes de limites.

`occurredAt` é a data/instante informado do fato; `recordedAt` é o instante do servidor; `recordedBy` vem da sessão autenticada. O cliente não define os dois últimos. Fatos realizados não podem estar no futuro. Uma consulta histórica sempre informa a data ou período a que se refere; a interpretação dos membros para aptidão está em SPEC-APT.

## 4. HTTP e contratos de saída

Prefixo da API: `/api/v1`. JSON UTF-8 em camelCase; enums e códigos técnicos em inglês. Textos da interface são traduzidos no frontend. Sucesso com recurso: `{ data: ... }`. Listas: `{ data: [...], pagination: { page, pageSize, total } }`. Paginação começa em 1, usa 20 itens por padrão e no máximo 100; ordenação estável sempre desempata por `id`. Filtros e ordenações aceitam apenas os campos expressamente definidos pela rota.

Erros: `{ error: { code, message, details?, requestId } }`. `message` é uma mensagem técnica em inglês; o frontend traduz o código e os campos em orientações pt-BR. `details` contém somente metadados autorizados, sem SQL, stack, valores pessoais indevidos ou payload integral. Não renderizar `message` diretamente como texto institucional.

| HTTP / código | Situação |
| --- | --- |
| `400 VALIDATION_ERROR` | Tipo, formato, limite ou chave inválida |
| `415 UNSUPPORTED_MEDIA_TYPE` | Escrita recebida com Content-Type diferente de JSON |
| `401 UNAUTHENTICATED` | Sessão ausente, inválida, expirada ou conta desativada |
| `403 FORBIDDEN` | Operação ou campo sem permissão; sem revelar valores restritos |
| `404 NOT_FOUND` | Recurso inexistente dentro do universo que o operador pode consultar |
| `409 REVISION_CONFLICT` | Revisão esperada difere da atual; informar a revisão atual se autorizada |
| `409 IDEMPOTENCY_CONFLICT` | Mesma chave, operação ou conteúdo incompatível |
| `409 DOMAIN_CONFLICT` | Vigência sobreposta, referência incompatível ou conflito que exige reconciliação |
| `409 REPORT_CHANGED` | Fontes/filtros do detalhe já não correspondem ao total consultado |
| `422 BUSINESS_RULE_VIOLATION` | Entrada válida em formato viola regra da operação; `details.rule` identifica a regra |
| `422 FEATURE_NOT_ENABLED` | Bloco ou uso real ainda não habilitado pela decisão institucional |
| `429 TOO_MANY_ATTEMPTS` | Controle temporário de login; incluir `Retry-After` |
| `503 DEPENDENCY_UNAVAILABLE` | Dependência indispensável indisponível; nenhum efeito parcial |

`POST` que cria recurso retorna 201; alteração ou comando concluído, 200; logout, 204. `GET` não cria registros de negócio, avaliações persistidas ou auditoria de alteração. Nenhuma rota DELETE elimina fatos operacionais no uso normal.

## 5. Autorização e projeções

Todas as rotas, exceto login, verificação mínima de disponibilidade e o caminho de logout sem sessão descrito em SPEC-ACS, exigem sessão válida. As permissões de operação e campo são definidas em SPEC-ACS. A autorização consulta conta e perfis atuais; não usa uma lista de perfis congelada no JWT.

Cada resposta é montada por uma projeção explícita de campos permitidos e validada pelo contrato de saída. Filtrar um objeto Prisma completo depois de serializado é insuficiente. Acesso a histórico, auditoria, resultados de busca, contagens, explicações de aptidão e replay de operação exige a mesma permissão da operação/entidade de origem. Filtros por campos restritos também são proibidos.

Mudanças de permissão afetam a próxima requisição. Em comandos de escrita, bloquear a linha da conta autora na transação antes de revalidar conta/perfis e produzir efeitos, comparando também a `authVersion` capturada da sessão com a versão persistente atual. Alterações de perfis/ativação também bloqueiam essa linha; assim, confirmação e revogação têm uma ordem consistente, e uma revogação confirmada antes da obtenção do bloqueio impede a operação. Bloquear outras contas/alvos em ordem estável de ID para reduzir deadlocks.

## 6. Transações, revisões e idempotência

Criação composta, chamada, mudança de vínculo, publicação de ficha/política, unificação e alterações relevantes gravam dados, revisões, auditoria e conclusão de operação em uma transação PostgreSQL. Toda referência é validada nesse contexto. Erro em qualquer parte desfaz o conjunto. Restrições únicas/FKs e verificações transacionais protegem o estado sob concorrência; validação prévia na UI não oferece essa garantia.

As operações que alteram registro existente exigem `expectedRevision`. Comando que altera vários agregados informa as revisões exigidas pela respectiva spec. A mesma transação compara e incrementa revisões. Duas alterações incompatíveis não podem confirmar com a mesma revisão inicial.

Escritas de negócio exigem `Idempotency-Key` UUID. Exceções: login, logout e `PUT /auth/password`; criação de conta e reset administrativo exigem chave. O servidor usa `OperationRecord(id, type, key, actorType, actorId?, fingerprintKeyId?, requestFingerprint, resultReference, completedAt)`; `(type, key)` é único. `type` identifica a operação, sem incluir o ID do alvo: o alvo participa do conteúdo comparado, e reutilizar a chave para outro alvo conflita. `actorType=USER` exige FK em `actorId`; `SYSTEM_BOOTSTRAP` exige `actorId=null` e é limitado à primeira conta.

O fingerprint das operações comuns é SHA-256 de rota, parâmetros e corpo normalizados, com objetos ordenados e arrays ordenados apenas quando o contrato os declara conjuntos. Nas operações idempotentes que recebem senha, usar HMAC-SHA-256 do conteúdo completo, incluindo a senha em memória, com chave interna de pelo menos 32 bytes independente das chaves de autenticação. Persistir somente o MAC e `fingerprintKeyId`, nunca a senha, um hash público dela ou o corpo integral. No replay, comparar usando a chave identificada no registro; ao rotacionar, preservar as chaves anteriores enquanto houver registros válidos associados. O fingerprint interno não é retornado em DTO, log ou auditoria. Assim, uma senha diferente com a mesma chave de criação/reset resulta em conflito.

Troca da própria senha e bootstrap ainda criam um `OperationRecord` de correlação na mesma transação da auditoria, com chave UUID gerada no servidor e metadados não secretos, sem replay HTTP. Login/logout não são alterações auditadas de domínio e não criam esse registro. Dispensa de chave HTTP não dispensa correlação de uma alteração persistente.

Fluxo obrigatório:

1. Autenticar, validar entrada e autorizar a operação.
2. Iniciar transação e reivindicar a chave, associada ao autor. O registro só fica persistido se a operação inteira confirmar.
3. Mesma chave/autor/conteúdo já concluídos: retornar a referência do resultado anterior, sem novos efeitos, aplicando a autorização atual. A chave usada por outro autor é conflito.
4. Mesma chave com outro conteúdo: 409. Em nova operação, validar revisões e integridade, gravar efeitos, auditoria e resultado, então confirmar.
5. Em concorrência pela chave, esperar a transação vencedora e reler seu resultado. Falha da primeira tentativa não consome a chave.

`resultReference` aponta a IDs e revisões imutáveis suficientes para reconstruir o resultado original; não guarda outra cópia irrestrita de dados pessoais. Retenção de chaves acompanha os fatos aos quais se referem; uma limpeza não pode permitir duplicar um fato ainda existente. A UI mantém a chave após erro de rede; cria outra somente para uma nova intenção ou conteúdo corrigido.

Para vigências, unificação e fechamento de chamadas, usar transações serializáveis ou bloqueios determinísticos equivalentes, além de restrições de banco. Decisão desta spec: serializable, repetindo a transação no máximo 3 vezes somente em falha de serialização/deadlock. Erro de negócio ou revisão não é repetido. Sem chamadas de rede ou bcrypt dentro da transação. A API concreta de transação e o reconhecimento de erro devem corresponder à versão de Prisma fixada na implementação; a garantia independe da mudança de API entre versões.

## 7. Habilitação e dados sintéticos

Fontes: ERS RES-01/02/05/06, LAC-05/08 e modelagem D-09. Desenvolvimento e demonstrações permanecem em `DATA_MODE=SYNTHETIC` enquanto não houver decisão institucional. Essa configuração não deve ser apresentada como mecanismo capaz de detectar se um texto inserido é real.

Em `DATA_MODE=REAL`, toda rota que lê ou escreve dados pessoais exige `REAL_PERSONAL_DATA` habilitada e referência da decisão de DEC-08/LAC-08. Cada bloco social depende também da decisão campo a campo de DEC-05/LAC-05. Flags só são configuradas por operação com permissão específica, com `decisionReference`, autor e data; uma flag não substitui essa decisão.

A passagem para `DATA_MODE=REAL` exige que a decisão global já esteja registrada; o backend falha na inicialização se essa pré-condição não existir. Configurar/testar o mecanismo com contas e registros sintéticos antes da passagem evita depender de um login com dados reais ainda não liberado. A aprovação e os valores registrados devem vir da instituição; o seed não inventa uma referência de decisão.

O mecanismo usa `FeatureDecision(code, enabled, decisionReference, decidedAt, decidedBy, revision)`. Códigos, dependências e comportamento de leitura de blocos antigos estão em SPEC-FIC. Auditoria, cópias e ambientes de teste seguem as mesmas restrições de dados; nenhum seed contém pessoas reais. Saúde, religião e prontuário não podem ser introduzidos por observações livres.

## 8. Qualidade e conclusão da implementação

- Vitest verifica operações públicas, schemas e regras puras; Fastify `inject` verifica contratos HTTP e autorização. Integração usa PostgreSQL real de teste para rollback, concorrência, FKs, unicidade e vigências; Redis real de teste verifica expiração/revogação. Mocks não comprovam garantias de banco.
- Cada módulo entrega os cenários de sua spec, incluindo erros, campos desconhecidos, dados ausentes, revogação, repetição e revisão obsoleta.
- Frontend oferece carregamento, vazio, erro, conflito e sucesso; bloqueio explica motivo e ação possível. Dados ausentes aparecem como “Não informado” e falta de evidência como pendência.
- Tráfego em produção usa HTTPS. Logs operacionais contêm identificadores técnicos necessários, nunca corpos, tokens, senhas ou detalhes sociais.
- Metas ERS RNF-DES-01/02/03 (2 s, 2 s e 10 s) permanecem propostas dependentes de LAC-10; medir com volume identificado, sem declarar cumprimento sem medição. Backup diário e restauração antes do piloto são requisitos operacionais da ERS, a configurar e validar na implantação.
- Conclusão de uma implementação: migrations reproduzíveis, contrato HTTP e UI entregues, cenários aplicáveis aprovados e comandos reais documentados. Conclusão do piloto exige adicionalmente as decisões institucionais pertinentes; não está implícita na aprovação dos testes.

## 9. Referências técnicas consultadas

Estas referências sustentam mecanismos, não acrescentam requisitos de produto. [Prisma: transações](https://www.prisma.io/docs/orm/fundamentals/transactions) e [referência da versão 7](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions) esclarecem atomicidade e conflitos; conferir a API da versão fixada. [PostgreSQL: constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) fundamenta restrições de integridade. [Fastify: validação e serialização](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) fundamenta a separação entre validação de formato e verificações assíncronas de negócio.
