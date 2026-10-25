import { Link, Route, Routes } from "react-router";

import App from "./App";
import AdminRoute from "./components/AdminRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminFloodPage from "./pages/AdminFloodPage";
import PasswordPage from "./pages/PasswordPage";
import AdminFloodCreatePage from "./pages/AdminFloodCreatePage";
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/forgot-password"
        element={<PasswordPage key="forgot" mode="forgot" />}
      />

      <Route
        path="/reset-password"
        element={<PasswordPage key="reset" mode="reset" />}
      />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<AdminRoute />}>
        <Route path="/admin/flood-events" element={<AdminFloodPage />} />
        <Route
          path="/admin/flood-events/new"
          element={<AdminFloodCreatePage />}
        />
      </Route>

      <Route
        path="*"
        element={
          <main className="auth-page">
            <section className="auth-card">
              <h1>Không tìm thấy trang</h1>
              <Link to="/">Về bản đồ</Link>
            </section>
          </main>
        }
      />
    </Routes>
  );
}
