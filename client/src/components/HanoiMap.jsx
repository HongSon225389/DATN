import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import LocateControl from "./LocateControl";
function MapController({ focus }) {
  const map = useMap();

  const lat = focus?.[0];
  const lng = focus?.[1];

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.flyTo([lat, lng], 16, {
        duration: 0.7,
      });
    }
  }, [lat, lng, map, focus]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });

    observer.observe(map.getContainer());

    return () => observer.disconnect();
  }, [map]);

  return null;
}

export default function HanoiMap({
  floodEvents = [],
  selectedEventId,
  onEventSelect,
  focus,
  searchPosition,
}) {
  return (
    <MapContainer center={[21.0285, 105.835]} zoom={13} className="hanoi-map">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        referrerPolicy="strict-origin-when-cross-origin"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <MapController focus={focus} />
      <LocateControl />

      {searchPosition && (
        <CircleMarker
          center={[
            searchPosition.coordinates[1],
            searchPosition.coordinates[0],
          ]}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#1769d2",
            fillOpacity: 1,
          }}
        >
          <Tooltip>{searchPosition.name}</Tooltip>
        </CircleMarker>
      )}

      {floodEvents.map((event) => {
        const coordinates = event.location?.coordinates;

        if (
          !Array.isArray(coordinates) ||
          coordinates.length !== 2 ||
          !coordinates.every(Number.isFinite)
        ) {
          return null;
        }

        const [lng, lat] = coordinates;

        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          return null;
        }

        const receded = event.latestObservation?.status === "receded";

        return (
          <CircleMarker
            key={event.id}
            center={[lat, lng]}
            radius={selectedEventId === event.id ? 12 : 8}
            bubblingMouseEvents={false}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: receded ? "#16856b" : "#dc3545",
              fillOpacity: 1,
            }}
            eventHandlers={{
              click: () => onEventSelect(event),
            }}
          >
            <Tooltip>
              {event.title} · {receded ? "Đã rút" : "Đang ngập"}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
