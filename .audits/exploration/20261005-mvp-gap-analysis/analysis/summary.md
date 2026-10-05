# Features pendentes para concluir o MVP

Análise de 05/10/2026, baseada no commit `bff089e` e no estado local observado. Documento de diagnóstico: as decisões e os contratos continuam pertencendo a `docs/specs`.

## Conclusão

O backend entrega a fundação técnica, acesso e auditoria de contas. **Ainda faltam os seis módulos assistenciais persistentes: CAD, FIC, ATV, FRQ, APT e REL**, acompanhados de suas APIs, telas integradas, autorização, auditoria e testes. A UI contém partes de um protótipo em memória; seu build atualmente falha porque a entrada React referenciada não existe. Aptidão ainda não tem implementação nem contratos no protótipo.

Essa conclusão resulta da comparação das specs com a composição real: [runtime.ts](../../../../src/runtime.ts):36–69, [app.ts](../../../../src/app.ts):128–136, [schema.prisma](../../../../prisma/schema.prisma):25–103 e [create-demo-client.ts](../../../../apps/web/src/demo/create-demo-client.ts):9–18. Ela também coincide com a situação registrada no [índice das specs](../../../../docs/specs/README.md):5. A definição de conclusão exige persistência, API, UI e cenários aplicáveis aprovados, conforme [SPEC-CORE](../../../../docs/specs/00-foundation.md):114–119.

## Autoridade e método

- O [AGENTS.md](../../../../AGENTS.md) define o recorte do MVP. O [índice das specs](../../../../docs/specs/README.md) e as specs de cada módulo são a referência de implementação. PRD, ERS e modelagem esclarecem regras, fontes e decisões pertinentes.
- A [rastreabilidade](../../../../docs/specs/traceability.md):7–63 inclui **53 requisitos funcionais**, com três REL parcialmente aplicáveis e RF-FIC-06 incluído para implementação, desativado até aprovação específica. Esse número mede o recorte, não entrega realizada.
- Foram comparados modelos, operações, interfaces e aceites com `src/`, `prisma/`, `test/`, `apps/web/src` e `packages/contracts`. Código de demonstração foi identificado como protótipo; presença de arquivo de teste foi distinguida de teste executado.
- Não foi estimado percentual de conclusão: os requisitos não têm pesos equivalentes e vários dependem de contratos transversais.

## Estado por módulo e features faltantes

| Módulo | Estado observado | Features que ainda faltam para a spec | Referência |
| --- | --- | --- | --- |
| CORE | Base backend implementada; integração web pendente | Entrada/router da SPA; cliente HTTP; fuso institucional compartilhado; administração auditada das habilitações; dados sintéticos persistentes; aceite transversal e prontidão operacional | [CORE §§2–8](../../../../docs/specs/00-foundation.md) |
| ACS | API de autenticação e contas implementada; UI de demonstração | Login real; sessão/expiração; troca obrigatória de senha; administração de usuários/perfis/ativação/reset; consumo dos DTOs e capacidades reais nas telas | [ACS §§5–6](../../../../docs/specs/01-access.md):61–88 |
| CAD | Sem backend; contratos/adaptadores e telas de famílias parciais | Pessoas e famílias; código único; busca prévia/duplicidades; vínculos temporais, composição em data e titularidade; transferências/correções; tamanhos datados; issues; unificação autorizada com reconciliação transversal | [CAD §§2–6](../../../../docs/specs/02-registration.md):11–121 |
| FIC | Sem backend; contrato e adaptador de publicação simplificados | Seleção campo a campo e catálogos; habilitações/perfis; situação familiar e dados por membro; publicação com composição/revisões históricas; versões/correções imutáveis; ciência; blocos sensíveis implementados e protegidos, desativados por padrão | [FIC §§2–6](../../../../docs/specs/03-social-forms.md):11–130 |
| ATV | Sem backend ou telas; adaptador parcial | Institutos/tipos; projetos com vigência; atividades com natureza/horário/responsável; inscrições temporais; edição e encerramento auditados; bloqueio de mudanças incompatíveis com histórico | [ATV §§1–5](../../../../docs/specs/04-projects-activities.md):5–88 |
| FRQ | Sem backend ou telas; chamada/cálculo parciais em memória | Prévia de chamada com fingerprint do servidor; encontros e marcações explícitas, inclusive avulsos; revisão/correção de status e contexto; cancelamento; frequência histórica; declaração versionada e invalidação de cobertura | [FRQ §§1–5](../../../../docs/specs/05-attendance.md):5–93 |
| APT | Ausente no backend e no protótipo | Contratos; política completa, configurável, versionada e vigente; avaliador puro com três situações; prévia; avaliação persistida com evidências/revisões; telas de política, resultado e avaliações anteriores | [APT §§1–6](../../../../docs/specs/06-eligibility.md):5–98 |
| REL | Sem backend ou telas; consultas demo parciais | Históricos familiar/pessoal; alcance; frequência; aptidão; qualidade cadastral; filtros/períodos/unidades; detalhamento de cada total; fingerprint e `REPORT_CHANGED`; projeções autorizadas | [REL §§1–6](../../../../docs/specs/07-reports.md):5–85 |
| AUD | Persistência/consulta de auditoria de contas implementadas | Eventos e leitura de revisões dos novos módulos; ações de correção/encerramento/cancelamento/unificação/publicação; projeção de dados e motivos restritos; tela global e histórico de alterações por registro | [AUD §§2–6](../../../../docs/specs/08-audit.md):11–63 |

