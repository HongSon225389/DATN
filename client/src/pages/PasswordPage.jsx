import { useEffect, useState } from "react";
import { Link } from "react-router";

import authService from "../services/authService";
import { useAuth } from "../contexts/AuthContext";

export default function PasswordPage({ mode }) {
  const isReset = mode === "reset";
  const { logout } = useAuth();

  const [token] = useState(() => {
    return (
      new URLSearchParams(window.location.hash.slice(1)).get("token") || ""
    );
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);

  const validToken = /^[a-f0-9]{64}$/.test(token);

  useEffect(() => {
    if (isReset && window.location.hash) {
      // Xóa token khỏi thanh địa chỉ sau khi đã đọc vào bộ nhớ.
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, [isReset]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading || completed) return;

    setError("");
    setMessage("");

    if (isReset) {
      if (!validToken) {
        setError("Liên kết không hợp lệ. Vui lòng yêu cầu liên kết mới.");
        return;
      }

      if (
        password.length < 8 ||
        new TextEncoder().encode(password).length > 72
      ) {
        setError("Mật khẩu cần ít nhất 8 ký tự và không quá 72 byte UTF-8");
        return;
      }

      if (password !== confirmPassword) {
        setError("Mật khẩu xác nhận không khớp");
        return;
      }
    }

    setLoading(true);

    try {
      const result = isReset
        ? await authService.resetPassword({ token, password })
        : await authService.forgotPassword(email.trim());

      if (isReset) {
        logout();
        setPassword("");
        setConfirmPassword("");
      }

      setMessage(result.message);
      setCompleted(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/login">← Đăng nhập</Link>

        <h1>{isReset ? "Đặt mật khẩu mới" : "Quên mật khẩu"}</h1>

        <p>
          {isReset
            ? "Nhập mật khẩu mới cho tài khoản của bạn."
            : "Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu."}
        </p>

        {isReset && !validToken ? (
          <p className="error-message" role="alert">
            Liên kết không hợp lệ.{" "}
            <Link to="/forgot-password">Yêu cầu liên kết mới</Link>
          </p>
        ) : (
          !completed && (
            <form onSubmit={handleSubmit}>
              {isReset ? (
                <>
                  <label htmlFor="new-password">Mật khẩu mới</label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                  />

                  <label htmlFor="confirm-new-password">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={loading}
                  />
                </>
              ) : (
                <>
                  <label htmlFor="recovery-email">Email đã đăng ký</label>
                  <input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={loading}
                  />
                </>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading
                  ? "Đang xử lý…"
                  : isReset
                    ? "Lưu mật khẩu mới"
                    : "Gửi liên kết"}
              </button>
            </form>
          )
        )}

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="success-message" role="status">
            {message}
          </p>
        )}

        {completed && !isReset && (
          <p>
            Chưa nhận được thư? Kiểm tra thư rác và chờ ít nhất 60 giây trước
            khi yêu cầu lại.
          </p>
        )}

        {completed && !isReset && (
          <button
            type="button"
            className="refresh-button"
            onClick={() => {
              setCompleted(false);
              setMessage("");
            }}
          >
            Nhập lại email
          </button>
        )}

        {isReset && (
          <p className="auth-switch">
            <Link to="/forgot-password">Yêu cầu liên kết mới</Link>
          </p>
        )}
      </section>
    </main>
  );
}
