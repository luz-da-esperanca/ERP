# Seed de demonstração

O comando `pnpm db:seed` prepara um cenário sintético para showcase, integração do frontend e testes manuais. Usa os casos de uso existentes pelo Fastify `inject`, sem precisar iniciar o servidor HTTP. Cadastro, revisões, validações, autorização e auditoria seguem o mesmo fluxo da API.

## Executar

Com PostgreSQL e Redis ativos, dependências instaladas e `.env` configurado:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Em outro terminal, execute `pnpm dev:web`. O comando de seed também está registrado em `prisma.config.ts` para `pnpm exec prisma db seed`.

A primeira execução exige banco sem contas ou registros de negócio. Em um banco já preparado por este seed, o comando pode ser repetido: recupera os IDs pelas operações concluídas, preserva alterações manuais e retoma passos ainda não concluídos após uma falha. Não limpa tabelas, redefine senhas existentes nem recria versões ou avaliações já publicadas. Cada passo confirma sua própria transação; uma falha mantém os passos anteriores e desfaz o passo que falhou.

O seed rejeita `NODE_ENV=production` e `DATA_MODE=REAL`. Para preparar um ambiente sem exemplos, use `pnpm db:bootstrap` no lugar do seed. O bootstrap não funciona depois que o seed criou as contas.

## Acessos

A senha é gerada aleatoriamente na primeira execução e salva em `.env.demo`, com permissão `600`. Esse arquivo é ignorado pelo Git e reutilizado nas próximas execuções. Abra-o localmente para consultar `DEMO_SEED_PASSWORD`; as quatro contas de demonstração usam esse valor. O comando não imprime a senha. Preserve o arquivo enquanto utilizar esse banco; alterar ou apagar o arquivo não muda a senha das contas existentes.

| Login               | Perfil                    | Fluxo sugerido                                            |
| ------------------- | ------------------------- | --------------------------------------------------------- |
| `demo.coordination` | Coordenação               | Navegar pelos módulos sociais, relatórios e configurações |
| `demo.social`       | Assistência Social        | Cadastro, ficha social e avaliação familiar               |
| `demo.activity`     | Responsável por Atividade | Projetos, inscrições, encontros e frequência              |
| `demo.admin`        | Administrador             | Contas e perfis; sem acesso automático aos dados sociais  |

As contas são individuais, com os perfis separados. A troca inicial de senha é concluída pelo seed para que estejam prontas para login. Nenhuma credencial fixa é distribuída pelo repositório.

## Cenários disponíveis

São criadas quatro famílias com dois membros cada, dois projetos, três atividades e oito inscrições. As atividades incluem duas periódicas e uma pontual apenas cadastrada, sem encontros ou realização de atendimento pontual.

| Família          | Resultado na data de referência | Evidências                                                                                |
| ---------------- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| Aurora (demo)    | Apta                            | Membros com três presenças válidas; duas versões da ficha de moradia                      |
| Girassol (demo)  | Não apta                        | Um membro com uma presença e duas ausências; outro com três ausências; cobertura completa |
| Horizonte (demo) | Pendente                        | Inscrições e oportunidades conhecidas, sem marcações individuais nos encontros válidos    |
| Jacarandá (demo) | Pendente                        | Sem oportunidades; nascimentos desconhecidos e possível duplicidade a revisar             |

Há cinco encontros: quatro válidos e um cancelado, preservado no histórico. A roda de convivência possui três encontros válidos; a oficina de leitura possui um. O cancelado contém marcações que não entram na frequência nem na aptidão. A cobertura declarada não transforma marcações desconhecidas em ausências.

São publicadas três fichas sociais, incluindo duas versões de Aurora. A seleção fictícia inclui somente `housing.roomCount`, com acesso para Coordenação e Assistência Social. O seed habilita apenas `FIC_HOUSING`; não habilita saúde, medicamentos, religião ou uso de dados reais.

A seleção cadastral fictícia acompanha nascimento das pessoas e telefone das famílias, produzindo pendências `MISSING_DATA`. Uma alteração de nome cria um exemplo de `POSSIBLE_DUPLICATE`, sem unificação automática. Históricos, auditoria e relatórios consultam esses mesmos registros.

## Datas e política fictícia

O comando imprime a data de referência e o período. A referência é o dia anterior à criação da primeira conta, no `APP_TIMEZONE`; o período fixo cobre os 30 dias encerrados nessa referência. Essa âncora permanece igual nas próximas execuções, inclusive após uma falha.

A política identifica explicitamente `DEMO-SYNTHETIC`: mínimo de duas presenças na roda de convivência durante esse período fixo. Esse critério serve somente para demonstrar os resultados e suas evidências; não representa a decisão institucional de DEC-02/LAC-01. As seleções cadastral e social também têm referências explícitas de demonstração. A instalação sem seed continua sem política e sem seleções padrão.

Para apresentar os relatórios, use o período impresso pelo comando. Na estação preparada em 06/10/2026, ele é `[2026-09-06, 2026-10-06)`, com referência em `2026-10-05`. Outras instalações recebem datas relativas à sua primeira execução.

## Testes automatizados

O seed não substitui as fixtures isoladas da suíte. Os testes próprios exercitam geração de credenciais, restrições de ambiente, login/perfis, os três resultados de aptidão, desconhecidos, versões da ficha, repetição com mudanças manuais e recuperação após falha real de auditoria PostgreSQL.

```bash
pnpm test test/features/demo-seed/infra/seed-environment.test.ts
TEST_DATABASE_URL=postgresql://erp:erp_test_only@localhost:55432/erp_test \
TEST_REDIS_URL=redis://localhost:56379 \
pnpm test:integration test/features/demo-seed/infra/showcase-seed.integration.test.ts
```

Essas URLs correspondem ao `compose.test.yaml`. A suíte exige um banco exclusivo terminado em `_test` e apaga seus dados; mantenha o banco do showcase separado. Ela não lê nem altera o `.env.demo` do projeto.
