# Lacunas de CORE e integração da interface

Data da análise: 05/10/2026. Base Git: `bff089e`, acrescida do estado local observado. Este arquivo é diagnóstico; não altera decisões das specs.

## Escopo e método

Comparação de SPEC-CORE e índice das specs com a composição HTTP, runtime, schema Prisma, contratos comuns, configuração, scripts, inventário da UI e configuração de testes. Foram lidos integralmente `00-foundation.md`, `README.md` das specs, `src/app.ts`, `src/runtime.ts`, schema Prisma e os arquivos transversais da UI citados abaixo. PRD §§6 e 8.1 e SPEC-FIC §5 foram consultados para distinguir aceite técnico de liberação institucional.

Critério: contrato, adaptador em memória, componente isolado ou arquivo de teste existente não demonstram entrega conjunta de persistência, API, UI e cenários aprovados. Esse critério vem de [SPEC-CORE](../../../../docs/specs/00-foundation.md):114–119 e do [índice](../../../../docs/specs/README.md):73–79.

## Estado observado

- A base implementa validação de configuração, HTTP Fastify, sessão e autorização, guard de dados reais, migration de acesso, revisões/idempotência e auditoria de contas. A composição concreta está em [runtime.ts](../../../../src/runtime.ts):36–69 e [app.ts](../../../../src/app.ts):128–136.
- PostgreSQL tem `UserAccount`, `Role`, `RoleAssignment`, `OperationRecord`, `AuditEntry` e `FeatureDecision`; ainda não há entidades assistenciais. Ver [schema.prisma](../../../../prisma/schema.prisma):25–103.
- A UI possui componentes e gateways parciais de demonstração, mas não tem entrada React, composição de rotas nem cliente HTTP. O inventário de `apps/web/src` contém apresentação apenas de login e famílias. [create-demo-client.ts](../../../../apps/web/src/demo/create-demo-client.ts):9–18 compõe exclusivamente adaptadores em memória.
- Não há diretório de testes da UI. [vitest.config.ts](../../../../vitest.config.ts):4–11 aceita esse caminho, mas uma inclusão configurada não cria cobertura.

## Lacunas transversais

P0 indica pré-condição técnica para uma primeira jornada verificável; P1 indica entrega obrigatória para concluir o MVP; P2 indica prontidão operacional antes do piloto. As prioridades são recomendações desta análise, não novos requisitos ou estimativas de esforço.

