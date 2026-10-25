import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import floodReportService from "../services/floodReportService";
import ReportCreatePage from "./ReportCreatePage";

export default function ReportEditPage() {
  const { id } = useParams();
  const { token, logout } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await floodReportService.getReportById({
          id,
          token,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setReport(data);
        }
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
  }, [id, token, logout, reloadKey]);

  if (loading) {
    return (
      <main className="admin-page report-page">
        <p role="status">Đang tải báo cáo…</p>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="admin-page report-page">
        <section className="admin-panel">
          <p className="error-message" role="alert">
            {error || "Không tìm thấy báo cáo"}
          </p>

          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Thử lại
          </button>

          <p>
            <Link to="/reports">Về danh sách báo cáo</Link>
          </p>
        </section>
      </main>
    );
  }

  if (report.status !== "rejected") {
    return (
      <main className="admin-page report-page">
        <section className="admin-panel">
          <h1>Không thể sửa báo cáo</h1>
          <p>Chỉ báo cáo bị bác bỏ mới được sửa và gửi lại.</p>
          <Link to={`/reports/${id}`}>Xem chi tiết báo cáo</Link>
        </section>
      </main>
    );
  }

  return (
    <ReportCreatePage
      key={`${report.id}-${report.revision}`}
      initialReport={report}
    />
  );
}
