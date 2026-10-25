import { useEffect, useRef, useState } from "react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polygon,
  Polyline,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { useAuth } from "../contexts/AuthContext";
import adminFloodService from "../services/adminFloodService";
import adminAvoidanceService from "../services/adminAvoidanceService";

function DrawingController({ coordinates, drawing, onAdd }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates) {
      map.setView([coordinates[1], coordinates[0]], 18);
    }
  }, [coordinates, map]);

  useEffect(() => {
    const container = map.getContainer();
    const previous = container.style.cursor;

    if (drawing) container.style.cursor = "crosshair";

    return () => {
      container.style.cursor = previous;
    };
  }, [drawing, map]);

  useMapEvents({
    click(event) {
      if (drawing) {
        onAdd([event.latlng.lng, event.latlng.lat]);
      }
    },
  });

  return null;
}

export default function AdminAvoidancePage() {
  const { token, logout } = useAuth();
  const pending = useRef(false);

  const [keyword, setKeyword] = useState("");
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [areas, setAreas] = useState([]);

  const [vertices, setVertices] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [hours, setHours] = useState(24);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [busy, setBusy] = useState(false);
  const [areasLoading, setAreasLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const handleError = (error) => {
    if (error.status === 401 || error.status === 403) {
      logout();
      return;
    }

    setError(error.message);
  };

  useEffect(() => {
    if (!selected) return;

    const controller = new AbortController();

    const load = async () => {
      setAreasLoading(true);

      try {
        const result = await adminAvoidanceService.list({
          eventId: selected.id,
          token,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setAreas(result.data);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error.status === 401 || error.status === 403) {
          logout();
        } else {
          setError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAreasLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [selected, token, logout, reloadKey]);

  const search = async (event) => {
    event.preventDefault();

    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await adminFloodService.getFloodEvents({
        token,
        q: keyword.trim(),
        mode: "current",
        published: "true",
        page: 1,
        limit: 20,
      });

      setEvents(
        result.data.filter(
          (item) => item.latestObservation?.status === "flooded",
        ),
      );

      setSelected(null);
      setAreas([]);
      setVertices([]);
      setDrawing(false);
    } catch (error) {
      handleError(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();

    if (pending.current) return;

    if (!selected || vertices.length < 3 || !confirmed || drawing) {
      setError("Cần hoàn tất vùng có ít nhất 3 đỉnh và xác nhận vị trí");
      return;
    }

    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await adminAvoidanceService.create({
        token,
        data: {
          floodEventId: selected.id,
          eventRevision: selected.revision,
          vertices,
          hours,
          reason: reason.trim(),
        },
      });

      // Lấy revision mới vì tạo vùng có cập nhật sự kiện.
      const detail = await adminFloodService.getFloodEventById({
        id: selected.id,
        token,
      });

      setSelected(detail.data);
      setVertices([]);
      setConfirmed(false);
      setReason("");
      setReloadKey((value) => value + 1);
      setMessage("Đã lưu vùng tránh. Hãy tìm lại tuyến để áp dụng.");
    } catch (error) {
      handleError(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const endArea = async (area) => {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await adminAvoidanceService.end({
        id: area.id,
        revision: area.revision,
        token,
      });

      setReloadKey((value) => value + 1);
      setMessage("Đã kết thúc vùng. Hãy tìm lại tuyến để cập nhật.");
    } catch (error) {
      handleError(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const positions = vertices.map(([lng, lat]) => [lat, lng]);

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <div>
          <h1>Vùng đường bị ngập</h1>
          <p>Chọn điểm ngập, phóng to rồi vẽ đúng phần đường bị ảnh hưởng.</p>
        </div>
      </header>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="admin-success-message" role="status">
          {message}
        </p>
      )}

      <section className="admin-panel">
        <form onSubmit={search}>
          <label htmlFor="avoidance-search">
            Tìm điểm đang ngập đã công bố
          </label>

          <div className="admin-search-row">
            <input
              id="avoidance-search"
              value={keyword}
              maxLength={200}
              required
              disabled={busy}
              onChange={(event) => setKeyword(event.target.value)}
            />

            <button type="submit" disabled={busy}>
              Tìm
            </button>
          </div>
        </form>

        <div className="review-event-list">
          {events.map((event) => (
            <button
              type="button"
              key={event.id}
              className="review-event-option"
              disabled={busy}
              aria-pressed={selected?.id === event.id}
              onClick={() => {
                setSelected(event);
                setAreas([]);
                setVertices([]);
                setDrawing(false);
                setConfirmed(false);
                setReason("");
                setError("");
                setMessage("");
              }}
            >
              <strong>{event.title}</strong>
              <span>{event.address}</span>
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section className="admin-panel">
          <h2>{selected.title}</h2>

          <p className="notice">
            Chấm đỏ là vị trí đại diện. Vẽ vùng trên mặt đường bị ảnh hưởng,
            không bao quanh căn nhà chỉ vì địa chỉ nằm ở đó. Chọn các đỉnh theo
            thứ tự quanh vùng; không bấm lại đỉnh đầu.
          </p>

          <div className="admin-form-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDrawing((value) => !value);
                setConfirmed(false);
              }}
            >
              {drawing ? "Hoàn tất vẽ" : "Bật vẽ / thêm đỉnh"}
            </button>

            <button
              type="button"
              disabled={busy || vertices.length === 0}
              onClick={() => {
                setVertices((previous) => previous.slice(0, -1));
                setConfirmed(false);
              }}
            >
              Bỏ đỉnh cuối
            </button>

            <button
              type="button"
              disabled={busy || vertices.length === 0}
              onClick={() => {
                setVertices([]);
                setConfirmed(false);
              }}
            >
              Xóa bản vẽ
            </button>
          </div>

          <p>
            {vertices.length} đỉnh · {drawing ? "Đang vẽ" : "Đã dừng vẽ"}
          </p>

          <div className="avoidance-editor-map">
            <MapContainer
              center={[21.0285, 105.835]}
              zoom={16}
              className="hanoi-map"
              doubleClickZoom={false}
            >
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                referrerPolicy="strict-origin-when-cross-origin"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              <DrawingController
                coordinates={selected.location.coordinates}
                drawing={drawing && !busy}
                onAdd={(position) => {
                  setVertices((previous) =>
                    previous.length < 100 ? [...previous, position] : previous,
                  );
                  setConfirmed(false);
                }}
              />

              <CircleMarker
                center={[
                  selected.location.coordinates[1],
                  selected.location.coordinates[0],
                ]}
                radius={8}
                interactive={false}
                pathOptions={{ color: "#dc3545" }}
              />

              {areas.map((area) => (
                <Polygon
                  key={area.id}
                  positions={area.geometry.coordinates[0].map(([lng, lat]) => [
                    lat,
                    lng,
                  ])}
                  interactive={false}
                  pathOptions={{
                    color: "#dc3545",
                    fillOpacity: 0.18,
                  }}
                />
              ))}

              {positions.length >= 3 ? (
                <Polygon
                  positions={positions}
                  interactive={false}
                  pathOptions={{
                    color: "#7c3aed",
                    fillOpacity: 0.2,
                  }}
                />
              ) : positions.length >= 2 ? (
                <Polyline positions={positions} interactive={false} />
              ) : null}

              {positions.map((position, index) => (
                <CircleMarker
                  key={index}
                  center={position}
                  radius={4}
                  interactive={false}
                  pathOptions={{ color: "#7c3aed" }}
                >
                  <Tooltip permanent>{index + 1}</Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          <form onSubmit={save}>
            <label htmlFor="avoidance-hours">Rà soát lại sau</label>
            <select
              id="avoidance-hours"
              value={hours}
              disabled={busy}
              onChange={(event) => setHours(Number(event.target.value))}
            >
              <option value={1}>1 giờ</option>
              <option value={6}>6 giờ</option>
              <option value={12}>12 giờ</option>
              <option value={24}>24 giờ</option>
              <option value={48}>48 giờ</option>
            </select>

            <label htmlFor="avoidance-reason">Căn cứ xác định phạm vi *</label>
            <textarea
              id="avoidance-reason"
              rows={3}
              required
              maxLength={1000}
              disabled={busy}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Tôi đã kiểm tra vùng vẽ bao phủ đúng đoạn đường cần tránh.
            </label>

            <button
              type="submit"
              disabled={busy || drawing || vertices.length < 3 || !confirmed}
            >
              {busy ? "Đang xử lý…" : "Lưu và bật vùng tránh"}
            </button>
          </form>

          <h3>Vùng đã lưu, chưa kết thúc</h3>

          {areasLoading && <p>Đang tải vùng…</p>}

          {areas.map((area) => (
            <div className="location-card" key={area.id}>
              <p>{area.reason}</p>
              <p>
                Hạn rà soát: {new Date(area.reviewAt).toLocaleString("vi-VN")}
              </p>
              <p>
                {area.isActive && new Date(area.reviewAt) > new Date()
                  ? "Đang bật, còn hạn"
                  : "Đã tắt hoặc hết hạn"}
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={() => endArea(area)}
              >
                Kết thúc áp dụng vùng này
              </button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