Os diagnósticos detalhados abaixo identificam evidências, lacunas de contratos e aceites por módulo; a tabela não declara que todo requisito de uma área com implementação parcial está concluído.

## Pontos que precisam orientar a implementação

1. **Cadastro histórico precede a frequência confiável.** Transferência e mudança de titular não movem fatos antigos. A implementação precisa resolver vínculo na data do fato, proteger pertença vigente única sob concorrência e permitir reconciliações atômicas. Ver CAD §§2–4 e FRQ §§1–2.
2. **Unificação é transversal.** A prévia, aliases e proveniência precisam ser previstos em CAD, mas a confirmação completa depende de FIC/FRQ/APT e deve resolver conflitos sem apagar origens ou duplicar contagens. O [índice](../../../../docs/specs/README.md):64–71 orienta concluir esse contrato após as entidades dependentes existirem.
3. **Ficha é publicação histórica, com configuração aprovada.** Completar dados atuais não substitui versionamento da composição e dos dados individuais. Saúde, medicamentos e religião estão no desenho a implementar, com proteção e desligados por padrão; a seleção não pode ser contornada por texto livre. Ver [FIC](../../../../docs/specs/03-social-forms.md):29–109.
4. **Cobertura de encontros é uma feature própria.** Inscrição sem marcação continua desconhecida. Cobertura e sua invalidação são necessárias para explicar completude, taxa e evidências de aptidão; preencher todas as linhas conhecidas não comprova que todos os encontros foram registrados. Ver [FRQ](../../../../docs/specs/05-attendance.md):37–49 e [APT](../../../../docs/specs/06-eligibility.md):48–59.
5. **O selo Pendente do protótipo não é o módulo de aptidão.** Falta o mecanismo configurável e seus motivos/evidências. A spec permite Apta por um membro com prova suficiente e exige distinguir Pendente de Não apta. Sem política, permanece Pendente; não há mínimo/período presumido. Ver [APT](../../../../docs/specs/06-eligibility.md):7–9/54–61.
6. **Totais precisam de origem recuperável.** REL usa as fontes e projeções dos módulos, com a mesma referência/filtros e detecção de alteração entre total e detalhe. Aptidão nos relatórios usa o mesmo avaliador, com totais globais anteriores à paginação. Ver [REL](../../../../docs/specs/07-reports.md):32–48.
7. **Autorização e auditoria entram em cada feature.** A base de ACS/AUD não entrega automaticamente proteção ou trilha de módulos inexistentes. Cada leitura/projeção, replay e escrita de negócio precisa aplicar os contratos comuns. Ver [CORE](../../../../docs/specs/00-foundation.md):70–100 e [AUD](../../../../docs/specs/08-audit.md):23–39.

## Ordem recomendada de entrega

Esta sequência concretiza a ordem já definida no [índice](../../../../docs/specs/README.md):60–69; as prioridades abaixo são recomendações desta análise.

