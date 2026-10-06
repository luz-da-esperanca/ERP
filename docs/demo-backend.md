# Demonstração sintética do backend

Roteiro para 06/10/2026. Use um ambiente de demonstração com `DATA_MODE=SYNTHETIC`, PostgreSQL e Redis disponíveis. A autenticação da interface já usa HTTP; as telas dos demais módulos dependem das integrações da frente de frontend. Este roteiro permite conferir os contratos por um cliente HTTP enquanto essas telas são concluídas.

## Preparação

Siga o [ambiente local](../README.md#executar-a-api-local), incluindo chaves e bootstrap. Aplique a migration desta entrega:

```bash
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Em outro terminal, `pnpm dev:web` inicia a interface. Acesse `http://localhost:5173`. `GET /api/v1/health` deve responder 200. Não execute a suíte de integração contra o banco da apresentação: ela limpa o banco exclusivo de testes.

É necessária uma conta de Coordenação para o roteiro. O bootstrap cria somente Administrador. Se ainda não existir uma conta operacional, autentique o Administrador, troque sua senha e crie uma conta com `POST /api/v1/users`, `roleCodes: ["COORDINATION"]`, nome/login sintéticos e senha inicial escolhida para a demo. Entre com essa conta, troque a senha inicial e autentique novamente. O [guia de sessão](api/README.md#sessão-e-cabeçalhos) registra as chamadas; não há credencial padrão.

As chamadas abaixo usam o prefixo `/api/v1` e o cookie da conta de Coordenação. Escritas exigem `Content-Type: application/json`, `Origin: http://localhost:5173`, `X-ERP-Request: 1` e `Idempotency-Key` UUID. Guarde a chave de cada intenção para repetir uma chamada que perdeu a resposta.

## Cadastro mínimo e qualidade dos dados

1. Consulte `GET /registration-field-selections/current`. Publique uma seleção de demonstração com `POST /registration-field-selections`; `expectedVersion` é `null` na primeira publicação ou a versão retornada:

   ```json
   {
     "expectedVersion": null,
     "personFields": ["birthDate"],
     "familyFields": ["contactPhone"],
     "decisionReference": "Seleção sintética para demonstração de 06/10/2026; sem aprovação institucional"
   }
   ```

2. Crie a família com `POST /families`, corpo `{}`. Guarde `data.id`, `data.code` e `data.revision`. O código vem do servidor; nenhum telefone é inventado.

3. Crie a pessoa com `POST /people`, usando o ID e a revisão da família. Escolha um nome sintético ainda não cadastrado; se houver candidatos, analise-os pelo fluxo de duplicidade, sem confirmar automaticamente que são distintos:

   ```json
   {
     "name": "Pessoa Sintética Demo 06",
     "familyId": "<id da família>",
     "expectedFamilyRevision": 1,
     "validFrom": "2026-01-01T00:00:00-03:00"
   }
   ```

   A resposta 201 traz pessoa, vínculo e família revisada. Nascimento e CPF permanecem desconhecidos; o cadastro mínimo funciona mesmo com uma pendência selecionada.

4. Consulte `GET /data-quality-issues?kind=MISSING_DATA&status=OPEN`. Em um ambiente inicialmente vazio, há duas ocorrências: telefone da família e nascimento da pessoa. Em ambiente com outros cadastros, identifique as ocorrências pelos IDs das entidades, sem atribuir todo o total aos dois registros da demo.

5. Complemente `PATCH /people/<id>` com `{ "expectedRevision": 1, "birthDate": "2000-01-01" }`. Esse valor pertence à pessoa fictícia do roteiro. A ocorrência de nascimento passa a `COMPLETED`, com autor, data e revisão; o telefone familiar continua pendente.

6. Consulte `GET /audit-entries?entityType=DataQualityIssue&entityId=<id da ocorrência resolvida>`. Mostre a criação e o encerramento, os snapshots e a autoria da mesma operação do complemento cadastral.

7. Consulte `GET /reports/data-quality?from=2026-01-01&toExclusive=2027-01-01&kind=MISSING_DATA`. O total conta **ocorrências**, com período e filtros explícitos. O detalhe `/reports/data-quality/records` usa os mesmos filtros e `expectedQueryFingerprint` da resposta. Fontes alteradas entre as consultas retornam `REPORT_CHANGED`, exigindo nova consulta do total.

8. Para mostrar reaparecimento, remova o nascimento com `PATCH /people/<id>`, `{ "expectedRevision": 2, "birthDate": null }`. A ocorrência resolvida permanece e uma nova é aberta. Para encerrar a configuração da demo, publique listas vazias com a versão corrente: ocorrências abertas tornam-se `NOT_TRACKED`, distinguindo retirada da seleção de preenchimento.

## Continuação pelas integrações

Use os contratos de [ATV](api/integrating-projects.md), [FRQ](api/integrating-attendance.md), [FIC](api/integrating-social-forms.md), [APT](api/eligibility.md) e [REL](api/reports.md). Aptidão sem política configurada deve aparecer como Pendente; não configure critérios institucionais implícitos para a apresentação. Inscrição é diferente de presença e um cadastro não comprova frequência.

A seleção cadastral desta entrega não habilita saúde, medicamentos ou religião, não altera fichas publicadas e não resolve as decisões institucionais para uso real. O [inventário de telas](frontend-status.md) orienta a frente de frontend; a existência das APIs não comprova que essas telas estejam conectadas.
