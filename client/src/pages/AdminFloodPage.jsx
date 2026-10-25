import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import AdminFloodDetails from "../components/AdminFloodDetails";
import adminFloodService from "../services/adminFloodService";

export default function AdminFloodPage() {
  const { user, token, logout } = useAuth();

  const [keyword, setKeyword] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    mode: "",
    published: "",
    page: 1,
    limit: 10,
  });

  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const location = useLocation();

  const handleUnauthorized = useCallback(() => {
    logout();
  }, [logout]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      setResult(null);

      try {
        const data = await adminFloodService.getFloodEvents({
          ...filters,
          token,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setResult(data);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error.status === 401 || error.status === 403) {
          handleUnauthorized();
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
  }, [filters, token, reloadKey, handleUnauthorized]);

  const changeFilter = (key, value) => {
    setSelectedId(null);

    setFilters((previous) => ({
      ...previous,
      [key]: value,
      page: 1,
    }));
  };

  const search = (event) => {
    event.preventDefault();
    changeFilter("q", keyword.trim());
  };

  const pagination = result?.pagination;

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <h1>Quản lý điểm ngập</h1>
          <p>Xin chào, {user.name}</p>
        </div>
      </header>

      {location.state?.successMessage && (
        <p className="admin-success-message" role="status">
          {location.state.successMessage}
        </p>
      )}

      {selectedId ? (
        <AdminFloodDetails
          key={selectedId}
          id={selectedId}
          token={token}
          onClose={() => {
            setSelectedId(null);
            setReloadKey((value) => value + 1);
          }}
          onUnauthorized={handleUnauthorized}
        />
      ) : (
        <section className="admin-panel">
          <form className="admin-search" onSubmit={search}>
            <label htmlFor="admin-keyword">Tìm điểm ngập</label>

            <div className="admin-search-row">
              <input
                id="admin-keyword"
                type="search"
                placeholder="Tên, địa chỉ hoặc mã"
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
              Loại dữ liệu
              <select
                value={filters.mode}
                onChange={(event) => changeFilter("mode", event.target.value)}
              >
                <option value="">Tất cả</option>
                <option value="current">Hiện tại</option>
                <option value="historical">Lịch sử</option>
              </select>
            </label>

            <label>
              Công bố
              <select
                value={filters.published}
                onChange={(event) =>
                  changeFilter("published", event.target.value)
                }
              >
                <option value="">Tất cả</option>
                <option value="false">Chưa công khai</option>
                <option value="true">Đã đăng</option>
              </select>
            </label>

            <label>
              Số mục mỗi trang
              <select
                value={filters.limit}
                disabled={loading}
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

          {loading && <p role="status">Đang tải danh sách…</p>}

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          {!loading && !error && result && (
            <>
              <p>Tổng cộng: {pagination.total} địa điểm</p>

              {result.data.length === 0 ? (
                <p className="notice">Không có địa điểm phù hợp.</p>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <caption className="visually-hidden">
                      Danh sách điểm ngập
                    </caption>

                    <thead>
                      <tr>
                        <th scope="col">Địa điểm</th>
                        <th scope="col">Loại</th>
                        <th scope="col">Công bố</th>
                        <th scope="col">Tình trạng</th>
                        <th scope="col">Thao tác</th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.data.map((event) => (
                        <tr key={event.id}>
                          <td>
                            <strong>{event.title}</strong>
                            <span>{event.address || "Chưa có địa chỉ"}</span>
                            <small>{event.code}</small>
                          </td>

                          <td>
                            {event.dataMode === "historical"
                              ? "Lịch sử"
                              : "Hiện tại"}
                          </td>

                          <td>
                            {event.isPublished
                              ? "Đã đăng"
                              : event.publishedAt
                                ? "Đã ẩn"
                                : "Nháp"}
                          </td>

                          <td>
                            {event.latestObservation?.status === "flooded"
                              ? "Đang ngập"
                              : event.latestObservation?.status === "receded"
                                ? "Đã rút"
                                : "Chưa rõ"}
                          </td>

                          <td>
                            <button
                              type="button"
                              className="refresh-button"
                              aria-label={`Xem chi tiết ${event.title}`}
                              onClick={() => setSelectedId(event.id)}
                            >
                              Chi tiết
                            </button>
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
                  className="refresh-button"
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
                  Trang {filters.page}/{Math.max(1, pagination.totalPages)}
                </span>

                <button
                  type="button"
                  className="refresh-button"
                  disabled={filters.page >= pagination.totalPages}
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
      )}
    </main>
  );
}
