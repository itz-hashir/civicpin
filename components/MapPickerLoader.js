"use client";

import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("./MapPicker"), {
  ssr: false,
  loading: () => <div className="map-loading" role="status">Loading the map…</div>,
});

export default function MapPickerLoader(props) {
  return <MapPicker {...props} />;
}
