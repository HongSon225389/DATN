import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import RoutingCheck from "./RoutingCheck";
function MapClickHandler({ onSelect }) {
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

export default function HanoiMap({ selectedPosition, onSelect }) {
  return (
    <MapContainer center={[21.0285, 105.835]} zoom={13} className="hanoi-map">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {import.meta.env.DEV && <RoutingCheck />}
      <MapClickHandler onSelect={onSelect} />

      {selectedPosition && (
        <CircleMarker
          center={[selectedPosition.lat, selectedPosition.lng]}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#1769d2",
            fillOpacity: 1,
          }}
        >
          <Tooltip permanent direction="top">
            Vị trí đã chọn
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
