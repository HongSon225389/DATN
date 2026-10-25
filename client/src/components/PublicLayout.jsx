import { useLayoutEffect, useRef } from "react";
import { Link, NavLink, Outlet } from "react-router";

import { useAuth } from "../contexts/AuthContext";

export default function PublicLayout() {
  const { user, logout } = useAuth();
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    const header = headerRef.current;

    const updateHeight = () => {
      document.documentElement.style.setProperty(
        "--public-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--public-header-height");
    };
  }, []);

  const linkClass = ({ isActive }) =>
    `public-nav-link${isActive ? " active" : ""}`;

  return (
    <div className="public-shell">
      <header ref={headerRef} className="public-navbar">
        <Link to="/" className="public-brand">
          <strong>Hanoi Flood</strong>
          <span>Bản đồ thông tin ngập tại Hà Nội</span>
        </Link>

        <nav className="public-nav-links" aria-label="Điều hướng chính">
          <NavLink to="/" end className={linkClass}>
            Bản đồ
          </NavLink>

          {user?.role === "user" && (
            <>
              <NavLink to="/reports/new" className={linkClass}>
                Gửi báo cáo
              </NavLink>

              <NavLink to="/reports" end className={linkClass}>
                Báo cáo của tôi
              </NavLink>
            </>
          )}

          {user?.role === "admin" && (
            <Link to="/admin/flood-events" className="public-nav-link">
              Quản trị
            </Link>
          )}

          {user ? (
            <button
              type="button"
              className="public-nav-button"
              onClick={logout}
            >
              Đăng xuất
            </button>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                Đăng nhập
              </NavLink>

              <NavLink to="/register" className={linkClass}>
                Đăng ký
              </NavLink>
            </>
          )}
        </nav>
      </header>

      <Outlet />
    </div>
  );
}
