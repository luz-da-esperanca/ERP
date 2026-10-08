# Analysis: 08-context-mismatch

> **Research prompt.** Onde o código existente apresenta, explica ou autoriza um contexto que
> contradiz a documentação vigente ou a própria implementação: mensagens e rótulos que afirmam
> estados falsos, código de protótipo no caminho de produção, operações cuja autorização ou
> justificativa difere do declarado, matrizes de permissão duplicadas e defaults presumidos.

## Scope

- **Fatia:** `08-context-mismatch` da auditoria de qualidade de código de 2026-10-07.
- **Superfície:** `src/**` (Fastify/Prisma) e `apps/web/**` (React), mais as specs que definem o
  contrato de erros, autorização e mensagens (`docs/specs/00-foundation.md`,
  `docs/specs/01-access.md`, `docs/specs/README.md`) e o estado declarado da UI
  (`docs/frontend-status.md`, `README.md`).
- **Fora de escopo:** a lista de módulos/funcionalidades ausentes no MVP, tratada por
  `.audits/exploration/20261005-mvp-gap-analysis/analysis/summary.md`, e as fatias irmãs
  `01` (arquitetura), `03` (persistência), `06` (testes) e `07` (tooling).
- **Método:** verificação estática com leitura de arquivo e busca de padrões. Nenhum script de
  build, lint ou teste foi executado (ver *Evidence*). Nenhum arquivo fora deste foi alterado.
- O prompt verbatim da fatia não está versionado no repositório; a pergunta acima é a reconstituição
  a partir do nome da fatia e do contrato repassado.

## Overview

O código está notavelmente coerente com a documentação nas partes que importam para integridade de
dados: não encontrei nenhum default de negócio presumido (aptidão cai em `PENDING` sem política,
`DATA_MODE` parte de `SYNTHETIC`, nenhum `DEFAULT_FIELDS` em `src/**` ou `packages/**`), os blocos da
ficha sob decisão lançam `FeatureNotEnabledError` antes de qualquer leitura de `REAL`, o snapshot de
auditoria de contas não contém `passwordHash`, `.env.demo` está ignorado e as contagens de rotas
declaradas em `README.md:194` e `docs/api/projects.md:3` batem com o código.

As incoerências restantes estão na camada de **apresentação e justificativa do contexto**, não na
persistência. Elas se agrupam em três mecanismos:

1. **Tradução de erro sem uso do `details` que o backend envia.** O frontend reduz códigos de erro a
   frases fixas, e duas dessas frases afirmam algo falso ou incompleto sobre a causa (`VALIDATION_ERROR`
   vira uma regra temporal; `FORBIDDEN` descarta `details.rule`).
2. **Mensagens de ausência de capacidade redigidas como ausência de produto.** Onde a UI não tem
   permissão ou onde a rota não existe, o texto dita "ainda não está disponível" ou "nesta etapa",
   o que promete uma evolução que a decisão de escopo exclui permanentemente.
3. **Restos do caminho de demonstração convivendo com o caminho conectado.** Contrato de gateway com
   operações de demo, componentes de login/layout/dashboard sem rota, e uma segunda matriz de
   permissões em TypeScript — tudo mantido vivo por testes próprios, sem teste que compare as duas
   fontes de verdade.

Nenhum achado abaixo indica vazamento de dado ou escrita sem transação; todos são de coerência
declarativa. As severidades refletem o risco de decisão errada pelo operador ou pelo mantenedor.

## Achados

### 1. [Médio] `VALIDATION_ERROR` é traduzido como uma regra temporal específica

**Evidência.** `apps/web/src/shared/use-action.ts:40-41` mapeia o código para
`'Revise os valores e as datas. Fatos realizados não podem estar no futuro.'`. O backend produz esse
código em `src/core/presentation/error-mapper.ts:210-220` (qualquer `z.ZodError`, com
`details.fields`) e `error-mapper.ts:221-230` (JSON malformado). A frase é uma citação da regra
temporal de `docs/specs/00-foundation.md:44`, aplicada a toda a seção 4.