| ID | Feature ou entregável pendente | Exigência nas specs | Evidência observada | Próximo resultado verificável |
| --- | --- | --- | --- | --- |
| CORE-01 | Inicialização da SPA e navegação executável | CORE §2 e §8; contrato HTTP + UI entregue | [index.html](../../../../apps/web/index.html):11 referencia `/src/main.tsx`, ausente no inventário; build web falhou por essa referência | P0: entrada React, composição de provider/router, telas existentes acessíveis e build web aprovado |
| CORE-02 | Cliente HTTP e integração entre sessão/API/UI | CORE §2, §4 e §5 | [erp-client.ts](../../../../apps/web/src/app/erp-client.ts):8–17 e [create-demo-client.ts](../../../../apps/web/src/demo/create-demo-client.ts):9–18; não há chamadas `fetch`/Axios na UI | P0/P1: acesso real primeiro, seguido de cada módulo; respeitar DTOs, cookies, cabeçalhos de origem e capacidades atuais |
| CORE-03 | Escritas assistenciais com garantias comuns | CORE §6 | [app.ts](../../../../src/app.ts):129–136 só registra ACS/AUD; [schema.prisma](../../../../prisma/schema.prisma):25–103 não tem entidades dos módulos restantes | P1: cada novo caso de uso realiza autorização sob bloqueio, valida revisões, confirma alteração/auditoria/operação juntas e reconstrói replay autorizado |
| CORE-04 | Administração auditada de habilitações | CORE §7; FIC §4–5 | [data-mode.ts](../../../../src/core/application/data-mode.ts):10–21 e [prisma-feature-decisions.ts](../../../../src/core/infra/prisma-feature-decisions.ts):4–13 implementam somente leitura/guard; [SPEC-FIC](../../../../docs/specs/03-social-forms.md):100–103 especifica os comandos ainda ausentes | P1: seleção de campos/flags com referência, autoria, revisão, dependências e auditoria; exercitar antes em modo sintético |
| CORE-05 | Configuração civil única para backend e frontend | CORE §3, linha 42 | API aceita `APP_TIMEZONE` em [config.ts](../../../../src/core/infra/config.ts):23–33; [time.ts](../../../../apps/web/src/shared/time.ts):1/14/27–28 fixa Fortaleza e offset `-03:00` | P1: UI usa a configuração institucional efetiva; testes cobrem fronteiras de dia e intervalos sem pressupor offset fixo |
| CORE-06 | Estados da UI aplicados às jornadas reais | CORE §4 e §8 | [ui.tsx](../../../../apps/web/src/shared/ui.tsx):49–83 e [use-action.ts](../../../../apps/web/src/shared/use-action.ts):4–55 oferecem estruturas parciais; textos e sessão continuam ligados à demonstração | P1: carregamento/vazio/erro/conflito/sucesso e recuperação de sessão, revisão e idempotência demonstrados nas telas entregues; preservar chave em falha de rede |
| CORE-07 | Dados sintéticos persistentes e comando reproduzível | CORE §2, linha 23; §7 | [package.json](../../../../package.json):10–27 tem `db:bootstrap`, mas não `db:seed`; [demo/runtime.ts](../../../../apps/web/src/demo/runtime.ts):21–28 semeia apenas memória | P1: comando ou procedimento documentado para conjunto sintético persistente, incluindo catálogos quando seus módulos existirem; nunca semear aprovação institucional ou senha padrão |
| CORE-08 | Aceite transversal do MVP | CORE §8; índice §4–5 | Suítes atuais ficam em CORE/ACS/AUD e contratos de acesso; não há testes dos módulos assistenciais ou da UI | P1: cenários das specs, contratos HTTP, autorização/projeção e integração PostgreSQL para vínculos, ficha, frequência, aptidão e unificação; Redis para sessão/revogação |
| CORE-09 | Prontidão de implantação e piloto | CORE §8, linhas 117–119; índice linha 58 | Os scripts e testes inspecionados não evidenciam restauração de backup nem medições com volume institucional | P2: configurar HTTPS/origem, backup diário, ensaio de restauração e medir metas com volume identificado; resolver DEC/LAC pertinentes antes de dados reais |

Referências de requisito da tabela: [SPEC-CORE](../../../../docs/specs/00-foundation.md), [SPEC-FIC](../../../../docs/specs/03-social-forms.md) e [índice das specs](../../../../docs/specs/README.md).

## Validação executada

| Verificação | Resultado | Limite da conclusão |
| --- | --- | --- |
| `pnpm test` | 12 arquivos e 140 testes aprovados | Suíte unitária existente; não comprova integração real ou os módulos ausentes |
| `pnpm --filter @erp/web build` | Falha: `Failed to resolve /src/main.tsx` | Confirma impedimento atual de empacotamento da UI |
| Inventário de `src`, `test`, `prisma`, `apps/web/src` e contratos | Revisado | Conclusões limitadas ao repositório e ao estado local observado |

Não foram criados testes: a alteração é apenas documental. Não foram executadas integrações PostgreSQL/Redis, build da API, lint, typecheck ou navegação no browser; não houve alteração de código que exigisse esses checks. O build web foi executado para confirmar o impedimento encontrado no inventário. A análise não afirma que o piloto está aprovado nem que integrações passaram nesta execução.

## Decisões e limites

- MVP-D01–07 já fecham o desenho necessário para implementar com dados sintéticos. Falta de valores institucionais não impede construir o mecanismo configurável de aptidão. Ver [índice](../../../../docs/specs/README.md):45–58.
- Uso real depende de DEC-01/02/04/05/08/10 conforme a função. Falta de aprovação é condição de uso, separada da falta de código. Ver [PRD](../../../../docs/PRD-ERP-Luz-da-Esperanca-v1.1.md):324–340.
- CORE-09 registra ausência de evidência no repositório, não afirma inexistência de procedimentos ou decisões institucionais fora dele.
- Não foi estimado percentual de conclusão: os 53 RF da rastreabilidade não têm pesos equivalentes, e muitos aceites atravessam módulos.
