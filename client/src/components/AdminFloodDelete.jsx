import { useRef, useState } from "react";

import adminFloodService from "../services/adminFloodService";

export default function AdminFloodDelete({
  event,
  token,
  onDeleted,
  onUnauthorized,
  onReload,
}) {
  const pending = useRef(false);

  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const remove = async (submitEvent) => {
    submitEvent.preventDefault();

    if (pending.current) return;

    if (!reason.trim()) {
      setError("Vui lòng nhập lý do xóa");
      return;
    }

    pending.current = true;
    setLoading(true);
    setError("");

    try {
      await adminFloodService.deleteFloodEvent({
        id: event.id,
        revision: event.revision,
        reason: reason.trim(),
        token,
      });

      onDeleted();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        onUnauthorized();
        return;
      }

      setError(error.message);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        className="danger-button"
        onClick={() => setConfirming(true)}
      >
        Xóa điểm ngập
      </button>
    );
  }

  return (
    <form className="delete-panel" onSubmit={remove}>
      <h3>Xóa “{event.title}”?</h3>

      <p>
        Điểm sẽ được gỡ khỏi danh sách và bản đồ. Lịch sử được giữ lại trong hệ
        thống.
      </p>

      <label htmlFor="deletion-reason">Lý do xóa *</label>
      <textarea
        id="deletion-reason"
        required
        maxLength={500}
        rows={3}
        placeholder="Ví dụ: Nhập trùng điểm đã có"
        value={reason}
        disabled={loading}
        onChange={(changeEvent) => setReason(changeEvent.target.value)}
      />

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      <div className="admin-form-actions">
        <button type="submit" className="danger-button" disabled={loading}>
          {loading ? "Đang xóa…" : "Xác nhận xóa"}
        </button>

        <button
          type="button"
          className="refresh-button"
          disabled={loading}
          onClick={() => {
            setConfirming(false);
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
            onClick={onReload}
          >
            Tải lại chi tiết
          </button>
        )}
      </div>
    </form>
  );
}
