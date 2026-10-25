import { useEffect } from "react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  Polyline,
  Polygon,
  useMap,
  useMapEvents,
} from "react-leaflet";

import LocateControl from "./LocateControl";

const isValidCoordinates = (value) =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every(Number.isFinite) &&
  value[0] >= -180 &&
  value[0] <= 180 &&
  value[1] >= -90 &&
  value[1] <= 90;

function RouteLayer({ route }) {
  const map = useMap();

  const coordinates = route?.geometry?.coordinates;

  const valid =
    route?.geometry?.type === "LineString" &&
    Array.isArray(coordinates) &&
    coordinates.length >= 2 &&
    coordinates.every(isValidCoordinates);

  useEffect(() => {
    if (!valid) return;

    map.fitBounds(
      coordinates.map(([lng, lat]) => [lat, lng]),
      {
        padding: [35, 35],
        maxZoom: 17,
      },
    );
  }, [coordinates, valid, map]);

  if (!valid) return null;

  return (
    <Polyline
      positions={coordinates.map(([lng, lat]) => [lat, lng])}
      pathOptions={{
        color: "#2563eb",
        weight: 6,
        opacity: 0.85,
      }}
    />
  );
}

function RouteMapPicker({ target, onPick }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const previousCursor = container.style.cursor;

    if (target) {
      container.style.cursor = "crosshair";
    }

    return () => {
      container.style.cursor = previousCursor;
    };
  }, [target, map]);

  useMapEvents({
    click(event) {
      if (!target) return;

      onPick?.([event.latlng.lng, event.latlng.lat]);
    },
  });

  return null;
}

function MapController({ focus }) {
  const map = useMap();

  const lat = focus?.[0];
  const lng = focus?.[1];

  useEffect(() => {
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
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
  route,
  routeStart,
  routeEnd,
  pickTarget,
  onRoutePick,
  locateRef,
}) {
  const searchCoordinates = searchPosition?.coordinates;

  return (
    <MapContainer center={[21.0285, 105.835]} zoom={13} className="hanoi-map">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        referrerPolicy="strict-origin-when-cross-origin"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <MapController focus={focus} />

      <LocateControl ref={locateRef} />

      <RouteMapPicker target={pickTarget} onPick={onRoutePick} />

      {(route?.avoidanceAreas ?? []).map((area) => (
        <Polygon
          key={area.id}
          positions={area.geometry.coordinates[0].map(([lng, lat]) => [
            lat,
            lng,
          ])}
          interactive={false}
          pathOptions={{
            color: "#dc3545",
            weight: 2,
            fillOpacity: 0.18,
          }}
        />
      ))}

      <RouteLayer route={route} />

      {isValidCoordinates(searchCoordinates) && (
        <CircleMarker
          center={[searchCoordinates[1], searchCoordinates[0]]}
          radius={8}
          bubblingMouseEvents={false}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#1769d2",
            fillOpacity: 1,
          }}
          eventHandlers={{
            click: () => {
              if (pickTarget) {
                onRoutePick?.(searchCoordinates);
              }
            },
          }}
        >
          <Tooltip>{searchPosition.name}</Tooltip>
        </CircleMarker>
      )}

      {floodEvents.map((event) => {
        const coordinates = event.location?.coordinates;

        if (!isValidCoordinates(coordinates)) return null;

        const [lng, lat] = coordinates;
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
              click: () => {
                if (pickTarget) {
                  onRoutePick?.(coordinates);
                } else {
                  onEventSelect?.(event);
                }
              },
            }}
          >
            <Tooltip>
              {event.title} · {receded ? "Đã rút" : "Đang ngập"}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {[
        {
          key: "start",
          place: routeStart,
          label: "A · Điểm đi",
          color: "#1769d2",
        },
        {
          key: "end",
          place: routeEnd,
          label: "B · Điểm đến",
          color: "#7c3aed",
        },
      ].map(({ key, place, label, color }) => {
        const coordinates = place?.coordinates;

        if (!isValidCoordinates(coordinates)) return null;

        return (
          <CircleMarker
            key={key}
            center={[coordinates[1], coordinates[0]]}
            radius={9}
            bubblingMouseEvents={false}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: color,
              fillOpacity: 1,
            }}
            eventHandlers={{
              click: () => {
                if (pickTarget) {
                  onRoutePick?.(coordinates);
                }
              },
            }}
          >
            <Tooltip permanent direction="top">
              {label}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
