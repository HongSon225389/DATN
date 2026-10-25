const formatDateTime = (value) => {
  if (!value) return "Chưa rõ";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa rõ";
  }

  return date.toLocaleString("vi-VN", {
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

const trendLabels = {
  rising: "Nước đang dâng",
  falling: "Nước đang giảm",
  stable: "Mực nước ổn định",
};

export default function FloodDetails({ event, onClose }) {
  const observation = event.latestObservation;
  const receded = observation?.status === "receded";
  const trendText = trendLabels[observation?.trend];

  return (
    <section className="detail-card" aria-labelledby="flood-detail-title">
      <div className="section-heading">
        <h2 id="flood-detail-title">Chi tiết điểm ngập</h2>

        <button
          type="button"
          className="close-button"
          aria-label="Đóng chi tiết"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <h3>{event.title}</h3>

      <span className={`status-badge ${receded ? "receded" : "flooded"}`}>
        {receded ? "Đã rút" : "Đang ngập"}
      </span>

      <dl className="event-details">
        <div>
          <dt>Địa chỉ</dt>
          <dd>{event.address || "Chưa có địa chỉ chi tiết"}</dd>
        </div>

        <div>
          <dt>Độ sâu</dt>
          <dd>{formatDepth(observation)}</dd>
        </div>

        {!receded && trendText && (
          <div>
            <dt>Diễn biến</dt>
            <dd>{trendText}</dd>
          </div>
        )}

        <div>
          <dt>Đăng lúc</dt>
          <dd>{formatDateTime(event.publishedAt)}</dd>
        </div>

        <div>
          <dt>Cập nhật tình trạng</dt>
          <dd>
            {formatDateTime(
              event.lastStatusPublishedAt || observation?.publishedAt,
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
