import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import authService from "../services/authService";

const AuthContext = createContext(null);
const TOKEN_KEY = "hanoi-flood-auth-token";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const restoreController = useRef(null);

  const logout = useCallback(() => {
    restoreController.current?.abort();

    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // Vẫn kết thúc phiên trong bộ nhớ nếu trình duyệt chặn lưu trữ.
    }

    setSession(null);
    setAuthError("");
    setAuthLoading(false);
  }, []);

  const retrySession = useCallback(() => {
    setAuthError("");
    setAuthLoading(true);
    setRetryKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    restoreController.current = controller;

    const restoreSession = async () => {
      setAuthLoading(true);
      setAuthError("");

      try {
        const token = sessionStorage.getItem(TOKEN_KEY);

        if (!token) {
          setSession(null);
          return;
        }

        const user = await authService.getCurrentUser({
          token,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setSession({ token, user });
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error.status === 401 || error.status === 403) {
          logout();
          return;
        }

        // Lỗi mạng hoặc backend: giữ token để có thể thử lại.
        setAuthError(
          "Chưa kiểm tra được phiên đăng nhập. Hãy kiểm tra kết nối và backend rồi thử lại.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setAuthLoading(false);
        }
      }
    };

    restoreSession();

    return () => controller.abort();
  }, [retryKey, logout]);

  const login = async (credentials) => {
    const result = await authService.login(credentials);

    try {
      sessionStorage.setItem(TOKEN_KEY, result.token);
    } catch {
      throw new Error(
        "Trình duyệt đang chặn lưu trữ phiên. Hãy cho phép dữ liệu trang rồi thử lại.",
      );
    }

    restoreController.current?.abort();

    setSession(result);
    setAuthError("");
    setAuthLoading(false);

    return result.user;
  };

  const value = {
    user: session?.user ?? null,
    token: session?.token ?? null,
    authLoading,
    authError,
    login,
    logout,
    retrySession,
  };

  return (
    <AuthContext.Provider value={value}>
      {authLoading ? (
        <main className="auth-page">
          <section className="auth-card">
            <p role="status">Đang kiểm tra phiên đăng nhập…</p>
          </section>
        </main>
      ) : authError ? (
        <main className="auth-page">
          <section className="auth-card">
            <p className="error-message" role="alert">
              {authError}
            </p>

            <div className="account-actions">
              <button
                type="button"
                className="refresh-button"
                onClick={retrySession}
              >
                Thử lại
              </button>

              <button type="button" className="refresh-button" onClick={logout}>
                Kết thúc phiên và tiếp tục
              </button>
            </div>
          </section>
        </main>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth phải nằm trong AuthProvider");
  }

  return context;
}
