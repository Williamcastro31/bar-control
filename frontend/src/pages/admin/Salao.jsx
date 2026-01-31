import React, { useEffect, useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { http } from "../../api/http.js";

const emptyMesaForm = { numero: "", descricao: "", ativo: true };

export default function Salao() {
  const [tab, setTab] = useState("mesas");
  const [mesas, setMesas] = useState([]);
  const [form, setForm] = useState(emptyMesaForm);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  async function loadMesas() {
    const { data } = await http.get("/admin/mesas");
    setMesas(data);
  }

  useEffect(() => { loadMesas(); }, []);

  async function createMesa(e) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    if (!form.numero) {
      setError("Informe o numero da mesa.");
      return;
    }
    try {
      await http.post("/admin/mesas", form);
      setForm(emptyMesaForm);
      setMsg("Mesa cadastrada!");
      loadMesas();
    } catch (err) {
      setError(err?.response?.data?.detail || "Falha ao cadastrar mesa");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="ADM - Salao" />
      <div className="px-6 pt-6">
        <div className="inline-flex rounded-full bg-white border shadow-sm">
          <button
            onClick={() => setTab("mesas")}
            className={`px-4 py-2 text-sm rounded-full ${tab === "mesas" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
          >
            Mesas
          </button>
        </div>
      </div>

      {tab === "mesas" && (
        <div className="p-6 grid gap-6 lg:grid-cols-3">
          <div className="bg-white rounded-2xl shadow border p-5">
            <div className="font-semibold text-lg">Cadastrar mesa</div>
            <form className="mt-4 space-y-3" onSubmit={createMesa}>
              <div>
                <label className="text-sm font-medium">Numero</label>
                <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: 12"
                  value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Descricao</label>
                <input className="mt-1 w-full rounded-lg border p-3" placeholder="Ex: Perto da janela"
                  value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
              </div>
              <button className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium hover:bg-slate-700">
                Cadastrar
              </button>
              {msg && <div className="text-green-700 text-sm">{msg}</div>}
              {error && <div className="text-red-600 text-sm">{error}</div>}
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl shadow border p-5">
            <div className="font-semibold text-lg">Lista de mesas</div>
            <div className="mt-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2">ID</th>
                    <th>Numero</th>
                    <th>Descricao</th>
                    <th>Ativo</th>
                    <th>Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {mesas.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="py-2">{m.id}</td>
                      <td className="font-medium">{m.numero}</td>
                      <td>{m.descricao || "-"}</td>
                      <td>{m.ativo ? "Sim" : "Nao"}</td>
                      <td>
                        <button
                          onClick={async () => {
                            await http.put(`/admin/mesas/${m.id}`, {
                              numero: m.numero,
                              descricao: m.descricao,
                              ativo: !m.ativo,
                            });
                            loadMesas();
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs"
                        >
                          {m.ativo ? "Desativar" : "Ativar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {mesas.length === 0 && (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan="5">Nenhuma mesa cadastrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
