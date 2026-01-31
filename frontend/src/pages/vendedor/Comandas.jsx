import React, { useEffect, useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { http } from "../../api/http.js";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";

export default function Comandas() {
  const [comandas, setComandas] = useState([]);
  const [resumo, setResumo] = useState({ total_vendas: 0, produtos: [], vendedores: [], comandas_finalizadas: [] });
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [mesa, setMesa] = useState("");
  const [observacao, setObservacao] = useState("");
  const [mesas, setMesas] = useState([]);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const nav = useNavigate();

  async function load() {
    const { data } = await http.get("/comandas/abertas");
    setComandas(data);
  }
  async function loadResumo() {
    const { data } = await http.get("/comandas/resumo-dia");
    setResumo(data);
  }
  async function loadMesas() {
    const { data } = await http.get("/mesas");
    setMesas(data);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadResumo(); }, []);
  useEffect(() => { if (open) loadMesas(); }, [open]);

  async function criar() {
    setMsg(null);
    setErr(null);
    if (!mesa) {
      setErr("Informe a mesa.");
      return;
    }
    const { data } = await http.post("/comandas", { mesa, observacao });
    setMsg(`Comanda #${data.id} criada`);
    setMesa("");
    setObservacao("");
    setOpen(false);
    load();
    loadResumo();
    nav(`/vendedor/comanda/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="Vendedor - Comandas" />
      <div className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Comandas abertas</div>
            <div className="text-slate-500 text-sm">Crie e abra a comanda para adicionar itens</div>
          </div>
          <div className="flex items-end gap-3">
            <button onClick={() => setOpen(true)} className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700">
              Nova comanda
            </button>
          </div>
        </div>

        {msg && <div className="mt-3 text-green-700 text-sm">{msg}</div>}
        {err && <div className="mt-3 text-red-700 text-sm">{err}</div>}

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow border p-5">
              <div className="text-lg font-semibold">Abrir comanda</div>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium">Mesa</label>
                  <select
                    className="mt-1 w-full rounded-lg border p-3"
                    value={mesa}
                    onChange={(e) => setMesa(e.target.value)}
                  >
                    <option value="">Selecione a mesa</option>
                    {mesas.map((m) => (
                      <option key={m.id} value={m.numero}>{m.numero}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Observacao</label>
                  <input
                    className="mt-1 w-full rounded-lg border p-3"
                    placeholder="Ex: aniversario, cliente VIP"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => {
                    setOpen(false);
                    setMesa("");
                    setObservacao("");
                    setErr(null);
                  }}
                  className="flex-1 rounded-lg border py-2 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={criar}
                  className="flex-1 rounded-lg bg-slate-900 text-white py-2 hover:bg-slate-700"
                >
                  Abrir
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold">Comandas em aberto</div>
          <div className="text-sm">Total: <span className="font-semibold">{comandas.length}</span></div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {comandas.map(c => (
            <button
              key={c.id}
              onClick={() => nav(`/vendedor/comanda/${c.id}`)}
              className="text-left bg-white rounded-2xl shadow border p-5 hover:shadow-md"
            >
              <div className="text-xl font-bold">#{c.id}</div>
              <div className="text-sm text-slate-500">Mesa: <b className="font-semibold text-slate-900">{c.mesa || "-"}</b></div>
              <div className="text-sm text-slate-500">
                Vendedor: <b className="font-semibold text-slate-900">{c.vendedor_nome || c.id_vendedor}</b>
              </div>
              <div className="text-sm text-slate-500">Status: {c.status}</div>
              <div className="mt-2 font-medium">Total: R$ {Number(c.valor_total).toFixed(2)}</div>
            </button>
          ))}
        </div>

        {user?.role === "ADMIN" && (
          <div className="mt-6">
            <div className="rounded-2xl bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">Resumo de vendas</div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-3 bg-white rounded-2xl shadow border p-5">
              <div className="text-lg font-semibold">Total de vendas hoje</div>
              <div className="mt-2 text-2xl font-bold">R$ {Number(resumo.total_vendas || 0).toFixed(2)}</div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl shadow border p-5">
              <div className="text-lg font-semibold">Produtos vendidos hoje</div>
              <div className="mt-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-2">Produto</th>
                      <th>Qtd</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.produtos.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="py-2 font-medium">{p.nome}</td>
                        <td>{p.quantidade}</td>
                        <td>R$ {Number(p.total).toFixed(2)}</td>
                      </tr>
                    ))}
                    {resumo.produtos.length === 0 && (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan="3">Nenhuma venda hoje.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl shadow border p-5">
              <div className="text-lg font-semibold">Vendas por vendedor</div>
              <div className="mt-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="py-2">Vendedor</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumo.vendedores.map((v) => (
                      <tr key={v.id} className="border-t">
                        <td className="py-2 font-medium">{v.nome}</td>
                        <td>R$ {Number(v.total).toFixed(2)}</td>
                      </tr>
                    ))}
                    {resumo.vendedores.length === 0 && (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan="2">Nenhuma venda hoje.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow border p-5">
              <div className="text-lg font-semibold">Comandas finalizadas hoje</div>
              <div className="mt-4 space-y-2">
                {resumo.comandas_finalizadas.map((c) => (
                  <div key={c.id} className="border rounded-xl p-3">
                    <div className="font-medium">#{c.id} - Mesa {c.mesa || "-"}</div>
                    <div className="text-xs text-slate-500">
                      {c.vendedor_nome || "-"} - R$ {Number(c.valor_total).toFixed(2)}
                    </div>
                  </div>
                ))}
                {resumo.comandas_finalizadas.length === 0 && (
                  <div className="text-sm text-slate-500">Nenhuma comanda finalizada hoje.</div>
                )}
              </div>
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
