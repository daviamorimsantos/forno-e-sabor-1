# Forno & Sabor

Site demonstrativo de pizzaria feito com React, Vite e Vercel, com catálogo dinâmico, filtros, carrinho, checkout por WhatsApp e painel de produtos.

## Publicação

1. Envie o projeto ao GitHub.
2. Importe o repositório na Vercel.
3. Configure `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH` e `ADMIN_PASSWORD` nas variáveis de ambiente da Vercel.
4. Faça o deploy.

## Painel do lojista

Acesse `/admin` ou use o link **Configurações** no cabeçalho. Consulte `README-ADMIN.md` para criar o token privado do GitHub e configurar o catálogo.

## Catálogo

O arquivo inicial é `catalog/products.json`. O painel grava alterações nesse arquivo por uma API segura da Vercel. O checkout envia os detalhes para o WhatsApp e não salva pedidos em banco.

## Importante

Os dados de endereço, preços, avaliações e contato são demonstrativos. Revise `src/data/store.js` antes de usar com um negócio real. Nunca publique o token privado do GitHub.