**Problema.** `VALIDATION_ERROR` significa, pela própria spec (`docs/specs/00-foundation.md:54`),
"tipo, formato, limite ou chave inválida". Gatilhos reais incluem `Idempotency-Key` inválida em
`src/features/access/presentation/access-routes.ts:38-39`, `Content-Type` e limites de rota. O
frontend ainda ignora `details.fields`, contrariando `docs/specs/00-foundation.md:50` ("o frontend
traduz o código **e os campos**"), e `use-action.ts:62` degrada qualquer código desconhecido para a
mensagem de `INTERNAL_ERROR`.

**Impacto no MVP.** Em qualquer validação que não seja data, o operador é orientado a procurar uma
causa inexistente. A mensagem é apresentada em `role="alert"` como diagnóstico da falha — em
`activity-page.test.tsx:341-367` o alerta é a única superfície de erro. Nenhum teste fixa a cópia de
`VALIDATION_ERROR`, então a correção é barata.

**Recomendação.** Devolver a mensagem genérica de `use-action.ts:11-12` (que já existe e descreve a
causa correta) e, quando `details.fields` estiver presente, listar os campos. Se a intenção era
cobrir o caso "data no futuro", esse caso deve vir como `BUSINESS_RULE_VIOLATION` com
`details.rule`, que a spec já exige (`docs/specs/00-foundation.md:63`).

### 2. [Médio] `details.rule` é emitido pelo backend e ignorado na tradução de `403` e `422`

**Evidência.** `src/core/presentation/error-mapper.ts:178-184` devolve
`details: { rule: error.rule }` para `PermissionDeniedError` (403) e `error-mapper.ts:171-177` faz o
mesmo para `AccountRuleError` (422). No frontend, `use-action.ts:33` fixa `'Seu perfil não permite
esta operação.'` para todo `FORBIDDEN` e `use-action.ts:50-51` fixa uma frase genérica para todo
`BUSINESS_RULE_VIOLATION`. `details.rule` só é lido em `use-action.ts:14-22`, e apenas para
`DOMAIN_CONFLICT` + `CPF_ALREADY_REGISTERED`.

**Problema.** `docs/specs/01-access.md:81` exige que ações de domínio com `mustChangePassword`
retornem **403 com `details.rule=PASSWORD_CHANGE_REQUIRED`**, e
`docs/specs/00-foundation.md:63` exige que `422 BUSINESS_RULE_VIOLATION` identifique a regra em
`details.rule`. O backend cumpre ambos; a interface descarta o campo em dois códigos.

**Impacto no MVP.** O único consumidor mitigado é `PASSWORD_CHANGE_REQUIRED`, neutralizado porque
`apps/web/src/app/connected-app.tsx:113` redireciona para `/change-password` antes de qualquer ação.
Qualquer outra regra futura cai em "Seu perfil não permite esta operação", que é **falsa** quando a
conta tem a capacidade mas a operação é vedada por estado (revisão divergente, família vigente,
natureza da atividade). Distinções que a spec faz — permissão × regra de estado — tornam-se
indistinguíveis na UI.

**Recomendação.** Traduzir `details.rule` para `FORBIDDEN` e `BUSINESS_RULE_VIOLATION` pelo mesmo
mecanismo já usado em `use-action.ts:14-22`, com queda para a cópia genérica quando ausente.

### 3. [Médio] Falta de capacidade e rota inexistente apresentadas como "etapa" do produto

**Evidência.** `apps/web/src/features/projects/presentation/activity-page.tsx:152-159` renderiza,
para atividade `PERIODIC` sem `attendance.read`, "A consulta de encontros **ainda não está
disponível**", e para `ONE_OFF` "O registro de atendimentos **não está disponível nesta etapa**".
`activity-page.tsx:113-117` usa "Consulta ainda não disponível" como rótulo de reserva de
`responsibleName`. `activity-page.tsx:260-267` converte `records` em `undefined` quando sem
capacidade. A rota `activities/:id` exige apenas `projects.read`
(`apps/web/src/app/connected-app.tsx:184-203`), de modo que o `403` nunca chega — a UI degrada
silenciosamente. Trava explícita em `activity-page.test.tsx:237-242`.

**Problema.** Duas situações distintas são narradas como uma só, e a narrativa escolhida é a de
produto incompleto. Para `ONE_OFF`, a ausência é **permanente por decisão de escopo**:
`docs/specs/README.md:27` exclui o módulo de atendimentos e `docs/frontend-status.md:55-56` registra
que ele fica fora. Um operador lê "nesta etapa" e aguarda evolução que não virá; um mantenedor lê o
mesmo texto e infere que falta implementar algo que foi deliberadamente excluído.

**Impacto no MVP.** É exatamente o tipo de afirmação que induz a decisão errada sobre escopo — o
risco que esta fatia existe para encontrar. Não há perda de dado: sem `attendance.read` o backend já
nega (`attendance-routes.ts:32-146` declara capacidade em todas as rotas FRQ).

**Recomendação.** Separar as duas causas no texto: capacidade ausente → "Seu perfil não permite
consultar encontros"; funcionalidade excluída do MVP → não exibir o painel. O rótulo de reserva de
`responsibleName` (`activity-page.tsx:113-117`) deve indicar autor não informado, não consulta
indisponível.

### 4. [Médio] Caminho de login/layout/dashboard do protótipo permanece no bundle, morto e mantido vivo pelos próprios testes

**Evidência.**
- `apps/web/src/features/access/presentation/login-page.tsx` não é importado por nenhum arquivo de
  `src/` ou `test/`; seu texto afirma, em `login-page.tsx:77-79`, "**O acesso real ainda não está
  conectado nesta interface**" — falso desde que o backend entrou.
- `DashboardPage` (`apps/web/src/features/home/presentation/dashboard-page.tsx:41`) não é importado
  por nenhum arquivo; apenas `ConnectedDashboardPage` é roteado.
- `AppLayout` (`apps/web/src/app/app-layout.tsx:46-63`, com `'Demo access is required by the demo
  layout'` em `:51` e `"Sair da demonstração"` em `:59`) e `GlobalActions`
  (`apps/web/src/app/global-actions.tsx:7`, importado em `app-layout.tsx:23`) são importados
  exclusivamente por `apps/web/test/app/app-layout.test.tsx:7,10,33,44`.
- O contrato de acesso exige operações de demonstração: `apps/web/src/features/access/application/access-gateway.ts:9-10`
  declara `demoAccounts()` e `enterDemo()`; só `apps/web/src/demo/runtime.ts:92,101` e
  `apps/web/src/features/access/infra/demo-access.ts:10-11` os implementam. `HttpErpClient`
  (`apps/web/src/features/access/infra/http-erp-client.ts:12-32`) não define `access`, então
  `apps/web/src/app/erp-provider.tsx:30` cai em `client.access?.session()` — caminho coberto apenas
  porque `connected-app.tsx:121-127` injeta `session` explicitamente.
- `README.md:42` afirma que "Ajuda e sino **permanecem no protótipo**"; nenhum caminho do protótipo
  existe mais, e `docs/frontend-status.md:55-56` diz que notificações ficam fora do escopo.

**Problema.** Um contrato compartilhado (`AccessGateway`) declara operações que só a implementação de
demonstração satisfaz, e a única coisa que impede um erro em runtime é uma injeção explícita em outro
arquivo. Componentes com copy falsa permanecem no bundle por causa de testes que roteiam o caminho
morto.

**Impacto no MVP.** Risco de manutenção, não de operação: ao remover ou renomear a injeção de
`connected-app.tsx:121-127`, ou ao rotear `login-page.tsx` por engano, a UI passaria a afirmar que o
acesso real não está conectado. `GlobalActions` também gera 153 linhas de painéis de ajuda e
notificação inalcançáveis.

**Recomendação.** Estreitar `AccessGateway` às operações de sessão usadas pelo caminho conectado e
mover `demoAccounts`/`enterDemo` para um contrato de demonstração separado; excluir do bundle de
produção os componentes sem rota, ou apontá-los explicitamente como protótipo não roteado em
`docs/frontend-status.md`.

### 5. [Baixo] Duas matrizes de permissão em TypeScript, sem teste que as compare

**Evidência.** O backend define a matriz em `src/features/access/domain/permissions.ts` (testada em
`test/features/access/domain/permissions.test.ts:61`). O frontend define **outra** em
`apps/web/src/features/access/domain/permissions.ts:14-25`, consumida apenas por
`apps/web/src/demo/runtime.ts:4,49`. A do demo omite `participants.lookup`, `registration.merge`,
`eligibility.evaluate`, `eligibility.policy.write` e `featureDecisions.manage`, além de não repor em
`COORDINATION` as capacidades que só o backend concede. `hasCapability` (`:29-30`) não tem nenhum
consumidor. Nenhum teste em `test/` nem em `apps/web/test/` compara as duas.

A mesma duplicação de domínio aparece nas outras camadas `domain` do frontend: quatro dos sete
módulos são executados apenas pelos adaptadores de demonstração —
`projects/domain/activity-rules.ts` (`demo-attendance.ts:20`, `demo-projects.ts:15`),
`attendance/domain/attendance-rules.ts` (`demo-attendance.ts:21`),
`registration/domain/registration-rules.ts` (`demo-registration.ts:10`) e
`access/domain/account-rules.ts` (`demo-access.ts:5`). `attendance/domain/frequency.ts` só entra no
caminho conectado como `import type` em `apps/web/src/features/reports/application/reports-gateway.ts:2`,
apagado em tempo de compilação. Somente `registration/domain/memberships.ts` é de fato compartilhado
(`http-registration.ts:27`, `families-page.tsx:15`, `search-page.tsx:8`).

**Problema.** Duas fontes de verdade para a mesma matriz, sem verificação de sincronia. O gap
analysis de 2026-10-05 já apontou a omissão da matriz demo
(`.audits/exploration/20261005-mvp-gap-analysis/analysis/03_analysis_acs-aud-rel.md:30`); o ponto
novo é que a divergência persiste **depois** que o backend passou a existir, e agora é uma duplicação
de contrato, não uma lacuna de implementação.

**Impacto no MVP.** O backend é a fonte autoritativa — `session.capabilities` vem de
`docs/specs/00-foundation.md:72`, que veta lista congelada em JWT. Os testes que exercitam adaptadores
em memória, porém, provam comportamento sob uma matriz com cinco capacidades a menos, e por isso não
cobrem os caminhos de `registration.merge`, `eligibility.evaluate`, `eligibility.policy.write` e
`featureDecisions.manage`.

**Recomendação.** Derivar `getCapabilities` do contrato compartilhado (`@erp/contracts/access`) ou
adicionar um teste que compare as duas matrizes campo a campo; remover `hasCapability` sem uso.

### 6. [Baixo] Oito rotas sem capacidade declarada no nível HTTP, cinco dependendo só do serviço

**Evidência.** Rotas que chamam `principal(request)` sem `capabilities:` no registro:

| Rota | Arquivo:linha | Quem autoriza |
| --- | --- | --- |
| `POST /activities/:id/enrollments` | `projects-routes.ts:84` | `projects-service.ts:586` (`attendance.write`/`projects.write`) |
| `PATCH /enrollments/:id` | `projects-routes.ts:96` | `projects-service.ts:681` (idem) |
| `DELETE /enrollments/:id` | `projects-routes.ts:108` | idem |
| `GET /people` | `registration-routes.ts:196` | `registration-service.ts:398-405` (dual `registration.read`/`participants.lookup`) |
| `GET /people/:personId` | `registration-routes.ts:98` | `registration-service.ts:744-751` (idem) |
| `GET /auth/session` | `access-routes.ts:50` | natureza da rota |
| `PUT /auth/password` | `access-routes.ts:58` | natureza da rota |
| `GET /responsible-candidates` | `access-routes.ts:75` | `accounts-service.ts:73-89` |

**Problema.** A capacidade da rota é a declaração legível de autorização que uma pessoa consulta
antes de ler o serviço; `docs/specs/00-foundation.md:72` exige autorização em **todas** as rotas.
As três primeiras e a última são legítimas — a capacidade é decisão do serviço, e
`registration-service.ts:406-407` inclusive nega `birthDate`/`cpf` a quem só tem
`participants.lookup`, comportamento que nenhuma capacidade de rota reproduziria. As duas de sessão
são naturalmente públicas dentro da sessão.

**Impacto no MVP.** Nenhuma escrita fica sem autorização: todo caminho de `command` passa por
`projects-service.ts:122-129`, que revalida autor dentro da transação. O custo é de leitura e de
revisão — quem audita autorização precisa saber que cinco rotas a delegam.

**Recomendação.** Registrar a delegação no comentário da rota ou no próprio
`docs/api/projects.md`, para que a ausência de `capabilities:` não pareça omissão.

### 7. [Baixo] `ProjectsService.authorize` usa `assertPermission(..., true, capabilities[0]!)` como atalho opaco

**Evidência.** `src/features/projects/application/projects-service.ts:104-110`:

```ts
private authorize(actor: Principal, capabilities: readonly Capability[]) {
  if (actor.user.mustChangePassword)
    assertPermission(actor.user.roleCodes, true, capabilities[0]!);
  const available = capabilitiesFor(actor.user.roleCodes);
  if (!capabilities.some((capability) => available.includes(capability)))
    throw new PermissionDeniedError();
}
```

**Problema.** A chamada a `assertPermission` não serve para checar a capacidade: `src/features/access/domain/permissions.ts:49-57`
lança `PASSWORD_CHANGE_REQUIRED` antes de ler o terceiro argumento, então `capabilities[0]!` nunca é
dereferenciado e o non-null assertion documenta um caminho inexistente. A intenção real — "se a senha
mudou, `PASSWORD_CHANGE_REQUIRED` antes de qualquer regra" — só é compreendida seguindo o corpo de
`assertPermission` em outro módulo.

**Impacto no MVP.** Comportamento correto e coberto por
`test/features/projects/application/projects-service.test.ts:76`. O risco é de manutenção: alguém
"otimizando" `assertPermission` para ler a capacidade antes de checar `mustChangePassword` quebraria
silenciosamente o contrato de `docs/specs/01-access.md:81`.

**Recomendação.** Trocar por um nome explícito (`assertPasswordChangeNotPending(actor)`) ou por
`assertPermission(roleCodes, mustChangePassword, capabilities[0]!)` sem o `if`, deixando o efeito
declarado na própria assinatura.

### 8. [Baixo] Costuras da era de demonstração no caminho de produção

**Evidência.**
- `apps/web/src/shared/audit/http-audit.ts:19-44` — `list(familyId?)` varre todas as páginas com
  `readCapability: 'registration.read'` fixo; o único chamador sem `familyId` é o `DashboardPage`
  morto (`dashboard-page.tsx:58`), chamador com família usa `families-page`.
- `apps/web/src/app/app-layout.tsx:46-63` declara a UI autenticada como `"Acesso autenticado"` e a
  de demonstração como `"Dados sintéticos"`, enquanto o caminho conectado rotula em
  `connected-app.tsx:425-473`.
- Os barris `apps/web/src/*.ts` (`projects.ts`, `registration.ts`, `access.ts`, …) existem para os
  testes: são importados apenas de `apps/web/test/**` (13 pontos de entrada), nunca de `src/`.

**Problema.** São acoplamentos corretos no uso atual, mas nenhum deles é identificado como legado do
protótipo. `http-audit.ts` varre auditoria com uma capacidade fixa e sem filtro de família — padrão
que a spec de auditoria não prevê como consulta de usuário.

**Impacto no MVP.** Baixo: sem efeito observável hoje, porque os consumidores errados não estão
roteados e os barris não entram no bundle de produção.

**Recomendação.** Exigir `familyId` ou `recordedBy` em `HttpAudit.list` (removendo o caso que
nenhum caminho conectado usa) e marcar `app-layout.tsx`/barris como área de demonstração e teste.

## Relevant Sources

- `docs/specs/00-foundation.md:44,50,54,63,72` — regra temporal, tradução de erro pelo código e
  pelos campos, semântica de `VALIDATION_ERROR`/`BUSINESS_RULE_VIOLATION`, autorização sem JWT
  congelado.
- `docs/specs/01-access.md:81` — 403 com `details.rule=PASSWORD_CHANGE_REQUIRED`.
- `docs/specs/README.md:27` — módulo de atendimentos fora do MVP; `docs/frontend-status.md:4-5,55-56`
  — adaptadores em memória e notificações fora do escopo.
- `src/core/presentation/error-mapper.ts:171-230` — origem real de cada código de erro.
- `apps/web/src/shared/use-action.ts:5-65` — tradução de erros no frontend.
- `apps/web/src/features/projects/presentation/activity-page.tsx:113-159,190-192,260-267` —
  mensagens de indisponibilidade.
- `apps/web/src/app/connected-app.tsx:113,121-127,184-203,425-473` e `app-layout.tsx:23-63` — caminho
  conectado × caminho de protótipo.
- `src/features/access/domain/permissions.ts` × `apps/web/src/features/access/domain/permissions.ts`
  — as duas matrizes.
- `.audits/exploration/20261005-mvp-gap-analysis/analysis/summary.md` e
  `.../03_analysis_acs-aud-rel.md:30` — antecedente já publicado.

## Transferable Patterns

- **Tradução de erro guiada por `details`, não por código.** O padrão de
  `use-action.ts:14-22` (ler `details.rule` e traduzir) é o correto e já existe; basta generalizá-lo
  dos dois códigos que hoje o usam. Recomendação de design: mapear código + `rule` em uma única
  tabela, para que adicionar um erro no backend sem tradução no frontend seja falha de teste.
- **Contrato de porta sem operação da era anterior.** `AccessGateway` com `demoAccounts`/`enterDemo`
  é contraexemplo de "não estender o contrato compartilhado com necessidade da camada de
  demonstração". Padrão transferível: portas do `application` só declaram operações que **todas** as
  implementações sustentam.
- **Ausência de permissão ≠ ausência de produto.** Texto de UI deve distinguir "seu perfil não
  permite" de "fora do escopo". Verificar essa distinção em toda mensagem contendo "ainda não",
  "disponível" ou "etapa".
- **Matriz de permissão tem fonte única.** Qualquer segunda definição de `role → capability` deve
  nascer do contrato compartilhado ou ser comparada por teste; a duplicação aqui é silenciosa porque
  ambos os arquivos compilam.

## Risks / Mismatches

- **Doc × código, baixo impacto:** `README.md:42` ("Ajuda e sino permanecem no protótipo") descreve
  componentes que nenhum caminho alcança; `docs/frontend-status.md` já trata notificações como fora
  do escopo. Corrigir o `README`, não o código.
- **Teste × decisão:** `activity-page.test.tsx:237-242,341-367` fixam as cópia de indisponibilidade e
  de erro. São testes intencionais sob a regra de preservação de `AGENTS.md` — corrigir a cópia
  exige ajustar o teste junto, sem enfraquecer a cobertura.
- **Nenhum achado de:** vazamento de credencial (`.env.demo` ignorado; `passwordHash` fora de
  `AccountAuditSnapshot` em `src/features/audit/domain/account-audit.ts:11-13`), escrita fora de
  transação, default de negócio presumido, operação de domínio sem autorização, ou rota FRQ sem
  capacidade.
- **Divergência conhecida e publicada:** a omissão de cinco capacidades na matriz demo já consta do
  gap analysis de 2026-10-05; este documento a reporta sob a ótica de duplicação de fonte de verdade,
  não como trabalho pendente de implementação.

## Open Questions

1. A mensagem de `VALIDATION_ERROR` (`use-action.ts:40-41`) foi escrita para cobrir um caso concreto
   de data futura em alguma tela? Se sim, o caso deve virar `BUSINESS_RULE_VIOLATION` com
   `details.rule` identificado — não localizei teste ou comentário que sustente a escolha.
2. Deve o painel de atividade `ONE_OFF` ser oculto em vez de exibir "não está disponível nesta
   etapa"? A resposta muda se `attendance.read` for concedido a um perfil que não tem inscrições —
   comportamento que a ausência de capacidade torna indistinguível hoje.
3. Os barris `apps/web/src/*.ts` são o mecanismo pretendido de entrada de teste, ou candidatos a
   sair para `apps/web/test/`? `AGENTS.md` fala em testes espelhando a hierarquia, mas não define a
   função desses arquivos.
4. `hasCapability` (`apps/web/src/features/access/domain/permissions.ts:29-30`) pode ser removido
   diretamente ou é API pretendida para a era de demonstração?

## Evidence

- **Ferramentas:** leitura de arquivo e busca de padrões (grep) sobre `src/**`, `apps/web/**`,
  `packages/**`, `docs/**` e `.audits/**`. `rg` indisponível no ambiente; nenhum comando alterou
  estado do repositório além de criar este arquivo.
- **Não executado:** `pnpm lint`, `pnpm test`, `pnpm typecheck` e `pnpm build` — a análise é
  estática por contrato de somente-leitura, e o corepack precisaria baixar o pnpm para fora do
  repositório. As severidades de *build* não foram validadas por execução.
- **Buscas de falsos positivos, sem ocorrências:** `TODO|FIXME|HACK|XXX` em `src/**`; módulos de
  estoque/bazar/doação/CRM contábil em `packages/contracts/src`; `DEFAULT_FIELDS|defaultFields` em
  `packages/**` e `src/features/registration`; rótulo `'Atendimentos'` em `apps/web/src`; rota
  `broadcast-coverage` em `src/**`.
- **Verificação de importadores (barril não conta como uso):** `login-page.tsx` e `DashboardPage`
  não têm nenhum importador em `apps/web/src/**` nem em `apps/web/test/**` — os testes importam
  `ConnectedDashboardPage` via `apps/web/src/home.ts:1`. `AppLayout` e `GlobalActions` só aparecem
  em `apps/web/test/app/app-layout.test.tsx:7,10,33,44` (`GlobalActions` é importado por
  `app-layout.tsx:23`, que só é roteado por esse teste).
- **Contagens verificadas contra a documentação:** `projects-routes.ts` registra 19 operações (18
  pontos de chamada + o laço `:229-247` que acrescenta 2 `PATCH`), batendo com `README.md:194` e
  `docs/api/projects.md:3`; `registration-routes` 16, `attendance-routes` 11, `social-forms-routes`
  11, `eligibility-routes` 6, `identity-merge-routes` 2, `reports-routes` 10,
  `membership-reconciliation-routes` 2.
- **Verificações positivas citadas no Overview:** `AccountAuditSnapshot extends Account`
  (`src/features/audit/domain/account-audit.ts:11-13`) sem `passwordHash`, com `audit-store.ts:107-113`
  parseando por `userDtoSchema`; `.gitignore:20-22` com `!.env.example` e `git ls-files` mostrando
  apenas `.env.example`; `src/core/infra/config.ts:34` com `DATA_MODE` default `SYNTHETIC`;
  `social-forms-service.ts:588-604` lançando `FeatureNotEnabledError` em `REAL` sem
  `REAL_PERSONAL_DATA`; `activity-rules.ts:84-90,104-105` aplicando a regra de `serviceTypeId` e
  vedando inscrição em `ONE_OFF`, coerente com `project-forms.tsx:118-119,181-186`,
  `MODELAGEM-DO-SISTEMA.md:159` e ERS:476; `prisma-accounts.ts:246-259` com `select` explícito que
  comenta "Never the login, roles or any credential metadata", e
  `packages/contracts/src/access-api.ts:120-122` com `responsibleCandidateSchema` estrito.
