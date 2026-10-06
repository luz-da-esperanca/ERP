# Ambiente local preparado para a demo

Na estação atual, o `.env` está configurado para desenvolvimento, com `DATA_MODE=SYNTHETIC`, API em `127.0.0.1:3001` e frontend em `http://localhost:5173`. As chaves de autenticação, idempotência e criptografia de FIC foram geradas separadamente; não habilitam campos protegidos. O arquivo tem permissão `600` e é ignorado pelo Git.

PostgreSQL 18.4 e Redis 7.4.6 foram instalados no diretório do usuário `~/.local/share/erp-social-dev`, pois esta estação não possui Compose disponível nem acesso ao daemon Docker. Estão ativos em `127.0.0.1:5432` e `127.0.0.1:6379`. O banco `erp` possui as 13 migrations aplicadas e foi preenchido com o [seed de demonstração](showcase-seed.md): cinco contas, quatro famílias, oito pessoas, dois projetos e três atividades.

Para iniciar o backend, na raiz do projeto:

```bash
pnpm dev
```

Para navegar pelos módulos sociais, entre como `demo.coordination` com a senha `DEMO_SEED_PASSWORD` do arquivo local `.env.demo`. Os demais acessos e cenários estão no [guia do seed](showcase-seed.md#acessos). A data de referência da demonstração é `2026-10-05`, com período `[2026-09-06, 2026-10-06)`.

A conta `dario.brito`, com nome Dario Brito, combina Administrador e Coordenação para ter todas as permissões do MVP. Sua senha fica separada em `DARIO_SEED_PASSWORD`, no mesmo `.env.demo`. Depois de criada, use **Alterar senha** no frontend para mudar a senha no banco; editar o arquivo sozinho não altera a credencial cadastrada.

Para conferir ou retomar o seed, execute:

```bash
pnpm db:seed
```

Repetir o comando preserva os registros e mudanças manuais. O `.env.example` continua como modelo de configuração, sem credenciais geradas. Para preparar outro banco sem exemplos, siga o bootstrap no [guia do backend](api/README.md#preparar-o-ambiente-e-a-conta); ele funciona somente enquanto não houver contas.

Se reiniciar a estação ou parar os serviços locais, inicie-os antes da API:

```bash
bash ~/.local/share/erp-social-dev/start-services.sh
pnpm dev
```

Esse script local verifica os processos existentes antes de iniciá-los novamente. Os dados PostgreSQL permanecem em `~/.local/share/erp-social-dev/postgres-data`; reiniciar Redis encerra as sessões, exigindo novo login. O diretório de serviços e o `.env` são locais e não são distribuídos pelo repositório.

Outras estações devem seguir o [ambiente padrão com Docker Compose](../README.md#executar-a-api-local). O banco desta estação é independente do volume do Compose; não inicie outra instância nas mesmas portas nem troque de banco esperando encontrar os mesmos registros.
