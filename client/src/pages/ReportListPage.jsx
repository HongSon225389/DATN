import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import floodReportService from "../services/floodReportService";

const labels = {
  pending: "Chờ xác minh",
  approved: "Đã chấp nhận",
  rejected: "Bị bác bỏ",
};

const formatTime = (value) => {
  if (!value) return "Chưa có";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Chưa rõ"
    : date.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      });
};

export default function ReportListPage({ admin = false }) {
  const { token, logout } = useAuth();
  const headingRef = useRef(null);

  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: admin ? "pending" : "",
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await floodReportService.getReports({
          token,
          admin,
          ...filters,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const lastPage = Math.max(1, data.pagination.totalPages);

        // Ví dụ mục cuối trang bị thay đổi trạng thái bởi admin khác.
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

        if (error.status === 401) {
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
  }, [admin, filters, token, logout, reloadKey]);

  const changeFilter = (field, value) => {
    setFilters((previous) => ({
      ...previous,
      [field]: value,
      page: 1,
    }));
  };

  const changePage = (page) => {
    setFilters((previous) => ({
      ...previous,
      page,
    }));

    headingRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <h1>{admin ? "Duyệt báo cáo" : "Báo cáo của tôi"}</h1>

          <p>
            {admin
              ? "Các thông tin do người dùng gửi về."
              : "Theo dõi kết quả xác minh các báo cáo đã gửi."}
          </p>
        </div>
      </header>

      <section className="admin-panel">
        <div className="admin-filters">
          <label>
            Trạng thái
            <select
              value={filters.status}
              disabled={loading}
              onChange={(event) => changeFilter("status", event.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="pending">Chờ xác minh</option>
              <option value="approved">Đã chấp nhận</option>
              <option value="rejected">Bị bác bỏ</option>
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

        {loading && <p role="status">Đang tải báo cáo…</p>}

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && result && (
          <>
            <p>Tổng cộng: {result.pagination.total} báo cáo</p>

            {result.data.length === 0 ? (
              <p className="notice">Chưa có báo cáo phù hợp.</p>
            ) : (
              <div className="observation-history">
                {result.data.map((report) => (
                  <article className="observation-item" key={report.id}>
                    <div className="history-heading">
                      <strong>{report.address}</strong>
                      <span>{labels[report.status] || "Chưa rõ"}</span>
                    </div>

                    <p>{report.description}</p>
                    <p>Quan sát: {formatTime(report.observedAt)}</p>
                    <p>Gửi lúc: {formatTime(report.submittedAt)}</p>

                    {report.reviewNote && (
                      <p>
                        <strong>Phản hồi của admin: </strong>
                        {report.reviewNote}
                      </p>
                    )}

                    <small>Mã báo cáo: {report.id}</small>
                    <div className="report-item-actions">
                      <Link
                        to={
                          admin
                            ? `/admin/flood-reports/${report.id}`
                            : `/reports/${report.id}`
                        }
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="admin-pagination">
              <button
                type="button"
                className="refresh-button"
                disabled={filters.page <= 1}
                onClick={() => changePage(filters.page - 1)}
              >
                Trước
              </button>

              <span>
                Trang {filters.page}/{Math.max(1, result.pagination.totalPages)}
              </span>

              <button
                type="button"
                className="refresh-button"
                disabled={filters.page >= result.pagination.totalPages}
                onClick={() => changePage(filters.page + 1)}
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
