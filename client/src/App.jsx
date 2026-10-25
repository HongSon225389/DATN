import { useEffect, useRef, useState } from "react";

import HanoiMap from "./components/HanoiMap";
import FloodDetails from "./components/FloodDetails";
import PlaceSearch from "./components/PlaceSearch";
import RoutingPanel from "./components/RoutingPanel";

import floodService from "./services/floodService";
import routingService from "./services/routingService";

const isValidCoordinates = (value) =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every(Number.isFinite) &&
  value[0] >= -180 &&
  value[0] <= 180 &&
  value[1] >= -90 &&
  value[1] <= 90;

export default function App() {
  // Mục đang mở trong sidebar.
  const [sidebarTab, setSidebarTab] = useState("floods");

  // Dữ liệu ngập.
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [floodEvents, setFloodEvents] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Bản đồ và tìm địa chỉ.
  const [focus, setFocus] = useState(null);
  const [searchPosition, setSearchPosition] = useState(null);

  // Hành trình.
  const [routeStart, setRouteStart] = useState(null);
  const [routeEnd, setRouteEnd] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [avoidFloods, setAvoidFloods] = useState(true);
  const [pickTarget, setPickTarget] = useState(null);

  const panelRef = useRef(null);
  const routingPanelRef = useRef(null);
  const locateRef = useRef(null);

  const routingControllerRef = useRef(null);
  const locationRequestRef = useRef(0);
  const scrollFrameRef = useRef(null);

  // Giữ riêng vị trí cuộn của hai mục.
  const sidebarScrollRef = useRef({
    floods: 0,
    routing: 0,
  });

  useEffect(() => {
    return () => {
      routingControllerRef.current?.abort();
      locationRequestRef.current += 1;

      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  // Tải dữ liệu ngập và cập nhật định kỳ.
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

  const scheduleScroll = (callback) => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      callback();
    });
  };

  const changeSidebarTab = (nextTab) => {
    if (nextTab === sidebarTab) return;

    if (panelRef.current) {
      sidebarScrollRef.current[sidebarTab] = panelRef.current.scrollTop;
    }

    setSidebarTab(nextTab);
    setPickTarget(null);

    scheduleScroll(() => {
      if (panelRef.current) {
        panelRef.current.scrollTop = sidebarScrollRef.current[nextTab];
      }
    });
  };

  const selectEvent = (event, fromMap = false) => {
    if (sidebarTab !== "floods" && panelRef.current) {
      sidebarScrollRef.current[sidebarTab] = panelRef.current.scrollTop;
    }

    setSelectedEvent(event);
    setSidebarTab("floods");
    setPickTarget(null);

    const coordinates = event.location?.coordinates;

    if (isValidCoordinates(coordinates)) {
      setFocus([coordinates[1], coordinates[0]]);
    }

    // Chọn trong danh sách thì không chủ động cuộn.
    if (!fromMap) return;

    scheduleScroll(() => {
      const element = document.getElementById(`flood-item-${event.id}`);

      const sidebar = panelRef.current;

      if (!element || !sidebar) return;

      if (window.matchMedia("(max-width: 700px)").matches) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        return;
      }

      const sidebarRect = sidebar.getBoundingClientRect();
      const itemRect = element.getBoundingClientRect();

      sidebar.scrollTo({
        top: sidebar.scrollTop + itemRect.top - sidebarRect.top - 76,
        behavior: "smooth",
      });
    });
  };

  const clearRouteResult = () => {
    routingControllerRef.current?.abort();
    routingControllerRef.current = null;

    locationRequestRef.current += 1;

    setRoute(null);
    setRouteError("");
    setRouteLoading(false);
  };

  const changeRouteStart = (place) => {
    clearRouteResult();
    setRouteStart(place);
    setPickTarget(null);

    if (isValidCoordinates(place?.coordinates)) {
      setFocus([place.coordinates[1], place.coordinates[0]]);
    }
  };

  const changeRouteEnd = (place) => {
    clearRouteResult();
    setRouteEnd(place);
    setPickTarget(null);

    if (isValidCoordinates(place?.coordinates)) {
      setFocus([place.coordinates[1], place.coordinates[0]]);
    }
  };

  const pickRoutePosition = (coordinates) => {
    if (!pickTarget || !isValidCoordinates(coordinates)) return;

    const place = {
      coordinates,
      name: "Vị trí chọn trên bản đồ",
      address:
        `${coordinates[1].toFixed(6)}, ` + `${coordinates[0].toFixed(6)}`,
    };

    if (pickTarget === "start") {
      changeRouteStart(place);
    } else {
      changeRouteEnd(place);
    }

    if (window.matchMedia("(max-width: 700px)").matches) {
      scheduleScroll(() => {
        routingPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  };

  const swapRoute = () => {
    clearRouteResult();
    setRouteStart(routeEnd);
    setRouteEnd(routeStart);
    setPickTarget(null);
  };

  const useCurrentPosition = () => {
    clearRouteResult();
    setPickTarget(null);

    const requestId = locationRequestRef.current;

    locateRef.current?.locate({
      onSuccess: (position) => {
        if (requestId !== locationRequestRef.current) return;

        changeRouteStart({
          name: "Vị trí của tôi",
          address:
            "Vị trí của tôi · sai số khoảng " +
            `${Math.round(position.accuracy)} m`,
          coordinates: [position.lng, position.lat],
        });
      },
    });
  };

  const clearJourney = () => {
    clearRouteResult();
    setRouteStart(null);
    setRouteEnd(null);
    setPickTarget(null);
  };

  const findRoute = async () => {
    if (
      !isValidCoordinates(routeStart?.coordinates) ||
      !isValidCoordinates(routeEnd?.coordinates)
    ) {
      setRouteError("Vui lòng chọn điểm đi và điểm đến hợp lệ");
      return;
    }

    if (
      routeStart.coordinates[0] === routeEnd.coordinates[0] &&
      routeStart.coordinates[1] === routeEnd.coordinates[1]
    ) {
      setRouteError("Điểm đi và điểm đến không được trùng nhau");
      return;
    }

    routingControllerRef.current?.abort();
    locationRequestRef.current += 1;

    const controller = new AbortController();
    routingControllerRef.current = controller;

    setRouteLoading(true);
    setRouteError("");
    setRoute(null);
    setPickTarget(null);

    try {
      const data = await routingService.findRoute({
        start: routeStart.coordinates,
        end: routeEnd.coordinates,
        avoidFloods,
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        setFocus(null);
        setRoute(data);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setRouteError(error.message);
      }
    } finally {
      if (
        !controller.signal.aborted &&
        routingControllerRef.current === controller
      ) {
        routingControllerRef.current = null;
        setRouteLoading(false);
      }
    }
  };

  return (
    <div className="app">
      <main className="workspace">
        <aside className="sidebar" ref={panelRef}>
          <div className="map-sidebar-tabs">
            <button
              type="button"
              className={sidebarTab === "floods" ? "active" : ""}
              aria-pressed={sidebarTab === "floods"}
              onClick={() => changeSidebarTab("floods")}
            >
              Điểm ngập
            </button>

            <button
              type="button"
              className={sidebarTab === "routing" ? "active" : ""}
              aria-pressed={sidebarTab === "routing"}
              onClick={() => changeSidebarTab("routing")}
            >
              Tìm đường
            </button>
          </div>

          {/* Giữ component khi ẩn để không mất nội dung tìm đường. */}
          <div
            ref={routingPanelRef}
            className="map-sidebar-section"
            hidden={sidebarTab !== "routing"}
          >
            <RoutingPanel
              start={routeStart}
              end={routeEnd}
              onStartChange={changeRouteStart}
              onEndChange={changeRouteEnd}
              onSwap={swapRoute}
              onLocate={useCurrentPosition}
              pickTarget={pickTarget}
              onPickTargetChange={(target) => {
                clearRouteResult();
                setPickTarget(target);
              }}
              avoidFloods={avoidFloods}
              onAvoidFloodsChange={(value) => {
                clearRouteResult();
                setAvoidFloods(value);
              }}
              loading={routeLoading}
              error={routeError}
              route={route}
              onFind={findRoute}
              onClear={clearJourney}
            />
          </div>

          <div className="map-sidebar-section" hidden={sidebarTab !== "floods"}>
            <PlaceSearch
              onQueryChange={() => setSearchPosition(null)}
              onSelect={(place) => {
                if (!isValidCoordinates(place.coordinates)) return;

                const [lng, lat] = place.coordinates;

                setSearchPosition({
                  coordinates: place.coordinates,
                  name: place.name,
                });

                setFocus([lat, lng]);
                setPickTarget(null);
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
                </p>
              )}

              {!loading && !error && floodEvents.length === 0 && (
                <p className="notice">
                  Chưa có thông tin ngập hiện tại được công bố. Điều này không
                  có nghĩa khu vực không ngập.
                </p>
              )}

              {truncated && (
                <p className="notice">Đang hiển thị tối đa 100 địa điểm.</p>
              )}
            </div>

            <div className="flood-list">
              {floodEvents.map((event) => {
                const receded = event.latestObservation?.status === "receded";

                const selected = selectedEvent?.id === event.id;

                return (
                  <article
                    key={event.id}
                    id={`flood-item-${event.id}`}
                    className={`flood-list-entry${selected ? " selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="flood-item"
                      aria-expanded={selected}
                      aria-controls={`flood-detail-${event.id}`}
                      onClick={() => {
                        if (selected) {
                          setSelectedEvent(null);
                        } else {
                          selectEvent(event);
                        }
                      }}
                    >
                      <div className="flood-item-heading">
                        <strong>{event.title}</strong>

                        <span className="flood-item-chevron" aria-hidden="true">
                          {selected ? "−" : "+"}
                        </span>
                      </div>

                      <span>{event.address || "Chưa có địa chỉ chi tiết"}</span>

                      <small
                        className={`status-badge ${
                          receded ? "receded" : "flooded"
                        }`}
                      >
                        {receded ? "Đã rút" : "Đang ngập"}
                      </small>
                    </button>

                    {selected && (
                      <div
                        id={`flood-detail-${event.id}`}
                        className="flood-inline-detail"
                      >
                        <FloodDetails
                          event={event}
                          onClose={() => setSelectedEvent(null)}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="map-section" aria-label="Bản đồ ngập tại Hà Nội">
          <HanoiMap
            floodEvents={floodEvents}
            selectedEventId={selectedEvent?.id}
            onEventSelect={(event) => {
              if (sidebarTab === "routing") return;
              selectEvent(event, true);
            }}
            focus={focus}
            searchPosition={searchPosition}
            route={route}
            routeStart={routeStart}
            routeEnd={routeEnd}
            pickTarget={pickTarget}
            onRoutePick={pickRoutePosition}
            locateRef={locateRef}
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

            {route && (
              <span>
                <i className="legend-dot route-line" />
                Tuyến ô tô
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
