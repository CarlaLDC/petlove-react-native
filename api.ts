// Contrato da API copiado de ThiagoMarangoni-dev/Petlove (dfab31c).
import { Platform } from "react-native";
declare const process: { env: { EXPO_PUBLIC_API_URL?: string } };

// Endereço da API. No celular físico use o IP do computador na rede Wi-Fi:
//   EXPO_PUBLIC_API_URL=http://192.168.0.10:3333/api npx expo start
// O emulador Android enxerga o computador como 10.0.2.2.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:3333/api" : "http://localhost:3333/api")).replace(/\/+$/, "");

export type ProdutoApi = {
  id: number;
  nome: string;
  categoria: string;
  descricao: string;
  preco: number;
  avaliacao: number;
  numAvaliacoes: number;
  imagem: string;
  estoque: number;
  atualizadoEm: string;
};

export type ItemPedido = {
  produtoId: number;
  nome: string;
  categoria: string;
  imagem: string;
  precoUnitario: number;
  quantidade: number;
  totalItem: number;
};

export type Pedido = {
  id: number;
  codigo: string;
  idLocal?: string | null;
  status: string;
  cep: string;
  endereco: string;
  cidade: string;
  uf: string;
  subtotal: number;
  entrega: number;
  total: number;
  quantidadeItens: number;
  itens: ItemPedido[];
  criadoEm: string;
};

export type Endereco = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type Sincronizacao = {
  servidorEm: string;
  completa: boolean;
  produtos: ProdutoApi[];
  pedidos: Pedido[];
  produtosRemovidos: number[];
  pedidosRemovidos: number[];
  carrinho: Record<string, number>;
  favoritos: number[];
};

export type NovoProduto = {
  nome: string;
  categoria: string;
  preco: number;
  estoque?: number;
  imagem?: string;
  descricao?: string;
};

export type DadosExportados = {
  metadados: { geradoEm: string };
  resumo: {
    totalPedidos: number;
    pedidosValidos: number;
    pedidosCancelados: number;
    faturamento: number;
    ticketMedio: number;
    itensVendidos: number;
    produtosAtivos: number;
    favoritos: number;
  };
  produtos: unknown[];
  pedidos: unknown[];
  itensVendidos: unknown[];
};

/** Erro devolvido pela API (validação, estoque, etc.). */
export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
    public campos?: Record<string, string>,
  ) {
    super(mensagem);
  }
}

/** Sem conexão com o servidor: a operação pode ir para a fila offline. */
export class ErroRede extends Error {}

async function chamar<T>(
  metodo: string,
  rota: string,
  corpo?: unknown,
): Promise<T> {
  let resposta: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    resposta = await fetch(API_URL + rota, {
      method: metodo,
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ErroRede("Sem conexão com o servidor. Verifique se o backend está rodando.");
  } finally {
    clearTimeout(timer);
  }
  if (resposta.status === 204) return undefined as T;
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroApi(
      resposta.status,
      dados.mensagem ?? "Erro no servidor.",
      dados.campos,
    );
  }
  return dados as T;
}

export const api = {
  sincronizar: (desde?: string) =>
    chamar<Sincronizacao>(
      "GET",
      `/sincronizacao${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`,
    ),
  // Produtos (CRUD)
  listarProdutos: (busca = "") =>
    chamar<ProdutoApi[]>(
      "GET",
      `/produtos?busca=${encodeURIComponent(busca)}`,
    ),
  criarProduto: (p: NovoProduto) => chamar<ProdutoApi>("POST", "/produtos", p),
  atualizarProduto: (id: number, p: Partial<NovoProduto>) =>
    chamar<ProdutoApi>("PUT", `/produtos/${id}`, p),
  removerProduto: (id: number) => chamar<void>("DELETE", `/produtos/${id}`),
  // Pedidos (CRUD)
  listarPedidos: () => chamar<Pedido[]>("GET", "/pedidos"),
  criarPedido: (p: {
    itens: { produtoId: number; quantidade: number }[];
    cep?: string;
    idLocal: string;
  }) => chamar<Pedido>("POST", "/pedidos", p),
  mudarStatusPedido: (id: number, status: string) =>
    chamar<Pedido>("PATCH", `/pedidos/${id}/status`, { status }),
  removerPedido: (id: number) => chamar<void>("DELETE", `/pedidos/${id}`),
  // Preferências
  salvarCarrinho: (itens: Record<number, number>) =>
    chamar<Record<string, number>>("PUT", "/carrinho", { itens }),
  favoritar: (id: number) => chamar<number[]>("POST", `/favoritos/${id}`),
  desfavoritar: (id: number) => chamar<number[]>("DELETE", `/favoritos/${id}`),
  // Serviço externo (Correios/ViaCEP, passando pela nossa API)
  buscarCep: (cep: string) =>
    chamar<Endereco>("GET", `/cep/${cep.replace(/\D/g, "")}`),
  // Dados para o dashboard
  exportar: () => chamar<DadosExportados>("GET", "/exportar"),
};

