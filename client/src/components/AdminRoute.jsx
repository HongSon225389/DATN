import { Link, Navigate, Outlet } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import AdminNavbar from "./AdminNavbar";

export default function AdminRoute() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Không có quyền truy cập</h1>
          <p>Tài khoản này không có quyền quản trị.</p>
          <Link to="/">Về bản đồ</Link>
        </section>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <AdminNavbar />
      <Outlet />
    </div>
  );
}
