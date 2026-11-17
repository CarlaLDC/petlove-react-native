import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { images } from "./assets";
import { api, type Pedido } from "./api";

type Screen =
  | "home"
  | "cart"
  | "profile"
  | "orders"
  | "favorites"
  | "forgot"
  | "login"
  | "signup"
  | "product"
  | "checkout"
  | "confirmed"
  | "orderDetail";
type Product = {
  id: number;
  category: string;
  name: string;
  price: number;
  rating: string;
  image: string;
};
const C = {
  bg: "#fffdf9",
  ink: "#2d2522",
  muted: "#857a75",
  coral: "#ff7c6e",
  pale: "#fff0ee",
  border: "#f3ede9",
  cream: "#fff7f4",
  white: "#ffffff",
};

const money = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const Heading = ({
  children,
  size = 22,
}: {
  children: React.ReactNode;
  size?: number;
}) => <Text style={[s.heading, { fontSize: size }]}>{children}</Text>;
const Button = ({
  children,
  onPress,
  light = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  light?: boolean;
}) => (
  <Pressable onPress={onPress} style={[s.button, light && s.lightButton]}>
    <Text style={[s.buttonText, light && { color: C.coral }]}>{children}</Text>
  </Pressable>
);
const Panel = ({ children }: { children: React.ReactNode }) => (
  <View style={s.panel}>{children}</View>
);
const Field = ({
  label,
  placeholder,
  secure = false,
}: {
  label: string;
  placeholder: string;
  secure?: boolean;
}) => (
  <View style={{ gap: 6, marginBottom: 16 }}>
    <Text style={s.label}>{label}</Text>
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={C.muted}
      secureTextEntry={secure}
      style={s.input}
    />
  </View>
);

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [history, setHistory] = useState<Screen[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Pedido[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const requestId = useRef<string | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selected, setSelected] = useState(1);
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<{
    id: string;
    total: number;
    createdAt: Date;
    items: Product[];
    subtotal: number;
    delivery: number;
    status: string;
  } | null>(null);
  const go = (next: Screen) => {
    setHistory((h) => [...h, screen]);
    setScreen(next);
  };
  const back = () => {
    setScreen(history[history.length - 1] || "home");
    setHistory((h) => h.slice(0, -1));
  };
  const sync = async () => {
    const data = await api.sincronizar();
    setProducts(data.produtos.map(p => ({
      id: p.id, name: p.nome, category: p.categoria, price: p.preco,
      rating: `${p.avaliacao} (${p.numAvaliacoes})`, image: p.imagem,
    })));
    setCart(data.carrinho);
    setFavorites(data.favoritos);
    setOrders(data.pedidos);
    setReady(true);
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível conectar à API."); }
    finally { lock.current = false; setBusy(false); }
  };
  useEffect(() => { void run(sync); }, []);
  const saveCart = (next: Record<number, number>) => run(async () => {
    const saved = await api.salvarCarrinho(next);
    setCart(saved);
    requestId.current = null;
  });
  const add = (id: number, delta = 1) =>
    saveCart({ ...cart, [id]: Math.min(99, Math.max(0, (cart[id] || 0) + delta)) });
  const toggleFavorite = (id: number) => run(async () => {
    setFavorites(await (favorites.includes(id) ? api.desfavoritar(id) : api.favoritar(id)));
  });
  const selectOrder = (p: Pedido) => setOrder({
    id: p.codigo, total: p.total, subtotal: p.subtotal, delivery: p.entrega,
    status: p.status, createdAt: new Date(p.criadoEm),
    items: p.itens.map(i => ({
      id: i.produtoId, name: `${i.nome} × ${i.quantidade}`,
      category: i.categoria, image: i.imagem, price: i.totalItem, rating: "",
    })),
  });
  const checkout = () => run(async () => {
    if (!items.length) throw new Error("Seu carrinho está vazio.");
    requestId.current ??= `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const saved = await api.criarPedido({
      idLocal: requestId.current,
      itens: items.map((p) => ({ produtoId: p.id, quantidade: cart[p.id] })),
    });
    selectOrder(saved);
    setOrders((old) => [saved, ...old.filter((p) => p.id !== saved.id)]);
    setCart({});
    requestId.current = null;
    go("confirmed");
  });
  const subtotal = products.reduce(
    (sum, p) => sum + p.price * (cart[p.id] || 0),
    0,
  );
  const delivery = subtotal > 0 ? 5.9 : 0;
  const items = products.filter((p) => cart[p.id] > 0);
  const formatMoney = (value: number) => money(value);
  const formatOrderDate = (date: Date) =>
    date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const formatOrderTime = (date: Date) =>
    date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const activeOrderTotal = order?.total ?? subtotal + delivery;
  const activeOrderItems = order?.items ?? items;
  const chooseProduct = (id: number) => {
    setSelected(id);
    go("product");
  };
  const current = products.find((p) => p.id === selected) || products[0];
  const header = (title: string, right?: React.ReactNode) => (
    <View style={s.header}>
      <Pressable onPress={back} style={s.back}>
        <Text style={{ color: C.ink, fontSize: 22 }}>‹</Text>
      </Pressable>
      <Heading>{title}</Heading>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
  const productCard = (p: Product) => (
    <Pressable
      key={p.id}
      style={s.productCard}
      onPress={() => chooseProduct(p.id)}
    >
      <Image source={{ uri: p.image }} style={s.productImage} />
      <Text style={s.category}>{p.category}</Text>
      <Text style={s.productName} numberOfLines={1}>
        {p.name}
      </Text>
      <Text style={s.muted}>⭐ {p.rating}</Text>
      <View style={s.rowBetween}>
        <Heading size={18}>{money(p.price)}</Heading>
        <Pressable onPress={() => add(p.id)} style={s.add}>
          <Text style={{ color: C.white, fontSize: 20 }}>+</Text>
        </Pressable>
      </View>
    </Pressable>
  );
  const cartItem = (p: Product, controls = true) => (
    <Panel>
      <View style={s.cartItem}>
        <Image source={{ uri: p.image }} style={s.thumb} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.label} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={s.muted}>
            {p.id === 1
              ? "Tamanho: Médio | Natural"
              : p.id === 2
                ? "Cor: Coral vibrante"
                : p.category}
          </Text>
          <View style={s.rowBetween}>
            <Text style={[s.label, { fontSize: 16 }]}>{money(p.price)}</Text>
            {controls && (
              <View style={s.quantity}>
                <Pressable onPress={() => add(p.id, -1)}>
                  <Text style={s.qtyAction}>−</Text>
                </Pressable>
                <Text style={s.label}>{cart[p.id]}</Text>
                <Pressable onPress={() => add(p.id)}>
                  <Text style={s.qtyAction}>+</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </Panel>
  );
  const summary = (currentSubtotal = subtotal, currentDelivery = delivery) => (
    <Panel>
      <Text style={s.label}>Resumo do pedido</Text>
      <View style={s.summaryLine}>
        <Text style={s.muted}>Subtotal</Text>
        <Text>{money(currentSubtotal)}</Text>
      </View>
      <View style={s.summaryLine}>
        <Text style={s.muted}>Entrega</Text>
        <Text>{money(currentDelivery)}</Text>
      </View>
      <View style={s.separator} />
      <View style={s.rowBetween}>
        <Heading size={18}>Total</Heading>
        <Heading size={20}>{money(currentSubtotal + currentDelivery)}</Heading>
      </View>
    </Panel>
  );
  const menu = (label: string, target: Screen, icon: string) => (
    <Pressable onPress={() => go(target)} style={s.menu}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[s.label, { flex: 1 }]}>{label}</Text>
      <Text style={s.muted}>›</Text>
    </Pressable>
  );
  const content = () => {
    switch (screen) {
      case "home":
        return (
          <>
            <View style={s.delivery}>
              <Image source={{ uri: images.avatar }} style={s.avatar} />
              <View>
                <Text style={s.muted}>Entregando em</Text>
                <Text style={s.label}>Condomínio Patinhas Felizes⌄</Text>
              </View>
            </View>
            <View style={s.section}>
              <Heading size={28}>Olá, Sarah! 👋</Heading>
              <Text style={s.muted}>
                Vamos encontrar algo delicioso para o Buddy hoje
              </Text>
            </View>
            <View style={s.banner}>
              <View
                style={{
                  flex: 1,
                  padding: 18,
                  justifyContent: "space-between",
                }}
              >
                <View>
                  <Text style={s.pill}>OFERTA DA SEMANA</Text>
                  <Heading size={20}>
                    Patinhas saudáveis, corações felizes
                  </Heading>
                </View>
                <Text style={[s.label, { color: C.coral }]}>
                  Ganhe 20% OFF em petiscos premium ➔
                </Text>
              </View>
              <Image
                source={{ uri: images.banner }}
                style={{ width: 130, height: 150 }}
              />
            </View>
            <View style={s.section}>
              <Heading size={18}>Compre por pet</Heading>
              <View style={s.categories}>
                {[
                  ["🐶", "Cães"],
                  ["🐱", "Gatos"],
                  ["🐦", "Aves"],
                  ["🐟", "Peixes"],
                  ["🛍️", "Acessórios"],
                ].map(([icon, name]) => (
                  <View key={name} style={{ alignItems: "center", gap: 8 }}>
                    <Text style={s.categoryCircle}>{icon}</Text>
                    <Text style={s.label}>{name}</Text>
                  </View>
                ))}
              </View>
              <View style={s.rowBetween}>
                <Heading size={18}>Petiscos e brinquedos populares</Heading>
                <Text style={{ color: C.coral }}>Ver tudo</Text>
              </View>
              <View style={s.grid}>
                {products
                  .filter((p) =>
                    `${p.name} ${p.category}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map(productCard)}
              </View>
            </View>
          </>
        );
      case "cart":
        return (
          <>
            {header(
              "Meu carrinho",
              <Pressable onPress={() => saveCart({})}>
                <Text style={{ color: C.coral, fontWeight: "700" }}>
                  Limpar tudo
                </Text>
              </Pressable>,
            )}
            <View style={s.section}>
              {items.length ? (
                <>
                  {items.map((p: Product) => cartItem(p))}
                  {summary()}
                  <Button onPress={() => go("checkout")}>
                    Continuar para pagamento →
                  </Button>
                </>
              ) : (
                <Panel>
                  <Text style={s.muted}>Seu carrinho está vazio.</Text>
                  <Button onPress={() => go("home")}>Explorar produtos</Button>
                </Panel>
              )}
            </View>
          </>
        );
      case "profile":
        return (
          <>
            {header("Meu perfil")}
            <View style={s.section}>
              <Panel>
                <View style={s.cartItem}>
                  <Image source={{ uri: images.avatar }} style={s.avatar} />
                  <View>
                    <Heading size={20}>Sarah Santos</Heading>
                    <Text style={s.muted}>sarah.santos@gmail.com</Text>
                  </View>
                </View>
              </Panel>
              <Panel>
                {menu("Meus pedidos", "orders", "📦")}
                {menu("Meus favoritos", "favorites", "♡")}
                {menu("Meus dados", "signup", "👤")}
              </Panel>
              <Button light onPress={() => go("login")}>
                Sair da conta
              </Button>
            </View>
          </>
        );
      case "orders":
        return (
          <>
            {header("Meus pedidos")}
            <View style={s.section}>
              <Heading size={18}>Acompanhe suas compras</Heading>
              {!orders.length && <Text style={s.muted}>Nenhum pedido registrado.</Text>}
              {orders.map((p) => (
                <Pressable key={p.id} onPress={() => { selectOrder(p); go("orderDetail"); }}>
                  <Panel>
                    <Text style={s.label}>Pedido {p.codigo} · {p.status}</Text>
                    <Text style={s.muted}>{formatOrderDate(new Date(p.criadoEm))}</Text>
                    <Text>{p.quantidadeItens} itens · {money(p.total)}</Text>
                    <Text style={{ color: C.coral }}>Ver detalhes →</Text>
                  </Panel>
                </Pressable>
              ))}
            </View>
          </>
        );
      case "favorites":
        return (
          <>
            {header("Favoritos")}
            <View style={s.section}>
              <Heading size={18}>Produtos que você ama ♡</Heading>
              <View style={s.grid}>
                {products
                  .filter((p) => favorites.includes(p.id))
                  .map(productCard)}
              </View>
            </View>
          </>
        );
      case "product":
        return (
          <>
            {header("Detalhes do produto")}
            <View style={s.section}>
              <View style={s.heroWrap}>
                <Image
                  source={{
                    uri: current.image,
                  }}
                  style={s.hero}
                />
                <Pressable
                  style={s.fav}
                  onPress={() => toggleFavorite(selected)}
                >
                  <Text style={{ color: C.coral, fontSize: 22 }}>
                    {favorites.includes(selected) ? "♥" : "♡"}
                  </Text>
                </Pressable>
              </View>
              <Text style={[s.category, { color: C.coral }]}>
                {current.category.toUpperCase()}
              </Text>
              <Heading size={24}>{current.name}</Heading>
              <Text style={s.muted}>
                ⭐ {current.rating} avaliações de tutores
              </Text>
              <Heading size={28}>{money(current.price)}</Heading>
              <Text style={s.muted}>
                Feitos para trazer mais conforto e alegria para seu pet. Produto
                selecionado com carinho para a rotina do seu melhor amigo.
              </Text>
              <Text style={s.label}>Tamanho do Pacote</Text>
              <View style={s.row}>
                <Text style={s.option}>Médio (250g)</Text>
                <Text
                  style={[
                    s.option,
                    {
                      backgroundColor: C.white,
                      borderColor: C.border,
                      color: C.ink,
                    },
                  ]}
                >
                  Grande (500g)
                </Text>
              </View>
              <Button
                onPress={() => {
                  add(selected);
                  go("cart");
                } }              >
                Adicionar ao carrinho
              </Button>
            </View>
          </>
        );
      case "checkout":
        return (
          <>
            {header("Revisar pedido")}
            <View style={s.section}>
              <Heading size={18}>Itens do pedido</Heading>
              {items.map((p: Product) => cartItem(p, false))}
              {summary()}
              <Button
                onPress={checkout}              >
                Confirmar pedido
              </Button>
            </View>
          </>
        );
      case "confirmed": {
        const confirmedOrder = order ?? {
          id: "000000",
          total: subtotal + delivery,
          createdAt: new Date(),
          items: items,
        };
        const confirmedDate = formatOrderDate(confirmedOrder.createdAt);
        const estimatedText = new Date(
          confirmedOrder.createdAt.getTime() + 3 * 60 * 60 * 1000,
        ).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <View style={s.confirmedScreen}>
            <View style={s.successBadge}>
              <Text style={s.successBadgeText}>✓</Text>
            </View>

            <Heading size={38}>Pedido confirmado!</Heading>

            <Text style={s.confirmedSubtitle}>
              Obrigado! O seu pedido foi registrado com muito
              carinho.
            </Text>

            <View style={s.confirmedSummary}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Identificação do pedido</Text>
                <Text style={s.summaryValue}>#{confirmedOrder.id}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Data de faturamento</Text>
                <Text style={s.summaryValue}>Hoje às {formatOrderTime(confirmedOrder.createdAt)}</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Previsão de entrega</Text>
                <Text style={[s.summaryValue, s.summaryValueGreen]}>
                  A confirmar
                </Text>
              </View>
              <View style={[s.summaryRow, s.summaryRowTotal]}>
                <Text style={s.summaryLabel}>Total do pedido</Text>
                <Text style={s.totalPaid}>{formatMoney(confirmedOrder.total)}</Text>
              </View>
            </View>

            <View style={s.deliveryBanner}>
              <View style={s.deliveryIconWrap}>
                <Text style={s.deliveryIcon}>🚚</Text>
              </View>
              <Text style={s.deliveryText}>
                Status: {order?.status ?? "Confirmado"}
              </Text>
            </View>

            <Pressable style={s.primaryAction} onPress={() => go("orderDetail")}>
              <Text style={s.primaryActionText}>Ir para Meus Pedidos</Text>
              <Text style={s.primaryActionArrow}>→</Text>
            </Pressable>

            <Pressable style={s.secondaryAction} onPress={() => go("home")}>
              <Text style={s.secondaryActionText}>Voltar para a página inicial</Text>
            </Pressable>
          </View>
        );
      }
      case "orderDetail": {
        const detailOrder = order ?? {
          id: "000000",
          total: activeOrderTotal,
          createdAt: new Date(),
          items: activeOrderItems,
        };
        const detailTotal = detailOrder.total;

        return (
          <>
            {header("Detalhes do pedido")}
            <View style={s.section}>
              <Heading size={22}>Pedido #{detailOrder.id}</Heading>
              <Text style={s.muted}>
                Realizado em {formatOrderDate(detailOrder.createdAt)}
              </Text>

              {summary(order?.subtotal ?? 0, order?.delivery ?? 0)}

              <Heading size={18}>Itens do pedido</Heading>
              
              {detailOrder.items.map((p: Product) => cartItem(p, false))}

              <Panel>
                <Text style={s.label}>Precisa de ajuda com o pedido?</Text>
                <Text style={s.muted}>
                  Fale com o suporte no chat online 24h
                </Text>
              </Panel>
            </View>
          </>
        );
      }
      case "login":
        return (
          <>
            {header("Entrar")}
            <View style={[s.section, { paddingTop: 40 }]}>
              <Text style={{ fontSize: 40 }}>🐾</Text>
              <Heading size={28}>Bem-vinda de volta!</Heading>
              <Text style={s.muted}>
                Entre na sua conta para cuidar do seu pet.
              </Text>
              <Field label="E-mail" placeholder="seuemail@exemplo.com" />
              <Field label="Senha" placeholder="Digite sua senha" secure />
              <Pressable onPress={() => go("forgot")}>
                <Text style={{ color: C.coral, textAlign: "right" }}>
                  Esqueceu a senha?
                </Text>
              </Pressable>
              <Button onPress={() => setError("Esta API não possui autenticação. Use o aplicativo em modo demonstração.")}>Entrar</Button>
              <Pressable onPress={() => go("signup")}>
                <Text style={s.center}>
                  Não tem uma conta?{" "}
                  <Text style={{ color: C.coral }}>Criar conta</Text>
                </Text>
              </Pressable>
            </View>
          </>
        );
      case "signup":
        return (
          <>
            {header("Criar conta")}
            <View style={s.section}>
              <Heading size={26}>Vamos começar? 🐾</Heading>
              <Text style={s.muted}>
                Crie sua conta e encontre tudo para o seu pet.
              </Text>
              <Field label="Nome completo" placeholder="Seu nome" />
              <Field label="E-mail" placeholder="seuemail@exemplo.com" />
              <Field label="Telefone" placeholder="(11) 99999-9999" />
              <Field
                label="Sua Senha"
                placeholder="Insira uma senha segura"
                secure
              />
              <Field
                label="Confirmar Senha"
                placeholder="Repita a senha digitada"
                secure
              />
              <Text style={s.muted}>
                ☑ Eu aceito as políticas de Privacidade e os Termos de Serviço
                da Petlove.
              </Text>
              <Button onPress={() => setError("Cadastro de usuários ainda não está disponível nesta API.")}>Criar minha conta</Button>
              <Pressable onPress={() => go("login")}>
                <Text style={s.center}>
                  Já possui conta?{" "}
                  <Text style={{ color: C.coral }}>Entrar</Text>
                </Text>
              </Pressable>
            </View>
          </>
        );
      case "forgot":
        return (
          <>
            {header("Esqueci a senha")}
            <View style={[s.section, { paddingTop: 60 }]}>
              <Text style={{ fontSize: 48 }}>🔒</Text>
              <Heading size={26}>Recuperar senha</Heading>
              <Text style={s.muted}>
                Informe seu e-mail para receber as instruções de recuperação.
              </Text>
              <Field label="E-mail" placeholder="seuemail@exemplo.com" />
              <Button onPress={() => setError("Recuperação de senha ainda não está disponível nesta API.")}>Enviar instruções</Button>
            </View>
          </>
        );
    }
  };
  const showTabs = [
    "home",
    "cart",
    "profile",
    "product",
    "orders",
    "favorites",
  ].includes(screen);
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: showTabs ? 110 : 36 }}
      >
        {!!error && <View style={s.section}><Text accessibilityRole="alert" style={{ color: "#a32020" }}>{error}</Text><Button onPress={() => run(sync)}>Tentar conectar novamente</Button></View>}
        {busy && <Text style={s.center}>Conectando à API…</Text>}
        <View pointerEvents={busy ? "none" : "auto"} style={{ opacity: busy ? 0.6 : 1 }}>
          {ready ? content() : !busy && <Text style={s.center}>Inicie o backend para carregar a loja.</Text>}
        </View>
      </ScrollView>
      {showTabs && (
        <View style={s.tabs}>
          {(
            [
              ["⌂", "Início", "home"],
              ["🛒", "Carrinho", "cart"],
              ["♙", "Perfil", "profile"],
            ] as const
          ).map(([icon, label, target]) => (
            <Pressable
              key={target}
              onPress={() => go(target)}
              style={[s.tab, screen === target && s.tabActive]}
            >
              <Text
                style={{
                  color: screen === target ? C.coral : C.muted,
                  fontSize: 22,
                }}
              >
                {icon}
              </Text>
              {screen === target && (
                <Text style={{ color: C.coral, fontWeight: "700" }}>
                  {label}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 16,
  },
  heading: { color: C.ink, fontWeight: "800", letterSpacing: -0.5 },
  muted: { color: C.muted, fontSize: 13, lineHeight: 20 },
  label: { color: C.ink, fontSize: 14, fontWeight: "700" },
  category: { color: C.muted, fontSize: 11, marginTop: 8 },
  productName: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "700",
    marginVertical: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  header: {
    paddingHorizontal: 16,
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  delivery: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  input: {
    height: 48,
    borderRadius: 24,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    color: C.ink,
    fontSize: 14,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: "row",
    height: 150,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.pale,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: C.coral,
    color: C.white,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 6,
  },
  categories: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  categoryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.pale,
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
    fontSize: 26,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  productCard: {
    width: "48%",
    backgroundColor: C.white,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 2,
  },
  productImage: { width: "100%", height: 130, borderRadius: 12 },
  add: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: C.coral,
    justifyContent: "center",
    alignItems: "center",
  },
  panel: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  cartItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 80, height: 80, borderRadius: 12 },
  quantity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.cream,
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  qtyAction: { color: C.coral, fontSize: 20, fontWeight: "700" },
  separator: { height: 1, backgroundColor: C.border },
  summaryLine: { flexDirection: "row", justifyContent: "space-between" },
  button: {
    minHeight: 52,
    backgroundColor: C.coral,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  lightButton: { backgroundColor: C.pale },
  buttonText: { color: C.white, fontSize: 15, fontWeight: "800" },
  confirmedScreen: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 18,
    alignItems: "center",
    backgroundColor: C.bg,
  },
  successBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#dff4ea",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 22,
  },
  successBadgeText: {
    color: "#3bb26b",
    fontSize: 52,
    fontWeight: "800",
    lineHeight: 52,
  },
  confirmedSubtitle: {
    marginTop: 6,
    marginBottom: 20,
    textAlign: "center",
    fontSize: 18,
    color: C.ink,
    lineHeight: 28,
    fontWeight: "400",
  },
  confirmedSummary: {
    width: "100%",
    backgroundColor: "#f6f1ef",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#f0e7e5",
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  summaryRowTotal: {
    borderBottomWidth: 0,
    paddingTop: 16,
    paddingBottom: 8,
  },
  summaryLabel: {
    color: C.ink,
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  summaryValue: {
    color: C.ink,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
  },
  summaryValueGreen: {
    color: "#19a86d",
  },
  totalPaid: {
    color: "#f57a6a",
    fontSize: 18,
    fontWeight: "800",
  },
  deliveryBanner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fbe7e3",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 22,
  },
  deliveryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#f6d3cc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  deliveryIcon: {
    fontSize: 20,
  },
  deliveryText: {
    flex: 1,
    color: "#d76b5e",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  primaryAction: {
    width: "100%",
    backgroundColor: "#f68d7b",
    borderRadius: 28,
    minHeight: 60,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  primaryActionText: {
    color: C.white,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  primaryActionArrow: {
    color: C.white,
    fontSize: 24,
    fontWeight: "700",
    marginLeft: 8,
  },
  secondaryAction: {
    width: "100%",
    minHeight: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#f2c9c2",
    backgroundColor: "transparent",
  },
  secondaryActionText: {
    color: "#ef826f",
    fontSize: 19,
    fontWeight: "700",
  },
  tabs: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
    height: 68,
    backgroundColor: C.white,
    borderRadius: 34,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
    elevation: 4,
  },
  tab: {
    flex: 1,
    height: 44,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tabActive: { backgroundColor: C.pale },
  menu: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  heroWrap: {
    backgroundColor: C.white,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 12,
  },
  hero: { width: "100%", height: 214, borderRadius: 16 },
  fav: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: C.white,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.coral,
    backgroundColor: C.pale,
    color: C.coral,
    fontWeight: "700",
  },
  center: { color: C.muted, textAlign: "center", padding: 12 },
});
