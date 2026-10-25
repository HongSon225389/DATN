import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import LocationPicker from "../components/LocationPicker";
import adminFloodService from "../services/adminFloodService";

export default function AdminFloodCreatePage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const submitting = useRef(false);

  const [coordinates, setCoordinates] = useState(null);
  const [dataMode, setDataMode] = useState("current");
  const [status, setStatus] = useState("flooded");
  const [depthKnown, setDepthKnown] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting.current) return;

    setError("");

    if (!coordinates) {
      setError("Vui lòng chọn vị trí trên bản đồ");
      return;
    }

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const address = String(form.get("address") || "").trim();
    const note = String(form.get("note") || "").trim();
    const observedDate = String(form.get("observedDate") || "");

    if (!title || !address || !note) {
      setError("Vui lòng nhập tên, địa chỉ và ghi chú xác nhận");
      return;
    }

    if (dataMode === "historical" && !observedDate) {
      setError("Dữ liệu lịch sử phải có ngày ghi nhận");
      return;
    }

    let depthMinCm = null;
    let depthMaxCm = null;

    if (status === "flooded" && depthKnown) {
      const minText = String(form.get("depthMinCm") || "");
      const maxText = String(form.get("depthMaxCm") || "");

      if (!minText || !maxText) {
        setError("Vui lòng nhập đủ độ sâu nhỏ nhất và lớn nhất");
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
        setError(
          "Độ sâu phải không âm và giá trị lớn nhất không nhỏ hơn nhỏ nhất",
        );
        return;
      }
    }

    const payload = {
      title,
      address,
      coordinates,
      locationNote: String(form.get("locationNote") || "").trim(),
      dataMode,

      status,
      trend:
        status === "receded"
          ? "unknown"
          : String(form.get("trend") || "unknown"),

      depthMinCm,
      depthMaxCm,
      depthMethod: status === "flooded" && depthKnown ? "estimated" : "unknown",

      timePrecision: observedDate ? "day" : "unknown",
      observedDate: observedDate || null,
      observedAt: null,

      note,
    };

    submitting.current = true;
    setLoading(true);

    try {
      await adminFloodService.createFloodEvent({
        token,
        data: payload,
      });

      navigate("/admin/flood-events", {
        replace: true,
        state: {
          successMessage: "Đã tạo bản nháp. Điểm ngập chưa được công khai.",
        },
      });
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        logout();
        return;
      }

      setError(error.message);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <h1>Tạo điểm ngập</h1>
          <p>Nhập thông tin và lưu nháp trước khi công bố.</p>
        </div>
      </header>

      <form className="admin-panel admin-form" onSubmit={handleSubmit}>
        <fieldset disabled={loading}>
          <legend>Thông tin địa điểm</legend>

          <label htmlFor="flood-title">Tên địa điểm *</label>
          <input
            id="flood-title"
            name="title"
            required
            maxLength={200}
            placeholder="Ví dụ: Ngập khu vực đường..."
          />

          <label htmlFor="flood-address">Địa chỉ *</label>
          <textarea
            id="flood-address"
            name="address"
            required
            maxLength={1000}
            rows={2}
          />

          <label>Vị trí trên bản đồ *</label>
          <LocationPicker
            value={coordinates}
            onChange={setCoordinates}
            disabled={loading}
          />

          <label htmlFor="location-note">Ghi chú vị trí nội bộ</label>
          <textarea
            id="location-note"
            name="locationNote"
            maxLength={1000}
            rows={2}
            placeholder="Mốc nhận diện hoặc phạm vi cần kiểm tra"
          />
        </fieldset>

        <fieldset disabled={loading}>
          <legend>Tình trạng ngập</legend>

          <div className="admin-form-grid">
            <div>
              <label htmlFor="flood-mode">Loại dữ liệu</label>
              <select
                id="flood-mode"
                value={dataMode}
                onChange={(event) => setDataMode(event.target.value)}
              >
                <option value="current">Hiện tại</option>
                <option value="historical">Lịch sử</option>
              </select>
            </div>

            <div>
              <label htmlFor="observed-date">
                Ngày ghi nhận {dataMode === "historical" ? "*" : ""}
              </label>
              <input
                id="observed-date"
                name="observedDate"
                type="date"
                required={dataMode === "historical"}
              />
            </div>

            <div>
              <label htmlFor="flood-status">Tình trạng</label>
              <select
                id="flood-status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setDepthKnown(false);
                }}
              >
                <option value="flooded">Đang ngập</option>
                <option value="receded">Đã rút</option>
              </select>
            </div>

            {status === "flooded" && (
              <div>
                <label htmlFor="flood-trend">Diễn biến</label>
                <select id="flood-trend" name="trend" defaultValue="unknown">
                  <option value="unknown">Chưa rõ</option>
                  <option value="rising">Nước dâng</option>
                  <option value="falling">Nước giảm</option>
                  <option value="stable">Ổn định</option>
                </select>
              </div>
            )}
          </div>

          {status === "flooded" && (
            <>
              <label htmlFor="depth-mode">Thông tin độ sâu</label>
              <select
                id="depth-mode"
                value={depthKnown ? "estimated" : "unknown"}
                onChange={(event) =>
                  setDepthKnown(event.target.value === "estimated")
                }
              >
                <option value="unknown">Chưa rõ</option>
                <option value="estimated">Có thông tin ước lượng</option>
              </select>

              {depthKnown && (
                <>
                  <div className="admin-form-grid">
                    <div>
                      <label htmlFor="depth-min">Nhỏ nhất (cm)</label>
                      <input
                        id="depth-min"
                        name="depthMinCm"
                        type="number"
                        min="0"
                        step="0.1"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="depth-max">Lớn nhất (cm)</label>
                      <input
                        id="depth-max"
                        name="depthMaxCm"
                        type="number"
                        min="0"
                        step="0.1"
                        required
                      />
                    </div>
                  </div>

                  <p className="field-help">
                    Nếu chỉ có một giá trị, nhập giống nhau ở cả hai ô.
                  </p>
                </>
              )}
            </>
          )}

          <label htmlFor="confirmation-note">Ghi chú xác nhận nội bộ *</label>
          <textarea
            id="confirmation-note"
            name="note"
            required
            maxLength={2000}
            rows={4}
            placeholder="Căn cứ xác nhận và những thông tin cần lưu lại"
          />
        </fieldset>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <div className="admin-form-actions">
          <button type="submit" className="refresh-button" disabled={loading}>
            {loading ? "Đang lưu…" : "Lưu bản nháp"}
          </button>

          {!loading && <Link to="/admin/flood-events">Hủy</Link>}
        </div>
      </form>
    </main>
  );
}
