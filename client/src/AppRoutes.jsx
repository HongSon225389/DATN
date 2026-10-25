import { Link, Route, Routes } from "react-router";

import App from "./App";

// Layout và kiểm tra quyền.
import PublicLayout from "./components/PublicLayout";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";

// Xác thực.
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PasswordPage from "./pages/PasswordPage";

// Báo cáo của người dùng.
import ReportListPage from "./pages/ReportListPage";
import ReportCreatePage from "./pages/ReportCreatePage";
import ReportDetailPage from "./pages/ReportDetailPage";
import ReportEditPage from "./pages/ReportEditPage";

// Quản trị.
import AdminFloodPage from "./pages/AdminFloodPage";
import AdminFloodCreatePage from "./pages/AdminFloodCreatePage";
import AdminUsersPage from "./pages/AdminUsersPage";

import AdminAvoidancePage from "./pages/AdminAvoidancePage";
export default function AppRoutes() {
  return (
    <Routes>
      {/* Bản đồ và báo cáo dùng chung navbar công khai. */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<App />} />

        {/* Chỉ tài khoản người dùng đã đăng nhập. */}
        <Route element={<PrivateRoute />}>
          <Route path="/reports" element={<ReportListPage />} />

          <Route path="/reports/new" element={<ReportCreatePage />} />

          <Route path="/reports/:id" element={<ReportDetailPage />} />

          <Route path="/reports/:id/edit" element={<ReportEditPage />} />
        </Route>
      </Route>

      {/* Đăng nhập, đăng ký và khôi phục mật khẩu. */}
      <Route path="/login" element={<LoginPage />} />

      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/forgot-password"
        element={<PasswordPage key="forgot" mode="forgot" />}
      />

      <Route
        path="/reset-password"
        element={<PasswordPage key="reset" mode="reset" />}
      />

      {/* Quản trị: kiểm tra quyền và hiển thị navbar admin. */}
      <Route element={<AdminRoute />}>
        <Route path="/admin/flood-events" element={<AdminFloodPage />} />

        <Route
          path="/admin/flood-events/new"
          element={<AdminFloodCreatePage />}
        />

        <Route
          path="/admin/flood-reports"
          element={<ReportListPage key="admin-reports" admin />}
        />

        <Route
          path="/admin/flood-reports/:id"
          element={<ReportDetailPage admin />}
        />

        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route
          path="/admin/routing-avoidances"
          element={<AdminAvoidancePage />}
        />
      </Route>

      {/* Đường dẫn không tồn tại. */}
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
