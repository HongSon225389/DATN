import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import authService from "../services/authService";

export default function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    setError("");

    if (name.trim().length < 2) {
      setError("Tên phải có ít nhất 2 ký tự");
      return;
    }

    if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
      setError("Mật khẩu phải có ít nhất 8 ký tự và không vượt quá 72 byte");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);

    try {
      await authService.register({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      navigate("/login", {
        replace: true,
        state: {
          registered: true,
        },
      });
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

        <h1>Tạo tài khoản</h1>
        <p>Đăng ký để gửi thông tin ngập và quản lý báo cáo của bạn.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="register-name">Họ tên</label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="register-password">Mật khẩu</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby="password-help"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />

          <small id="password-help" className="field-help">
            Ít nhất 8 ký tự, tối đa 72 byte.
          </small>

          <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
          <input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={loading}
          />

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? "Đang tạo tài khoản…" : "Đăng ký"}
          </button>
        </form>

        <p className="auth-switch">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </section>
    </main>
  );
}
