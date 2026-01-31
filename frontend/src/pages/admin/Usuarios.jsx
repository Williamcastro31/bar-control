import React, { useEffect, useState } from "react";
import Topbar from "../../components/Topbar.jsx";
import { http } from "../../api/http.js";

const ROLE_OPTIONS = [
  { label: "Gerente", value: "ADMIN" },
  { label: "Vendedor", value: "VENDEDOR" },
  { label: "Caixa", value: "CAIXA" },
];

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nome: "", username: "", password: "", role: "VENDEDOR" });
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    const { data } = await http.get("/admin/vendedores");
    setUsuarios(data);
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    try {
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await http.put(`/admin/vendedores/${editingId}`, payload);
        setMsg("Usuario atualizado!");
      } else {
        await http.post("/admin/vendedores", form);
        setMsg("Usuario criado!");
      }
      setForm({ nome: "", username: "", password: "", role: "VENDEDOR" });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err?.response?.data?.detail || "Falha ao criar usuario");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="ADM - Usuarios" />
      <div className="p-6 grid gap-6 lg:grid-cols-3">
        <div className="bg-white rounded-2xl shadow border p-5">
          <div className="font-semibold text-lg">{editingId ? "Editar usuario" : "Novo usuario"}</div>
          <form className="mt-4 space-y-3" onSubmit={create}>
            <input className="w-full rounded-lg border p-3" placeholder="Nome"
              value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <input className="w-full rounded-lg border p-3" placeholder="Username"
              value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input type="password" className="w-full rounded-lg border p-3" placeholder="Senha"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select className="w-full rounded-lg border p-3"
              value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {editingId && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                />
                Usuario ativo
              </label>
            )}
            <button className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium hover:bg-slate-700">
              {editingId ? "Salvar" : "Criar"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ nome: "", username: "", password: "", role: "VENDEDOR" });
                  setMsg(null);
                  setError(null);
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
                  <th>Username</th>
                  <th>Role</th>
                  <th>Ativo</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="py-2">{u.id}</td>
                    <td className="font-medium">{u.nome}</td>
                    <td>{u.username}</td>
                    <td>{u.role}</td>
                    <td>{u.ativo ? "Sim" : "Nao"}</td>
                    <td>
                      <button
                        onClick={() => {
                          setEditingId(u.id);
                          setForm({
                            nome: u.nome,
                            username: u.username,
                            password: "",
                            role: u.role,
                            ativo: u.ativo,
                          });
                          setMsg(null);
                          setError(null);
                        }}
                        className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
