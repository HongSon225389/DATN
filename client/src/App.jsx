import { useEffect, useState } from "react";

import HanoiMap from "./components/HanoiMap";
import FloodDetails from "./components/FloodDetails";
import floodService from "./services/floodService";

export default function App() {
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [focus, setFocus] = useState(null);

  const [surveyMode, setSurveyMode] = useState(false);
  const [showRoutingCheck, setShowRoutingCheck] = useState(false);

  const [floodEvents, setFloodEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const loadFloodEvents = async () => {
      setLoading(true);
      setError("");
      setFloodEvents([]);
      setSelectedEvent(null);

      try {
        const data = await floodService.getFloodEvents({
          survey: surveyMode,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setFloodEvents(data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadFloodEvents();

    return () => controller.abort();
  }, [surveyMode, reloadKey]);

  const selectEvent = (event) => {
    setSelectedEvent(event);
    setSelectedPosition(null);

    const [lng, lat] = event.location.coordinates;
    setFocus([lat, lng]);
  };

  const selectPosition = (position) => {
    setSelectedPosition(position);
    setSelectedEvent(null);
  };

  const changeSurveyMode = (enabled) => {
    setSurveyMode(enabled);
    setFloodEvents([]);
    setSelectedEvent(null);
    setSelectedPosition(null);
    setShowRoutingCheck(false);
    setError("");
    setLoading(true);
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <strong>Hanoi Flood</strong>
          <span>Bản đồ thông tin ngập tại Hà Nội</span>
        </div>

        <small>{surveyMode ? "Khảo sát lịch sử" : "Đang phát triển"}</small>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <p className="eyebrow">KHU VỰC THÍ ĐIỂM</p>
          <h1>Hà Nội</h1>

          {import.meta.env.DEV && (
            <section className="development-panel">
              <h2>Công cụ phát triển</h2>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={surveyMode}
                  onChange={(event) => changeSurveyMode(event.target.checked)}
                />
                Xem 5 sự kiện khảo sát lịch sử
              </label>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showRoutingCheck}
                  onChange={(event) =>
                    setShowRoutingCheck(event.target.checked)
                  }
                />
                Hiện lớp kiểm tra định tuyến
              </label>
            </section>
          )}

          {surveyMode && (
            <p className="notice">
              Dữ liệu lịch sử ngày 30/09/2025, chưa công bố. Không dùng cho định
              tuyến hiện tại.
            </p>
          )}

          <div className="section-heading">
            <h2>{surveyMode ? "Sự kiện khảo sát" : "Thông tin đã công bố"}</h2>

            <button
              type="button"
              className="refresh-button"
              disabled={loading}
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Tải lại
            </button>
          </div>

          <div aria-live="polite">
            {loading && <p>Đang tải dữ liệu…</p>}

            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}

            {!loading && !error && floodEvents.length === 0 && (
              <p className="notice">
                Chưa có dữ liệu phù hợp. Điều này không có nghĩa khu vực không
                ngập.
              </p>
            )}
          </div>

          {selectedEvent && (
            <FloodDetails
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          )}

          <div className="flood-list">
            {floodEvents.map((event) => (
              <button
                type="button"
                key={event.id}
                className={`flood-item ${
                  selectedEvent?.id === event.id ? "selected" : ""
                }`}
                onClick={() => selectEvent(event)}
              >
                <strong>{event.title}</strong>
                <span>{event.sourceLocationText}</span>

                <small>
                  {event.dataMode === "historical" ? "Lịch sử" : "Hiện tại"}
                  {" · "}
                  {event.isPublished ? "Đã công bố" : "Chưa công bố"}
                </small>
              </button>
            ))}
          </div>

          {selectedPosition && (
            <section className="location-card">
              <h2>Vị trí chọn thủ công</h2>

              <label htmlFor="coordinates">GeoJSON: kinh độ, vĩ độ</label>

              <input
                id="coordinates"
                readOnly
                value={`[${selectedPosition.lng.toFixed(6)}, ${selectedPosition.lat.toFixed(6)}]`}
                onFocus={(event) => event.target.select()}
              />

              <button onClick={() => setSelectedPosition(null)}>Bỏ chọn</button>
            </section>
          )}

          {showRoutingCheck && import.meta.env.DEV && (
            <p className="notice">
              Lớp tuyến thử: xanh dương là tuyến thường, xanh lá là tuyến tránh
              polygon đỏ giả lập. Lớp này không sử dụng các sự kiện lịch sử.
            </p>
          )}
        </aside>

        <section className="map-section" aria-label="Bản đồ Hà Nội">
          <HanoiMap
            selectedPosition={selectedPosition}
            onSelect={selectPosition}
            floodEvents={floodEvents}
            selectedEventId={selectedEvent?.id}
            onEventSelect={selectEvent}
            focus={focus}
            showRoutingCheck={showRoutingCheck}
          />

          {surveyMode && (
            <div className="history-map-label">
              ● Điểm tím: dữ liệu lịch sử, vị trí cần rà soát
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
