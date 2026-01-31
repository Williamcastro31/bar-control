import React, { useEffect, useMemo, useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { http } from "../../api/http.js";

const emptyProductForm = {
  nome: "",
  preco: "",
  estoque_atual: 0,
  estoque_minimo: 0,
  tipo: "SIMPLES",
  ativo: true,
};

const emptyEntryForm = {
  id_produto: "",
  data_entrada: "",
  validade: "",
  quantidade: 0,
};

const emptyExitForm = {
  id_produto: "",
  data_saida: "",
  quantidade: 0,
  detalhe: "",
};

const emptyComponent = { id_produto_componente: "", quantidade: 1 };
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

export default function Produtos() {
  const [tab, setTab] = useState("cadastro");
  const [produtos, setProdutos] = useState([]);
  const [movs, setMovs] = useState([]);
  const [form, setForm] = useState(emptyProductForm);
  const [editingId, setEditingId] = useState(null);
  const [components, setComponents] = useState([emptyComponent]);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [entry, setEntry] = useState(emptyEntryForm);
  const [entryMsg, setEntryMsg] = useState(null);
  const [entryError, setEntryError] = useState(null);
  const [saida, setSaida] = useState(emptyExitForm);
  const [saidaMsg, setSaidaMsg] = useState(null);
  const [saidaError, setSaidaError] = useState(null);
  const [filters, setFilters] = useState({ produtoId: "", dataInicio: "", dataFim: "" });

  async function loadProdutos() {
    const { data } = await http.get("/produtos");
    setProdutos(data);
  }

  async function loadMovs() {
    const { data } = await http.get("/produtos/movimentos");
    setMovs(data);
  }

  useEffect(() => { loadProdutos(); }, []);
  useEffect(() => { if (tab === "movimentos") loadMovs(); }, [tab]);

  const simpleProducts = useMemo(
    () => produtos.filter((p) => p.tipo === "SIMPLES"),
    [produtos]
  );
  const today = new Date().toISOString().slice(0, 10);

  const filteredMovs = useMemo(() => {
    const start = filters.dataInicio ? new Date(`${filters.dataInicio}T00:00:00`) : null;
    const end = filters.dataFim ? new Date(`${filters.dataFim}T23:59:59`) : null;
    return movs.filter((m) => {
      if (filters.produtoId && String(m.id_produto) !== String(filters.produtoId)) return false;
      if (!m.data_hora) return false;
      const when = new Date(m.data_hora);
      if (start && when < start) return false;
      if (end && when > end) return false;
      return true;
    });
  }, [movs, filters]);

  async function create(e) {
    e.preventDefault();
    setMsg(null);
    setError(null);

    const isCombo = form.tipo === "COMBO";
    let comps = [];
    if (isCombo) {
      comps = components
        .filter((c) => Number(c.id_produto_componente) > 0 && Number(c.quantidade) > 0)
        .map((c) => ({
          id_produto_componente: Number(c.id_produto_componente),
          quantidade: Number(c.quantidade),
        }));
      if (comps.length === 0) {
        setError("Informe ao menos um componente do combo.");
        return;
      }
    }

    try {
      const payload = {
        nome: form.nome,
        preco: parseBRL(form.preco),
        tipo: form.tipo,
        ativo: form.ativo,
      };
      const { data } = editingId
        ? await http.put(`/produtos/${editingId}`, payload)
        : await http.post("/produtos", payload);
      if (isCombo) {
        await http.post(`/produtos/${data.id}/componentes`, comps);
      }
      setForm(emptyProductForm);
      setEditingId(null);
      setComponents([emptyComponent]);
      setMsg(editingId ? "Produto atualizado!" : "Produto criado!");
      loadProdutos();
    } catch (err) {
      setError(err?.response?.data?.detail || "Falha ao criar produto");
    }
  }

  function updateComponent(index, patch) {
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function entradaEstoque(e) {
    e.preventDefault();
    setEntryMsg(null);
    setEntryError(null);

    if (!entry.id_produto) {
      setEntryError("Selecione um produto.");
      return;
    }
    if (!entry.data_entrada || !entry.validade) {
      setEntryError("Informe a data da entrada e a validade.");
      return;
    }
    if (entry.data_entrada > today) {
      setEntryError("Data de entrada nao pode ser futura.");
      return;
    }

    try {
      await http.post(`/produtos/${entry.id_produto}/entrada`, {
        quantidade: Number(entry.quantidade),
        data_entrada: entry.data_entrada,
        validade: entry.validade,
      });
      setEntry(emptyEntryForm);
      setEntryMsg("Entrada registrada!");
      loadProdutos();
      loadMovs();
    } catch (err) {
      setEntryError(err?.response?.data?.detail || "Falha ao registrar entrada");
    }
  }

  async function saidaEstoque(e) {
    e.preventDefault();
    setSaidaMsg(null);
    setSaidaError(null);

    if (!saida.id_produto) {
      setSaidaError("Selecione um produto.");
      return;
    }
    if (!saida.data_saida) {
      setSaidaError("Informe a data da saida.");
      return;
    }
    if (saida.data_saida > today) {
      setSaidaError("Data de saida nao pode ser futura.");
      return;
    }

    try {
      await http.post(`/produtos/${saida.id_produto}/saida`, {
        quantidade: Number(saida.quantidade),
        data_saida: saida.data_saida,
        detalhe: saida.detalhe || undefined,
      });
      setSaida(emptyExitForm);
      setSaidaMsg("Saida registrada!");
      loadProdutos();
      loadMovs();
    } catch (err) {
      setSaidaError(err?.response?.data?.detail || "Falha ao registrar saida");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="ADM - Produtos" />
      <div className="px-6 pt-6">
        <div className="inline-flex rounded-full bg-white border shadow-sm">
          <button
            onClick={() => setTab("cadastro")}
            className={`px-4 py-2 text-sm rounded-full ${tab === "cadastro" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
          >
            Cadastro de produtos
          </button>
          <button
            onClick={() => setTab("movimentos")}
            className={`px-4 py-2 text-sm rounded-full ${tab === "movimentos" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
          >
            Movimentações
          </button>
        </div>
      </div>

      {tab === "cadastro" && (
        <div className="p-6 grid gap-6 lg:grid-cols-3">
          <div className="bg-white rounded-2xl shadow border p-5">
            <div className="font-semibold text-lg">
              {editingId ? "Editar produto" : "Novo produto"}
            </div>
            <form className="mt-4 space-y-3" onSubmit={create}>
              <div>
                <label className="text-sm font-medium">Nome</label>
                <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: Cerveja Pilsen"
                  value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Preco</label>
                  <input
                    className="mt-1 w-full rounded-lg border p-3"
                    placeholder="Ex: R$ 12,50"
                    value={form.preco}
                    onChange={(e) => setForm({ ...form, preco: formatBRLInput(e.target.value, { padDecimals: false }) })}
                    onBlur={(e) => setForm({ ...form, preco: formatBRLInput(e.target.value, { padDecimals: true }) })}
                  />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <select className="mt-1 w-full rounded-lg border p-3"
                  value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  <option value="SIMPLES">SIMPLES</option>
                  <option value="COMBO">COMBO</option>
                </select>
              </div>

              {form.tipo === "COMBO" && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Componentes do combo</div>
                  {components.map((c, index) => (
                    <div key={index} className="grid grid-cols-6 gap-2 items-center">
                      <select className="col-span-3 rounded-lg border p-2"
                        value={c.id_produto_componente}
                        onChange={(e) => updateComponent(index, { id_produto_componente: e.target.value })}>
                        <option value="">Selecione</option>
                        {simpleProducts.map((p) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                      <input className="col-span-2 rounded-lg border p-2" placeholder="Qtd"
                        value={c.quantidade}
                        onChange={(e) => updateComponent(index, { quantidade: e.target.value })} />
                      <button
                        type="button"
                        className="col-span-1 rounded-lg border p-2 text-red-600 hover:bg-red-50"
                        onClick={() => setComponents((prev) => prev.filter((_, i) => i !== index))}
                        aria-label="Remover componente"
                      >
                        X
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => setComponents((prev) => [...prev, emptyComponent])}
                      className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm">
                      Adicionar componente
                    </button>
                  </div>
                </div>
              )}

              <button className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium hover:bg-slate-700">
                {editingId ? "Salvar" : "Criar"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyProductForm);
                    setComponents([emptyComponent]);
                    setError(null);
                    setMsg(null);
                  }}
                  className="w-full rounded-lg border py-3 font-medium hover:bg-slate-50"
                >
                  Cancelar edicao
                </button>
              )}
              {msg && <div className="text-green-700 text-sm">{msg}</div>}
              {error && <div className="text-red-600 text-sm">{error}</div>}
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl shadow border p-5">
            <div className="font-semibold text-lg">Lista</div>
            <div className="mt-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2">ID</th>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Preco</th>
                    <th>Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2">{p.id}</td>
                      <td className="font-medium">{p.nome}</td>
                      <td>{p.tipo}</td>
                      <td>{Number(p.preco).toFixed(2)}</td>
                      <td>
                        <button
                          onClick={() => {
                            setEditingId(p.id);
                            setTab("cadastro");
                            setForm({
                              ...emptyProductForm,
                              nome: p.nome,
                              preco: formatBRLInput(p.preco, { padDecimals: true }),
                              tipo: p.tipo,
                              ativo: p.ativo,
                            });
                          }}
                          className="mr-2 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs"
                        >
                          Editar
                        </button>
                        <button
                          onClick={async () => {
                            await http.put(`/produtos/${p.id}`, { ativo: false });
                            loadProdutos();
                          }}
                          className="px-3 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs"
                        >
                          Inativar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "movimentos" && (
        <div className="p-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow border border-green-500 p-5">
              <div className="font-semibold text-lg">Entrada de estoque</div>
              <form className="mt-4 space-y-3" onSubmit={entradaEstoque}>
                <div>
                  <label className="text-sm font-medium">Produto</label>
                  <select className="mt-1 w-full rounded-lg border p-3"
                    value={entry.id_produto} onChange={(e) => setEntry({ ...entry, id_produto: e.target.value })}>
                    <option value="">Selecione o produto</option>
                    {simpleProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Data de entrada</label>
                    <input type="date" max={today} className="mt-1 w-full rounded-lg border p-3"
                      value={entry.data_entrada} onChange={(e) => setEntry({ ...entry, data_entrada: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Validade</label>
                    <input type="date" className="mt-1 w-full rounded-lg border p-3"
                      value={entry.validade} onChange={(e) => setEntry({ ...entry, validade: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Quantidade</label>
                  <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: 50"
                    value={entry.quantidade} onChange={(e) => setEntry({ ...entry, quantidade: e.target.value })} />
                </div>
                <button className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium hover:bg-slate-700">
                  Registrar entrada
                </button>
                {entryMsg && <div className="text-green-700 text-sm">{entryMsg}</div>}
                {entryError && <div className="text-red-600 text-sm">{entryError}</div>}
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow border border-red-500 p-5">
              <div className="font-semibold text-lg">Saida de estoque</div>
              <form className="mt-4 space-y-3" onSubmit={saidaEstoque}>
                <div>
                  <label className="text-sm font-medium">Produto</label>
                  <select className="mt-1 w-full rounded-lg border p-3"
                    value={saida.id_produto} onChange={(e) => setSaida({ ...saida, id_produto: e.target.value })}>
                    <option value="">Selecione o produto</option>
                    {simpleProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Data de saida</label>
                  <input type="date" max={today} className="mt-1 w-full rounded-lg border p-3"
                    value={saida.data_saida} onChange={(e) => setSaida({ ...saida, data_saida: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Quantidade</label>
                  <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: 10"
                    value={saida.quantidade} onChange={(e) => setSaida({ ...saida, quantidade: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Detalhe</label>
                  <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: perda, ajuste, vencimento"
                    value={saida.detalhe} onChange={(e) => setSaida({ ...saida, detalhe: e.target.value })} />
                </div>
                <button className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium hover:bg-slate-700">
                  Registrar saida
                </button>
                {saidaMsg && <div className="text-green-700 text-sm">{saidaMsg}</div>}
                {saidaError && <div className="text-red-600 text-sm">{saidaError}</div>}
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow border p-5">
              <div className="font-semibold text-lg">Filtros</div>
              <div className="mt-4 flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-sm font-medium">Produto</label>
                  <select className="mt-1 w-full rounded-lg border p-3"
                    value={filters.produtoId} onChange={(e) => setFilters({ ...filters, produtoId: e.target.value })}>
                    <option value="">Todos</option>
                    {simpleProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Data inicio</label>
                  <input type="date" className="mt-1 w-full rounded-lg border p-3"
                    value={filters.dataInicio} onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Data fim</label>
                  <input type="date" className="mt-1 w-full rounded-lg border p-3"
                    value={filters.dataFim} onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow border p-5">
              <div className="font-semibold text-lg">Saldo por produto</div>
              <div className="mt-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-2">Produto</th>
                      <th>Entradas</th>
                      <th>Saidas</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(filteredMovs.reduce((acc, m) => {
                      const key = m.id_produto;
                      if (!acc[key]) {
                        acc[key] = {
                          id_produto: m.id_produto,
                          produto_nome: m.produto_nome,
                          entradas: 0,
                          saidas: 0,
                        };
                      }
                      if (m.tipo === "ENTRADA" || m.tipo === "ESTORNO") {
                        acc[key].entradas += Number(m.quantidade);
                      } else {
                        acc[key].saidas += Number(m.quantidade);
                      }
                      return acc;
                    }, {})).map((row) => (
                      <tr key={row.id_produto} className="border-t">
                        <td className="py-2 font-medium">{row.produto_nome}</td>
                        <td className="text-green-700">{row.entradas}</td>
                        <td className="text-red-700">{row.saidas}</td>
                        <td>{(row.entradas - row.saidas).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow border p-5">
              <div className="font-semibold text-lg">Movimentacoes</div>
              <div className="mt-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-2">Data</th>
                      <th>Produto</th>
                      <th>Tipo</th>
                      <th>Quantidade</th>
                      <th>Detalhe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovs.map((m) => {
                      const isEntrada = m.tipo === "ENTRADA" || m.tipo === "ESTORNO";
                      const rowClass = isEntrada ? "text-green-700" : "text-red-700";
                      return (
                        <tr key={m.id} className={`border-t ${rowClass}`}>
                          <td className="py-2">{m.data_hora ? String(m.data_hora).replace("T", " ").slice(0, 19) : "-"}</td>
                          <td className="font-medium">{m.produto_nome}</td>
                          <td>{m.tipo}</td>
                          <td>{m.quantidade}</td>
                          <td className="text-slate-500">{m.detalhe || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
