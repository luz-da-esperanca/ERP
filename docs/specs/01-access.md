# SPEC-ACS — Autenticação, contas e perfis de acesso

Versão 1.0 · Dependência: [SPEC-CORE](00-foundation.md). Base documental: PRD 1.1 OBJ-06, CAP-11, RN-08/15 e AC-09; ERS RF-ACS-01/02/03/06, RNF-SEG-01/02/03/04 e §2.3; modelagem D-10. A matriz derivada da ERS foi adotada para implementação do MVP em [MVP-D03](README.md); DEC-08/LAC-08 ainda condiciona operação com dados reais.

## 1. Resultado e limites

Operadores entram com conta individual e recebem somente as capacidades e campos associados aos perfis atribuídos. Pessoa assistida não tem login por consequência do cadastro. Família não acessa a aplicação. Administração de contas é separada de consulta social.

Inclui criar contas, atribuir perfis, ativar/desativar, login, logout, consulta da sessão e troca de senha. Cadastro público, recuperação por e-mail, SSO, MFA, gestão de equipes/territórios e editor de perfis personalizados não são exigências do MVP. Os perfis são um catálogo fixo; uma conta pode combinar perfis.

## 2. Modelo

| Entidade | Campos e integridade |
| --- | --- |
| `UserAccount` | `id`, `login`, `displayName`, `passwordHash`, `active`, `mustChangePassword`, `authVersion`, `revision`, `createdAt`, `updatedAt`; login normalizado único; versões iniciam em 1 |
| `Role` | `code`, `label`; quatro códigos do catálogo abaixo |
| `RoleAssignment` | `userId`, `roleCode`; combinação única; alterações auditadas |
| Sessão Redis | UUID de sessão, `userId`, `authVersion`, `createdAt`, `absoluteExpiresAt`, `lastActivityAt`; TTL por inatividade limitado ao prazo absoluto |

Login é lowercase após trim, de 3 a 100 caracteres, com letras ASCII, números, ponto, hífen e underscore. Nome de exibição segue SPEC-CORE. Senhas nunca são normalizadas, aparadas ou truncadas. A validação exige no mínimo 12 caracteres Unicode e no máximo 72 bytes UTF-8; rejeita NUL. Esse limite em bytes é necessário para a implementação bcrypt escolhida, que usa somente os primeiros 72 bytes. [bcrypt: segurança](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns).

