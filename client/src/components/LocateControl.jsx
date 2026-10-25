import { useEffect, useRef, useState } from "react";
import { Circle, CircleMarker, Tooltip, useMap } from "react-leaflet";

export default function LocateControl() {
  const map = useMap();
  const mounted = useRef(false);
  const pending = useRef(false);

  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const locate = () => {
    if (pending.current) return;

    setError("");

    if (!window.isSecureContext || !navigator.geolocation) {
      setError("Trình duyệt cần HTTPS hoặc localhost để lấy vị trí.");
      return;
    }

    pending.current = true;
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        pending.current = false;

        if (!mounted.current) return;

        const next = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        };

        setPosition(next);
        setLoading(false);

        const center = [next.lat, next.lng];

        if (next.accuracy <= 200) {
          map.flyTo(center, 16);
        } else {
          map.fitBounds(
            [
              [next.lat - 0.001, next.lng - 0.001],
              [next.lat + 0.001, next.lng + 0.001],
            ],
            { maxZoom: 14 },
          );

          setError(
            `Vị trí chỉ mang tính gần đúng, sai số khoảng ${Math.round(
              next.accuracy,
            )} m.`,
          );
        }
      },
      (failure) => {
        pending.current = false;

        if (!mounted.current) return;

        setLoading(false);

        const messages = {
          1: "Bạn chưa cho phép truy cập vị trí. Hãy kiểm tra quyền của trang.",
          2: "Thiết bị chưa xác định được vị trí.",
          3: "Lấy vị trí quá thời gian. Vui lòng thử lại.",
        };

        setError(messages[failure.code] || "Không lấy được vị trí.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      },
    );
  };

  return (
    <>
      <div
        className="locate-control"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          disabled={loading}
          onClick={locate}
          title="Đến vị trí hiện tại của tôi"
        >
          {loading ? "Đang định vị…" : "◎ Vị trí của tôi"}
        </button>

        {error && (
          <div className="locate-message" role="status">
            {error}
          </div>
        )}
      </div>

      {position && (
        <>
          <Circle
            center={[position.lat, position.lng]}
            radius={position.accuracy}
            interactive={false}
            pathOptions={{
              color: "#1769d2",
              weight: 1,
              fillOpacity: 0.08,
            }}
          />

          <CircleMarker
            center={[position.lat, position.lng]}
            radius={7}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: "#1769d2",
              fillOpacity: 1,
            }}
          >
            <Tooltip>
              Vị trí của bạn · Sai số khoảng {Math.round(position.accuracy)} m
            </Tooltip>
          </CircleMarker>
        </>
      )}
    </>
  );
}
