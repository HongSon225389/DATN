const formatDateTime = (value) => {
  if (!value) return "Chưa xác định";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Thời gian không hợp lệ";
  }

  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
};

const formatObservationTime = (observation) => {
  if (!observation) return "Chưa có quan sát";

  if (observation.timePrecision === "exact" && observation.observedAt) {
    return formatDateTime(observation.observedAt);
  }

  if (observation.observedDate) {
    const [year, month, day] = observation.observedDate.split("-");

    return `${day}/${month}/${year} — chưa rõ giờ`;
  }

  return "Chưa xác định";
};

const formatDepth = (observation) => {
  const min = observation?.depthMinCm;
  const max = observation?.depthMaxCm;

  if (min == null || max == null) {
    return "Chưa có thông tin";
  }

  return min === max ? `${min} cm` : `${min}–${max} cm`;
};

export default function FloodDetails({ event, onClose }) {
  const observation = event.latestObservation;
  const source = observation?.sourceArticleId;

  let statusText = "Chưa có quan sát";

  if (observation?.status === "flooded") {
    statusText = "Nguồn ghi nhận ngập";
  } else if (observation?.status === "receded") {
    statusText = "Nguồn ghi nhận đã rút";
  }

  return (
    <section className="detail-card">
      <div className="section-heading">
        <h2>Chi tiết sự kiện</h2>
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

      <p className="event-label">
        {event.dataMode === "historical" ? "Lịch sử" : "Hiện tại"}
        {" · "}
        {event.isPublished ? "Đã công bố" : "Chưa công bố"}
      </p>

      <dl className="event-details">
        <div>
          <dt>Phạm vi nguồn mô tả</dt>
          <dd>{event.sourceLocationText}</dd>
        </div>

        <div>
          <dt>Tình trạng theo nguồn</dt>
          <dd>{statusText}</dd>
        </div>

        <div>
          <dt>Thời điểm ghi nhận</dt>
          <dd>{formatObservationTime(observation)}</dd>
        </div>

        <div>
          <dt>Độ sâu theo nguồn</dt>
          <dd>{formatDepth(observation)}</dd>
        </div>

        <div>
          <dt>Định vị</dt>
          <dd>{event.locationNote || "Chưa có ghi chú"}</dd>
        </div>

        <div>
          <dt>Rà soát vị trí</dt>
          <dd>
            {event.locationReviewStatus === "reviewed"
              ? "Đã rà soát"
              : "Cần rà soát"}
          </dd>
        </div>

        <div>
          <dt>Đơn vị xuất bản</dt>
          <dd>{source?.publisher || "Chưa có thông tin"}</dd>
        </div>

        <div>
          <dt>Giờ đăng bài — Việt Nam</dt>
          <dd>{formatDateTime(source?.publishedAt)}</dd>
        </div>
      </dl>

      {source?.url && (
        <a
          className="source-link"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mở bài nguồn ↗
        </a>
      )}

      {event.dataMode === "historical" && (
        <p className="notice">
          Thông tin lịch sử, không phản ánh tình trạng ngập hiện tại.
        </p>
      )}
    </section>
  );
}
