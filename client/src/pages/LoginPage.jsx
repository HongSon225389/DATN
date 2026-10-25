import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router";

import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { user, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  if (user) {
    return (
      <Navigate
        to={user.role === "admin" ? "/admin/flood-events" : "/"}
        replace
      />
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      await login({
        email: email.trim(),
        password,
      });

      setPassword("");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/">← Về bản đồ</Link>

        <h1>Đăng nhập</h1>
        <p>Đăng nhập tài khoản Hanoi Flood của bạn.</p>
        {location.state?.registered && (
          <p className="success-message" role="status">
            Đăng ký thành công. Bạn có thể đăng nhập ngay.
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="login-password">Mật khẩu</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
        <p className="auth-switch">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
        </p>
        <p className="auth-switch">
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </p>
      </section>
    </main>
  );
}
