# SPEC-REL — Consultas, históricos e relatórios do MVP

Versão 1.0 · Dependências: [CORE](00-foundation.md), [CAD](02-registration.md), [FIC](03-social-forms.md), [ATV](04-projects-activities.md), [FRQ](05-attendance.md), [APT](06-eligibility.md), [ACS](01-access.md). Fontes: PRD 1.1 OBJ-01/02/03/06, CAP-10 parcialmente, RN-09/15/16, AC-01/02/03/08/09; ERS RF-REL-01/02/03/04/07/08/09; modelagem §4.2. RF-REL-05/06 são de estoque/entregas e ficam fora; CSV/PDF RF-REL-10 é evolução excluída.

**Implementação backend em 05/10/2026:** as dez rotas, os contratos públicos e a leitura em snapshot único estão entregues e testados, inclusive com PostgreSQL/Redis. A [referência HTTP](../api/reports.md) registra contratos, erros e projeções. Não há migration: REL só lê. As telas desta spec continuam pendentes e as metas de desempenho não foram medidas.

Derivações técnicas da implementação, sem alterar a regra: o relatório de frequência exige `activityId`, porque a projeção de oportunidades de FRQ é por atividade; a projeção de oportunidades foi extraída para uma função pura de FRQ, usada tanto pela consulta individual quanto pelo relatório; aptidão usa `EligibilityService.evaluateAll`, o mesmo avaliador da prévia; o histórico familiar exige `registration.read` e o pessoal, `participants.lookup`, cada tipo de evento filtrado por sua permissão antes da leitura; o histórico familiar não lista inscrições, que ficam no histórico da pessoa; eventos de ficha informam apenas versão e proveniência; avaliações salvas entram no histórico pela data de referência; filtro de referência inexistente responde 422 `REPORT_FILTER_UNKNOWN`.

## 1. Resultado e unidade de contagem

Oferecer histórico familiar e pessoal e relatórios de alcance, frequência, aptidão e qualidade cadastral somente sobre fatos deste MVP. Não criar cadastro paralelo, “saldo” de atendimentos fictícios nem linha de quantidade de doação zero para representar um módulo não implementado.

| Relatório | Unidade e inclusão |
| --- | --- |
| Histórico familiar | Vínculos/titularidade, versões autorizadas da ficha, inscrições quando pertinentes, encontros/presenças na família histórica e avaliações de aptidão |
| Histórico pessoal | Vínculos, atividades/inscrições, encontros/marcações e versões da ficha em que integra a composição, com dados autorizados desse membro |
| Alcance | Pessoas canônicas únicas com ao menos uma marcação PRESENT válida; famílias canônicas únicas desses fatos; encontros COMPLETED; presenças como unidade separada |
| Frequência | Encontros pertinentes, presentes, ausentes, não registrados, percentual/completude e cancelados identificados à parte |
| Aptidão | Quantidade/lista de famílias Apta, Não apta e Pendente em uma referência, motivo, política e evidências permitidas |
| Qualidade cadastral | Issues de possíveis duplicidades/dados ausentes, abertas/resolvidas, identificação/resolução e motivo |

Família com dois membros presentes é uma família alcançada e duas pessoas; a mesma pessoa em dois encontros conta uma pessoa e duas presenças. Inscrição e ficha publicada não constituem participação realizada nem entram como alcance. Uma família só cadastrada pode aparecer em cadastro/qualidade/aptidão, sem ser chamada de alcançada por atividade.

Histórico individual de uma pessoa não concede acesso aos dados sociais de outros membros da mesma ficha: renderizar apenas contexto familiar autorizado e bloco individual permitido, a menos que o perfil tenha direito à ficha integral.

## 2. Períodos, filtros, ordenação e fontes

Intervalos de relatórios são civis `from` e `toExclusive` no fuso CORE. Filtrar fatos por `occurredAt`, convertendo os limites civis em instantes; qualidade usa `identifiedAt` ou `resolvedAt` segundo o filtro `dateBasis`. Auditoria por data do lançamento pertence a SPEC-AUD. Informar `generatedAt`, período, filtros normalizados, unidade de contagem, método e `queryFingerprint` em cada retorno.

Filtros comuns aplicáveis: `instituteId?`, `projectId?`, `activityId?`, `familyId?`, `personId?`; somente os compatíveis com o relatório são aceitos. Filtros hierárquicos conflitantes retornam 400/422, sem produzir total vazio enganoso. “Todos” significa todos os registros autorizados no recorte, não acesso a campos restritos.

Identidades unificadas são resolvidas canonicamente para contagem e busca; a linha de origem conserva código/vínculo/família factual. Transferência real não move frequência passada para outra família. Cancelados e marcações supersedidas ficam excluídos dos totais válidos e consultáveis à parte com motivo/proveniência.

Históricos ordenam `occurredAt`, depois `recordedAt`, depois `id`, com sentido informado; linhas com referência civil usam sua data e tipo de origem para ordenação estável. Uma versão de ficha é distinguida de uma mudança cadastral; a UI não deve transformar um snapshot em atendimento realizado.

## 3. Totais e detalhe coerentes

Cada consulta de relatório lê fontes em snapshot PostgreSQL consistente. A mesma definição de filtros/projeções gera totais e linhas, sem uma consulta ampla de total e outra restrita de detalhe. Agrupamentos carregam os IDs das unidades contadas ou critérios reprodutíveis de seleção.

O servidor calcula `queryFingerprint` de filtros, modalidade do relatório e identidades/revisões relevantes, incluindo as fontes que determinam completude. Ao abrir ou paginar o detalhe do total, o cliente envia `expectedQueryFingerprint` e os mesmos filtros. Se as fontes mudaram, retornar `409 REPORT_CHANGED` para atualizar totais/lista; não mostrar lista nova como prova exata de total antigo. Esse erro segue o envelope CORE.

