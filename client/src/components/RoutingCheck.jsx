import { useEffect, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import { geoJSON } from "leaflet";

export default function RoutingCheck() {
  const map = useMap();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const names = ["route-normal", "route-avoidance", "avoidance-test"];

        const results = await Promise.all(
          names.map(async (name) => {
            const response = await fetch(`/routing-check/${name}.geojson`, {
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error("Không tải được dữ liệu thử.");
            }

            return response.json();
          }),
        );

        const [normal, avoidance, area] = results;

        const bounds = geoJSON(normal).getBounds();

        if (!bounds.isValid()) {
          throw new Error("Hình học tuyến thử không hợp lệ.");
        }

        setData({ normal, avoidance, area });
        map.fitBounds(bounds, { padding: [35, 35] });
      } catch (error) {
        if (error.name !== "AbortError") {
          setError(error.message);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [map]);

  if (error) {
    return (
      <div className="routing-check-error" role="alert">
        {error} Kiểm tra ba file trong public/routing-check.
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <GeoJSON
        data={data.area}
        style={{
          color: "#dc3545",
          weight: 2,
          fillColor: "#dc3545",
          fillOpacity: 0.25,
        }}
      />

      <GeoJSON
        data={data.normal}
        style={{
          color: "#2563eb",
          weight: 7,
          opacity: 0.6,
        }}
      />

      <GeoJSON
        data={data.avoidance}
        style={{
          color: "#16856b",
          weight: 4,
          opacity: 1,
          dashArray: "8 6",
        }}
      />
    </>
  );
}
