import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import barIcon from "../assets/balcao-de-bar.png";

export default function Topbar({ title }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const canVendas = user?.role === "VENDEDOR" || isAdmin;
  const canCaixa = user?.role === "CAIXA" || canVendas;

  return (
    <div className="w-full border-b bg-white">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-slate-100 p-2 shadow-sm ring-1 ring-slate-200">
            <img src={barIcon} alt="Bar Flow" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight text-slate-900">Bar Flow</div>
            <div className="text-sm text-slate-500">{title}</div>
            {user && <div className="text-xs text-slate-500">{user.nome} - {user.role}</div>}
          </div>
        </div>
        {user ? (
          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700"
          >
            Sair
          </button>
        ) : (
          <Link
            to="/login"
            className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700"
          >
            Entrar
          </Link>
        )}
      </div>
      <div className="px-6 pb-4">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200" to="/">
            Inicio
          </Link>
          {canVendas && (
            <Link className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200" to="/vendedor/comandas">
              Vendas
            </Link>
          )}
          {canCaixa && (
            <Link className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200" to="/caixa">
              Caixa
            </Link>
          )}
          {isAdmin && (
            <Link className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200" to="/admin/produtos">
              Produtos
            </Link>
          )}
          {isAdmin && (
            <Link className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200" to="/admin/usuarios">
              Usuarios
            </Link>
          )}
          {isAdmin && (
            <Link className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200" to="/admin/salao">
              Administrar loja
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
