import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { useAuth } from "../contexts/AuthContext";
import LocationPicker from "../components/LocationPicker";
import ReportImage from "../components/ReportImage";
import floodReportService from "../services/floodReportService";

const toLocalDateTime = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = (number) => String(number).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
};

export default function ReportCreatePage({ initialReport = null }) {
  const editing = Boolean(initialReport);
  const { token, logout } = useAuth();

  const submitting = useRef(false);
  const fileInputRef = useRef(null);
  const previewUrlsRef = useRef([]);

  const [coordinates, setCoordinates] = useState(
    () => initialReport?.location?.coordinates ?? null,
  );

  const [address, setAddress] = useState(() => initialReport?.address ?? "");

  const [description, setDescription] = useState(
    () => initialReport?.description ?? "",
  );

  const [observedAt, setObservedAt] = useState(() =>
    initialReport
      ? toLocalDateTime(initialReport.observedAt)
      : toLocalDateTime(new Date()),
  );

  const [depth, setDepth] = useState(() =>
    initialReport?.estimatedDepthCm == null
      ? ""
      : String(initialReport.estimatedDepthCm),
  );

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  const oldImages = initialReport?.images ?? [];

  const wordCount = description.trim()
    ? description.trim().split(/\s+/).length
    : 0;

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });

      previewUrlsRef.current = [];
    };
  }, []);

  const updateFiles = (nextFiles) => {
    previewUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    const urls = nextFiles.map((file) => URL.createObjectURL(file));

    previewUrlsRef.current = urls;

    setFiles(nextFiles);
    setPreviews(urls);
  };

  const clearNewImages = () => {
    updateFiles([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const selectFiles = (event) => {
    const selected = Array.from(event.target.files || []);

    setError("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    let message = "";

    if (selected.length > 3) {
      message = "Chỉ được chọn tối đa 3 ảnh";
    } else if (selected.some((file) => !allowedTypes.includes(file.type))) {
      message = "Chỉ nhận ảnh JPEG, PNG hoặc WebP";
    } else if (
      selected.some((file) => file.size === 0 || file.size > 5 * 1024 * 1024)
    ) {
      message = "Mỗi ảnh phải có dữ liệu và không vượt quá 5 MB";
    }

    if (message) {
      setError(message);
      clearNewImages();
      return;
    }

    updateFiles(selected);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting.current || created) return;

    setError("");

    if (editing && initialReport.status !== "rejected") {
      setError("Chỉ được sửa và gửi lại báo cáo bị bác bỏ");
      return;
    }

    if (
      editing &&
      (!Number.isInteger(initialReport.revision) || initialReport.revision < 0)
    ) {
      setError("Phiên bản báo cáo không hợp lệ. Vui lòng tải lại trang");
      return;
    }

    if (
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      !coordinates.every(Number.isFinite) ||
      coordinates[0] < -180 ||
      coordinates[0] > 180 ||
      coordinates[1] < -90 ||
      coordinates[1] > 90
    ) {
      setError("Vui lòng chọn vị trí hợp lệ trên bản đồ");
      return;
    }

    if (!address.trim() || address.trim().length > 1000) {
      setError("Địa chỉ phải có từ 1 đến 1000 ký tự");
      return;
    }

    if (
      !description.trim() ||
      description.trim().length > 5000 ||
      wordCount > 200
    ) {
      setError("Mô tả cần có nội dung, không quá 200 từ và 5000 ký tự");
      return;
    }

    const observationTime = new Date(observedAt);

    if (
      !observedAt ||
      !Number.isFinite(observationTime.getTime()) ||
      observationTime > new Date()
    ) {
      setError("Thời gian quan sát không hợp lệ hoặc nằm ở tương lai");
      return;
    }

    const imageCount =
      editing && files.length === 0 ? oldImages.length : files.length;

    if (imageCount < 1 || imageCount > 3) {
      setError("Báo cáo cần từ 1 đến 3 ảnh");
      return;
    }

    const normalizedDepth = depth.trim();

    if (
      normalizedDepth &&
      (!/^\d+(?:\.\d+)?$/.test(normalizedDepth) ||
        !Number.isFinite(Number(normalizedDepth)))
    ) {
      setError("Độ sâu phải là số không âm hoặc để trống");
      return;
    }

    const formData = new FormData();

    formData.append("address", address.trim());
    formData.append("coordinates", JSON.stringify(coordinates));
    formData.append("description", description.trim());
    formData.append("observedAt", observationTime.toISOString());

    if (normalizedDepth) {
      formData.append("estimatedDepthCm", normalizedDepth);
    }

    if (editing) {
      formData.append("revision", String(initialReport.revision));
    }

    files.forEach((file) => {
      formData.append("images", file);
    });

    submitting.current = true;
    setLoading(true);

    try {
      const result = editing
        ? await floodReportService.resubmitReport({
            id: initialReport.id,
            token,
            formData,
          })
        : await floodReportService.createReport({
            token,
            formData,
          });

      setCreated(result.data);
      clearNewImages();
    } catch (error) {
      if (error.status === 401) {
        logout();
        return;
      }

      setError(error.message);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  if (created) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>{editing ? "Đã gửi lại báo cáo" : "Đã gửi báo cáo"}</h1>

          <p className="success-message" role="status">
            Thông tin đang chờ admin xác minh, chưa được đăng lên bản đồ.
          </p>

          <p>Mã báo cáo: {created.id}</p>

          <p>
            <Link to={`/reports/${created.id}`}>Xem báo cáo</Link>
          </p>

          <p>
            <Link to="/reports">Báo cáo của tôi</Link>
          </p>

          <Link to="/">Về bản đồ</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page report-page">
      <header className="admin-heading">
        <div>
          <h1>{editing ? "Sửa và gửi lại báo cáo" : "Gửi thông tin ngập"}</h1>

          <p>
            {editing
              ? "Chỉnh sửa thông tin theo phản hồi của admin rồi gửi lại để xác minh."
              : "Cung cấp vị trí và ảnh để admin kiểm tra."}
          </p>
        </div>
      </header>

      {editing && initialReport.reviewNote && (
        <p className="notice">
          <strong>Lý do bác bỏ:</strong> {initialReport.reviewNote}
        </p>
      )}

      <form className="admin-panel admin-form" onSubmit={handleSubmit}>
        <fieldset disabled={loading}>
          <legend>Vị trí và thông tin</legend>

          <LocationPicker
            value={coordinates}
            onChange={setCoordinates}
            disabled={loading}
          />

          <label htmlFor="report-address">Địa chỉ hoặc mốc nhận diện *</label>

          <textarea
            id="report-address"
            required
            maxLength={1000}
            rows={2}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />

          <div className="admin-form-grid">
            <div>
              <label htmlFor="report-time">Thời gian quan sát *</label>

              <input
                id="report-time"
                type="datetime-local"
                step="1"
                required
                value={observedAt}
                onChange={(event) => setObservedAt(event.target.value)}
              />

              <p className="field-help">
                Thời điểm bạn thực tế quan sát, theo giờ trên thiết bị. Không
                cần đổi sang giờ hiện tại chỉ vì gửi lại báo cáo.
              </p>
            </div>

            <div>
              <label htmlFor="report-depth">Độ sâu ước lượng (cm)</label>

              <input
                id="report-depth"
                type="number"
                min="0"
                step="any"
                placeholder="Để trống nếu chưa rõ"
                value={depth}
                onChange={(event) => setDepth(event.target.value)}
              />
            </div>
          </div>

          <label htmlFor="report-description">Mô tả *</label>

          <textarea
            id="report-description"
            required
            maxLength={5000}
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-describedby="report-word-count"
            placeholder="Mô tả tình trạng nước, đoạn đường bị ảnh hưởng và mốc nhận diện..."
          />

          <p
            id="report-word-count"
            className={wordCount > 200 ? "error-message" : "field-help"}
          >
            {wordCount}/200 từ
          </p>

          <label htmlFor="report-images">
            {editing ? "Thay ảnh hiện trường" : "Ảnh hiện trường *"}
          </label>

          <input
            ref={fileInputRef}
            id="report-images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            required={!editing || oldImages.length === 0}
            onChange={selectFiles}
          />

          <p className="field-help">
            Từ 1 đến 3 ảnh JPEG, PNG hoặc WebP. Mỗi ảnh tối đa 5 MB.
          </p>

          {editing && (
            <p className="field-help">
              Không chọn ảnh mới thì giữ nguyên ảnh cũ. Chọn ảnh mới sẽ thay
              toàn bộ ảnh hiện tại; ảnh cũ vẫn được lưu trong lịch sử.
            </p>
          )}

          {editing && files.length === 0 && oldImages.length > 0 && (
            <>
              <h3>Ảnh đang giữ lại</h3>

              <div className="report-detail-images">
                {oldImages.map((image) => (
                  <ReportImage
                    key={`${initialReport.id}-${initialReport.revision}-${image.index}`}
                    reportId={initialReport.id}
                    index={image.index}
                    token={token}
                  />
                ))}
              </div>
            </>
          )}

          {files.length > 0 && (
            <>
              <h3>{editing ? "Ảnh mới thay thế" : "Ảnh đã chọn"}</h3>

              <div className="report-previews">
                {previews.map((url, index) => (
                  <figure key={url}>
                    <img src={url} alt={`Ảnh báo cáo ${index + 1}`} />

                    <figcaption>{files[index]?.name}</figcaption>
                  </figure>
                ))}
              </div>

              <button
                type="button"
                className="refresh-button"
                onClick={clearNewImages}
              >
                {editing ? "Bỏ ảnh mới, giữ ảnh cũ" : "Bỏ các ảnh đã chọn"}
              </button>
            </>
          )}
        </fieldset>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="refresh-button"
          disabled={loading || wordCount > 200}
        >
          {loading
            ? "Đang gửi báo cáo…"
            : editing
              ? "Gửi lại để xác minh"
              : "Gửi báo cáo"}
        </button>
      </form>
    </main>
  );
}
