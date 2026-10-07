# Telas e integrações do frontend

Estado em 06/10/2026, limitado ao [MVP vigente](specs/README.md).
A entrada conectada usa a API e capacidades recebidas na sessão; os adaptadores
em memória permanecem restritos ao protótipo e seus testes.

## Fluxos conectados

| Área   | Telas e operações HTTP                                                                                                                                                                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACS    | Login, sessão por cookie, logout, troca obrigatória de senha e administração de contas, perfis, ativação e redefinição de senha.                                                                                                                                                                                     |
| Início | Composição do [protótipo do dashboard](design-prototype/00-initial-screen/dashboard/screen.png): saudação e data local, ações rápidas com ícones, rotinas do MVP em “Para hoje” e alterações familiares em “Atividade recente”. Total e registros vêm da API, respeitando as permissões.                             |
| CAD    | Lista paginada, busca, criação/edição com CPF válido e único, máscara no formulário e no perfil, composição por data, tamanhos, vinculação de pessoa existente, titularidade, transferência, correção e encerramento de vínculos; reconciliação composta e seleção de campos cadastrais. A central de duplicidades foi retirada. |
| ATV    | Catálogos, projetos, atividades, responsáveis e inscrições, incluindo criação, edição, encerramento e histórico.                                                                                                                                                                                                     |
| FRQ    | Encontros, chamada, correções, cancelamento, frequência, cobertura e correção da data/contexto familiar com prévia e revisões capturadas.                                                                                                                                                                            |
| FIC    | Versões da ficha, composição histórica, publicação/correção, ciência em papel, configuração explícita de campos, catálogos e decisões de habilitação.                                                                                                                                                                |
| APT    | Prévia familiar, consulta solicitada para as famílias da página, avaliação persistida, evidências, políticas versionadas e consulta de avaliações/políticas históricas por identificador.                                                                                                                            |
| REL    | Alcance, frequência, aptidão e qualidade, filtros e recuperação paginada dos registros pelo fingerprint do relatório; históricos de pessoa e família.                                                                                                                                                                |
| AUD    | Consulta paginada por escopo autorizado, autor, registro e período, com valores anteriores/posteriores e motivos.                                                                                                                                                                                                    |

As rotas ficam em `apps/web/src/app/connected-app.tsx`; apresentação e
adaptadores HTTP ficam em `apps/web/src/features/`, por módulo. A ficha social
fica no perfil familiar; tamanhos e vínculos ficam no perfil individual;
catálogos ficam na área de projetos. O menu mostra as áreas permitidas ao usuário.

Em 07/10/2026, por exigência de Dário comunicada pelo responsável pelo projeto,
a tela e a rota “Duplicidades e qualidade” foram removidas, incluindo componentes
de comparação/unificação e atalhos no início. O cadastro de pessoa não oferece
exceção por justificativa: CPF repetido na criação ou edição retorna um bloqueio
com mensagem específica. A máscara não é persistida; o value object `Cpf` e os
schemas compartilhados normalizam e validam o documento. CPF desconhecido
continua permitido. A regra de revisão de núcleos familiares semelhantes permanece
no próprio cadastro de família; a exigência confirmada de unicidade é por CPF.

Os históricos de auditoria e de qualidade já persistidos continuam disponíveis
nos contratos de leitura/relatórios. A proteção de concorrência exige aplicar a
migration de [unicidade do CPF](api/registration.md#migration-de-unicidade-do-cpf).

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

A revisão visual usa os protótipos de `docs/design-prototype/` como referência.
Os controles compartilhados distinguem campos de texto de checkboxes/radios,
mantêm o marcador obrigatório junto ao rótulo e evitam esticar botões no grid.
Formulários lineares têm largura limitada; as ações de gestão ficam juntas e as
seções da página têm espaçamento próprio. A navegação lateral permite rolagem
sem ocultar a saída; no celular, o menu fechado fica fora da navegação por
teclado e o menu aberto controla foco, Tab e Escape.

`apps/web/src/index.css` importa `app.css` na camada `components` do Tailwind.
Isso permite que as utilities de cada tela sobrescrevam os padrões
compartilhados, incluindo largura mínima das tabelas, margens e tipografia.

Os testes de layout renderizam os componentes reais com o CSS compilado em um
servidor Vite isolado. Usam Chromium pelo CLI `agent-browser`, sem depender de
contas, banco ou credenciais. Com o CLI e seu navegador instalados, execute:

```bash
AGENT_BROWSER_BIN=/caminho/para/agent-browser \
pnpm test apps/web/test/shared/ui-layout.browser.test.tsx
```

Sem `AGENT_BROWSER_BIN`, essa suíte visual fica explicitamente ignorada; os
testes de interação continuam na suíte normal. A revisão das telas conectadas
também inclui larguras de 1440 e 390 px, com dados sintéticos.

A adaptação do início ao print do dashboard cobre saudação/data, acessos
autorizados e identificação das alterações familiares nos testes de componente.
Há dois casos adicionais de navegador para proporções dos painéis e composição
no celular. A execução final desses casos em 07/10/2026 ficou bloqueada por
`listen EPERM` ao abrir o servidor Vite no ambiente restrito; a conferência visual
final dessa adaptação permanece pendente em um ambiente com rede local permitida.
