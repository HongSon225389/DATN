import { Link, NavLink } from "react-router";

import { useAuth } from "../contexts/AuthContext";

export default function AdminNavbar() {
  const { logout } = useAuth();

  const linkClass = ({ isActive }) =>
    `admin-nav-link${isActive ? " active" : ""}`;

  return (
    <nav className="admin-navbar" aria-label="Điều hướng quản trị">
      <Link className="admin-nav-brand" to="/admin/flood-events">
        Hanoi Flood · Admin
      </Link>

      <div className="admin-nav-links">
        <NavLink to="/admin/flood-events" end className={linkClass}>
          Điểm ngập
        </NavLink>

        <NavLink to="/admin/flood-events/new" className={linkClass}>
          Tạo điểm ngập
        </NavLink>

        <NavLink to="/admin/flood-reports" className={linkClass}>
          Duyệt báo cáo
        </NavLink>

        <NavLink to="/admin/users" className={linkClass}>
          Người dùng
        </NavLink>

        <Link to="/" className="admin-nav-link">
          Xem bản đồ
        </Link>

        <button type="button" className="admin-nav-logout" onClick={logout}>
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}
