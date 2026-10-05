# Especificações de implementação do MVP

Base documental: PRD 1.1 (18/09/2026), ERS 1.0 (24/09/2026), modelagem 1.1 (28/09/2026), ficha de famílias 2025 e decisões de escopo/stack do [AGENTS.md](../../AGENTS.md).

**Situação:** contratos fechados para implementação do MVP, com as recomendações aceitas pelo responsável pelo projeto em 01/10/2026 e as derivações técnicas registradas na seção 3. As políticas institucionais ainda abertas têm comportamento configurável, desativado ou Pendente definido nas specs. CORE, ACS e auditoria de contas têm implementação e testes; o [README](../../README.md) registra o estado e os comandos de validação. Os demais módulos do MVP continuam pendentes.

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
| Instituto obrigatório/exclusivo apresentado pela ERS versus pendência do PRD | Um instituto por projeto adotado para o MVP em MVP-D05; ratificação institucional de LAC-04 permanece separada |
| Campo existente no formulário versus aprovação de coleta | Matriz campo a campo e flags; nenhum bloco real habilitado automaticamente |
| Renda “mensal” no nome de atributo da modelagem versus papel sem periodicidade | `incomeAmount` declarado; não presumir periodicidade nem consolidar rendas |
| Lista de participantes versus presença | Inscrição temporal e marcação explícita são contratos distintos |
| Ausência de linha versus ausência física | Linha inexistente é desconhecida; nunca ABSENT automático |
| Avaliação antiga versus correção atual | Avaliação/revisões preservadas; nova avaliação usa conhecimento atual e recebe novo ID |
| Histórico e unificação versus duplicação de contagens | Mapeamento canônico e supersessão explícita, com proveniência e reconciliação |

## 3. Decisões do MVP

Em 01/10/2026, o responsável pelo projeto escolheu as recomendações de todas as cinco perguntas apresentadas. MVP-D01–05 registram essa escolha de produto. MVP-D06–07 são derivações técnicas adotadas para concretizar os contratos de frequência e evidência, sob o mesmo desenho; não são regras institucionais atribuídas ao levantamento.

| ID local | Decisão adotada | Efeito |
| --- | --- | --- |
| MVP-D01 | Aptidão configurável, sem valores padrão e Pendente sem política | Fecha formato e comportamento do mecanismo; valores de DEC-02 continuam institucionais |
| MVP-D02 | Implementar saúde, medicamentos e religião desativados por padrão até aprovação específica | Inclui estruturas/validações/proteção FIC; não habilita coleta ou leitura automaticamente |
| MVP-D03 | Quatro perfis combináveis: Coordenação, Assistência Social, Responsável por Atividade e Administrador | Fecha matriz ACS sem acesso social automático para Administrador; validação institucional de DEC-08 continua pendente |
| MVP-D04 | No máximo uma família vigente por pessoa, preservando os vínculos anteriores | Proíbe sobreposição de pertença na mesma identidade canônica; família atual pode ser desconhecida quando não houver vínculo vigente |
| MVP-D05 | Um instituto por projeto e lista simples de participantes, conforme tratamento provisório da ERS | Fecha cardinalidade ATV no MVP, mantendo turmas/vagas/espera fora; validação institucional de DEC-04/LAC-04 continua pendente |
| MVP-D06 | Denominador operacional `ENROLLMENT_OR_RECORDED` | Frequência considera inscrição válida no encontro ou marcação avulsa explícita; não presume faltas anteriores à inscrição |
| MVP-D07 | Declaração explícita e versionada de cobertura dos encontros | Permite comprovar completude sem inferir que a ausência de registros é ausência factual; alterações relevantes invalidam a declaração |

Essas decisões fecham as alternativas estruturais das specs. MVP-D06 define a consulta operacional; uma política de aptidão continua exigindo seleção explícita de sua modalidade de oportunidades conforme SPEC-APT, sem herdar um default oculto. MVP-D07 não transforma declaração de cobertura em presença individual nem força uma negativa sem evidência suficiente. Não é necessário escolher um valor institucional de período/mínimo para implementar o mecanismo configurável.

A organização vigente, por decisão do responsável pelo projeto, mantém a API principal na raiz, a UI em `apps/web` e os contratos em `packages/contracts`. Cada módulo separa domínio, aplicação, apresentação e infraestrutura quando necessário, conforme SPEC-CORE. Essa mudança de organização não altera o recorte nem aprova políticas institucionais.

Ratificação institucional de composição familiar e organização de projetos continua em DEC-01/04; período/mínimo/atividades de aptidão, em DEC-02; campo a campo da ficha, finalidades, guarda, acesso a dados reais e enquadramento institucional, em DEC-05/08; volumes/metas/implantação, em DEC-10. Desenvolvimento e demonstração usam dados sintéticos; a liberação real depende da decisão pertinente. A escolha do desenho pelo responsável pelo projeto não declara aprovação institucional em nome da instituição.

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

As escolhas locais que alteram os contratos estão fechadas na seção 3. Implementar os modelos/comandos/erros e cenários definidos, preservando os contratos entre módulos. Políticas ainda não escolhidas permanecem configuráveis/desativadas com resultado definido; sua ausência não autoriza inventar obrigatoriedade, valores de aptidão ou liberação de dados reais.

Uma implementação fica concluída quando entrega persistência, API e UI especificadas e passa pelos cenários aplicáveis. Uso real/piloto exige as decisões institucionais, matriz de campos/perfis e condições operacionais previstas nas fontes. Não declarar testes, migração, conformidade ou aprovação que ainda não ocorreram.
