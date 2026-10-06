# Telas e integrações do frontend

Estado em 06/10/2026, limitado ao [MVP vigente](specs/README.md).
A entrada conectada usa a API e capacidades recebidas na sessão; os adaptadores
em memória permanecem restritos ao protótipo e seus testes.

## Fluxos conectados

| Área   | Telas e operações HTTP                                                                                                                                                                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACS    | Login, sessão por cookie, logout, troca obrigatória de senha e administração de contas, perfis, ativação e redefinição de senha.                                                                                                                                                 |
| Início | Total de famílias e registros recentes autorizados, com acesso aos registros que compõem as consultas.                                                                                                                                                                           |
| CAD    | Lista paginada, busca, criação/edição, composição por data, duplicidades, unificação, tamanhos, vinculação de pessoa existente, titularidade, transferência, correção e encerramento de vínculos; prévia e confirmação de reconciliação composta e seleção de campos cadastrais. |
| ATV    | Catálogos, projetos, atividades, responsáveis e inscrições, incluindo criação, edição, encerramento e histórico.                                                                                                                                                                 |
| FRQ    | Encontros, chamada, correções, cancelamento, frequência, cobertura e correção da data/contexto familiar com prévia e revisões capturadas.                                                                                                                                        |
| FIC    | Versões da ficha, composição histórica, publicação/correção, ciência em papel, configuração explícita de campos, catálogos e decisões de habilitação.                                                                                                                            |
| APT    | Prévia familiar, consulta solicitada para as famílias da página, avaliação persistida, evidências, políticas versionadas e consulta de avaliações/políticas históricas por identificador.                                                                                        |
| REL    | Alcance, frequência, aptidão e qualidade, filtros e recuperação paginada dos registros pelo fingerprint do relatório; históricos de pessoa e família.                                                                                                                            |
| AUD    | Consulta paginada por escopo autorizado, autor, registro e período, com valores anteriores/posteriores e motivos.                                                                                                                                                                |

As rotas ficam em `apps/web/src/app/connected-app.tsx`; apresentação e
adaptadores HTTP ficam em `apps/web/src/features/`, por módulo. A ficha social
fica no perfil familiar; tamanhos e vínculos ficam no perfil individual;
catálogos ficam na área de projetos. O menu mostra as áreas permitidas ao usuário.

## Garantias e limites

Aptidão é consultada no backend, sem critérios presumidos na interface.
Filtros dos totais e dos detalhes permanecem capturados durante a consulta;
`REPORT_CHANGED` exige consultar os totais novamente. Revisões, fingerprints
e chaves de idempotência acompanham as escritas. Repetições no mesmo formulário
após perda de resposta conservam a chave quando o conteúdo permanece igual;
a recuperação de um rascunho após recarregar a página não é oferecida.

A interface preserva dados desconhecidos e distingue inscrição de presença.
Autorização e auditoria permanecem responsabilidade do backend. Configuração
FIC consulta metadados completos por uma rota exclusiva da Coordenação;
leitura de ficha continua projetada por perfis, seleção e flags.

Saúde, medicamentos e religião dependem de habilitação explícita. A entrega
não aprova coleta real nem resolve decisões institucionais abertas. Demonstrações
usam dados sintéticos. Notificações, exportação CSV/PDF, atendimentos realizados,
estoque, entregas, Bazar e migração permanecem fora do escopo.

## Validação

Testes Vitest cobrem adaptadores HTTP, permissões das rotas e fluxos de UI,
incluindo repetição de escritas, duplicidades, fingerprints de relatórios,
composição histórica e dados desconhecidos. Tipos, lint e builds usam os scripts
do [README](../README.md#validar). A rota de configuração FIC foi validada
com PostgreSQL/Redis de teste. A conferência no navegador foi amostral;
não substitui uma homologação completa de todas as escritas.
