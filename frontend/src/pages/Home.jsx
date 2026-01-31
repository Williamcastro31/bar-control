import React from "react";
import { Link } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const canVendas = user?.role === "VENDEDOR" || isAdmin;
  const canCaixa = user?.role === "CAIXA" || canVendas;

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="Inicio" />
      <div className="p-6">
        <div className="text-lg font-semibold">Acessos rapidos</div>
        <div className="text-slate-500 text-sm">Escolha a area que deseja acessar</div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {canCaixa && (
            <Link
              to="/caixa"
              className="block bg-white rounded-2xl shadow border p-6 hover:shadow-md"
            >
              <div className="text-xl font-bold">Caixa</div>
              <div className="text-slate-500 text-sm mt-1">Fluxo do caixa e fechamento</div>
            </Link>
          )}

          {canVendas && (
            <Link
              to="/vendedor/comandas"
              className="block bg-white rounded-2xl shadow border p-6 hover:shadow-md"
            >
              <div className="text-xl font-bold">Vendas</div>
              <div className="text-slate-500 text-sm mt-1">Comandas e itens do vendedor</div>
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin/produtos"
              className="block bg-white rounded-2xl shadow border p-6 hover:shadow-md"
            >
              <div className="text-xl font-bold">Produtos</div>
              <div className="text-slate-500 text-sm mt-1">Gerencie catalogo e estoque</div>
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin/usuarios"
              className="block bg-white rounded-2xl shadow border p-6 hover:shadow-md"
            >
              <div className="text-xl font-bold">Usuarios</div>
              <div className="text-slate-500 text-sm mt-1">Crie gerente e vendedores</div>
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/admin/salao"
              className="block bg-white rounded-2xl shadow border p-6 hover:shadow-md"
            >
              <div className="text-xl font-bold">Administrar loja</div>
              <div className="text-slate-500 text-sm mt-1">Cadastre as mesas do bar</div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