Hash assíncrono com bcrypt e salt gerado pela biblioteca; custo configurado por `BCRYPT_COST`, inicialmente 12 como proposta técnica, com mínimo 10. O custo deve ser medido no ambiente antes do piloto. [OWASP: armazenamento de senhas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Hash não é dado de auditoria nem DTO.

## 3. Matriz de acesso do MVP

Perfis: `COORDINATION`, `SOCIAL_ASSISTANCE`, `ACTIVITY_MANAGER`, `ADMINISTRATOR`. União das permissões dos perfis atribuídos, sem superusuário implícito. Esta versão não inclui escopo por território ou por atividade; a permissão aplica-se ao módulo, respeitando a projeção de campos.

| Capacidade | Coordenação | Assistência social | Responsável por atividade | Administrador |
| --- | --- | --- | --- | --- |
| Cadastro e vínculos completos; duplicidades/unificação | Ler e escrever | Ler e escrever | Somente seleção: pessoa `id/name`, família `id/code` | Sem acesso |
| Ficha social e versões | Ler e escrever blocos habilitados | Ler e escrever blocos habilitados | Sem acesso | Sem acesso |
| Projetos, atividades e institutos | Ler e escrever | Ler | Ler | Sem acesso |
| Participantes, encontros, chamada e correção/cancelamento | Ler e escrever | Ler | Ler e escrever | Sem acesso |
| Aptidão, evidências e relatório de situação | Ler e avaliar | Ler e avaliar | Sem acesso ao resultado familiar; lê sua frequência | Sem acesso |
| Publicação de política de aptidão | Sim | Não | Não | Não |
| Relatórios | Todos os recortados do MVP | Cadastro, social, alcance, frequência e aptidão | Frequência e alcance de atividades, campos mínimos | Sem dados assistenciais |
| Usuários, perfis, ativação e desativação | Não, salvo outro perfil | Não | Não | Sim |
| Habilitação de dados/blocos por decisão institucional | Sim | Não | Não | Não |
| Auditoria | Entidades e campos que pode consultar | Entidades e campos que pode consultar | Projetos/atividades/chamadas, projeção mínima | Contas/perfis, sem dados sociais |

Permissões técnicas correspondem às linhas: `registration.read/write/merge`, `participants.lookup`, `socialForms.read/write`, `projects.read/write`, `attendance.read/write`, `eligibility.read/evaluate/policy.write`, `reports.read`, `accounts.manage`, `featureDecisions.manage` e `audit.read`. `reports.read` e `audit.read` sozinhas não ampliam a permissão de domínio. Consulta de saúde/religião exige adicionalmente o bloco habilitado e os perfis social/coordenação, conforme SPEC-FIC.

Um responsável por atividade que precisa cadastrar uma pessoa pede a um operador com permissão de cadastro, ou usa sua conta com o perfil adicional explicitamente atribuído. A busca mínima não aceita CPF, renda, endereço ou outros filtros que revelem campos não autorizados.

## 4. Sessão e autenticação

Decisão técnica: JWT assinado com jose em cookie HttpOnly, com sessão revogável em Redis; sem refresh token no MVP. JWT contém somente `sub` (usuário), `jti` (sessão), `iss`, `aud`, `iat` e `exp`. Algoritmo fixo `HS256`; segredo aleatório de pelo menos 32 bytes via configuração, validado na inicialização. Validar assinatura, algoritmo, emissor, audiência e validade usando `jwtVerify`; decodificar não é autenticar. [jose: JWT](https://github.com/panva/jose#json-web-tokens-jwt).

Cookie `__Host-erp_session` em produção: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`. Desenvolvimento local HTTP usa nome `erp_session` e configuração de segurança explícita para ambiente local. Produção compartilha origem de SPA e API; CORS com origem curinga e credenciais não é permitido.

Em toda requisição protegida: validar JWT, sessão Redis, prazo absoluto/inatividade, conta ativa e igualdade de `authVersion` da sessão com a conta PostgreSQL, então carregar permissões atuais. `SESSION_IDLE_SECONDS=1800` segue o valor proposto de 30 minutos da ERS; `SESSION_MAX_SECONDS=28800` é proposta técnica de 8 horas. São configurações de implantação, não valores de aptidão. Uso do sistema atualiza a atividade da sessão; polling automático de disponibilidade não mantém sessão viva.

Login e todas as escritas exigem `Content-Type: application/json`, `Origin` igual à origem configurada e cabeçalho `X-ERP-Request: 1`. A SPA adiciona esse cabeçalho fixo; não é um segredo ou token. Rejeitar formas simples de submissão, origem ausente/diferente e preflight de outra origem. Se enviado, `Sec-Fetch-Site` também precisa ser `same-origin`. Essa proteção por origem/cabeçalho para API JSON segue [OWASP: custom headers](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#employing-custom-request-headers-for-ajaxapi). Login retorna apenas usuário/perfis/capacidades; JWT vai exclusivamente no cookie HttpOnly, nunca em JSON, logs ou storage do navegador.

Login inválido ou conta inativa retorna a mesma resposta 401, sem informar qual campo falhou. Conta inexistente executa comparação com hash fictício pré-calculado para reduzir diferença de tempo. Após 5 tentativas consecutivas, bloquear a chave de login por 15 minutos; o número 5 vem da proposta RNF-SEG-02 e os 15 minutos são escolha técnica configurável. Contadores Redis são atômicos e com expiração; sucesso limpa o contador. Há limite adicional por IP configurável para impedir varredura de logins.

Redis indisponível impede login e operações autenticadas com 503, sem recorrer a JWT não revogável. Alteração de senha, reset e desativação incrementam `authVersion` na mesma transação PostgreSQL do estado/revisão/auditoria: sessões antigas deixam de valer mesmo se a limpeza Redis falhar, e reativação não as restaura. A limpeza é uma otimização posterior; sua falha é registrada sem dados pessoais e não converte sucesso já confirmado em erro de rollback. A checagem persistente garante a revogação.

Logout possui caminho próprio: verificar JSON/origem/cabeçalho; com sessão válida, apagar o registro Redis e limpar cookie; sem sessão/conta desativada, limpar cookie e responder 204. Redis indisponível retorna 503, sem afirmar que a sessão foi revogada.

## 5. API

Rotas sob `/api/v1`:

| Método e caminho | Entrada | Resultado / permissão |
| --- | --- | --- |
| `POST /auth/login` | `{ login, password }` | 200, cookie + `{ user, roles, capabilities }`; sem auditoria com credenciais |
| `GET /auth/session` | — | 200, sessão e capacidades atuais; 401 se expirada |
| `POST /auth/logout` | `{}` e cabeçalhos de proteção de origem | 204; ausência de sessão já encerrada também 204, cookie limpo |
| `PUT /auth/password` | `{ expectedRevision, currentPassword, newPassword }` | 200, troca senha e revoga sessões; autenticar novamente |
| `GET /users` | `q?`, `active?`, paginação | DTO sem hash; `accounts.manage` |
| `POST /users` | `{ login, displayName, initialPassword, roleCodes }` | 201; login único; perfis conhecidos; `accounts.manage` |
| `PATCH /users/:userId` | `{ expectedRevision, displayName?, roleCodes? }` | 200; substitui conjunto de perfis se informado; `accounts.manage` |
| `POST /users/:userId/activation` | `{ expectedRevision, active, reason }` | 200; `accounts.manage` |
| `PUT /users/:userId/password` | `{ expectedRevision, temporaryPassword, reason }` | 200; revoga sessões, exige troca; `accounts.manage` |
| `GET /roles` | — | Quatro perfis/capacidades; `accounts.manage` |
| `GET /responsible-candidates` | `q?`, `ids?`, paginação | `id`, `displayName`, `active`; `projects.write` ou `attendance.write` |

Derivação adotada pelo responsável pelo projeto em 05/10/2026: `GET /responsible-candidates` é um diretório mínimo para designar o responsável de atividade/encontro, não administração de contas. Lista contas ativas com perfil Coordenação ou Responsável por Atividade, ordenadas por nome; `ids` resolve contas já gravadas como responsável, qualquer que seja seu perfil ou estado, para que continuem identificáveis. Nunca devolve login, perfis ou metadados de credencial. A gravação de `responsibleId` continua aceitando qualquer conta existente, conforme SPEC-ATV/FRQ.

Contas criadas/resetadas usam `mustChangePassword=true`. Enquanto esse estado estiver ativo, somente sessão, logout e troca de senha são acessíveis; ações de domínio retornam 403 com `details.rule=PASSWORD_CHANGE_REQUIRED`. DTO da sessão informa `UserAccount.revision` para a troca. Comparar senha/hash fora da transação; na confirmação, verificar a revisão capturada, incrementar revisão/`authVersion`, atualizar `mustChangePassword` e registrar auditoria. Uma troca/reset concorrente produz 409, sem bcrypt dentro da transação.

`initialPassword`, `temporaryPassword` e `newPassword` não participam de snapshots. Criação/reset usam a comparação HMAC interna de CORE para proteger equivalência sem armazenar senha ou hash público no registro de operação. Troca própria usa correlação interna sem chave/replay HTTP; após sucesso, autenticar novamente com a nova senha.

Impedir desativar/remover o último administrador ativo por transação concorrente protegida. Isso protege a operação de contas, sem conceder dados sociais a esse administrador. A primeira conta é criada por comando administrativo local, lendo senha por entrada oculta e usando a mesma regra/hash; nenhum seed contém senha padrão. Sua autoria de bootstrap é identificada explicitamente como operação inicial, sem inventar outro usuário autor.

## 6. Interface e fluxos alternativos

`/login` apresenta login e senha, erro genérico, bloqueio temporário e indisponibilidade. `/change-password` atende a troca obrigatória. `/settings/users` lista e administra contas/perfis, com confirmação de desativação e motivo. Navegação usa capacidades retornadas; a API continua sendo a autoridade.

Ao expirar sessão, preservar apenas dados de formulário não sensíveis em memória enquanto a tela pede autenticação; não persistir ficha em storage. Mensagens pt-BR explicam sessão expirada, ausência de permissão e ação necessária. Conta de múltiplos perfis não precisa trocar de perfil: recebe a união autorizada.

## 7. Critérios de aceite e testes

| ID | Cenário observável |
| --- | --- |
| ACS-AC01 | Conta individual válida entra; segredo/hash/JWT não aparecem no corpo, log ou auditoria |
| ACS-AC02 | Responsável por atividade recebe somente seleção mínima; CPF e ficha são negados também por busca, relatório e auditoria (ERS AC-09) |
| ACS-AC03 | Administrador isolado cria conta e desativa usuário, mas não consulta cadastro/ficha |
| ACS-AC04 | Conta combinando Administrador e Assistência recebe exatamente a união das permissões, auditada |
| ACS-AC05 | Desativação e mudança de perfis valem na próxima requisição, incluindo replay idempotente |
| ACS-AC06 | JWT com algoritmo, emissor, audiência ou assinatura inválidos é rejeitado; ausência de Redis não libera acesso |
| ACS-AC07 | Cinco falhas bloqueiam temporariamente; expiração desbloqueia; sucesso limpa contador |
| ACS-AC08 | Sessão sem atividade expira; logout e mudança de senha revogam acesso |
| ACS-AC09 | Senha de mais de 72 bytes é rejeitada antes do bcrypt; multibyte não é contada como byte único |
| ACS-AC10 | Escrita sem cabeçalho/origem válida é rejeitada sem efeitos; login não revela existência da conta |
| ACS-AC11 | Duas desativações concorrentes não deixam o sistema sem administrador ativo; autorias anteriores continuam consultáveis |
| ACS-AC12 | Desativação/reset continuam revogando sessões se a limpeza Redis falhar; reativação não restaura sessões antigas |
| ACS-AC13 | Criação/reset repetidos com mesma chave e outra senha geram conflito, sem gravar senha ou fingerprint em auditoria/log/DTO |
| ACS-AC14 | Troca de senha concorrente valida a revisão capturada; comando iniciado antes de revogação não confirma com autorização obsoleta |

Vitest/Fastify `inject` cobre HTTP; integração PostgreSQL/Redis cobre revogação, contadores, sessões e concorrência. Matriz integral deve ser exercitada com contas de um perfil e combinações, não somente com conta de coordenação.
