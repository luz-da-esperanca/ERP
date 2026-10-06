# Ambiente local preparado para a demo

Na estação atual, o `.env` está configurado para desenvolvimento, com `DATA_MODE=SYNTHETIC`, API em `127.0.0.1:3001` e frontend em `http://localhost:5173`. As chaves de autenticação, idempotência e criptografia de FIC foram geradas separadamente; não habilitam campos protegidos. O arquivo tem permissão `600` e é ignorado pelo Git.

PostgreSQL 18.4 e Redis 7.4.6 foram instalados no diretório do usuário `~/.local/share/erp-social-dev`, pois esta estação não possui Compose disponível nem acesso ao daemon Docker. Estão ativos em `127.0.0.1:5432` e `127.0.0.1:6379`. O banco `erp` é novo, possui as 13 migrations aplicadas e não contém pessoas ou contas da aplicação.

Para iniciar o backend, na raiz do projeto:

```bash
pnpm dev
```

Para criar a primeira conta, execute em outro terminal:

```bash
pnpm db:bootstrap
```

O comando pede login, nome e senha e cria o primeiro Administrador, que precisa trocar a senha no primeiro acesso. Ele funciona somente enquanto não houver contas; não há credencial padrão. Para operar módulos sociais, siga a atribuição explícita dos perfis no [guia do backend](api/README.md#preparar-o-ambiente-e-a-conta).

Se reiniciar a estação ou parar os serviços locais, inicie-os antes da API:

```bash
bash ~/.local/share/erp-social-dev/start-services.sh
pnpm dev
```

Esse script local verifica os processos existentes antes de iniciá-los novamente. Os dados PostgreSQL permanecem em `~/.local/share/erp-social-dev/postgres-data`; reiniciar Redis encerra as sessões, exigindo novo login. O diretório de serviços e o `.env` são locais e não são distribuídos pelo repositório.

Outras estações devem seguir o [ambiente padrão com Docker Compose](../README.md#executar-a-api-local). O banco desta estação é independente do volume do Compose; não inicie outra instância nas mesmas portas nem troque de banco esperando encontrar os mesmos registros.
