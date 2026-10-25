import PlaceSearch from "./PlaceSearch";

const formatDistance = (meters) =>
  meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;

const formatDuration = (seconds) => {
  const minutes = Math.max(1, Math.ceil(seconds / 60));

  if (minutes < 60) return `${minutes} phút`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return `${hours} giờ${remaining ? ` ${remaining} phút` : ""}`;
};

export default function RoutingPanel({
  start,
  end,
  onStartChange,
  onEndChange,
  onSwap,
  onLocate,
  pickTarget,
  onPickTargetChange,
  avoidFloods,
  onAvoidFloodsChange,
  loading,
  error,
  route,
  onFind,
  onClear,
}) {
  const renderEndpoint = (target, value, onChange) => (
    <section className="route-endpoint">
      <PlaceSearch
        // Khi đổi chiều hoặc chọn trên bản đồ, làm mới ô tìm kiếm.
        key={`${target}-${value?.coordinates?.join(",") ?? "empty"}`}
        label={target === "start" ? "Điểm đi" : "Điểm đến"}
        disabled={loading}
        onSelect={onChange}
        onQueryChange={() => {
          if (value) onChange(null);
        }}
      />

      {value && (
        <div className="route-selected-place">
          <p>
            <strong>Đã chọn:</strong> {value.address || value.name}
          </p>

          <button
            type="button"
            className="route-remove-point"
            disabled={loading}
            onClick={() => onChange(null)}
          >
            {target === "start" ? "Bỏ điểm đi" : "Bỏ điểm đến"}
          </button>
        </div>
      )}

      <button
        type="button"
        className="refresh-button"
        disabled={loading}
        aria-pressed={pickTarget === target}
        onClick={() =>
          onPickTargetChange(pickTarget === target ? null : target)
        }
      >
        {pickTarget === target ? "Hủy chọn trên bản đồ" : "Chọn trên bản đồ"}
      </button>
    </section>
  );

  return (
    <section className="routing-panel">
      <h2>Tìm đường ô tô</h2>

      {renderEndpoint("start", start, onStartChange)}

      <div className="admin-form-actions">
        <button
          type="button"
          className="refresh-button"
          disabled={loading}
          onClick={onLocate}
        >
          Dùng vị trí của tôi làm điểm đi
        </button>

        <button
          type="button"
          className="refresh-button"
          disabled={loading || (!start && !end)}
          onClick={onSwap}
        >
          ⇅ Đổi chiều
        </button>
      </div>

      {renderEndpoint("end", end, onEndChange)}

      {pickTarget && (
        <p className="notice" role="status">
          Bấm lên đường trên bản đồ để chọn{" "}
          {pickTarget === "start" ? "điểm đi" : "điểm đến"}.
        </p>
      )}

      <label className="toggle-label">
        <input
          type="checkbox"
          checked={avoidFloods}
          disabled={loading}
          onChange={(event) => onAvoidFloodsChange(event.target.checked)}
        />
        Áp dụng vùng tránh ngập đã cấu hình
      </label>

      <div className="admin-form-actions">
        <button
          type="button"
          disabled={loading || !start || !end || Boolean(pickTarget)}
          onClick={onFind}
        >
          {loading ? "Đang tìm đường…" : "Tìm đường"}
        </button>

        <button type="button" className="refresh-button" onClick={onClear}>
          Xóa hành trình
        </button>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {route && (
        <div className="route-result" aria-live="polite">
          <strong>
            {formatDistance(route.distanceMeters)}
            {" · "}
            {formatDuration(route.durationSeconds)}
          </strong>

          <p>
            {route.avoidance.applied
              ? `Đã áp dụng ${route.avoidance.areaCount} vùng tránh ngập.`
              : "Chưa áp dụng tránh ngập."}
          </p>

          {route.warnings.map((warning) => (
            <p className="field-help" key={warning}>
              {warning}
            </p>
          ))}

          <small>Định tuyến: openrouteservice</small>
        </div>
      )}
    </section>
  );
}
