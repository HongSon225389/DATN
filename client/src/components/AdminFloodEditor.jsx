import { useRef, useState } from "react";

import LocationPicker from "./LocationPicker";
import adminFloodService from "../services/adminFloodService";

export default function AdminFloodEditor({
  event,
  token,
  onSaved,
  onCancel,
  onUnauthorized,
}) {
  const isDraft = !event.isPublished && !event.publishedAt;

  const pending = useRef(false);

  const [coordinates, setCoordinates] = useState(
    event.location?.coordinates ?? null,
  );

  const [status, setStatus] = useState(
    event.latestObservation?.status || "flooded",
  );

  const [depthKnown, setDepthKnown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();

    if (pending.current) return;

    setError("");

    const form = new FormData(submitEvent.currentTarget);
    let data;

    if (isDraft) {
      const title = String(form.get("title") || "").trim();
      const address = String(form.get("address") || "").trim();

      if (!title || !address || !coordinates) {
        setError("Vui lòng nhập tên, địa chỉ và chọn vị trí");
        return;
      }

      data = {
        revision: event.revision,
        title,
        address,
        coordinates,
        locationNote: String(form.get("locationNote") || "").trim(),
      };
    } else {
      const note = String(form.get("note") || "").trim();
      const observedDate = String(form.get("observedDate") || "");

      if (!note) {
        setError("Vui lòng nhập ghi chú xác nhận tình trạng mới");
        return;
      }

      if (event.dataMode === "historical" && !observedDate) {
        setError("Dữ liệu lịch sử phải có ngày ghi nhận");
        return;
      }

      let depthMinCm = null;
      let depthMaxCm = null;

      if (status === "flooded" && depthKnown) {
        const minText = String(form.get("depthMinCm") || "");
        const maxText = String(form.get("depthMaxCm") || "");

        if (!minText || !maxText) {
          setError("Vui lòng nhập đủ hai giá trị độ sâu");
          return;
        }

        depthMinCm = Number(minText);
        depthMaxCm = Number(maxText);

        if (
          !Number.isFinite(depthMinCm) ||
          !Number.isFinite(depthMaxCm) ||
          depthMinCm < 0 ||
          depthMaxCm < depthMinCm
        ) {
          setError("Khoảng độ sâu không hợp lệ");
          return;
        }
      }

      data = {
        revision: event.revision,
        status,
        trend:
          status === "receded"
            ? "unknown"
            : String(form.get("trend") || "unknown"),

        depthMinCm,
        depthMaxCm,
        depthMethod:
          status === "flooded" && depthKnown ? "estimated" : "unknown",

        timePrecision: observedDate ? "day" : "unknown",
        observedDate: observedDate || null,
        observedAt: null,

        note,
      };
    }

    pending.current = true;
    setLoading(true);

    try {
      const save = isDraft
        ? adminFloodService.updateDraft
        : adminFloodService.addObservation;

      await save({
        id: event.id,
        token,
        data,
      });

      onSaved(
        isDraft ? "Đã sửa bản nháp." : "Đã cập nhật tình trạng và lưu lịch sử.",
      );
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

  return (
    <section className="editor-panel">
      <h3>{isDraft ? "Sửa bản nháp" : "Cập nhật tình trạng"}</h3>

      <form className="admin-form" onSubmit={handleSubmit}>
        <fieldset disabled={loading}>
          <legend>{isDraft ? "Thông tin địa điểm" : "Tình trạng mới"}</legend>

          {isDraft ? (
            <>
              <label htmlFor="edit-title">Tên địa điểm *</label>
              <input
                id="edit-title"
                name="title"
                defaultValue={event.title}
                required
                maxLength={200}
              />

              <label htmlFor="edit-address">Địa chỉ *</label>
              <textarea
                id="edit-address"
                name="address"
                defaultValue={event.address || ""}
                required
                maxLength={1000}
                rows={2}
              />

              <LocationPicker
                value={coordinates}
                onChange={setCoordinates}
                disabled={loading}
              />

              <label htmlFor="edit-location-note">Ghi chú vị trí nội bộ</label>
              <textarea
                id="edit-location-note"
                name="locationNote"
                defaultValue={event.locationNote || ""}
                maxLength={1000}
                rows={3}
              />
            </>
          ) : (
            <>
              <p className="field-help">
                Thông tin mới sẽ thay thế tình trạng đang hiển thị. Các bản ghi
                trước vẫn được giữ trong lịch sử.
              </p>

              <label htmlFor="update-status">Tình trạng</label>
              <select
                id="update-status"
                value={status}
                onChange={(changeEvent) => {
                  setStatus(changeEvent.target.value);
                  setDepthKnown(false);
                }}
              >
                <option value="flooded">Đang ngập</option>
                <option value="receded">Đã rút</option>
              </select>

              {status === "flooded" && (
                <>
                  <label htmlFor="update-trend">Diễn biến</label>
                  <select id="update-trend" name="trend" defaultValue="unknown">
                    <option value="unknown">Chưa rõ</option>
                    <option value="rising">Nước dâng</option>
                    <option value="falling">Nước giảm</option>
                    <option value="stable">Ổn định</option>
                  </select>

                  <label htmlFor="update-depth-mode">Độ sâu mới</label>
                  <select
                    id="update-depth-mode"
                    value={depthKnown ? "estimated" : "unknown"}
                    onChange={(changeEvent) =>
                      setDepthKnown(changeEvent.target.value === "estimated")
                    }
                  >
                    <option value="unknown">Chưa rõ</option>
                    <option value="estimated">Có thông tin ước lượng</option>
                  </select>

                  {depthKnown && (
                    <div className="admin-form-grid">
                      <div>
                        <label htmlFor="update-depth-min">Nhỏ nhất (cm)</label>
                        <input
                          id="update-depth-min"
                          name="depthMinCm"
                          type="number"
                          required
                          min="0"
                          step="0.1"
                        />
                      </div>

                      <div>
                        <label htmlFor="update-depth-max">Lớn nhất (cm)</label>
                        <input
                          id="update-depth-max"
                          name="depthMaxCm"
                          type="number"
                          required
                          min="0"
                          step="0.1"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <label htmlFor="update-observed-date">
                Ngày ghi nhận
                {event.dataMode === "historical" ? " *" : ""}
              </label>
              <input
                id="update-observed-date"
                name="observedDate"
                type="date"
                required={event.dataMode === "historical"}
              />

              <label htmlFor="update-note">Ghi chú xác nhận nội bộ *</label>
              <textarea
                id="update-note"
                name="note"
                required
                maxLength={2000}
                rows={4}
              />
            </>
          )}
        </fieldset>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <div className="admin-form-actions">
          <button type="submit" className="refresh-button" disabled={loading}>
            {loading ? "Đang lưu…" : "Lưu thay đổi"}
          </button>

          <button
            type="button"
            className="refresh-button"
            disabled={loading}
            onClick={onCancel}
          >
            Hủy
          </button>
        </div>
      </form>
    </section>
  );
}
