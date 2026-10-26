# Forno & Sabor — catálogo administrativo

O painel gerencia somente o catálogo: adicionar produto, editar descrição/preço/foto, ocultar/reativar e excluir. Os pedidos não são gravados em banco; o checkout prepara a mensagem e envia ao WhatsApp da loja. O catálogo persistente fica em `catalog/products.json` no GitHub.

## Configuração

Na Vercel, abra **Project → Settings → Environment Variables** e configure:

- `ADMIN_PASSWORD`: senha para entrar no painel (exemplo demonstrativo: `3103`; para produção, prefira uma senha forte).
- `GITHUB_TOKEN`: token fine-grained privado, limitado ao repositório, com permissão **Contents: Read and write**.
- `GITHUB_REPO`: caminho `usuario/repositorio` do repositório do site.
- `GITHUB_BRANCH`: branch do site, normalmente `main`.

Salve as variáveis e faça um novo deploy. Não use prefixo `VITE_` no token. Nunca coloque o token no navegador ou em arquivo público.

## Uso

1. Abra `https://SEU-SITE.vercel.app/admin` ou clique em **Configurações** no cabeçalho.
2. Digite a senha configurada em `ADMIN_PASSWORD`.
3. Na área **Produtos**, altere preços, crie produtos, envie fotos ou oculte itens.
4. Ao salvar, a API grava um commit no arquivo `catalog/products.json` do GitHub. A loja pública lê o catálogo pela função `/api/catalog`.

Imagens enviadas pelo painel são adicionadas em `public/product-images/` no GitHub; use JPG, PNG ou WebP de até 2,5 MB.

## Observações

- O checkout não registra pedidos em banco; ele abre o WhatsApp com o resumo do pedido.
- Cada alteração de catálogo gera um commit no GitHub. Evite alterações simultâneas em várias abas para não provocar conflito de versão.
- Se o repositório for privado, a função da Vercel usa o token no servidor para ler o catálogo.
