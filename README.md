# Ana Sales

Painel de vendas da Ana, preparado para publicação no Cloudflare Pages.

## Estrutura

- `index.html` — interface principal
- `styles.css` — tema premium escuro
- `app.js` — carregador dos módulos
- `app-1.js` — dados, Google Sheets e regras de negócio
- `app-2.js` — dashboard, pedidos, clientes e renderização
- `app-3.js` — lançamentos, edição, valores a receber e interações
- `_headers` — cabeçalhos básicos para Cloudflare Pages

## Dados

As vendas da planilha são lidas da Google Sheets configurada no painel. Lançamentos manuais, valores a receber, notas e atividades usam `localStorage` nesta versão.
