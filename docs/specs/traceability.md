# Rastreabilidade dos requisitos do MVP

Fonte: [ERS 1.0](<../ERS — ERP Social Luz da Esperança.md>), catálogo de 101 requisitos funcionais. Autoridade do recorte: [AGENTS.md](../../AGENTS.md). Esta matriz identifica a cobertura prevista pelas specs, não testes executados ou aprovação institucional. Decisões adotadas do MVP e condições institucionais pendentes estão no [índice](README.md).

## Requisitos incluídos

São 53 requisitos funcionais no recorte, sendo 3 de relatórios parcialmente aplicáveis e RF-FIC-06 incluído para implementação, desativado até aprovação específica de uso. Os cenários abaixo são locais às specs.

| Requisito da ERS | Spec proprietária / contrato | Aceite previsto |
| --- | --- | --- |
| RF-CAD-01 | CAD — Família e código único | CAD-AC02/10 |
| RF-CAD-02 | CAD — Pessoa e dados opcionais | CAD-AC01/06 |
| RF-CAD-03 | CAD — Vínculo temporal e pertença única vigente | CAD-AC01/02/03/18 |
| RF-CAD-04 | CAD — Troca de titular | CAD-AC04/05 |
| RF-CAD-05 | CAD — Transferência/correção e histórico | CAD-AC03/04/16/17; FRQ-AC12 |
| RF-CAD-06 | CAD — Busca prévia e revisão de candidatos | CAD-AC06/11 |
| RF-CAD-07 | CAD — Unificação e reconciliação | CAD-AC07/08/09/12/13/15 |
| RF-CAD-08 | CAD — Dados ausentes sem bloqueio | CAD-AC01; FIC-AC04 |
| RF-CAD-09 | CAD — Composição derivada em data | CAD-AC10 |
| RF-CAD-10 | CAD — Tamanhos datados, LAC-12 para adultos | CAD-AC14/15; FIC-AC13; seleção de campo |
| RF-CAD-11 | CAD — Cadastro mínimo antes de presença avulsa | CAD-AC01; FRQ-AC04 |
| RF-FIC-01 | FIC — Domicílio, opções e seleção campo a campo | FIC-AC01/03/10 |
| RF-FIC-02 | FIC — Economia familiar e por membro | FIC-AC04/05 |
| RF-FIC-04 | FIC — Educação individual selecionada | FIC-AC05 |
| RF-FIC-05 | FIC — Necessidades declaradas | FIC-AC01/03 |
| RF-FIC-06 | FIC — Saúde/religião implementadas e desativadas até aprovação, bloco protegido | FIC-AC06/07/12/16 |
| RF-FIC-07 | FIC — Situação encontrada com autoria/data | FIC-AC01/06; AUD-AC02 |
| RF-FIC-08 | FIC — Publicação imutável versionada | FIC-AC02/03/09/11/13/14/15 |
| RF-FIC-09 | FIC — Ciência conhecida sem consentimento presumido | FIC-AC08 |
| RF-ATV-01 | ATV — Seis institutos | ATV-AC01/09 |
| RF-ATV-02 | ATV — Projetos, instituto único e vigência | ATV-AC02/06/10/13 |
| RF-ATV-03 | ATV — Natureza da atividade | ATV-AC02/03 |
| RF-ATV-04 | ATV — Horário previsto e responsável | FRQ-AC01/05; cadastro de atividade |
| RF-ATV-05 | ATV — Catálogo de tipo pontual, sem realização | ATV-AC03/09 |
| RF-ATV-06 | ATV — Natureza bloqueada após registros | ATV-AC04/05 |
| RF-ATV-07 | ATV — Inscrição temporal distinta de presença | ATV-AC02/08; FRQ-AC02 |
| RF-ATV-08 | ATV — Encerramento preserva fatos | ATV-AC06/07/11/12 |
| RF-FRQ-01 | FRQ — Encontro confirmado, data/responsável | FRQ-AC01/03/05 |
| RF-FRQ-02 | FRQ — PRESENT/ABSENT explícitos | FRQ-AC02/06/10/15/16 |
| RF-FRQ-03 | FRQ — Presença avulsa | FRQ-AC04 |
| RF-FRQ-04 | FRQ — Correção com motivo/revisão | FRQ-AC08; AUD-AC02 |
| RF-FRQ-06 | FRQ — Consulta com denominador/completude | FRQ-AC03/09/10/13/14/17; REL-AC09/13 |
| RF-FRQ-07 | FRQ — Cancelamento sem apagar | FRQ-AC09 |
| RF-APT-01 | APT — Avaliação em data e três situações | APT-AC01/02/06/09 |
| RF-APT-02 | APT — Política configurável sem defaults | APT-AC01/11/12 |
| RF-APT-03 | APT — Vigência/versões de política | APT-AC03/05/12 |
| RF-APT-04 | APT — Membro/atividade/período e evidências | APT-AC02/07/08/10 |
| RF-APT-05 | APT — Somente presença periódica | APT-AC04 |
| RF-APT-06 | APT — Pendente separado de Não apta | APT-AC01/06/09; REL-AC08 |
| RF-APT-07 | REL — Lista de aptas na referência, mesmo avaliador | REL-AC07/08 |
| RF-REL-01 | REL — Histórico familiar parcial: vínculos/ficha/frequência | REL-AC01/03/04/06 |
| RF-REL-02 | REL — Histórico pessoal parcial: vínculos/atividades/frequência | REL-AC02/04/06 |
| RF-REL-03 | REL — Alcance parcial: pessoas/famílias/encontros/presenças | REL-AC01/02/10 |
| RF-REL-04 | REL — Frequência, usando FRQ | REL-AC09/13 |
| RF-REL-07 | REL — Origem de cada total | REL-AC05 |
| RF-REL-08 | REL — Aptidão nas três situações | REL-AC07/08 |
| RF-REL-09 | CAD/REL — Issues, identificação e resolução | REL-AC11; CAD-AC06/07 |
| RF-ACS-01 | ACS — Login individual e sessão | ACS-AC01/06/07/08/09/10/12/13/14 |
| RF-ACS-02 | ACS — Contas/perfis combináveis | ACS-AC03/04 |
| RF-ACS-03 | ACS — Projeção e restrição social | ACS-AC02/03/05; FIC-AC06/07 |
| RF-ACS-04 | AUD — Alteração e trilha atômicas | AUD-AC01/02/06/07/08/09/10/11 |
| RF-ACS-05 | AUD — Data do fato e lançamento | AUD-AC03; FRQ-AC05 |
| RF-ACS-06 | ACS/AUD — Desativação e autoria preservada | ACS-AC05/11; AUD-AC04 |

