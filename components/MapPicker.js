"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from "react-leaflet";

const DEFAULT_CENTER = [30.3753, 69.3451];
const DEFAULT_ZOOM = 5;

function ClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function FlyTo({ position }) {
  const map = useMap();
  const lat = position?.lat;
  const lng = position?.lng;
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    }
  }, [lat, lng, map]);
  return null;
}

export default function MapPicker({ position, onPick }) {
  return (
    <div className="map-canvas" role="group" aria-label="Incident location map. Click or tap to place the pin.">
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom={false}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={onPick} />
        <FlyTo position={position} />
        {position && (
          <CircleMarker
            center={[position.lat, position.lng]}
            radius={10}
            pathOptions={{ color: "#173D35", weight: 3, fillColor: "#F0BC5B", fillOpacity: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
}