O fingerprint não concede acesso nem funciona como autorização. Cada requisição autentica novamente e aplica a matriz atual. Se revogação alterar o universo autorizado, o detalhe é negado ou exige atualização; não reproduz o total anterior com dados agora proibidos.

Não persistir cada GET como relatório/avaliação. Não existe um requisito de materializar dashboards ou agendar relatórios neste MVP. Dados em memória/Redis não criam outra fonte de contagem.

## 4. Aptidão e frequência no relatório

Relatório de aptidão chama o mesmo avaliador puro de SPEC-APT sobre snapshot único da referência. Classificar primeiro todas as famílias autorizadas necessárias ao total; aplicar filtro de situação e só depois paginar. Não classificar somente a página retornada e apresentá-la como total global.

`PENDING` fica separado de `INELIGIBLE`, inclusive em filtros e contagens. Sem política vigente, todas as famílias avaliáveis ficam Pendentes e `policyId=null`. Resultado traz motivos/evidências e indica que é uma consulta calculada em `generatedAt`; leitura de avaliação persistida antiga é outra operação, não substitui silenciosamente o resultado atual.

Frequência reutiliza a projeção de oportunidades, os contadores/denominador e as três dimensões de completude de SPEC-FRQ; filtro familiar é aplicado ao contexto histórico antes de contar. Nenhum relatório redefine desconhecido como ausente para completar uma taxa. A taxa global por atividade é derivada de oportunidades dos participantes e marcada desconhecida se incompleta; pode apresentar contagens conhecidas e completude separadas. Não calcular média simples de percentuais individuais com denominadores distintos.

## 5. API e interface

| Método / caminho | Filtros / saída |
| --- | --- |
| `GET /families/:familyId/history` | Período, `eventTypes?`, ordenação/paginação; eventos familiares autorizados |
| `GET /people/:personId/history` | Período, tipos e paginação; vínculos e fatos pessoais |
| `GET /reports/reach` | Período e filtros de atividade/projeto/instituto; totais e grupos |
| `GET /reports/reach/records` | Mesmos filtros, `unit=PERSON/FAMILY/SESSION/PRESENCE`, fingerprint, paginação; origem da unidade clicada |
| `GET /reports/frequency` | Período, atividade/pessoa/família quando permitido; contagens e cobertura |
| `GET /reports/frequency/records` | Mesmos filtros, unidade e fingerprint; encontros/marcações de origem |
| `GET /reports/eligibility` | `referenceDate`, `status?`, `familyId?`, paginação; totais e famílias/evidências |
| `GET /reports/eligibility/records` | Mesma referência/filtros/fingerprint; famílias que compõem situação selecionada |
| `GET /reports/data-quality` | Período, `kind?`, `status?`, `dateBasis=IDENTIFICATION/RESOLUTION`; totais/lista de issues |
| `GET /reports/data-quality/records` | Mesmos filtros/fingerprint, paginação; issues e resoluções autorizadas |

Todas exigem a permissão do domínio somada à consulta de relatório conforme ACS. Frequência vê a projeção mínima, nunca documento/endereço/ficha/renda por join. História/relatório que contêm tipos de evento proibidos filtram-nos no backend; nomes de blocos e contagens não revelam a existência de informação totalmente restrita.

`/reports` oferece alcance, frequência, aptidão e qualidade; filtros aparecem junto dos totais, com unidade e data de geração. Todo total oferece detalhe correspondente. `/families/:id/history` e `/people/:id/history` distinguem fonte, situação e datas, com cancelados/correções recuperáveis por operadores autorizados. Não oferecer menus de estoque, entregas, migração ou exportações não implementadas.

## 6. Critérios de aceite

| ID | Cenário |
| --- | --- |
| REL-AC01 | Dois membros da mesma família em atividades diferentes produzem histórico familiar comum, duas pessoas e uma família alcançada |
| REL-AC02 | Pessoa com duas presenças conta uma pessoa e duas presenças; inscrição sem presença não aumenta alcance |
| REL-AC03 | Cancelamento/duplicata supersedida alteram total válido e continuam identificáveis no histórico |
| REL-AC04 | Família atual difere da família do fato; filtro/histórico antigo conservam o contexto factual |
| REL-AC05 | Um total e sua lista usam período/filtros/permissões iguais; alteração intermediária retorna REPORT_CHANGED |
| REL-AC06 | Perfil de frequência não recebe informação social por total, drill-down, filtro, histórico pessoal ou projeção da ficha |
| REL-AC07 | Aptidão lista as três situações separadamente e usa a mesma política/algoritmo do detalhe da família |
| REL-AC08 | Sem política, Pendentes não são somadas a Não aptas; a contagem global não depende da página |
| REL-AC09 | Taxa incompleta ou denominador zero é desconhecida, com contagens conhecidas explícitas |
| REL-AC10 | Unificação agrega identidades sem contar duas vezes e preserva origem dos eventos consultados |
| REL-AC11 | Issue corrigida tem identificação e resolução; filtro de data informa qual delas foi usado |
| REL-AC12 | GET de relatório não grava outra avaliação/ficha/evento de negócio e não inclui módulos fora do MVP |
| REL-AC13 | Frequência filtrada por família usa a projeção FRQ, conservando contexto das oportunidades marcadas e não marcadas; total/detalhe concordam |

Testes Vitest por API pública usam dados sintéticos com múltiplas pessoas/famílias/atividades, filtros cruzados, vínculos mudados, duplicidades e cancelamentos; integração comprova que totais e linhas vêm do mesmo universo. Metas de desempenho permanecem condicionadas ao volume de LAC-10, conforme CORE.
