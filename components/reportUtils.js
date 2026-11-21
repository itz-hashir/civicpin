export const REPORT_TYPES = [
  { value: "lighting", label: "Street lighting" },
  { value: "drainage", label: "Drainage" },
  { value: "roads", label: "Roads and paths" },
  { value: "waste", label: "Waste" },
  { value: "water", label: "Water supply" },
  { value: "other", label: "Other" },
];

export const STATUSES = [
  { value: "submitted", label: "Submitted" },
  { value: "in_progress", label: "In progress" },
  { value: "fixed", label: "Fixed" },
];

export function typeLabel(value) {
  return REPORT_TYPES.find((type) => type.value === value)?.label || "Other";
}

export function statusLabel(value) {
  return STATUSES.find((status) => status.value === value)?.label || "Update pending";
}

export function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

export function getCoordinates(location) {
  const coordinates = location?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function osmUrl({ lat, lng }) {
  const params = new URLSearchParams({ mlat: String(lat), mlon: String(lng) });
  return `https://www.openstreetmap.org/?${params}#map=18/${lat}/${lng}`;
}

export async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export function connectionError(fallback) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "You appear to be offline. Reconnect to the internet and try again.";
  }
  return fallback;
}
