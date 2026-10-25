import { useRef, useState } from "react";

import adminFloodService from "../services/adminFloodService";
import floodReportService from "../services/floodReportService";

export default function AdminReportReview({
  report,
  token,
  onReviewed,
  onUnauthorized,
}) {
  const pending = useRef(false);

  const [mode, setMode] = useState("");
  const [action, setAction] = useState("create");

  const [title, setTitle] = useState(report.address.slice(0, 200));
  const [status, setStatus] = useState("flooded");
  const [trend, setTrend] = useState("unknown");

  // Admin chủ động nhập sau khi xác minh.
  const [depth, setDepth] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");

  const handleError = (error) => {
    if (error.status === 401 || error.status === 403) {
      onUnauthorized();
      return;
    }

    setError(error.message);
  };

  const searchEvents = async () => {
    if (searching) return;

    const q = keyword.trim();

    if (q.length < 2) {
      setSearchError("Nhập ít nhất 2 ký tự để tìm điểm ngập");
      return;
    }

    setSearching(true);
    setSearchError("");
    setEvents([]);
    setSelectedEvent(null);

    try {
      const result = await adminFloodService.getFloodEvents({
        token,
        q,
        mode: "current",
        published: "true",
        page: 1,
        limit: 20,
      });

      setEvents(result.data);

      if (result.data.length === 0) {
        setSearchError("Không tìm thấy điểm phù hợp");
      }
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        onUnauthorized();
        return;
      }

      setSearchError(error.message);
    } finally {
      setSearching(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    if (pending.current) return;

    setError("");

    if (mode === "reject") {
      if (!reason.trim() || reason.trim().length > 1000) {
        setError("Nhập lý do bác bỏ, tối đa 1000 ký tự");
        return;
      }
    } else {
      if (action === "create" && !title.trim()) {
        setError("Nhập tên điểm ngập");
        return;
      }

      if (action === "update" && !selectedEvent) {
        setError("Chọn điểm ngập cần cập nhật");
        return;
      }

      if (!note.trim() || note.trim().length > 1000) {
        setError("Nhập căn cứ hoặc ghi chú xác minh, tối đa 1000 ký tự");
        return;
      }

      if (!confirmed) {
        setError("Cần xác nhận đã kiểm tra thông tin trước khi công bố");
        return;
      }

      if (
        depth.trim() !== "" &&
        (!Number.isFinite(Number(depth)) || Number(depth) < 0)
      ) {
        setError("Độ sâu không hợp lệ");
        return;
      }
    }

    pending.current = true;
    setLoading(true);

    try {
      if (mode === "reject") {
        await floodReportService.rejectReport({
          id: report.id,
          token,
          revision: report.revision,
          reason: reason.trim(),
        });
      } else {
        await floodReportService.approveReport({
          id: report.id,
          token,
          data: {
            revision: report.revision,
            action,
            ...(action === "create"
              ? { title: title.trim() }
              : {
                  floodEventId: selectedEvent.id,
                  eventRevision: selectedEvent.revision,
                }),
            status,
            trend: status === "receded" ? "unknown" : trend,
            depthCm: depth.trim() === "" ? null : Number(depth),
            note: note.trim(),
          },
        });
      }

      onReviewed();
    } catch (error) {
      handleError(error);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  if (report.status !== "pending") {
    return null;
  }

  return (
    <section className="report-review-panel">
      <h3>Xử lý báo cáo</h3>

      {!mode ? (
        <div className="admin-form-actions">
          <button type="button" onClick={() => setMode("approve")}>
            Chấp nhận và công bố
          </button>

          <button
            type="button"
            className="danger-button"
            onClick={() => setMode("reject")}
          >
            Bác bỏ
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={loading}>
            <legend>
              {mode === "reject"
                ? "Bác bỏ báo cáo"
                : "Xác minh và công bố thông tin"}
            </legend>

            {mode === "reject" ? (
              <>
                <label htmlFor="report-reject-reason">Lý do bác bỏ *</label>

                <textarea
                  id="report-reject-reason"
                  rows={4}
                  maxLength={1000}
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </>
            ) : (
              <>
                <label htmlFor="report-approval-action">Cách công bố</label>

                <select
                  id="report-approval-action"
                  value={action}
                  onChange={(event) => {
                    setAction(event.target.value);
                    setConfirmed(false);
                    setError("");
                  }}
                >
                  <option value="create">Tạo điểm ngập mới</option>
                  <option value="update">Cập nhật điểm ngập có sẵn</option>
                </select>

                {action === "create" ? (
                  <>
                    <label htmlFor="approved-event-title">
                      Tên điểm ngập *
                    </label>

                    <input
                      id="approved-event-title"
                      value={title}
                      required
                      maxLength={200}
                      onChange={(event) => setTitle(event.target.value)}
                    />

                    <p className="notice">
                      Điểm mới dùng địa chỉ và tọa độ trong báo cáo. Chỉ công bố
                      khi vị trí này đã chính xác.
                    </p>
                  </>
                ) : (
                  <>
                    <label htmlFor="existing-event-search">
                      Tìm điểm ngập hiện tại đã đăng
                    </label>

                    <div className="admin-search-row">
                      <input
                        id="existing-event-search"
                        value={keyword}
                        maxLength={200}
                        placeholder="Nhập tên, địa chỉ hoặc mã điểm"
                        onChange={(event) => {
                          setKeyword(event.target.value);
                          setEvents([]);
                          setSelectedEvent(null);
                          setConfirmed(false);
                        }}
                      />

                      <button
                        type="button"
                        className="refresh-button"
                        disabled={searching}
                        onClick={searchEvents}
                      >
                        {searching ? "Đang tìm…" : "Tìm"}
                      </button>
                    </div>

                    {searchError && (
                      <p role="alert" className="error-message">
                        {searchError}
                      </p>
                    )}

                    <div className="review-event-list">
                      {events.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          className="review-event-option"
                          aria-pressed={selectedEvent?.id === event.id}
                          onClick={() => {
                            setSelectedEvent(event);
                            setConfirmed(false);
                          }}
                        >
                          <strong>{event.title}</strong>
                          <span>{event.address}</span>
                          <small>
                            {selectedEvent?.id === event.id
                              ? "✓ Đã chọn"
                              : "Chọn điểm này"}
                          </small>
                        </button>
                      ))}
                    </div>

                    {selectedEvent && (
                      <p className="notice">
                        Cập nhật: <strong>{selectedEvent.title}</strong>. Giữ
                        nguyên địa chỉ và tọa độ của điểm này.
                      </p>
                    )}
                  </>
                )}

                <label htmlFor="approved-status">Tình trạng</label>

                <select
                  id="approved-status"
                  value={status}
                  onChange={(event) => {
                    const nextStatus = event.target.value;

                    setStatus(nextStatus);

                    if (nextStatus === "receded") {
                      setTrend("unknown");
                      setDepth("");
                    }
                  }}
                >
                  <option value="flooded">Đang ngập</option>
                  <option value="receded">Đã rút</option>
                </select>

                {status === "flooded" && (
                  <>
                    <label htmlFor="approved-trend">Diễn biến</label>

                    <select
                      id="approved-trend"
                      value={trend}
                      onChange={(event) => setTrend(event.target.value)}
                    >
                      <option value="unknown">Chưa rõ</option>
                      <option value="rising">Nước dâng</option>
                      <option value="falling">Nước giảm</option>
                      <option value="stable">Ổn định</option>
                    </select>
                  </>
                )}

                <label htmlFor="approved-depth">
                  Độ sâu ước lượng (cm) — để trống nếu chưa rõ
                </label>

                <input
                  id="approved-depth"
                  type="number"
                  min={0}
                  max={status === "receded" ? 0 : undefined}
                  step="any"
                  value={depth}
                  onChange={(event) => setDepth(event.target.value)}
                />

                <label htmlFor="approval-note">
                  Căn cứ / ghi chú xác minh *
                </label>

                <textarea
                  id="approval-note"
                  rows={4}
                  maxLength={1000}
                  required
                  placeholder="Ghi cách đối chiếu và thông tin đã xác nhận"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />

                <p className="notice">
                  Quan sát dùng thời gian người gửi khai trong báo cáo. Thời
                  gian công bố được tính từ lúc admin xác nhận. Ghi chú xử lý sẽ
                  được người gửi nhìn thấy.
                </p>

                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  Tôi đã kiểm tra vị trí, thời gian và tình trạng; xác nhận
                  thông tin đủ căn cứ để công bố.
                </label>
              </>
            )}
          </fieldset>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}

          <div className="admin-form-actions">
            <button
              type="submit"
              disabled={loading || searching}
              className={mode === "reject" ? "danger-button" : ""}
            >
              {loading
                ? "Đang xử lý…"
                : mode === "reject"
                  ? "Xác nhận bác bỏ"
                  : "Xác nhận duyệt và công bố"}
            </button>

            <button
              type="button"
              className="refresh-button"
              disabled={loading}
              onClick={() => {
                setMode("");
                setError("");
              }}
            >
              Hủy
            </button>

            {error && (
              <button
                type="button"
                className="refresh-button"
                disabled={loading}
                onClick={onReviewed}
              >
                Tải lại báo cáo
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
