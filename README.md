# Petlove — aplicativo e API local

As telas React Native/Expo deste projeto usam a API Express/SQLite de [ThiagoMarangoni-dev/Petlove](https://github.com/ThiagoMarangoni-dev/Petlove), copiada do commit `dfab31c84aa733fad8615dd8155c6d25fa5e6001`. Tudo roda na mesma máquina, sem hospedagem. Não é necessário clonar o outro repositório.

## Rodar no computador

Instale o Node.js 22.13 ou superior (recomendado: Node 24 LTS). Dentro desta pasta:

```bash
npm install
npm start
```

A instalação também instala as dependências do backend. O segundo comando inicia a API na porta 3333, aguarda ela ficar disponível e abre o aplicativo no navegador pelo Expo. Mantenha o terminal aberto; Ctrl+C encerra os processos. Se a porta 3333 estiver ocupada, encerre a execução anterior.

O SQLite é criado automaticamente em `banco/petlove.db`, com produtos e pedidos de exemplo na primeira execução. Os dados permanecem após reiniciar. Nenhum banco exportado do outro projeto foi copiado.

## Rodar no Expo Go / emulador

```bash
npm run mobile
```

No emulador Android a API padrão é `http://10.0.2.2:3333/api`; no simulador iOS, `http://localhost:3333/api`.

No celular físico, crie `.env` na raiz com o IP do computador (celular e computador no mesmo Wi-Fi):

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.0.10:3333/api
```

Troque pelo IP real, libere a porta 3333 no firewall da rede local e reinicie o Expo após alterar o arquivo. O QR code do Expo não hospeda a API. Para o navegador na mesma máquina, remova essa variável para usar o endereço local.

## O que foi integrado

- Catálogo: produtos e preços vindos do banco.
- Carrinho e favoritos: alterações gravadas pela API, recuperadas ao abrir o aplicativo.
- Checkout: pedido criado no servidor; preços, estoque, código e totais calculados pelo backend. Reenvios usam o mesmo identificador enquanto o carrinho não for editado.
- Histórico e detalhes: pedidos reais, com quantidades, valores e status do servidor. A confirmação só aparece após resposta de sucesso.
- Falhas de conexão/validação são exibidas com opção de reconectar; não há confirmação fictícia ou fila offline.

Esta API é uma demonstração com carrinho/favoritos compartilhados. Não possui contas, autenticação, recuperação de senha nem processamento de pagamento. As telas de conta informam essa limitação. Os pedidos de exemplo aparecem no histórico. A previsão de entrega é apresentada como “A confirmar”.

As imagens originais usam URLs temporárias exportadas do Figma; substitua-as por arquivos locais para uma apresentação sem dependência dessas URLs. O catálogo precisa do backend ativo; imagens externas ainda precisam de internet.

## Estrutura e validação

`App.tsx`: telas; `api.ts`: cliente HTTP; `backend/src`: API e regras; `banco/schema.sql`: esquema; `scripts/dev.mjs`: inicia os dois processos.

```bash
npm run typecheck
npm test
```

Os testes incluem a suíte original do backend e um teste que executa o cliente HTTP do aplicativo contra a API real com banco em memória (sem alterar seus dados). O workflow de integração também verifica a exportação web do Expo.

Para executar separadamente: `npm run backend` e, em outro terminal, `npm run frontend`. Não execute `npm start` junto com um backend já iniciado.

A cópia do backend é independente: mudanças futuras no repositório de origem precisam ser trazidas explicitamente.
