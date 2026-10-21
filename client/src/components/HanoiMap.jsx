import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

import RoutingCheck from "./RoutingCheck";

function MapController({ focus, onSelect }) {
  const map = useMap();

  const lat = focus?.[0];
  const lng = focus?.[1];

  useEffect(() => {
    if (typeof lat === "number" && typeof lng === "number") {
      map.flyTo([lat, lng], 16, {
        duration: 0.7,
      });
    }
  }, [lat, lng, map]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });

    observer.observe(map.getContainer());

    return () => observer.disconnect();
  }, [map]);

  useMapEvents({
    click(event) {
      onSelect({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  return null;
}

export default function HanoiMap({
  selectedPosition,
  onSelect,
  floodEvents,
  selectedEventId,
  onEventSelect,
  focus,
  showRoutingCheck,
}) {
  return (
    <MapContainer center={[21.0285, 105.835]} zoom={13} className="hanoi-map">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <MapController focus={focus} onSelect={onSelect} />

      {import.meta.env.DEV && showRoutingCheck && <RoutingCheck />}

      {floodEvents.map((event) => {
        const coordinates = event.location?.coordinates;

        if (!Array.isArray(coordinates) || coordinates.length !== 2) {
          return null;
        }

        const [lng, lat] = coordinates;

        // Lịch sử dùng màu tím để không nhầm là ngập hiện tại.
        let color = "#7c3aed";

        if (event.dataMode !== "historical") {
          color =
            event.latestObservation?.status === "receded"
              ? "#16856b"
              : "#dc3545";
        }

        return (
          <CircleMarker
            key={event.id}
            center={[lat, lng]}
            radius={selectedEventId === event.id ? 12 : 8}
            bubblingMouseEvents={false}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: color,
              fillOpacity: 1,
            }}
            eventHandlers={{
              click: () => onEventSelect(event),
            }}
          >
            <Tooltip>
              {event.title}
              {event.dataMode === "historical" ? " · Lịch sử" : ""}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {selectedPosition && (
        <CircleMarker
          center={[selectedPosition.lat, selectedPosition.lng]}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#1769d2",
            fillOpacity: 1,
          }}
        >
          <Tooltip permanent direction="top">
            Vị trí chọn thủ công
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
