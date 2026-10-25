import { useEffect, useRef, useState } from "react";

import adminFloodService from "../services/adminFloodService";
import AdminFloodEditor from "./AdminFloodEditor";
import AdminFloodDelete from "./AdminFloodDelete";
const formatTime = (value) => {
  if (!value) return "Chưa có";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Chưa rõ"
    : date.toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      });
};

const formatDepth = (observation) => {
  const min = observation?.depthMinCm;
  const max = observation?.depthMaxCm;

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return "Chưa rõ";
  }

  return min === max ? `${min} cm` : `${min}–${max} cm`;
};

const statusLabels = {
  flooded: "Đang ngập",
  receded: "Đã rút",
};

const trendLabels = {
  rising: "Nước dâng",
  falling: "Nước giảm",
  stable: "Ổn định",
  unknown: "Chưa rõ",
};

const sourceLabels = {
  admin: "Admin nhập",
  user_report: "Báo cáo người dùng",
  web_article: "Bài viết",
};

export default function AdminFloodDetails({
  id,
  token,
  onClose,
  onUnauthorized,
}) {
  const [event, setEvent] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const publishingRef = useRef(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishMessage, setPublishMessage] = useState("");
  const [confirmPublish, setConfirmPublish] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [detail, observations] = await Promise.all([
          adminFloodService.getFloodEventById({
            id,
            token,
            signal: controller.signal,
          }),
          adminFloodService.getObservations({
            id,
            token,
            page: historyPage,
            signal: controller.signal,
          }),
        ]);

        if (controller.signal.aborted) return;

        setEvent(detail.data);
        setHistory(observations);
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
  }, [id, token, historyPage, reloadKey, onUnauthorized]);

  const observation = event?.latestObservation;

  const publish = async () => {
    if (!event || publishingRef.current) return;

    publishingRef.current = true;
    setPublishing(true);
    setPublishError("");
    setPublishMessage("");

    try {
      await adminFloodService.publishFloodEvent({
        id: event.id,
        revision: event.revision,
        token,
      });

      setConfirmPublish(false);
      setPublishMessage("Đã đăng điểm ngập.");
      setReloadKey((value) => value + 1);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        onUnauthorized();
        return;
      }

      setPublishError(error.message);

      if (error.status === 409) {
        setConfirmPublish(false);
        setReloadKey((value) => value + 1);
      }
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  };

  return (
    <section className="admin-panel">
      <div className="section-heading">
        <h2>Chi tiết điểm ngập</h2>

        <button type="button" className="refresh-button" onClick={onClose}>
          Đóng
        </button>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {loading && <p role="status">Đang tải chi tiết…</p>}

      {!loading && error && (
        <button
          type="button"
          className="refresh-button"
          onClick={() => setReloadKey((value) => value + 1)}
        >
          Thử lại
        </button>
      )}

      {!loading && !error && event && (
        <>
          <h3>{event.title}</h3>
          <p className="admin-code">{event.code}</p>

          {saveMessage && (
            <p className="admin-success-message" role="status">
              {saveMessage}
            </p>
          )}

          {!editing &&
            !publishing &&
            ((!event.isPublished && !event.publishedAt) ||
              event.isPublished) && (
              <button
                type="button"
                className="refresh-button"
                onClick={() => {
                  setEditing(true);
                  setConfirmPublish(false);
                  setSaveMessage("");
                }}
              >
                {event.isPublished ? "Cập nhật tình trạng" : "Sửa bản nháp"}
              </button>
            )}

          {editing && (
            <AdminFloodEditor
              key={`${event.id}-${event.revision}`}
              event={event}
              token={token}
              onUnauthorized={onUnauthorized}
              onCancel={() => setEditing(false)}
              onSaved={(message) => {
                setEditing(false);
                setSaveMessage(message);
                setHistoryPage(1);
                setReloadKey((value) => value + 1);
              }}
            />
          )}

          {!editing && !event.isPublished && !event.publishedAt && (
            <div className="publish-panel">
              {!confirmPublish ? (
                <button
                  type="button"
                  className="refresh-button"
                  onClick={() => setConfirmPublish(true)}
                >
                  Đăng lên bản đồ
                </button>
              ) : (
                <>
                  <p>
                    Xác nhận đã kiểm tra địa chỉ, vị trí và tình trạng của{" "}
                    <strong>{event.title}</strong>.
                    {event.dataMode === "current"
                      ? " Điểm này sẽ được hiển thị công khai trong dữ liệu hiện tại."
                      : " Điểm này sẽ được công bố trong dữ liệu lịch sử."}
                  </p>

                  <div className="account-actions">
                    <button
                      type="button"
                      className="refresh-button"
                      disabled={publishing}
                      onClick={publish}
                    >
                      {publishing ? "Đang đăng…" : "Xác nhận đăng"}
                    </button>

                    <button
                      type="button"
                      className="refresh-button"
                      disabled={publishing}
                      onClick={() => setConfirmPublish(false)}
                    >
                      Hủy
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {publishError && (
            <p className="error-message" role="alert">
              {publishError}
            </p>
          )}

          {publishMessage && (
            <p className="admin-success-message" role="status">
              {publishMessage}
            </p>
          )}

          <dl className="event-details">
            <div>
              <dt>Địa chỉ</dt>
              <dd>{event.address || "Chưa có"}</dd>
            </div>

            <div>
              <dt>Tọa độ — kinh độ, vĩ độ</dt>
              <dd>{event.location?.coordinates?.join(", ") || "Chưa có"}</dd>
            </div>

            <div>
              <dt>Ghi chú vị trí</dt>
              <dd>{event.locationNote || "Không có"}</dd>
            </div>

            <div>
              <dt>Dữ liệu</dt>
              <dd>
                {event.dataMode === "historical" ? "Lịch sử" : "Hiện tại"}
                {" · "}
                {event.isPublished
                  ? "Đã đăng"
                  : event.publishedAt
                    ? "Đã ẩn"
                    : "Bản nháp"}
              </dd>
            </div>

            <div>
              <dt>Tình trạng mới nhất</dt>
              <dd>
                {statusLabels[observation?.status] || "Chưa rõ"}

                {observation?.status === "flooded" &&
                  observation?.trend &&
                  observation.trend !== "unknown" && (
                    <> · {trendLabels[observation.trend]}</>
                  )}
              </dd>
            </div>

            <div>
              <dt>Độ sâu</dt>
              <dd>{formatDepth(observation)}</dd>
            </div>

            <div>
              <dt>Ghi chú xác nhận</dt>
              <dd>{observation?.note || "Không có"}</dd>
            </div>

            <div>
              <dt>Đăng lần đầu</dt>
              <dd>{formatTime(event.publishedAt)}</dd>
            </div>

            <div>
              <dt>Cập nhật tình trạng</dt>
              <dd>{formatTime(event.lastStatusPublishedAt)}</dd>
            </div>
          </dl>

          <h3>Lịch sử tình trạng</h3>

          <div className="observation-history">
            {history?.data.map((item) => (
              <article className="observation-item" key={item.id}>
                <div className="history-heading">
                  <strong>{statusLabels[item.status] || "Chưa rõ"}</strong>
                  {item.isLatest && <span>Mới nhất</span>}
                </div>

                <p>
                  Độ sâu: {formatDepth(item)}
                  {item.status === "flooded" &&
                    item.trend &&
                    item.trend !== "unknown" && (
                      <> · {trendLabels[item.trend]}</>
                    )}
                </p>

                <p>
                  Ghi nhận:{" "}
                  {item.timePrecision === "exact"
                    ? formatTime(item.observedAt)
                    : item.observedDate || "Chưa rõ"}
                </p>

                <p>{item.note || "Không có ghi chú"}</p>

                <small>
                  {sourceLabels[item.sourceType] || "Chưa rõ nguồn"}
                  {" · Công bố: "}
                  {formatTime(item.publishedAt)}
                </small>
              </article>
            ))}

            {history?.data.length === 0 && <p>Chưa có lịch sử.</p>}
          </div>

          {history && (
            <div className="admin-pagination">
              <button
                type="button"
                className="refresh-button"
                disabled={editing || publishing || historyPage <= 1}
                onClick={() => setHistoryPage((value) => value - 1)}
              >
                Trước
              </button>

              <span>
                Trang {historyPage}/{Math.max(1, history.pagination.totalPages)}
              </span>

              <button
                type="button"
                className="refresh-button"
                disabled={
                  editing ||
                  publishing ||
                  historyPage >= history.pagination.totalPages
                }
                onClick={() => setHistoryPage((value) => value + 1)}
              >
                Sau
              </button>
            </div>
          )}
          {!editing && !publishing && !confirmPublish && (
            <div className="delete-section">
              <AdminFloodDelete
                key={`${event.id}-${event.revision}`}
                event={event}
                token={token}
                onUnauthorized={onUnauthorized}
                onDeleted={onClose}
                onReload={() => setReloadKey((value) => value + 1)}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
