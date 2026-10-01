# Especificações de implementação do MVP

Base documental: PRD 1.1 (18/09/2026), ERS 1.0 (24/09/2026), modelagem 1.1 (28/09/2026), ficha de famílias 2025 e decisões de escopo/stack do [AGENTS.md](../../AGENTS.md).

**Situação:** contratos redigidos para revisão; as decisões de produto da seção 3 ainda precisam de resposta para declarar todas as specs prontas para implementação. Aprovar o desenho do MVP não equivale a aprovação institucional para usar dados reais. Não há aplicação implementada nem testes da aplicação executados nesta entrega.

## 1. Specs e propriedade dos contratos

| Spec | Responsabilidade | Fontes funcionais |
| --- | --- | --- |
| [CORE — Contratos comuns](00-foundation.md) | Stack, módulos, tipos, datas, HTTP, transações, idempotência e critérios de conclusão | ERS IU-01–07, INT-04, §3.4–3.6; modelagem §1.2/D-10 |
| [ACS — Acesso](01-access.md) | Autenticação, contas, perfis, autorização e sessões | RF-ACS-01/02/03/06, RNF-SEG |
| [CAD — Cadastro](02-registration.md) | Pessoas, famílias, vínculos, titularidade, numerações, duplicidade e unificação | RF-CAD-01–11 |
| [FIC — Ficha social](03-social-forms.md) | Seleção de campos, fotografia versionada, composição e ciência conhecida | RF-FIC-01/02/04–09; RF-FIC-06 condicionado |
| [ATV — Projetos e atividades](04-projects-activities.md) | Institutos, projetos, naturezas, tipos e inscrições | RF-ATV-01–08 |
| [FRQ — Frequência](05-attendance.md) | Encontros, marcações, correções/cancelamentos, contagens e cobertura | RF-FRQ-01–04/06/07 |
| [APT — Aptidão](06-eligibility.md) | Critério versionado, avaliação em três situações e evidências | RF-APT-01–07 |
| [REL — Consultas e relatórios](07-reports.md) | Históricos, alcance, frequência, aptidão e qualidade, recortados para o MVP | RF-REL-01/02/03 parcialmente; RF-REL-04/07/08/09 |
| [AUD — Auditoria](08-audit.md) | Autoria, revisões, snapshots, proteção e reconstrução | RF-ACS-04/05 e RF-ACS-06 quanto à autoria |

Uma regra tem um proprietário: CORE define envelope/datas/idempotência; ACS define autorização; CAD resolve identidade/vínculo; ATV organiza atividades/lista; FRQ registra fatos; APT calcula situação; FIC publica a fotografia social; REL consulta; AUD preserva revisões. Módulos usam esses contratos, sem redefinir as regras do proprietário.

A [matriz de rastreabilidade](traceability.md) cobre individualmente os 53 requisitos funcionais do recorte e identifica os 48 adiados/excluídos, sem reivindicar o produto completo.

## 2. Recorte e conciliação das fontes

O MVP não implementa ATD, EST, ENT, BAZ nem MIG, embora sejam essenciais no produto completo. Natureza pontual é cadastro de atividade, sem registro de realização. Relatórios não criam essas dependências. Excluídos também turmas/vagas/espera, agenda, alerta de ficha/frequência, justificativa de ausência, renda total/per capita, compatibilidade por tamanho, CSV/PDF e auditoria de consultas: são desejáveis, sem inclusão explícita.

| Divergência ou lacuna | Tratamento nas specs |
| --- | --- |
| Nascimento no cadastro mínimo da ERS versus dados ausentes do PRD/modelagem | Nome e vínculo exigidos; nascimento/sexo/documentos desconhecidos permitidos; seleção final em DEC-01 |
| Instituto obrigatório/exclusivo apresentado pela ERS versus pendência do PRD | Base proposta de um instituto por projeto, identificada como tratamento provisório de LAC-04 |
| Campo existente no formulário versus aprovação de coleta | Matriz campo a campo e flags; nenhum bloco real habilitado automaticamente |
| Renda “mensal” no nome de atributo da modelagem versus papel sem periodicidade | `incomeAmount` declarado; não presumir periodicidade nem consolidar rendas |
| Lista de participantes versus presença | Inscrição temporal e marcação explícita são contratos distintos |
| Ausência de linha versus ausência física | Linha inexistente é desconhecida; nunca ABSENT automático |
| Avaliação antiga versus correção atual | Avaliação/revisões preservadas; nova avaliação usa conhecimento atual e recebe novo ID |
| Histórico e unificação versus duplicação de contagens | Mapeamento canônico e supersessão explícita, com proveniência e reconciliação |

