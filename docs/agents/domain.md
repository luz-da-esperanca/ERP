# Documentação de domínio

Layout adotado: **single-context**, com `GLOSSARY.md` na raiz e decisões arquiteturais em `docs/adr/`.

## Antes de explorar o repositório

- Leia o `GLOSSARY.md` na raiz.
- Se existir um `GLOSSARY-MAP.md` na raiz, siga o mapa e leia os glossários dos contextos relevantes.
- Leia em `docs/adr/` as decisões relacionadas à área da tarefa. Em repositórios com múltiplos contextos, consulte também `src/<context>/docs/adr/`.

Quando esses arquivos ou diretórios ainda não existirem, prossiga silenciosamente. A skill `domain-modeling`, também acionada por `grill-with-docs` e `improve-codebase-architecture`, cria os documentos conforme termos e decisões forem resolvidos.

## Estrutura adotada

```text
/
├── GLOSSARY.md
└── docs/
    └── adr/
        └── NNNN-decision-title.md
```

O glossário e as ADRs são criados conforme necessário; esta configuração define seus locais.

## Vocabulário

Ao nomear um conceito de domínio em títulos de issues, propostas de refatoração, hipóteses ou testes, use o termo definido no glossário e respeite os sinônimos desaconselhados.

Se o termo necessário ainda não estiver documentado, verifique se ele pertence à linguagem do projeto. Quando houver uma lacuna real, registre-a para a skill `domain-modeling`.

## Conflitos com ADRs

Se uma proposta contrariar uma ADR existente, identifique a decisão e explique o motivo para reabri-la. Exemplo: “Esta proposta contradiz a ADR-NNNN; proponho revisá-la porque <motivo>”.
