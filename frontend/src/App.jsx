import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";

import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import AdminProdutos from "./pages/admin/Produtos.jsx";
import AdminUsuarios from "./pages/admin/Usuarios.jsx";
import AdminSalao from "./pages/admin/Salao.jsx";
import Caixa from "./pages/Caixa.jsx";
import VendedorComandas from "./pages/vendedor/Comandas.jsx";
import ComandaDetalhe from "./pages/vendedor/ComandaDetalhe.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/produtos"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminProdutos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/usuarios"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminUsuarios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/salao"
            element={
              <ProtectedRoute roles={["ADMIN"]}>
                <AdminSalao />
              </ProtectedRoute>
            }
          />

          <Route
            path="/vendedor/comandas"
            element={
              <ProtectedRoute roles={["VENDEDOR", "ADMIN"]}>
                <VendedorComandas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendedor/comanda/:id"
            element={
              <ProtectedRoute roles={["VENDEDOR", "ADMIN"]}>
                <ComandaDetalhe />
              </ProtectedRoute>
            }
          />
          <Route
            path="/caixa"
            element={
              <ProtectedRoute roles={["VENDEDOR", "ADMIN", "CAIXA"]}>
                <Caixa />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
