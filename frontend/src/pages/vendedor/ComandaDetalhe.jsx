import React, { useEffect, useMemo, useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { http } from "../../api/http.js";
import { useParams, useNavigate } from "react-router-dom";

export default function ComandaDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const [produtos, setProdutos] = useState([]);
  const [itens, setItens] = useState([]);
  const [comandasAbertas, setComandasAbertas] = useState([]);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [qtds, setQtds] = useState({});

  async function load() {
    const [p, i, c] = await Promise.all([
      http.get("/produtos"),
      http.get(`/comandas/${id}/itens`),
      http.get("/comandas/abertas"),
    ]);
    setProdutos(p.data);
    setItens(i.data);
    setComandasAbertas(c.data);
  }

  useEffect(() => { load(); }, [id]);

  async function addItem(id_produto, quantidade) {
    setMsg(null); setErr(null);
    try {
      await http.post(`/comandas/${id}/itens`, { id_produto, quantidade });
      setMsg("Item adicionado!");
      setQtds((prev) => ({ ...prev, [id_produto]: 1 }));
      load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Erro ao adicionar");
    }
  }

  async function remover(itemId) {
    setMsg(null); setErr(null);
    await http.delete(`/comandas/itens/${itemId}`);
    setMsg("Item removido (estoque estornado)!");
    load();
  }

  async function finalizar() {
    setMsg(null); setErr(null);
    await http.post(`/comandas/${id}/finalizar`);
    nav("/vendedor/comandas");
  }

  async function cancelar() {
    setMsg(null); setErr(null);
    await http.post(`/comandas/${id}/cancelar`);
    nav("/vendedor/comandas");
  }

  const total = useMemo(() => itens.reduce((acc, it) => acc + Number(it.total_item), 0), [itens]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title={`Vendedor - Comanda #${id}`} />
      <div className="p-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <button
            onClick={() => nav("/vendedor/comandas")}
            className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
          >
            Voltar para vendas
          </button>
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl shadow border p-5">
          <div className="text-lg font-semibold">Comandas em aberto</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {comandasAbertas.map((c) => (
              <button
                key={c.id}
                onClick={() => nav(`/vendedor/comanda/${c.id}`)}
                className={`text-left rounded-2xl border p-4 hover:shadow-md ${String(c.id) === String(id) ? "bg-slate-100" : "bg-white"}`}
              >
                <div className="font-semibold">#{c.id}</div>
                <div className="text-xs text-slate-500">Mesa: {c.mesa || "-"}</div>
                <div className="text-xs text-slate-500">Total: R$ {Number(c.valor_total).toFixed(2)}</div>
              </button>
            ))}
            {comandasAbertas.length === 0 && (
              <div className="text-sm text-slate-500">Nenhuma comanda em aberto.</div>
            )}
          </div>
        </div>
        <div className="lg:col-span-2 bg-white rounded-2xl shadow border p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Adicionar produtos</div>
              <div className="text-sm text-slate-500">Produto com saldo 0 aparece, mas nao adiciona</div>
            </div>
          </div>

          {msg && <div className="mt-3 text-green-700 text-sm">{msg}</div>}
          {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {produtos.map((p) => (
              <div key={p.id} className="border rounded-2xl p-4 bg-slate-50">
                <div className="font-semibold">{p.nome}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Tipo: {p.tipo} - Preco: R$ {Number(p.preco).toFixed(2)}
                </div>
                <div className="text-xs mt-1">
                  {p.tipo === "SIMPLES" ? (
                    <span>Saldo: <b className={Number(p.saldo_atual ?? p.estoque_atual) <= 0 ? "text-red-600" : ""}>{p.saldo_atual ?? p.estoque_atual}</b></span>
                  ) : (
                    <span>Disponivel (combos): <b className={Number(p.disponivel_combo) <= 0 ? "text-red-600" : ""}>{p.disponivel_combo ?? 0}</b></span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="w-24">
                    <label className="text-xs text-slate-500">Qtd</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="mt-1 w-full rounded-lg border p-2 text-sm"
                      value={qtds[p.id] ?? 1}
                      onChange={(e) => setQtds((prev) => ({ ...prev, [p.id]: Number(e.target.value) || 1 }))}
                    />
                  </div>
                  <button
                    disabled={!p.can_add}
                    onClick={() => addItem(p.id, qtds[p.id] ?? 1)}
                    className={`flex-1 py-2 rounded-lg font-medium ${p.can_add ? "bg-slate-900 text-white hover:bg-slate-700" : "bg-slate-200 text-slate-500 cursor-not-allowed"}`}
                    title={p.reason_disabled || ""}
                  >
                    {p.can_add ? "Adicionar" : (p.reason_disabled || "Indisponivel")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow border p-5">
          <div className="text-lg font-semibold">Itens da comanda</div>
          <div className="text-sm text-slate-500">Total calculado: R$ {total.toFixed(2)}</div>

          <div className="mt-4 space-y-2">
            {itens.map((it) => (
              <div key={it.id} className="border rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Produto #{it.id_produto}</div>
                  <div className="text-xs text-slate-500">
                    Qtd: {it.quantidade} - Total: R$ {Number(it.total_item).toFixed(2)}
                  </div>
                </div>
                <button onClick={() => remover(it.id)} className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100">
                  Remover
                </button>
              </div>
            ))}
            {itens.length === 0 && <div className="text-sm text-slate-500">Nenhum item ainda.</div>}
          </div>

          <div className="mt-6 grid gap-2">
            <button onClick={finalizar} className="w-full py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              Finalizar comanda
            </button>
            <button onClick={cancelar} className="w-full py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300">
              Cancelar comanda (estorna)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
