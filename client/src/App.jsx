import { useEffect, useRef, useState } from "react";

import HanoiMap from "./components/HanoiMap";
import FloodDetails from "./components/FloodDetails";
import floodService from "./services/floodService";
import PlaceSearch from "./components/PlaceSearch";
export default function App() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [focus, setFocus] = useState(null);

  const [floodEvents, setFloodEvents] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const panelRef = useRef(null);

  const [searchPosition, setSearchPosition] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer;

    const loadFloodEvents = async (background = false) => {
      if (!background) {
        setLoading(true);
      }

      try {
        const result = await floodService.getFloodEvents({
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setFloodEvents(result.data);
        setTruncated(result.truncated);
        setError("");

        // Điểm hết thời hạn hiển thị sẽ tự đóng phần chi tiết.
        setSelectedEvent((previous) =>
          previous
            ? (result.data.find((event) => event.id === previous.id) ?? null)
            : null,
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(
            background
              ? "Chưa cập nhật được dữ liệu. Đang giữ kết quả từ lần tải trước."
              : error.message,
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);

          // Chờ request xong mới hẹn lần tiếp theo, tránh chồng request.
          refreshTimer = window.setTimeout(() => {
            loadFloodEvents(true);
          }, 60_000);
        }
      }
    };

    loadFloodEvents();

    return () => {
      controller.abort();
      window.clearTimeout(refreshTimer);
    };
  }, [reloadKey]);

  const selectEvent = (event, fromMap = false) => {
    setSelectedEvent(event);

    const coordinates = event.location?.coordinates;

    if (
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      coordinates.every(Number.isFinite)
    ) {
      const [lng, lat] = coordinates;
      setFocus([lat, lng]);
    }

    // Trên điện thoại, đưa phần chi tiết vào vùng nhìn thấy.
    if (fromMap && window.matchMedia("(max-width: 700px)").matches) {
      panelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <div className="app">
      <main className="workspace">
        <aside className="sidebar" ref={panelRef}>
          <PlaceSearch
            onSelect={(place) => {
              const [lng, lat] = place.coordinates;

              setSearchPosition({
                coordinates: place.coordinates,
                name: place.name,
              });

              setFocus([lat, lng]);
              setSelectedEvent(null);
            }}
          />
          <div className="section-heading">
            <h1>Thông tin ngập</h1>

            <button
              type="button"
              className="refresh-button"
              disabled={loading}
              onClick={() => setReloadKey((value) => value + 1)}
            >
              {loading ? "Đang tải…" : "Tải lại"}
            </button>
          </div>

          <div aria-live="polite" aria-busy={loading}>
            {error && (
              <p className="error-message" role="alert">
                {error}
                {floodEvents.length > 0 &&
                  " Đang giữ dữ liệu từ lần tải trước."}
              </p>
            )}

            {!loading && !error && floodEvents.length === 0 && (
              <p className="notice">
                Chưa có thông tin ngập hiện tại được công bố. Điều này không có
                nghĩa khu vực không ngập.
              </p>
            )}

            {truncated && (
              <p className="notice">Đang hiển thị tối đa 100 địa điểm.</p>
            )}
          </div>

          {selectedEvent ? (
            <>
              <button
                type="button"
                className="back-button"
                onClick={() => setSelectedEvent(null)}
              >
                ← Danh sách địa điểm
              </button>

              <FloodDetails
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
              />
            </>
          ) : (
            <div className="flood-list">
              {floodEvents.map((event) => {
                const receded = event.latestObservation?.status === "receded";

                return (
                  <button
                    type="button"
                    key={event.id}
                    className="flood-item"
                    onClick={() => selectEvent(event)}
                  >
                    <strong>{event.title}</strong>
                    <span>{event.address || "Chưa có địa chỉ chi tiết"}</span>

                    <small
                      className={`status-badge ${
                        receded ? "receded" : "flooded"
                      }`}
                    >
                      {receded ? "Đã rút" : "Đang ngập"}
                    </small>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="map-section" aria-label="Bản đồ ngập tại Hà Nội">
          <HanoiMap
            floodEvents={floodEvents}
            selectedEventId={selectedEvent?.id}
            onEventSelect={(event) => selectEvent(event, true)}
            focus={focus}
            searchPosition={searchPosition}
          />

          <div className="map-legend" aria-label="Chú giải">
            <span>
              <i className="legend-dot flooded" />
              Đang ngập
            </span>

            <span>
              <i className="legend-dot receded" />
              Đã rút
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
