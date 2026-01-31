import React, { useEffect, useMemo, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { http } from "../api/http.js";
import { useAuth } from "../auth/AuthContext.jsx";

const emptyOpen = { saldo_inicial: "", observacao: "" };
const emptyClose = { saldo_final: "", observacao: "" };
const emptyMov = { tipo: "VENDA", valor: "", descricao: "" };
const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function parseBRL(input) {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const raw = String(input).replace(/[^\d,.-]/g, "");
  if (!raw) return 0;
  let normalized = raw;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = raw.replace(/\./g, "");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function formatBRLInput(input, { padDecimals } = { padDecimals: true }) {
  let raw = String(input).replace(/[^\d,\.]/g, "");
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return "";
  let hadComma = raw.includes(",");
  if (raw.includes(",")) {
    raw = raw.replace(/\./g, "");
  } else if (raw.includes(".")) {
    const lastDot = raw.lastIndexOf(".");
    const decimals = raw.length - lastDot - 1;
    if (decimals > 0 && decimals <= 2) {
      const before = raw.slice(0, lastDot).replace(/\./g, "");
      const after = raw.slice(lastDot + 1);
      raw = `${before},${after}`;
      hadComma = true;
    } else {
      raw = raw.replace(/\./g, "");
    }
  }
  const [intRaw, decRaw = ""] = raw.split(",");
  let intPart = intRaw.replace(/^0+(?=\d)/, "");
  if (!intPart) intPart = "0";
  let decPart = decRaw.replace(/\D/g, "");
  if (padDecimals) {
    decPart = (decPart + "00").slice(0, 2);
  } else {
    decPart = decPart.slice(0, 2);
  }
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (padDecimals) {
    return `R$ ${intFormatted},${decPart}`;
  }
  if (hadComma || decPart.length > 0) {
    return `R$ ${intFormatted},${decPart}`;
  }
  return `R$ ${intFormatted}`;
}

export default function Caixa() {
  const { user } = useAuth();
  const isCaixa = user?.role === "CAIXA";
  const [caixa, setCaixa] = useState(null);
  const [movs, setMovs] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [tab, setTab] = useState("venda");
  const [openForm, setOpenForm] = useState(emptyOpen);
  const [closeForm, setCloseForm] = useState(emptyClose);
  const [movForm, setMovForm] = useState(emptyMov);
  const [venda, setVenda] = useState({ id_produto: "", quantidade: 1, descricao: "" });
  const [carrinho, setCarrinho] = useState([]);
  const [pagamento, setPagamento] = useState({ tipo: "DINHEIRO", valor_recebido: "" });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [movFilters, setMovFilters] = useState({ inicio: "", fim: "" });

  async function load() {
    const [c, m, p] = await Promise.all([
      http.get("/caixa/atual"),
      http.get("/caixa/movimentos"),
      http.get("/produtos")
    ]);
    setCaixa(c.data);
    setMovs(m.data || []);
    setProdutos(p.data || []);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (isCaixa && tab !== "venda") setTab("venda");
  }, [isCaixa, tab]);

  const filteredMovs = useMemo(() => {
    const hasFilters = movFilters.inicio || movFilters.fim;
    if (!hasFilters) return movs;
    const start = movFilters.inicio ? new Date(`${movFilters.inicio}T00:00:00`) : null;
    const end = movFilters.fim ? new Date(`${movFilters.fim}T23:59:59`) : null;
    return movs.filter((m) => {
      if (!m.criado_em) return false;
      const dateValue = String(m.criado_em).replace(" ", "T");
      const when = new Date(dateValue);
      if (start && when < start) return false;
      if (end && when > end) return false;
      return true;
    });
  }, [movs, movFilters]);

  const resumo = useMemo(() => {
    const entradas = filteredMovs.filter((m) => ["VENDA", "REFORCO", "AJUSTE"].includes(m.tipo))
      .reduce((acc, m) => acc + Number(m.valor), 0);
    const saidas = filteredMovs.filter((m) => m.tipo === "SANGRIA")
      .reduce((acc, m) => acc + Number(m.valor), 0);
    const saldo = Number(caixa?.saldo_inicial || 0) + entradas - saidas;
    return { entradas, saidas, saldo };
  }, [filteredMovs, caixa]);

  const totalVendidoCaixa = useMemo(() => {
    if (!caixa?.id) return 0;
    return movs
      .filter((m) => m.tipo === "VENDA" && Number(m.id_caixa) === Number(caixa.id))
      .reduce((acc, m) => acc + Number(m.valor), 0);
  }, [movs, caixa]);

  async function abrir(e) {
    e.preventDefault();
    setMsg(null); setErr(null);
    try {
      const { data } = await http.post("/caixa/abrir", {
        saldo_inicial: parseBRL(openForm.saldo_inicial),
        observacao: openForm.observacao || null
      });
      setCaixa(data);
      setOpenForm(emptyOpen);
      setMsg("Caixa aberto.");
      load();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Falha ao abrir caixa");
    }
  }

  async function fechar(e) {
    e.preventDefault();
    setMsg(null); setErr(null);
    try {
      await http.post("/caixa/fechar", {
        saldo_final: parseBRL(closeForm.saldo_final),
        observacao: closeForm.observacao || null
      });
      setCloseForm(emptyClose);
      setMsg("Caixa fechado.");
      load();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Falha ao fechar caixa");
    }
  }

  async function registrarMov(e) {
    e.preventDefault();
    setMsg(null); setErr(null);
    try {
      await http.post("/caixa/movimentos", {
        tipo: movForm.tipo,
        valor: parseBRL(movForm.valor),
        descricao: movForm.descricao || null
      });
      setMovForm({ ...emptyMov, tipo: movForm.tipo });
      setMsg("Movimento registrado.");
      load();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Falha ao registrar movimento");
    }
  }

  function adicionarCarrinho(e) {
    e.preventDefault();
    setMsg(null); setErr(null);
    if (!venda.id_produto) {
      setErr("Selecione o produto.");
      return;
    }
    const produto = produtos.find((p) => String(p.id) === String(venda.id_produto));
    if (!produto) {
      setErr("Produto invalido.");
      return;
    }
    const quantidade = Number(venda.quantidade || 1);
    setCarrinho((prev) => [
      ...prev,
      {
        id_produto: Number(venda.id_produto),
        nome: produto.nome,
        preco: Number(produto.preco),
        quantidade,
      }
    ]);
    setVenda({ ...venda, id_produto: "", quantidade: 1 });
  }

  async function finalizarVenda(e) {
    e.preventDefault();
    setMsg(null); setErr(null);
    if (carrinho.length === 0) {
      setErr("Carrinho vazio.");
      return;
    }
    try {
      await http.post("/caixa/venda-balcao-lote", {
        itens: carrinho.map((c) => ({ id_produto: c.id_produto, quantidade: c.quantidade })),
        descricao: venda.descricao || null,
        pagamento_tipo: pagamento.tipo,
        valor_recebido: pagamento.tipo === "DINHEIRO" ? parseBRL(pagamento.valor_recebido) : null
      });
      setCarrinho([]);
      setVenda({ id_produto: "", quantidade: 1, descricao: "" });
      setPagamento({ tipo: "DINHEIRO", valor_recebido: "" });
      setMsg("Venda registrada.");
      load();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Falha ao registrar venda");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="Caixa" />
      <div className="p-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <div className="inline-flex rounded-full bg-white border shadow-sm">
            <button
              onClick={() => setTab("venda")}
              className={`px-4 py-2 text-sm rounded-full ${tab === "venda" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              Registrar compra
            </button>
            {!isCaixa && (
              <button
                onClick={() => setTab("mov")}
                className={`px-4 py-2 text-sm rounded-full ${tab === "mov" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                Movimentações
              </button>
            )}
          </div>
        </div>

        {!caixa && !isCaixa && (
          <div className="lg:col-span-3">
            <button
              onClick={() => setOpenModal(true)}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 hover:bg-slate-700"
            >
              Abrir caixa
            </button>
          </div>
        )}

        {tab === "venda" && (
          caixa ? (
            <>
              <div className="lg:col-span-2 bg-white rounded-2xl shadow border p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-semibold text-lg">Venda balcao</div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 shadow-sm">
                  <div className="text-[11px] uppercase tracking-wide">Total vendido (caixa aberto)</div>
                  <div className="text-lg font-semibold">{brlFormatter.format(totalVendidoCaixa)}</div>
                </div>
              </div>
              <form className="mt-4 space-y-3" onSubmit={adicionarCarrinho}>
                <div>
                  <label className="text-sm font-medium">Produto</label>
                  <select className="mt-1 w-full rounded-lg border p-3"
                    value={venda.id_produto} onChange={(e) => setVenda({ ...venda, id_produto: e.target.value })}>
                    <option value="">Selecione</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id} disabled={!p.can_add}>
                          {p.nome} {p.can_add ? "" : "(sem estoque)"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Quantidade</label>
                    <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: 1"
                      value={venda.quantidade}
                      onChange={(e) => setVenda({ ...venda, quantidade: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Descricao</label>
                    <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: dinheiro, cliente balcão"
                      value={venda.descricao}
                      onChange={(e) => setVenda({ ...venda, descricao: e.target.value })} />
                </div>
                <button className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium hover:bg-slate-700">
                  Adicionar ao carrinho
                </button>
              </form>
              <div className="mt-4 border-t pt-4">
                <div className="font-medium">Carrinho</div>
                <div className="mt-2 space-y-2">
                    {carrinho.map((c, idx) => (
                      <div key={`${c.id_produto}-${idx}`} className="flex items-center justify-between border rounded-lg p-2">
                        <div>
                          <div className="text-sm font-medium">{c.nome}</div>
                          <div className="text-xs text-slate-500">Qtd: {c.quantidade} - {brlFormatter.format(c.preco)}</div>
                        </div>
                        <button
                          onClick={() => setCarrinho((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                    {carrinho.length === 0 && (
                      <div className="text-sm text-slate-500">Carrinho vazio.</div>
                    )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm">
                    Total: {brlFormatter.format(carrinho.reduce((acc, c) => acc + (c.preco * c.quantidade), 0))}
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Pagamento</label>
                    <select
                      className="mt-1 w-full rounded-lg border p-3"
                      value={pagamento.tipo}
                      onChange={(e) => setPagamento({ ...pagamento, tipo: e.target.value })}
                    >
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="CARTAO">Cartao</option>
                    </select>
                  </div>
                  {pagamento.tipo === "DINHEIRO" && (
                    <div>
                      <label className="text-sm font-medium">Valor recebido</label>
                      <input
                        className="mt-1 w-full rounded-lg border p-3"
                        placeholder="Ex: R$ 100,00"
                        value={pagamento.valor_recebido}
                        onChange={(e) => setPagamento({ ...pagamento, valor_recebido: formatBRLInput(e.target.value, { padDecimals: false }) })}
                        onBlur={(e) => setPagamento({ ...pagamento, valor_recebido: formatBRLInput(e.target.value, { padDecimals: true }) })}
                      />
                    </div>
                  )}
                </div>
                {pagamento.tipo === "DINHEIRO" && (
                  <div className="mt-2 text-sm text-slate-600">
                    Troco: {brlFormatter.format(Math.max(0, parseBRL(pagamento.valor_recebido) - carrinho.reduce((acc, c) => acc + (c.preco * c.quantidade), 0)))}
                  </div>
                )}
                <button
                  onClick={finalizarVenda}
                  className="mt-3 w-full rounded-lg bg-emerald-600 text-white py-2 hover:bg-emerald-700"
                >
                  Finalizar compra
                </button>
              </div>
            </div>
            </>
          ) : (
            <div className="lg:col-span-3 bg-white rounded-2xl shadow border p-5 text-slate-600">
              {isCaixa ? "Caixa fechado. Solicite a abertura." : "Abra o caixa para registrar compras."}
            </div>
          )
        )}

        {tab === "mov" && !isCaixa && (
          <>
            <div className="lg:col-span-3 bg-white rounded-2xl shadow border p-5">
              <div className="font-semibold text-lg">Filtro de periodo</div>
              <div className="mt-3 flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs font-medium text-slate-500">De</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border p-2"
                    value={movFilters.inicio}
                    onChange={(e) => setMovFilters({ ...movFilters, inicio: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Ate</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border p-2"
                    value={movFilters.fim}
                    onChange={(e) => setMovFilters({ ...movFilters, fim: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="h-9 rounded-lg border px-3 text-sm hover:bg-slate-50"
                  onClick={() => setMovFilters({ inicio: "", fim: "" })}
                  disabled={!movFilters.inicio && !movFilters.fim}
                >
                  Limpar
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow border p-5">
              <div className="font-semibold text-lg">Movimento de caixa</div>
              <form className="mt-4 space-y-3" onSubmit={registrarMov}>
                <div>
                  <label className="text-sm font-medium">Tipo</label>
                  <select className="mt-1 w-full rounded-lg border p-3"
                    value={movForm.tipo} onChange={(e) => setMovForm({ ...movForm, tipo: e.target.value })}>
                    <option value="REFORCO">REFORCO</option>
                    <option value="SANGRIA">SANGRIA</option>
                    <option value="AJUSTE">AJUSTE</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Valor</label>
                  <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: R$ 35,00"
                    value={movForm.valor}
                    onChange={(e) => setMovForm({ ...movForm, valor: formatBRLInput(e.target.value, { padDecimals: false }) })}
                    onBlur={(e) => setMovForm({ ...movForm, valor: formatBRLInput(e.target.value, { padDecimals: true }) })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Descricao</label>
                  <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: troco, retirada"
                    value={movForm.descricao}
                    onChange={(e) => setMovForm({ ...movForm, descricao: e.target.value })} />
                </div>
                <button className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium hover:bg-slate-700" disabled={!caixa}>
                  Registrar movimento
                </button>
              </form>
              {!caixa && <div className="mt-2 text-xs text-slate-500">Abra o caixa para registrar movimentacoes.</div>}
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow border p-5">
                <div className="text-lg font-semibold">Fluxo do caixa</div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Entradas</div>
                    <div className="text-lg font-semibold">{brlFormatter.format(resumo.entradas)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Saidas</div>
                    <div className="text-lg font-semibold">{brlFormatter.format(resumo.saidas)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Saldo</div>
                    <div className="text-lg font-semibold">{brlFormatter.format(resumo.saldo)}</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow border p-5">
                <div className="font-semibold text-lg">Movimentos do caixa</div>
                <div className="mt-4 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th className="py-2">Data</th>
                        <th>Tipo</th>
                        <th>Valor</th>
                        <th>Descricao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovs.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="py-2">{String(m.criado_em).replace("T", " ").slice(0, 19)}</td>
                          <td>{m.tipo}</td>
                          <td>{brlFormatter.format(Number(m.valor))}</td>
                          <td className="text-slate-500">{m.descricao || "-"}</td>
                        </tr>
                      ))}
                      {filteredMovs.length === 0 && (
                        <tr>
                          <td className="py-4 text-slate-500" colSpan="4">Nenhum movimento ainda.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}


        {caixa && !isCaixa && (
          <div className="lg:col-span-3">
            <button
              onClick={() => setCloseModal(true)}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 hover:bg-slate-700"
            >
              Fechar caixa
            </button>
          </div>
        )}

        {msg && <div className="text-green-700 text-sm">{msg}</div>}
        {err && <div className="text-red-700 text-sm">{err}</div>}
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow border p-5">
            <div className="text-lg font-semibold">Abrir caixa</div>
            <form className="mt-4 space-y-3" onSubmit={(e) => { abrir(e); setOpenModal(false); }}>
              <div>
                <label className="text-sm font-medium">Saldo inicial</label>
                <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: R$ 200,00"
                  value={openForm.saldo_inicial}
                  onChange={(e) => setOpenForm({ ...openForm, saldo_inicial: formatBRLInput(e.target.value, { padDecimals: false }) })}
                  onBlur={(e) => setOpenForm({ ...openForm, saldo_inicial: formatBRLInput(e.target.value, { padDecimals: true }) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Observacao</label>
                <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: caixa principal"
                  value={openForm.observacao}
                  onChange={(e) => setOpenForm({ ...openForm, observacao: e.target.value })} />
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setOpenModal(false); setOpenForm(emptyOpen); }}
                  className="flex-1 rounded-lg border py-2 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button className="flex-1 rounded-lg bg-slate-900 text-white py-2 hover:bg-slate-700">
                  Abrir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {closeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow border p-5">
            <div className="text-lg font-semibold">Fechar caixa</div>
            <form className="mt-4 space-y-3" onSubmit={(e) => { fechar(e); setCloseModal(false); }}>
              <div>
                <label className="text-sm font-medium">Saldo final</label>
                  <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: R$ 560,00"
                    value={closeForm.saldo_final}
                    onChange={(e) => setCloseForm({ ...closeForm, saldo_final: formatBRLInput(e.target.value, { padDecimals: false }) })}
                    onBlur={(e) => setCloseForm({ ...closeForm, saldo_final: formatBRLInput(e.target.value, { padDecimals: true }) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Observacao</label>
                <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: conferido"
                  value={closeForm.observacao}
                  onChange={(e) => setCloseForm({ ...closeForm, observacao: e.target.value })} />
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCloseModal(false); setCloseForm(emptyClose); }}
                  className="flex-1 rounded-lg border py-2 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button className="flex-1 rounded-lg bg-slate-900 text-white py-2 hover:bg-slate-700">
                  Fechar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

