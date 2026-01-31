import React, { useState } from "react";
import { http } from "../api/http.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const { login } = useAuth();
  const nav = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await http.post("/auth/login", { username, password });
      login({ token: data.access_token, role: data.role, nome: data.nome, userId: data.user_id });
      nav("/");
    } catch (err) {
      setError(err?.response?.data?.detail || "Falha no login");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="Login" />
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 border">
          <h1 className="text-2xl font-bold">Bar Flow</h1>
          <p className="text-slate-500 mt-1">Acesse com seu usuario</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Usuario</label>
              <input className="mt-1 w-full rounded-lg border p-3"
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Senha</label>
              <input type="password" className="mt-1 w-full rounded-lg border p-3"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium hover:bg-slate-700">
              Entrar
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
