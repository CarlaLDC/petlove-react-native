import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { abrirBanco } from "../backend/src/db.js";
import { criarApp } from "../backend/src/app.js";

test("cliente do aplicativo conversa com a API real e preserva o histórico", async () => {
  const db = abrirBanco();
  const { app, servicos } = criarApp({ db, buscarCep: async () => ({}) });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const oldUrl = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = "http://127.0.0.1:" + server.address().port + "/api/";
  try {
    const source = readFileSync(new URL("../api.ts", import.meta.url), "utf8")
      .replace('import { Platform } from "react-native";', 'const Platform = { OS: "web" };');
    const { outputText } = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
    }});
    const { api, ErroApi } = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
    const product = await api.criarProduto({ nome: "Teste", categoria: "Petiscos", preco: 10, estoque: 4 });
    const data = await api.sincronizar();
    assert.equal(data.produtos[0].id, product.id);
    assert.deepEqual(await api.salvarCarrinho({ [product.id]: 2 }), { [product.id]: 2 });
    assert.deepEqual(await api.favoritar(product.id), [product.id]);
    const body = { idLocal: "teste-cliente-1", itens: [{ produtoId: product.id, quantidade: 2 }] };
    const order = await api.criarPedido(body);
    assert.equal(order.total, 25.9);
    assert.equal(order.itens[0].quantidade, 2);
    assert.equal((await api.criarPedido(body)).id, order.id);
    assert.equal((await api.listarPedidos()).length, 1);
    assert.deepEqual((await api.sincronizar()).carrinho, {});
    await assert.rejects(api.criarPedido({ idLocal: "sem-estoque", itens: [{ produtoId: product.id, quantidade: 3 }] }),
      e => e instanceof ErroApi && e.status === 409);
    assert.equal((await api.listarPedidos()).length, 1);
    await api.desfavoritar(product.id);
    assert.deepEqual((await api.sincronizar()).favoritos, []);
    assert.equal(servicos.produtos.obter(product.id).estoque, 2);
  } finally {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = oldUrl;
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});
