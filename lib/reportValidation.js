import { REPORT_TYPES } from "./reportTypes.js";

export const MAX_PHOTO_BYTES = 4_500_000;
const MAX_DESCRIPTION_LENGTH = 1_000;
const PHOTO_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function invalid(error, status = 400) {
  return { ok: false, error, status };
}

function coordinate(value, name, minimum, maximum) {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") {
    return { error: `${name} is required` };
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    return { error: `${name} must be between ${minimum} and ${maximum}` };
  }
  return { value: number };
}
function invalidMunicipalConfiguration() {
  return invalid("Report service is temporarily unavailable", 503);
}

function parseBoundingBox(setting) {
  const parts = typeof setting === "string" ? setting.split(",") : [];
  if (parts.length !== 4 || parts.some((part) => part.trim() === "")) {
    throw new Error("Invalid bounding box");
  }
  const box = parts.map(Number);
  const [west, south, east, north] = box;
  if (
    !box.every(Number.isFinite) ||
    west < -180 || east > 180 || south < -90 || north > 90 ||
    west >= east || south >= north
  ) {
    throw new Error("Invalid bounding box");
  }
  return box;
}

function parsePolygon(setting) {
  const polygon = JSON.parse(setting);
  const ring = polygon?.type === "Polygon" ? polygon.coordinates?.[0] : null;
  if (!Array.isArray(ring) || ring.length < 4) throw new Error("Invalid polygon");
  for (const position of ring) {
    if (
      !Array.isArray(position) || position.length < 2 ||
      !Number.isFinite(position[0]) || !Number.isFinite(position[1]) ||
      position[0] < -180 || position[0] > 180 ||
      position[1] < -90 || position[1] > 90
    ) {
      throw new Error("Invalid polygon");
    }
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) throw new Error("Invalid polygon");
  return ring;
}

function pointOnSegment(lng, lat, start, end) {
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = (lng - x1) * (y2 - y1) - (lat - y1) * (x2 - x1);
  return cross === 0 && lng >= Math.min(x1, x2) && lng <= Math.max(x1, x2) &&
    lat >= Math.min(y1, y2) && lat <= Math.max(y1, y2);
}

function pointInPolygon(lng, lat, ring) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current, current += 1) {
    const start = ring[previous];
    const end = ring[current];
    if (pointOnSegment(lng, lat, start, end)) return true;
    const [x1, y1] = start;
    const [x2, y2] = end;
    if ((y1 > lat) !== (y2 > lat)) {
      const crossingLng = x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1);
      if (lng < crossingLng) inside = !inside;
    }
  }
  return inside;
}

function validateMunicipalLocation(lat, lng, environment) {
  const boundingBoxSetting = environment.MUNICIPAL_BBOX;
  const polygonSetting = environment.MUNICIPAL_GEOJSON;
  if (boundingBoxSetting === undefined && polygonSetting === undefined) return { ok: true };

  let boundingBox;
  let polygon;
  try {
    if (boundingBoxSetting !== undefined) boundingBox = parseBoundingBox(boundingBoxSetting);
    if (polygonSetting !== undefined) polygon = parsePolygon(polygonSetting);
  } catch {
    return invalidMunicipalConfiguration();
  }

  if (boundingBox) {
    const [west, south, east, north] = boundingBox;
    if (lng < west || lng > east || lat < south || lat > north) {
      return invalid("Location is outside the reporting area");
    }
  }
  if (polygon && !pointInPolygon(lng, lat, polygon)) {
    return invalid("Location is outside the reporting area");
  }
  return { ok: true };
}

function matchesSignature(bytes, mimeType) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
  }
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  );
}

async function readPhoto(photo) {
  if (!photo || typeof photo !== "object" || typeof photo.stream !== "function") {
    return invalid("Photo is required");
  }
  if (!Object.hasOwn(PHOTO_EXTENSIONS, photo.type)) {
    return invalid("Photo must be a JPEG, PNG, or WebP image");
  }
  if (!Number.isFinite(photo.size) || photo.size <= 0) {
    return invalid("Photo must not be empty");
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return invalid("Photo must be 4.5 MB or smaller", 413);
  }

  const chunks = [];
  let length = 0;
  try {
    for await (const chunk of photo.stream()) {
      const bytes = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      length += bytes.length;
      if (length > MAX_PHOTO_BYTES) {
        return invalid("Photo must be 4.5 MB or smaller", 413);
      }
      chunks.push(bytes);
    }
  } catch {
    return invalid("Photo could not be read");
  }

  const bytes = Buffer.concat(chunks, length);
  if (length === 0) return invalid("Photo must not be empty");
  if (!matchesSignature(bytes, photo.type)) {
    return invalid("Photo contents do not match its image type");
  }
  return { ok: true, bytes, extension: PHOTO_EXTENSIONS[photo.type] };
}

export async function validateReportForm(formData, environment = process.env) {
  const type = formData.get("type");
  if (typeof type !== "string" || !REPORT_TYPES.includes(type)) {
    return invalid("Invalid report type");
  }

  const description = formData.get("description");
  if (description !== null && typeof description !== "string") {
    return invalid("Description must be text");
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    return invalid("Description must be 1000 characters or fewer");
  }

  const latitude = coordinate(formData.get("lat"), "Latitude", -90, 90);
  if (latitude.error) return invalid(latitude.error);
  const longitude = coordinate(formData.get("lng"), "Longitude", -180, 180);
  if (longitude.error) return invalid(longitude.error);
  const municipalLocation = validateMunicipalLocation(latitude.value, longitude.value, environment);
  if (!municipalLocation.ok) return municipalLocation;

  const photo = await readPhoto(formData.get("photo"));
  if (!photo.ok) return photo;

  return {
    ok: true,
    value: {
      type,
      description: description || "",
      lat: latitude.value,
      lng: longitude.value,
      photoBytes: photo.bytes,
      photoExtension: photo.extension,
      photoContentType: formData.get("photo").type,
    },
  };
}