## 3. Decisões de produto em esclarecimento

As respostas devem escolher o desenho do MVP, sem declarar que o responsável pelo desenvolvimento aprovou políticas institucionais em nome da instituição. Nenhum item abaixo é registrado como aceito antes da resposta.

| ID local | Pergunta / proposta | Efeito |
| --- | --- | --- |
| MVP-D01 | Aptidão com configuração completa, sem default e Pendente sem política, conforme PRD/ERS | Fecha formato da política e comportamento sem configuração; valores de DEC-02 continuam institucionais |
| MVP-D02 | Especificar saúde/medicamentos/religião desativados até aprovação, ou excluí-los deste MVP | Define implementação dos blocos condicionais FIC |
| MVP-D03 | Adotar quatro perfis aplicáveis, combináveis, sem social automático para Administrador | Fecha matriz ACS para implementação; validação institucional de DEC-08 continua pendente |
| MVP-D04 | Uma família ativa por pessoa ou dupla pertença | Fecha integridade de vínculo e necessidade de contexto explícito nos comandos |
| MVP-D05 | Um instituto por projeto e lista simples de participantes, conforme tratamento provisório da ERS | Fecha cardinalidade ATV no MVP, mantendo turmas/vagas/espera fora; validação institucional de DEC-04/LAC-04 continua pendente |

Após as escolhas anteriores, a próxima rodada deve confirmar as derivações necessárias que as fontes não decidem: denominador `ENROLLMENT_OR_RECORDED` para consulta operacional e declaração explícita de cobertura para sustentar negativas de aptidão. Ambas estão escritas como propostas em FRQ/APT, não requisitos institucionais inventados. Não é necessário escolher um valor de período/mínimo para implementar o mecanismo configurável.

Campo a campo da ficha, finalidades, guarda, acesso a dados reais e enquadramento institucional continuam em DEC-05/08; volumes/metas/implantação, em DEC-10. Cada função permanece restrita a dados sintéticos ou desativada enquanto a decisão pertinente não existir. O detalhamento técnico não resolve essas decisões silenciosamente.

## 4. Sequência de implementação

1. CORE: base do monorepo, migrations, contratos, transação/revisão, habilitação e dados sintéticos.
2. ACS e AUD: conta inicial, sessão/perfis, projeção e escrita auditada. AUD participa de todas as escritas seguintes.
3. CAD: identidade, famílias/vínculos/titular, busca/qualidade. O contrato de unificação deve ser concluído depois que as entidades de FIC/FRQ/APT existirem; preparar aliases/proveniência desde o início.
4. ATV: catálogos, projetos/atividades e inscrições temporais.
5. FIC e FRQ: podem ser construídos separadamente sobre a base comum; preservar suas dependências de cadastro/revisões.
6. APT: política/avaliador, cobertura e snapshots de evidência.
7. Fechar unificação transversal de CAD com todos os tipos de conflito do MVP; REL: consultas com os mesmos filtros/fontes/autorização.
8. Validar os critérios por módulo e integração transversal; documentar comandos reais e condições de piloto.

Esta ordem não autoriza liberar unificação incompleta como se tratasse conflitos de módulos ainda ausentes. A primeira etapa não precisa de aplicativo de estoques/atendimentos para validar contratos do MVP.

## 5. Cobertura de aceite e prontidão

Cada arquivo define seus cenários observáveis e identifica fonte/ID. Cenários locais `*-ACnn` são derivados para implementação, não novos IDs oficiais do PRD. AC-01/02/03/08/09 do PRD e AC-14/15/18 da ERS são cobertos no recorte; AC-04–07/10–13/16/17 ligados aos módulos excluídos não são reivindicados como aceites completos deste MVP.

Uma spec fica pronta para implementação quando as escolhas locais que mudam seu contrato estão fechadas, todos os campos/comandos/erros e cenários têm interpretação única e os contratos entre módulos concordam. Uma política ainda não escolhida pode permanecer configurável/desabilitada com resultado definido; uma alternativa estrutural ainda não escolhida não deve ser disfarçada de contrato pronto.

Uma implementação fica concluída quando entrega persistência, API e UI especificadas e passa pelos cenários aplicáveis. Uso real/piloto exige as decisões institucionais, matriz de campos/perfis e condições operacionais previstas nas fontes. Não declarar testes, migração, conformidade ou aprovação que ainda não ocorreram.
