import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";

import { useAuth } from "../contexts/AuthContext";
import ReportImage from "../components/ReportImage";
import AdminReportReview from "../components/AdminReportReview";
import floodReportService from "../services/floodReportService";

const statusLabels = {
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

export default function ReportDetailPage({ admin = false }) {
  const { id } = useParams();
  const { token, logout } = useAuth();

  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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

  const coordinates = report?.location?.coordinates;

  const hasLocation =
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every(Number.isFinite) &&
    coordinates[0] >= -180 &&
    coordinates[0] <= 180 &&
    coordinates[1] >= -90 &&
    coordinates[1] <= 90;

  return (
    <main className="admin-page report-page">
      <header className="admin-heading">
        <div>
          <h1>Chi tiết báo cáo</h1>
          <p>Mã: {id}</p>
        </div>

        <Link to={admin ? "/admin/flood-reports" : "/reports"}>
          ← Danh sách báo cáo
        </Link>
      </header>

      {loading && <p role="status">Đang tải báo cáo…</p>}

      {error && (
        <section className="admin-panel">
          <p className="error-message" role="alert">
            {error}
          </p>

          <button
            type="button"
            className="refresh-button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Thử lại
          </button>
        </section>
      )}

      {!loading && !error && report && (
        <section className="admin-panel">
          <h2>{report.address}</h2>

          <span className="report-status">
            {statusLabels[report.status] || "Chưa rõ"}
          </span>

          {!admin && report.status === "rejected" && (
            <div className="report-item-actions">
              <p>
                Bạn có thể chỉnh sửa thông tin theo lý do bác bỏ rồi gửi lại để
                admin xác minh.
              </p>

              <Link to={`/reports/${report.id}/edit`}>
                Sửa và gửi lại báo cáo
              </Link>
            </div>
          )}

          <dl className="event-details">
            <div>
              <dt>Mô tả</dt>
              <dd className="report-description">{report.description}</dd>
            </div>

            <div>
              <dt>Độ sâu người gửi ước lượng</dt>
              <dd>
                {report.estimatedDepthCm == null
                  ? "Chưa rõ"
                  : `${report.estimatedDepthCm} cm`}
              </dd>
            </div>

            <div>
              <dt>Thời gian quan sát</dt>
              <dd>{formatTime(report.observedAt)}</dd>
            </div>

            <div>
              <dt>Thời gian gửi gần nhất</dt>
              <dd>{formatTime(report.submittedAt)}</dd>
            </div>

            {report.reviewedAt && (
              <div>
                <dt>Thời gian xử lý</dt>
                <dd>{formatTime(report.reviewedAt)}</dd>
              </div>
            )}

            {report.reviewNote && (
              <div>
                <dt>
                  {report.status === "rejected"
                    ? "Lý do bác bỏ"
                    : "Phản hồi của admin"}
                </dt>

                <dd className="report-description">{report.reviewNote}</dd>
              </div>
            )}
          </dl>

          <h3>Vị trí báo cáo</h3>

          {hasLocation ? (
            <div className="location-picker-map">
              <MapContainer
                key={`${report.id}-${coordinates[0]}-${coordinates[1]}`}
                center={[coordinates[1], coordinates[0]]}
                zoom={16}
                className="hanoi-map"
              >
                <TileLayer
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  referrerPolicy="strict-origin-when-cross-origin"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                <CircleMarker
                  center={[coordinates[1], coordinates[0]]}
                  radius={9}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 3,
                    fillColor: "#1769d2",
                    fillOpacity: 1,
                  }}
                />
              </MapContainer>
            </div>
          ) : (
            <p>Chưa có tọa độ hợp lệ.</p>
          )}

          <h3>Ảnh hiện trường</h3>

          <div className="report-detail-images">
            {(report.images ?? []).map((image) => (
              <ReportImage
                key={`${report.id}-${report.revision}-${image.index}`}
                reportId={report.id}
                index={image.index}
                token={token}
              />
            ))}
          </div>

          {admin && (
            <AdminReportReview
              key={`${report.id}-${report.revision}`}
              report={report}
              token={token}
              onReviewed={() => setReloadKey((value) => value + 1)}
              onUnauthorized={logout}
            />
          )}
        </section>
      )}
    </main>
  );
}
