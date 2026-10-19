import { useRef, useState } from "react";
import DemoMap from "./components/DemoMap";
import {
  floodPoints,
  places,
  sampleRoutes,
  STATUS,
  normalizeText,
} from "./data/demoData";

const tabs = [
  { id: "floods", label: "Điểm ngập", icon: "◉" },
  { id: "routes", label: "Tìm đường", icon: "↗" },
  { id: "report", label: "Gửi báo cáo", icon: "+" },
];

function PlaceField({ label, value, onChange, onPick }) {
  return (
    <div className="field">
      <label>{label}</label>

      <select
        aria-label={label}
        value={value?.id || ""}
        onChange={(event) => {
          const place = places.find((item) => item.id === event.target.value);
          onChange(place || null);
        }}
      >
        <option value="">Chọn địa điểm mẫu</option>

        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
          </option>
        ))}

        {value && !places.some((place) => place.id === value.id) && (
          <option value={value.id}>{value.name}</option>
        )}
      </select>

      <button type="button" className="text-button" onClick={onPick}>
        Chọn trên bản đồ
      </button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("floods");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [focus, setFocus] = useState(null);

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [pickMode, setPickMode] = useState(null);
  const [routeType, setRouteType] = useState(null);
  const [message, setMessage] = useState("");

  const [reportPosition, setReportPosition] = useState(null);
  const [description, setDescription] = useState("");
  const [reportDone, setReportDone] = useState(false);

  const contentRef = useRef(null);

  const visiblePoints = floodPoints.filter(
    (point) => filter === "all" || point.status === filter,
  );

  const searchResults = query.trim()
    ? places.filter((place) =>
        normalizeText(`${place.name} ${place.address}`).includes(
          normalizeText(query),
        ),
      )
    : [];

  const wordCount = description.trim()
    ? description.trim().split(/\s+/).length
    : 0;

  const isForward = origin?.id === "p1" && destination?.id === "p2";
  const isReverse = origin?.id === "p2" && destination?.id === "p1";

  let route = null;

  if (routeType && (isForward || isReverse)) {
    route = isReverse
      ? [...sampleRoutes[routeType]].reverse()
      : sampleRoutes[routeType];
  }

  function changeTab(nextTab) {
    setTab(nextTab);
    setPickMode(null);
    setMessage("");
    setQuery("");

    contentRef.current?.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }

  function selectPoint(point) {
    setSelected(point);
    setFocus([...point.position]);
    changeTab("floods");
    setPickMode(null);
    setRouteType(null);
  }

  function changeEndpoint(type, place) {
    if (type === "origin") setOrigin(place);
    else setDestination(place);

    setRouteType(null);
    setMessage("");

    if (place) setFocus([...place.position]);
  }

  function handlePick(position) {
    if (pickMode === "report") {
      setReportPosition(position);
      setReportDone(false);
    } else {
      changeEndpoint(pickMode, {
        id: `map-${pickMode}`,
        name: `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`,
        position,
      });
    }

    setPickMode(null);
  }

  function showSampleRoute() {
    if (!origin || !destination) {
      setMessage("Bạn cần chọn cả điểm đi và điểm đến.");
      return;
    }

    if (origin.id === destination.id) {
      setMessage("Điểm đi và điểm đến cần khác nhau.");
      return;
    }

    if (!isForward && !isReverse) {
      setMessage(
        "Bản demo chỉ có nét tuyến mẫu Hồ Hoàn Kiếm ↔ Đại học Bách khoa Hà Nội. Chưa tính tuyến cho cặp điểm này.",
      );
      return;
    }

    setRouteType("avoidance");
    setMessage("");
  }

  function loadSample() {
    setOrigin(places.find((place) => place.id === "p1"));
    setDestination(places.find((place) => place.id === "p2"));
    setRouteType("avoidance");
    setPickMode(null);
    setMessage("");
  }

  function handleReport(event) {
    event.preventDefault();

    if (!reportPosition) {
      setMessage("Hãy chọn vị trí báo cáo trên bản đồ.");
      return;
    }

    if (wordCount > 200) {
      setMessage(
        "Mô tả không được vượt quá 200 đơn vị tách bằng khoảng trắng.",
      );
      return;
    }

    setMessage("");
    setReportDone(true);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main-content">
          <span className="brand-mark">≈</span>
          <span>
            Hanoi Flood
            <small>Bản đồ thông tin ngập</small>
          </span>
        </a>

        <span className="demo-badge">UI DEMO · DỮ LIỆU GIẢ LẬP</span>
        <span className="header-location">Thí điểm Hà Nội</span>
      </header>

      <main className="workspace" id="main-content">
        <aside className="sidebar">
          <div className="sidebar-top">
            <div className="eyebrow">DI CHUYỂN CÓ THÔNG TIN</div>
            <h1>Bản đồ ngập Hà Nội</h1>
            <p>Tra cứu điểm ngập và khám phá giao diện tìm đường.</p>

            <div className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Tìm địa điểm mẫu"
                placeholder="Tìm địa điểm mẫu tại Hà Nội…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  className="clear-button"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => setQuery("")}
                >
                  ×
                </button>
              )}
            </div>

            {query.trim() && (
              <div className="search-results">
                {searchResults.length ? (
                  searchResults.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => {
                        setFocus([...place.position]);
                        setRouteType(null);
                        setSelected(place.status ? place : null);
                        setQuery("");
                      }}
                    >
                      <strong>{place.name}</strong>
                      <small>{place.address}</small>
                    </button>
                  ))
                ) : (
                  <p>Không có trong danh sách địa điểm mẫu.</p>
                )}
              </div>
            )}

            <nav className="tabs" aria-label="Chức năng bản đồ">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  className={tab === item.id ? "active" : ""}
                  aria-pressed={tab === item.id}
                  onClick={() => changeTab(item.id)}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="sidebar-content" ref={contentRef}>
            {tab === "floods" && (
              <>
                <div className="section-heading">
                  <h2>Thông tin ngập</h2>
                  <span>{visiblePoints.length} điểm mẫu</span>
                </div>

                <div className="filters">
                  <button
                    className={filter === "all" ? "selected" : ""}
                    onClick={() => setFilter("all")}
                  >
                    Tất cả
                  </button>

                  {Object.entries(STATUS).map(([key, value]) => (
                    <button
                      key={key}
                      className={filter === key ? "selected" : ""}
                      onClick={() => {
                        setFilter(key);
                        setSelected(null);
                      }}
                    >
                      {value.label}
                    </button>
                  ))}
                </div>

                {selected && (
                  <section className="detail-card">
                    <div className="section-heading">
                      <h2>Chi tiết điểm mẫu</h2>
                      <button
                        className="clear-button"
                        aria-label="Đóng chi tiết"
                        onClick={() => setSelected(null)}
                      >
                        ×
                      </button>
                    </div>

                    <h3>{selected.name}</h3>
                    <p>{selected.description}</p>

                    <dl>
                      <div>
                        <dt>Độ sâu</dt>
                        <dd>
                          {selected.depthCm === null
                            ? "Chưa có thông tin"
                            : `${selected.depthCm} cm`}
                        </dd>
                      </div>
                      <div>
                        <dt>Thời điểm mẫu</dt>
                        <dd>{selected.time}</dd>
                      </div>
                      <div>
                        <dt>Nguồn</dt>
                        <dd>Dữ liệu dựng cho demo</dd>
                      </div>
                    </dl>

                    <button
                      className="primary-button"
                      onClick={() => {
                        changeEndpoint("destination", selected);
                        changeTab("routes");
                      }}
                    >
                      Chọn làm điểm đến
                    </button>
                  </section>
                )}

                <div className="point-list">
                  {visiblePoints.map((point) => (
                    <button
                      key={point.id}
                      className={`point-card ${
                        selected?.id === point.id ? "is-selected" : ""
                      }`}
                      onClick={() => selectPoint(point)}
                    >
                      <span
                        className="point-symbol"
                        style={{ "--status-color": STATUS[point.status].color }}
                      >
                        ≈
                      </span>

                      <span className="point-body">
                        <strong>{point.name}</strong>
                        <small>{point.address}</small>
                        <span className={`status ${point.status}`}>
                          {STATUS[point.status].label}
                        </span>
                      </span>

                      <span className="depth">
                        {point.depthCm === null ? "—" : `${point.depthCm} cm`}
                      </span>
                    </button>
                  ))}
                </div>

                <p className="muted">
                  Các điểm ngập đều là giả lập, không phản ánh hiện trạng.
                </p>
              </>
            )}

            {tab === "routes" && (
              <>
                <div className="section-heading">
                  <h2>Tìm đường</h2>
                  <span>Ô tô · demo</span>
                </div>

                <PlaceField
                  label="A · Điểm xuất phát"
                  value={origin}
                  onChange={(place) => changeEndpoint("origin", place)}
                  onPick={() => setPickMode("origin")}
                />

                <button
                  className="secondary-button swap-button"
                  onClick={() => {
                    setOrigin(destination);
                    setDestination(origin);
                    setRouteType(null);
                    setMessage("");
                  }}
                >
                  ⇅ Đổi điểm đi và điểm đến
                </button>

                <PlaceField
                  label="B · Điểm đến"
                  value={destination}
                  onChange={(place) => changeEndpoint("destination", place)}
                  onPick={() => setPickMode("destination")}
                />

                {destination?.status === "flooded" && (
                  <p className="notice">
                    Trong kịch bản mẫu, điểm đến này có ghi nhận ngập.
                  </p>
                )}

                <button className="primary-button" onClick={showSampleRoute}>
                  Xem tuyến minh họa
                </button>

                <button className="secondary-button" onClick={loadSample}>
                  Nạp hành trình mẫu
                </button>

                {route && (
                  <section className="route-card">
                    <span className="eyebrow">KỊCH BẢN TRÌNH BÀY</span>
                    <h3>Hoàn Kiếm ↔ Bách khoa</h3>

                    <div className="route-options">
                      <button
                        className={routeType === "normal" ? "chosen" : ""}
                        onClick={() => setRouteType("normal")}
                      >
                        Tuyến thường
                      </button>
                      <button
                        className={routeType === "avoidance" ? "chosen" : ""}
                        onClick={() => setRouteType("avoidance")}
                      >
                        Tuyến tránh · mẫu
                      </button>
                    </div>

                    <p>
                      Nét vẽ minh họa, chưa bám chính xác mạng đường. Chưa tính
                      quãng đường, thời gian hoặc kiểm chứng tránh ngập.
                    </p>
                  </section>
                )}

                <p className="muted">
                  Nhánh demo chưa gọi dịch vụ tính đường thực tế.
                </p>
              </>
            )}

            {tab === "report" && (
              <form onSubmit={handleReport}>
                <h2>Gửi thông tin ngập</h2>
                <p className="muted">
                  Biểu mẫu mô phỏng. Dữ liệu không được gửi hoặc lưu.
                </p>

                <div className="field">
                  <label>Vị trí</label>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setPickMode("report")}
                  >
                    {reportPosition
                      ? `${reportPosition[0].toFixed(5)}, ${reportPosition[1].toFixed(5)}`
                      : "Chọn vị trí trên bản đồ"}
                  </button>
                </div>

                <div className="field">
                  <label htmlFor="observed-at">Thời điểm quan sát</label>
                  <input id="observed-at" type="datetime-local" required />
                </div>

                <div className="field">
                  <label htmlFor="report-image">Ảnh hiện trường</label>
                  <input
                    id="report-image"
                    type="file"
                    accept="image/*"
                    required
                  />
                  <small>Chỉ chọn file trên máy, không tải lên server.</small>
                </div>

                <div className="field">
                  <label htmlFor="description">Mô tả</label>
                  <textarea
                    id="description"
                    rows={4}
                    required
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setReportDone(false);
                    }}
                    placeholder="Mô tả vị trí và tình trạng quan sát…"
                  />
                  <small>{wordCount}/200 đơn vị tách bằng khoảng trắng</small>
                </div>

                <button className="primary-button" type="submit">
                  Kiểm tra biểu mẫu demo
                </button>

                {reportDone && (
                  <p className="success" role="status">
                    Biểu mẫu đã qua kiểm tra demo. Chưa gửi báo cáo thật.
                  </p>
                )}
              </form>
            )}

            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
          </div>

          <footer className="sidebar-footer">
            Đồ án tốt nghiệp · Bản trình bày giao diện
          </footer>
        </aside>

        <section className="map-area" aria-label="Bản đồ Hà Nội">
          <DemoMap
            points={visiblePoints}
            selectedId={selected?.id}
            onSelect={selectPoint}
            focus={focus}
            origin={tab === "routes" ? origin : null}
            destination={tab === "routes" ? destination : null}
            route={tab === "routes" ? route : null}
            reportPosition={tab === "report" ? reportPosition : null}
            routeType={routeType}
            pickMode={pickMode}
            activeTab={tab}
            onPick={handlePick}
          />

          <div className="map-banner">
            <span className="live-dot" />
            Hà Nội
            <span className="banner-divider">|</span>
            Bản đồ nền thật · thông tin ngập giả lập
          </div>

          {pickMode && (
            <div className="pick-banner" role="status">
              Bấm lên bản đồ để chọn{" "}
              {pickMode === "origin"
                ? "điểm đi"
                : pickMode === "destination"
                  ? "điểm đến"
                  : "vị trí báo cáo"}
              <button onClick={() => setPickMode(null)}>Hủy</button>
            </div>
          )}

          <div className="map-legend">
            <strong>Chú giải</strong>
            {Object.entries(STATUS).map(([key, value]) => (
              <span key={key}>
                <i style={{ backgroundColor: value.color }} />
                {value.label}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
