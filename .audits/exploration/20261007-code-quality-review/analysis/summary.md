# Síntese: revisão de code smells e práticas de arquitetura (2026-10-07)

Exploração somente-leitura em 8 fatias independentes sobre o estado do código em relação a `AGENTS.md` e às specs. O artefato final de entrega é `docs/plans/2026-10-07-code-quality-review.md`. A lacuna de features faltantes do MVP já havia sido analisada em `.audits/exploration/20261005-mvp-gap-analysis/` e não foi repetida aqui.

## Conclusão geral

A base do backend é sólida e aderente à documentação: camadas respeitadas, ESLint com `--max-warnings 0` (com teste próprio em `test/eslint-config.test.ts`), Zod na borda (220 `.strict()`), autenticação em 89/91 handlers, transações `serializable` com `FOR UPDATE` e revalidação do autor, zero `TODO/FIXME/HACK/any`, zero mocks internos nos testes e suíte de testes espelhando `src/`. Os problemas concentram-se em três eixos:

1. **Pontos de acoplamento e contrato sem decisão registrada** — `core` importa erros de 7 features; imports cross-feature de domínio sem regra que os autorize ou proíba; três fachadas HTTP paralelas no web; vocabulário de auditoria declarado em ≥7 lugares com divergência comprovada (`AuditEntry.action` aceita `PUBLISH`, valor impossível no banco).
2. **Falhas operacionais verificáveis** — `pnpm format:check` falha hoje (409 arquivos, EOL LF×CRLF, sem `.gitattributes`); a suíte de integração não roda no Windows (`test/support/global-setup.ts:7` usa `execFileSync('pnpm', …)` sem `shell` → ENOENT); não existe CI nem hooks — typecheck/lint/test/build dependem de execução manual; `/api/v1/health` é estático e Redis tem `on('error')` vazio.
3. **Camada de apresentação do web divergente do contrato** — tradução de erro descarta `details` (400 vira frase fixa de data futura; `details.rule` ignorado em 403/422); busca prévia de duplicidade de pessoa preparada mas nunca executada na UI; superfície morta do era-demo (`LoginPage`, `DashboardPage`, `AppLayout` etc.) sustentada por testes próprios; texto de módulo excluído do MVP diz "não está disponível nesta etapa".

## Achados por severidade (recorte dos cortes)

- **Altos:** `format:check` quebrado por EOL (07); ausência total de CI/hooks (07); integração não roda no Windows (06); ports de `application` não são o contrato real da UI — 41 imports `presentation`→`infra` e fachadas paralelas (04); duplicidade de pessoa nunca executada na UI (04); superfície morta demo com testes (04/08).
- **Médios (seleção):** `core`→features (01); preâmbulo de idempotência duplicado 9× em CAD e parâmetro `personIds` da UoW nunca passado (02); 413→500 no error-mapper (02); invariantes do MVP só em migrations com drift silencioso e sem `db:verify` (03); índices não cobrem buscas (`contains` sem `pg_trgm`, `Attendance` por `sessionId` sem índice) (03); ordem de lock divergente Family×Person amortecida só por retry 3× sem backoff (03); Redis `reconnectStrategy: false` + handler vazio (03); vocabulário de auditoria sem fonte única nem teste de paridade (05); envelope de erro da SPEC não é contrato exportado (05); `MembershipReconciliationService` (523 linhas) sem teste unitário (06); tradução de erro do web descarta `details` (08).
- **Baixos:** documentação (README/SPEC-CORE) desatualizada quanto a `bootstrap.ts`, `seed.ts`, `demo-seed`, `src/generated` (01); dívida fina de teste (`rejects.toThrow()` genéricos, asserts frágeis) (06); `engines` adverbial sem `engineStrict` (07); textos/UI da era demonstração (08), entre outros (~88 achados no total).

## Desacordos e correções entre fontes

- A análise de 05/10 afirma que o build web falha (`index.html`→`/src/main.tsx` inexistente); a fatia 04 verificou que o arquivo existe desde `4dac919` (05/10/2026) e que build/typecheck/lint passam. **Não reproduzir a alegação obsoleta.**
- Fatia 01 registra `pnpm lint` exit 0; fatia 07 registra `format:check` exit 1. Não conflitam: são gates distintos, ambos verificados por execução.
- Sobreposições deliberadas (tratadas por uma fatia, referenciadas nas demais): dependência `core`→features (01/02); paginação em memória (02/03); componentes demo mortos (04/08); ausência de CI (06/07).

## Lacunas remanescentes (Open Questions agregadas)

- Decisão sobre imports cross-feature de domínio e sobre ordem global de lock (candidatas a SPEC-CORE/DEC).
- Fonte de verdade do vocabulário de auditoria (`schema.prisma` × `packages/contracts`) e destino de `PUBLISH`/`INTERNAL_ERROR`.
- Direção da arquitetura de contratos do web: ports de `application` × fachadas HTTP.
- Threshold de cobertura e quem executa testes em merge (sem CI).
- Comportamento real do bundle `dist/main.js` (esbuild) não verificado; suíte de integração nunca executada neste ambiente Windows.

## Conclusões acionáveis (ordem sugerida)

1. Corrigir o que está quebrado hoje: EOL/`.gitattributes` (ou `endOfLine` no Prettier), `global-setup.ts` com shell compatível no Windows, `error-mapper` (413→500; log de 400).
2. Fechar decisões arquiteturais abertas em docs: dependência `core`→features, imports cross-feature, ordem de lock, fonte única dos vocabulários de contratos/auditoria.
3. Eliminar divergência contrato↔UI: `details` na tradução de erro, busca de duplicidade de pessoa na UI, consolidação das fachadas HTTP, remoção/explicação da superfície demo morta.
4. Endurecer plataforma: CI mínimo (typecheck+lint+test), `db:verify` para drift de migrations, índices faltantes, health real, handler de erro do Redis.
5. Completar dívida de teste focalizada: UoW/retry, `MembershipReconciliationService`, paridade de vocabulários.

## Evidência (arquivos desta exploração)

- [01 backend-architecture](01_analysis_backend-architecture.md) — 8 achados.
- [02 backend-features](02_analysis_backend-features.md) — 13 achados (5 médios, 8 baixos).
- [03 persistence-infra](03_analysis_persistence-infra.md) — 12 achados (6 médios, 6 baixos).
- [04 frontend](04_analysis_frontend.md) — 13 achados.
- [05 contracts](05_analysis_contracts.md) — 11 achados (5 médios, 6 baixos).
- [06 tests](06_analysis_tests.md) — dívida fina + 1 alto (Windows/global-setup).
- [07 tooling-config](07_analysis_tooling-config.md) — 12 achados (2 altos, 4 médios, 6 baixos).
- [08 context-mismatch](08_analysis_context-mismatch.md) — 8 achados (3 médios, 5 baixos) + evidências positivas.

## Limitações

Análise majoritariamente estática; `pnpm lint`/`format:check` e builds web foram executados por algumas fatias, mas `pnpm test`, `pnpm typecheck`, `pnpm build` (raiz) e a suíte de integração não foram executados (gerariam `src/generated`/`dist` ou dependem de ambiente com banco). Inferências estão marcadas como tal nos artefatos individuais. Tarefa documental: nenhum teste automatizado novo, por decisão registrada.
