# Telas e integrações do frontend

Estado em 09/10/2026, limitado ao [MVP vigente](specs/README.md).
A entrada conectada usa a API e capacidades recebidas na sessão; os adaptadores
em memória permanecem restritos ao protótipo e seus testes.

## Fluxos conectados

| Área   | Telas e operações HTTP                                                                                                                                                                                                                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACS    | Login, sessão por cookie, logout, troca obrigatória de senha e administração de contas, perfis, ativação e redefinição de senha.                                                                                                                                                                                                 |
| Início | Composição do [protótipo do dashboard](design-prototype/00-initial-screen/dashboard/screen.png): saudação e data local, ações rápidas com ícones, rotinas do MVP em “Para hoje” e alterações familiares em “Atividade recente”. Total e registros vêm da API, respeitando as permissões.                                         |
| CAD    | Lista paginada, busca, criação/edição com CPF válido e único, máscara no formulário e no perfil, composição por data, tamanhos, vinculação de pessoa existente, titularidade, transferência, correção e encerramento de vínculos; reconciliação composta e seleção de campos cadastrais. A central de duplicidades foi retirada. |
| ATV    | Catálogos, projetos, atividades, responsáveis e inscrições, incluindo criação, edição, encerramento e histórico.                                                                                                                                                                                                                 |
| FRQ    | Encontros, chamada, correções, cancelamento, frequência, cobertura e correção da data/contexto familiar com prévia e revisões capturadas.                                                                                                                                                                                        |
| FIC    | Ficha fixa de famílias de 2025, composição histórica, publicação/correção, perguntas Sim/Não com detalhes condicionais e ciência em papel.                                                                                                                                                                                       |
| APT    | Prévia familiar, consulta solicitada para as famílias da página, avaliação persistida, evidências, políticas versionadas e consulta de avaliações/políticas históricas por identificador.                                                                                                                                        |
| REL    | Alcance, frequência, aptidão e qualidade, filtros e recuperação paginada dos registros pelo fingerprint do relatório; históricos de pessoa e família.                                                                                                                                                                            |
| AUD    | Consulta paginada por escopo autorizado, autor, registro e período, com valores anteriores/posteriores e motivos.                                                                                                                                                                                                                |

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

Em 09/10/2026, o cadastro de família passou a consultar endereço e bairro ao
completar os oito dígitos do CEP, usando o [ViaCEP](https://viacep.com.br/).
O endereço continua editável para número e complemento. Consultas antigas são
canceladas; a resposta preserva edições manuais feitas durante a consulta.
CEP inexistente, falha do serviço ou logradouro ausente permitem preenchimento
manual. O serviço recebe somente o CEP, sem cookies ou dados pessoais do formulário.
CEP e telefones de pessoa/família possuem máscara e são enviados à API somente
com dígitos. Renda usa separadores brasileiros na tela e decimal na API;
campo vazio continua desconhecido, distinto de zero declarado.

A ficha fixa de 2025 está implementada conforme [SPEC-FIC](specs/03-social-forms.md).
O menu e a rota “Configuração da ficha” foram retirados. “Nova versão” prepara
o modelo fixo ao solicitar a composição, com escrita explícita e idempotente.
Todos os campos aplicáveis são obrigatórios, com Sim/Não sem seleção inicial;
Sim exige detalhes e Não dispensa seu preenchimento. Observações usam linhas
datadas e as assinaturas registram declarações sobre o papel. Identificação,
endereço e tamanhos vêm do cadastro; a tela aponta os dados faltantes e oferece
atalhos de edição. O quadro de crianças/adolescentes usa seleção explícita dos
membros, sem inferir faixa etária. Versões antigas continuam disponíveis.

Os perfis de família e pessoa usam ações com borda, ícone e foco visível.
Os membros têm acesso direto ao perfil individual. Histórico, ficha e aptidão
mantêm os mesmos destinos e permissões, com ações agrupadas e adaptação ao celular.
O histórico apresenta tipo, data e sinalização de cancelamento/correção; detalhes
de origem ficam recolhidos. Os tipos são filtrados por checkboxes. O fim do período
inclui o dia escolhido na tela e é convertido para `toExclusive` ao chamar a API.
A aptidão destaca situação, datas e contagens por membro; revisões técnicas
permanecem disponíveis em uma seção recolhida. As versões da ficha mostram a
seleção atual, datas brasileiras e renda em reais. Atualizar a lista de fichas
preserva o preenchimento em andamento; cancelar o preenchimento é uma ação explícita.

## Garantias e limites

Aptidão é consultada no backend, sem critérios presumidos na interface.
Filtros dos totais e dos detalhes permanecem capturados durante a consulta;
`REPORT_CHANGED` exige consultar os totais novamente. Revisões, fingerprints
e chaves de idempotência acompanham as escritas. Repetições no mesmo formulário
após perda de resposta conservam a chave quando o conteúdo permanece igual;
a recuperação de um rascunho após recarregar a página não é oferecida.

A interface preserva dados desconhecidos e distingue inscrição de presença.
Autorização e auditoria permanecem responsabilidade do backend. As APIs legadas
de configuração preservam contratos anteriores; após a adoção do formulário fixo,
não permitem alterar sua seleção/catálogos. Leitura de ficha continua projetada
por perfis, seleção e flags.

Saúde, medicamentos e religião dependem de habilitação explícita; a preparação
do modelo fixo registra essa habilitação somente para a demonstração sintética.
A entrega
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

A ficha fixa de 09/10/2026 foi validada por testes de interação, contratos,
regras, tipos, lint e builds. Os novos testes PostgreSQL de preparação concorrente
e rollback estão escritos, mas sua execução ficou bloqueada por `spawnSync pnpm
EPERM` na preparação e por falta de acesso ao daemon Docker. A conferência visual
dessa ficha também depende de ambiente que permita abrir o servidor local.

Os refinamentos dos perfis, histórico, ficha e aptidão de 09/10/2026 incluem testes
de interação para destinos, filtros, seleção de versões, formatação e preservação
do preenchimento. Há um teste de navegador para bordas, ícones, foco e disposição
dos atalhos familiares em 1440 e 390 px; sua execução permanece pendente porque
o servidor local retorna `listen EPERM` neste ambiente.

A adaptação do início ao print do dashboard cobre saudação/data, acessos
autorizados e identificação das alterações familiares nos testes de componente.
Há dois casos adicionais de navegador para proporções dos painéis e composição
no celular. A execução final desses casos em 07/10/2026 ficou bloqueada por
`listen EPERM` ao abrir o servidor Vite no ambiente restrito; a conferência visual
final dessa adaptação permanece pendente em um ambiente com rede local permitida.
