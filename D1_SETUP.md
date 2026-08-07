# Persistência online — Cloudflare D1

O projeto já contém Pages Functions em `functions/api/state.js` e o cliente em `cloud-state.js`.
O banco cria automaticamente a tabela `app_state` na primeira requisição; não é necessário executar migration manual.

## 1. Criar o banco

No painel Cloudflare, abra **Workers & Pages > D1** e crie um banco, por exemplo:

`ana-sales-db`

## 2. Vincular ao Pages

Abra o projeto Pages deste repositório e vá em:

**Settings > Bindings > Add > D1 database binding**

Use exatamente:

- Variable name: `DB`
- D1 database: `ana-sales-db`

Salve e faça um novo deploy da branch `main`.

## 3. O que passa a ficar online

- lançamentos manuais
- clientes / valores em A receber
- anotações dos pedidos
- histórico de atividades e auditoria
- configurações de meta e planilha
- snapshot usado para detectar alterações e exclusões na Google Sheets

O navegador deixa de ser a fonte desses dados. Na primeira conexão com D1, o sistema tenta migrar dados antigos existentes no `localStorage` para o banco e remove as chaves legadas depois da migração.

## Segurança

O site e a API devem ser protegidos antes de uso real. A opção recomendada é colocar o domínio do Pages atrás do **Cloudflare Access**, permitindo acesso apenas à Ana e aos administradores autorizados. Não coloque uma senha secreta dentro do JavaScript público.

## Endpoint

`GET /api/state` retorna o estado persistido.

`PUT /api/state` grava uma chave permitida (`manual`, `pending`, `notes`, `audit`, `settings`, `snapshot`).
