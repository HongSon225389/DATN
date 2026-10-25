import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import PlaceSearch from "./PlaceSearch";

function PickerController({ value, onChange, disabled }) {
  const map = useMap();
  useEffect(() => {
    if (!value) return;

    map.flyTo([value[1], value[0]], Math.max(map.getZoom(), 16), {
      duration: 0.6,
    });
  }, [value, map]);

  useMapEvents({
    click(event) {
      if (disabled) return;

      onChange([
        Number(event.latlng.lng.toFixed(6)),
        Number(event.latlng.lat.toFixed(6)),
      ]);
    },
  });

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });

    observer.observe(map.getContainer());

    return () => observer.disconnect();
  }, [map]);

  return null;
}

export default function LocationPicker({ value, onChange, disabled = false }) {
  return (
    <div>
      <PlaceSearch
        disabled={disabled}
        onSelect={(place) => onChange(place.coordinates)}
      />
      <p className="field-help">
        Phóng to và bấm đúng vị trí cần ghi nhận trên bản đồ.
      </p>

      <div className="location-picker-map">
        <MapContainer
          center={value ? [value[1], value[0]] : [21.0285, 105.835]}
          zoom={value ? 16 : 13}
          className="hanoi-map"
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            referrerPolicy="strict-origin-when-cross-origin"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <PickerController
            value={value}
            onChange={onChange}
            disabled={disabled}
          />

          {value && (
            <CircleMarker
              center={[value[1], value[0]]}
              radius={9}
              pathOptions={{
                color: "#ffffff",
                weight: 3,
                fillColor: "#1769d2",
                fillOpacity: 1,
              }}
            >
              <Tooltip>Vị trí đang chọn</Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      <p className="field-help" aria-live="polite">
        {value
          ? `Đã chọn: kinh độ ${value[0]}, vĩ độ ${value[1]}`
          : "Chưa chọn vị trí."}
      </p>
    </div>
  );
}
