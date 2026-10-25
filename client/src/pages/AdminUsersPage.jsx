import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import adminUserService from "../services/adminUserService";
import AdminDialog from "../components/AdminDialog";
const formatTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Chưa rõ"
    : date.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      });
};

const reportStatusLabels = {
  pending: "Chờ xác minh",
  approved: "Đã chấp nhận",
  rejected: "Bị bác bỏ",
};

function UserReports({ user, token, onUnauthorized }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await adminUserService.getReports({
          id: user.id,
          token,
          page,
          limit: 10,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setResult(data);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error.status === 401 || error.status === 403) {
          onUnauthorized();
          return;
        }

        setError(error.message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [user.id, token, page, reloadKey, onUnauthorized]);

  return (
    <section className="admin-panel">
      <h2>Báo cáo của {user.name}</h2>
      <p>{user.email}</p>

      {loading && <p role="status">Đang tải báo cáo…</p>}

      {error && (
        <>
          <p className="error-message" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Thử lại
          </button>
        </>
      )}

      {!loading && !error && result && (
        <>
          <p>Tổng cộng: {result.pagination.total} báo cáo</p>

          {result.data.length === 0 && <p>Người dùng chưa có báo cáo.</p>}

          <div className="flood-list">
            {result.data.map((report) => (
              <article className="location-card" key={report.id}>
                <h3>{report.address}</h3>
                <p>{reportStatusLabels[report.status]}</p>
                <p>Gửi gần nhất: {formatTime(report.submittedAt)}</p>

                {report.reviewNote && <p>Phản hồi: {report.reviewNote}</p>}

                <Link to={`/admin/flood-reports/${report.id}`}>
                  Xem chi tiết báo cáo
                </Link>
              </article>
            ))}
          </div>

          <div className="admin-pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Trước
            </button>

            <span>
              Trang {page}/{Math.max(1, result.pagination.totalPages)}
            </span>

            <button
              type="button"
              disabled={page >= result.pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Sau
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default function AdminUsersPage() {
  const { token, logout } = useAuth();

  const pending = useRef(false);

  const [keyword, setKeyword] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    active: "",
    page: 1,
    limit: 10,
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const [reportUser, setReportUser] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await adminUserService.getUsers({
          ...filters,
          token,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const lastPage = Math.max(1, data.pagination.totalPages);

        if (filters.page > lastPage) {
          setFilters((previous) => ({
            ...previous,
            page: lastPage,
          }));
          return;
        }

        setResult(data);
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error.status === 401 || error.status === 403) {
          logout();
          return;
        }

        setError(error.message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [filters, token, logout, reloadKey]);

  const changeFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
      page: 1,
    }));
  };

  const startAction = (user) => {
    setTarget(user);
    setReason("");
    setActionError("");
    setSuccess("");
  };

  const submitStatus = async (event) => {
    event.preventDefault();

    if (!target || pending.current) return;

    if (target.isActive && !reason.trim()) {
      setActionError("Vui lòng nhập lý do khóa");
      return;
    }

    pending.current = true;
    setSaving(true);
    setActionError("");

    try {
      const response = await adminUserService.updateStatus({
        id: target.id,
        token,
        isActive: !target.isActive,
        reason: reason.trim(),
      });

      setSuccess(response.message);
      setTarget(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        logout();
        return;
      }

      setActionError(error.message);
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <h1>Quản lý người dùng</h1>
          <p>Xem báo cáo và xử lý tài khoản có dấu hiệu spam.</p>
        </div>
      </header>

      {success && (
        <p className="admin-success-message" role="status">
          {success}
        </p>
      )}

      {target && (
        <AdminDialog
          title={target.isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
          busy={saving}
          onClose={() => setTarget(null)}
        >
          <section className="admin-panel">
            <h2>{target.isActive ? "Khóa" : "Mở khóa"} tài khoản</h2>

            <p>
              {target.name} — {target.email}
            </p>

            <form onSubmit={submitStatus}>
              {target.isActive ? (
                <>
                  <label htmlFor="block-reason">Lý do khóa *</label>
                  <textarea
                    id="block-reason"
                    rows={3}
                    maxLength={500}
                    required
                    disabled={saving}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <p>
                    Tài khoản sẽ không đăng nhập hoặc sử dụng chức năng yêu cầu
                    xác thực được nữa.
                  </p>
                </>
              ) : (
                <p>Sau khi mở khóa, người dùng cần đăng nhập lại.</p>
              )}

              {actionError && (
                <p className="error-message" role="alert">
                  {actionError}
                </p>
              )}

              <div className="admin-form-actions">
                <button type="submit" disabled={saving}>
                  {saving
                    ? "Đang xử lý…"
                    : target.isActive
                      ? "Xác nhận khóa"
                      : "Xác nhận mở khóa"}
                </button>

                <button
                  type="button"
                  className="refresh-button"
                  disabled={saving}
                  onClick={() => setTarget(null)}
                >
                  Hủy
                </button>

                {actionError && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setTarget(null);
                      setReloadKey((value) => value + 1);
                    }}
                  >
                    Tải lại danh sách
                  </button>
                )}
              </div>
            </form>
          </section>
        </AdminDialog>
      )}

      {reportUser && (
        <AdminDialog
          title={`Báo cáo của ${reportUser.name}`}
          onClose={() => setReportUser(null)}
        >
          <UserReports
            key={reportUser.id}
            user={reportUser}
            token={token}
            onUnauthorized={logout}
          />
        </AdminDialog>
      )}

      <section className="admin-panel">
        <form
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            changeFilter("q", keyword.trim());
          }}
        >
          <label htmlFor="user-keyword">Tìm theo tên hoặc email</label>

          <div className="admin-search-row">
            <input
              id="user-keyword"
              type="search"
              maxLength={200}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />

            <button type="submit" className="refresh-button">
              Tìm kiếm
            </button>
          </div>
        </form>

        <div className="admin-filters">
          <label>
            Trạng thái
            <select
              value={filters.active}
              onChange={(event) => changeFilter("active", event.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="true">Đang hoạt động</option>
              <option value="false">Đã khóa</option>
            </select>
          </label>

          <label>
            Số mục mỗi trang
            <select
              value={filters.limit}
              onChange={(event) =>
                changeFilter("limit", Number(event.target.value))
              }
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </label>

          <button
            type="button"
            className="refresh-button"
            disabled={loading}
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Tải lại
          </button>
        </div>

        {loading && <p role="status">Đang tải người dùng…</p>}

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && result && (
          <>
            <p>Tổng cộng: {result.pagination.total} người dùng</p>

            {result.data.length === 0 ? (
              <p>Không có người dùng phù hợp.</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Người dùng</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Báo cáo</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.data.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                          <small>Đăng ký: {formatTime(user.createdAt)}</small>
                        </td>

                        <td>
                          <strong>
                            {user.isActive ? "Hoạt động" : "Đã khóa"}
                          </strong>

                          {!user.isActive && (
                            <>
                              <span>{user.blockedReason}</span>
                              <small>{formatTime(user.blockedAt)}</small>
                            </>
                          )}
                        </td>

                        <td>
                          <strong>Tổng: {user.reports.total}</strong>
                          <span>Chờ: {user.reports.pending}</span>
                          <span>Duyệt: {user.reports.approved}</span>
                          <span>Bác bỏ: {user.reports.rejected}</span>
                        </td>

                        <td>
                          <div className="admin-form-actions">
                            <button
                              type="button"
                              className="refresh-button"
                              onClick={() => {
                                setTarget(null);
                                setReportUser(user);
                              }}
                            >
                              Xem báo cáo
                            </button>

                            <button
                              type="button"
                              className={
                                user.isActive
                                  ? "danger-button"
                                  : "refresh-button"
                              }
                              disabled={saving}
                              onClick={() => {
                                setReportUser(null);
                                startAction(user);
                              }}
                            >
                              {user.isActive ? "Khóa tài khoản" : "Mở khóa"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="admin-pagination">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() =>
                  setFilters((previous) => ({
                    ...previous,
                    page: previous.page - 1,
                  }))
                }
              >
                Trước
              </button>

              <span>
                Trang {filters.page}/{Math.max(1, result.pagination.totalPages)}
              </span>

              <button
                type="button"
                disabled={filters.page >= result.pagination.totalPages}
                onClick={() =>
                  setFilters((previous) => ({
                    ...previous,
                    page: previous.page + 1,
                  }))
                }
              >
                Sau
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
