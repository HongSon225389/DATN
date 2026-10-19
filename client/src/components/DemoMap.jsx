import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { HANOI_CENTER, STATUS } from "../data/demoData";

function MapController({ focus, route, pickMode, onPick, activeTab }) {
  const map = useMap();
  useEffect(() => {
    map.closePopup();
  }, [activeTab, pickMode, map]);
  const routeKey = route ? JSON.stringify(route) : "";
  const focusLat = focus?.[0];
  const focusLng = focus?.[1];

  useEffect(() => {
    if (routeKey) {
      map.fitBounds(JSON.parse(routeKey), {
        padding: [45, 45],
      });
    } else if (typeof focusLat === "number" && typeof focusLng === "number") {
      map.flyTo([focusLat, focusLng], 15, {
        duration: 0.7,
      });
    }
  }, [routeKey, focusLat, focusLng, map]);

  useEffect(() => {
    const container = map.getContainer();

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, [map]);

  useMapEvents({
    click(event) {
      if (pickMode) {
        onPick([event.latlng.lat, event.latlng.lng]);
      }
    },
  });

  return null;
}

export default function DemoMap({
  points,
  selectedId,
  onSelect,
  focus,
  origin,
  destination,
  route,
  routeType,
  pickMode,
  onPick,
  reportPosition,
  activeTab,
}) {
  return (
    <MapContainer
      center={HANOI_CENTER}
      zoom={13}
      zoomControl={false}
      className={`demo-map ${pickMode ? "is-picking" : ""}`}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <ZoomControl position="bottomright" />

      <MapController
        focus={focus}
        route={route}
        pickMode={pickMode}
        onPick={onPick}
        activeTab={activeTab}
      />

      {points.map((point) => (
        <CircleMarker
          key={point.id}
          center={point.position}
          radius={selectedId === point.id ? 13 : 9}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: STATUS[point.status].color,
            fillOpacity: 1,
          }}
          bubblingMouseEvents={false}
          eventHandlers={{ click: () => onSelect(point) }}
        >
          <Tooltip>{point.name}</Tooltip>

          <Popup>
            <strong>{point.name}</strong>
            <p>{STATUS[point.status].label} · Dữ liệu giả lập</p>
          </Popup>
        </CircleMarker>
      ))}

      {origin && (
        <CircleMarker
          center={origin.position}
          radius={10}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#2563eb",
            fillOpacity: 1,
          }}
        >
          <Tooltip permanent direction="top">
            A · Điểm đi
          </Tooltip>
        </CircleMarker>
      )}

      {destination && (
        <CircleMarker
          center={destination.position}
          radius={10}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#7c3aed",
            fillOpacity: 1,
          }}
        >
          <Tooltip permanent direction="top">
            B · Điểm đến
          </Tooltip>
        </CircleMarker>
      )}
      {reportPosition && (
        <CircleMarker
          center={reportPosition}
          radius={12}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#ea580c",
            fillOpacity: 1,
          }}
        >
          <Tooltip permanent direction="top">
            Vị trí báo cáo
          </Tooltip>
        </CircleMarker>
      )}
      {route && (
        <Polyline
          positions={route}
          pathOptions={{
            color: routeType === "avoidance" ? "#16856b" : "#2563eb",
            weight: 6,
            opacity: 0.85,
            dashArray: "10 8",
          }}
        />
      )}
    </MapContainer>
  );
}