## Requisitos fora desta entrega

| Requisito ou grupo | Quantidade | Motivo |
| --- | --- | --- |
| RF-FIC-03/10 | 2 | Renda total/per capita e alerta: desejáveis sem inclusão |
| RF-ATV-09 | 1 | Turmas/vagas/espera: desejável sem inclusão |
| RF-FRQ-05/08 | 2 | Justificativa e alerta: desejáveis sem inclusão |
| RF-REL-10 | 1 | CSV/PDF: desejável sem inclusão |
| RF-ACS-07 | 1 | Log de consulta: desejável sem inclusão |
| RF-ATD-01–09 | 9 | Atendimentos realizados fora do MVP |
| RF-EST-01–11 | 11 | Estoque fora do MVP |
| RF-ENT-01–09 | 9 | Entregas/compatibilidade/prioridade fora do MVP |
| RF-BAZ-01–04 | 4 | Bazar fora do MVP |
| RF-MIG-01–06 | 6 | Migração fora do MVP |
| RF-REL-05/06 | 2 | Relatórios exclusivamente de estoque/entregas |

Total: 53 cobertos no recorte + 7 evoluções adiadas + 41 relacionados aos módulos excluídos = 101. Nos três REL parciais, somente o recorte é reivindicado; não declarar cumprimento das partes de atendimento/estoque/entrega.

## Contratos transversais e aceite do negócio

CORE é proprietário de IU-01/02/06/07 e INT-04; FRQ de IU-04/05 no que se aplica a chamada; CAD e as telas consumidoras de IU-03, respeitando projeção. ACS implementa os mecanismos RNF-SEG-01–04; FIC protege os blocos de RNF-SEG-05; backup/exportação não implementada não concede outro acesso em RNF-SEG-06. Operação/backup/desempenho RNF-CON/DIS/DES continuam sujeitos ao contexto de implantação e LAC-10.

PRD AC-01 → CAD/REL; AC-02 → APT; AC-03 → APT/FRQ; AC-08 → CAD/FRQ/AUD; AC-09 → ACS/FIC/REL/AUD. ERS AC-14 → APT; AC-15 → CAD; AC-18 → FRQ/AUD. Os demais aceites de módulos excluídos não são reclamados como implementados. Auditoria e idempotência seguem modelagem §1.2/D-10; integridade temporal, D-01/D-03; fotografia social, D-09.