| Etapa | Escopo | Resultado verificável |
| --- | --- | --- |
| 0 | Completar integração mínima CORE/ACS da web | SPA inicia e compila; login, sessão, troca obrigatória e administração de contas consomem a API real |
| 1 | CAD + auditoria e autorização correspondentes | Família/pessoa persistidas; busca prévia; composição/titularidade em data; transferências/correções; qualidade e tamanhos; aliases/proveniência preparados |
| 2 | ATV | Catálogos sintéticos reproduzíveis; projetos/atividades com regras de natureza/vigência; inscrições; encerramento preservando fatos |
| 3 | FIC e FRQ sobre as bases necessárias | Ficha versionada/configurada; chamada histórica auditada; correções/cancelamentos; cobertura declarada e invalidada quando fontes mudarem |
| 4 | APT | Política publicada com vigência; prévia e avaliação com três situações e evidências recuperáveis; nenhum default institucional |
| 5 | Fechar unificação CAD e entregar REL | Reconciliação de todos os conflitos do MVP; históricos, totais e detalhes coerentes; contagem canônica sem duplicação |
| 6 | Aceite transversal e preparação do piloto | Cenários das specs com API/UI, autorização, rollback, concorrência, histórico, sessão e revogação; condições operacionais e institucionais registradas |

Cada etapa funcional inclui migration/persistência, contrato público, caso de uso, API, UI e testes pertinentes. A auditoria não deve ser adiada para uma etapa final. Não há estimativa de prazo ou compromisso de implantação nesta análise.

## Decisões institucionais e pontos de contrato

MVP-D01–07 já definem o desenho para desenvolver com dados sintéticos. A distinção entre desenho aprovado pelo responsável do projeto e ratificação institucional está no [índice](../../../../docs/specs/README.md):45–58.

| Condicionante | O que permanece pendente | Efeito na entrega |
| --- | --- | --- |
| DEC-01/LAC-02 e DEC-04/LAC-04 | Ratificação institucional de composição/titularidade e organização dos projetos | O desenho técnico adotado pode ser implementado; uso real depende da decisão pertinente |
| DEC-02/LAC-01 | Período, mínimo e modalidades/atividades de aptidão | Implementar mecanismo sem política inicial; situação Pendente até configuração válida |
| DEC-05/LAC-05 e DEC-08/LAC-08 | Campos/finalidades, acesso, dados sensíveis, guarda e uso real | Entregar seleção/habilitações/proteção; manter restrições e modo sintético até a decisão específica |
| DEC-10/LAC-10 | Volumes, metas, operação, sustentação e condições do piloto | Medir desempenho com volume identificado, configurar backups e validar restauração antes do piloto |

Também há um ponto de integração a fechar antes da tela de responsáveis: ATV/FRQ referenciam `UserAccount`, enquanto a listagem atual `/users` exige `accounts.manage`. O contrato precisa permitir a seleção autorizada necessária ou orientar a composição de perfis; esta análise não cria endpoint nem amplia permissão. Detalhes e fontes estão no diagnóstico ACS/AUD/REL.

## Limites do recorte

Atendimentos realizados, estoque, entregas, Bazar e migração pertencem ao produto maior e estão excluídos deste MVP. Turmas/vagas/espera, justificativa de ausência, alertas, renda total/per capita, CSV/PDF e auditoria de consultas são evoluções adiadas. Não foram classificados como features faltantes desta entrega. Referência: [rastreabilidade](../../../../docs/specs/traceability.md):65–81 e [índice](../../../../docs/specs/README.md):27–38.

## Validação e relatórios de apoio

- `pnpm test`: **12 arquivos, 140 testes aprovados** na suíte unitária atual.
- `pnpm --filter @erp/web build`: **falhou**, com `Failed to resolve /src/main.tsx`, referenciado por [index.html](../../../../apps/web/index.html):11.
- Conteúdo dos cinco relatórios e amostras das evidências de código foram revisados contra as fontes locais; 386 links locais foram conferidos, sem destino ausente. Não foram criados testes porque a mudança é documental.
- Integrações PostgreSQL/Redis não foram executadas nesta análise. Sua presença no repositório não é declarada como aprovação nesta execução. Também não houve validação de piloto, desempenho ou restauração de backup.

Análises por área:

- [CAD e FIC](01_analysis_cad-fic.md): comportamento, contratos, UI, aceites e condicionantes.
- [ATV, FRQ e APT](02_analysis_atv-frq-apt.md): atividades, frequência, cobertura e avaliação de aptidão.
- [ACS, AUD e REL](03_analysis_acs-aud-rel.md): acesso já entregue, extensão de auditoria e consultas pendentes.
- [CORE e UI](04_analysis_core-ui.md): lacunas transversais, evidências estruturais e comandos executados.
