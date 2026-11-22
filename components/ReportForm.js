"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MapPickerLoader from "./MapPickerLoader";
import { CameraIcon, CheckIcon, PinIcon } from "./Icons";
import { REPORT_TYPES, connectionError, readJson } from "./reportUtils";
import { formatFileSize, prepareIncidentPhoto } from "./preparePhoto";
import { copyText, saveReportLocally } from "./trackingStorage";

function validCoordinates(latValue, lngValue) {
  if (String(latValue).trim() === "" || String(lngValue).trim() === "") return null;
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export default function ReportForm() {
  const fileInput = useRef(null);
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [phase, setPhase] = useState("idle");
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [mapEnabled, setMapEnabled] = useState(false);
  const [locationVisibility, setLocationVisibility] = useState("approximate");
  const [photoVisibility, setPhotoVisibility] = useState("staff");
  const [deleteEvidenceOnResolution, setDeleteEvidenceOnResolution] = useState(false);
  const [saveOnDevice, setSaveOnDevice] = useState(false);

  const busy = phase === "processing" || phase === "submitting";

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function updatePhoto(next) {
    setPhoto(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : "");
  }

  function pickPosition(next) {
    setPosition(next);
    setLatitude(next.lat.toFixed(6));
    setLongitude(next.lng.toFixed(6));
    setErrors((current) => ({ ...current, location: "", form: "" }));
  }

  function updateCoordinate(axis, value) {
    const nextLat = axis === "lat" ? value : latitude;
    const nextLng = axis === "lng" ? value : longitude;
    if (axis === "lat") setLatitude(value);
    else setLongitude(value);
    setPosition(validCoordinates(nextLat, nextLng));
    setErrors((current) => ({ ...current, location: "", form: "" }));
  }

  function useMyLocation() {
    setErrors((current) => ({ ...current, location: "", form: "" }));
    if (!navigator.geolocation) {
      setErrors((current) => ({ ...current, location: "Location is not available in this browser. Tap the map or enter coordinates." }));
      return;
    }
    if (!navigator.onLine) {
      setErrors((current) => ({ ...current, location: "You appear to be offline. Reconnect, or enter the location manually." }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        pickPosition({ lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Tap the map or enter coordinates instead."
          : "Your location could not be determined. Tap the map or enter coordinates instead.";
        setErrors((current) => ({ ...current, location: message }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function handlePhoto(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPhase("processing");
    setErrors((current) => ({ ...current, photo: "", form: "" }));
    try {
      const prepared = await prepareIncidentPhoto(file);
      updatePhoto(prepared);
    } catch (error) {
      updatePhoto(null);
      input.value = "";
      setErrors((current) => ({ ...current, photo: error.message || "The photo could not be prepared." }));
    } finally {
      setPhase("idle");
    }
  }

  function removePhoto() {
    updatePhoto(null);
    if (fileInput.current) fileInput.current.value = "";
    setErrors((current) => ({ ...current, photo: "", form: "" }));
  }

  async function submitReport(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!type) nextErrors.type = "Choose the type of issue.";
    if (!position) nextErrors.location = "Select a valid location on the map or with the coordinate fields.";
    if (!photo) nextErrors.photo = "Add a photo of the issue.";
    if (Object.keys(nextErrors).length) {
      nextErrors.form = "Complete the required fields before sending your report.";
      setErrors(nextErrors);
      return;
    }
    if (!navigator.onLine) {
      setErrors({ form: "You appear to be offline. Your report has not been sent. Reconnect and try again." });
      return;
    }

    setPhase("submitting");
    setErrors({});
    setCopyMessage("");
    const body = new FormData();
    body.append("type", type);
    body.append("description", description.trim());
    body.append("lat", String(position.lat));
    body.append("lng", String(position.lng));
    body.append("photo", photo, photo.name);
    body.append("locationVisibility", locationVisibility);
    body.append("photoVisibility", photoVisibility);
    if (deleteEvidenceOnResolution) body.append("deleteEvidenceOnResolution", "true");

    try {
      const response = await fetch("/api/reports", { method: "POST", body });
      const data = await readJson(response);
      if (!response.ok) {
        setErrors({ form: data.error || "The service could not accept your report. Nothing was confirmed as submitted." });
        return;
      }
      if (typeof data.code !== "string" || !data.code.trim()) {
        setErrors({ form: "The service did not return a tracking code. Your submission is not confirmed." });
        return;
      }
      const code = data.code.trim().toUpperCase();
      const saved = saveOnDevice ? saveReportLocally({ code, type }) : false;
      setResult({ code, saved, saveRequested: saveOnDevice });
    } catch {
      setErrors({ form: connectionError("The service did not confirm your report. Check your connection before trying again.") });
    } finally {
      setPhase("idle");
    }
  }

  async function copyCode() {
    try {
      await copyText(result.code);
      setCopyMessage("Tracking code copied.");
    } catch {
      setCopyMessage("Could not copy automatically. Select the code and copy it manually.");
    }
  }

  async function shareReport() {
    const url = `${window.location.origin}/track?code=${encodeURIComponent(result.code)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Civicpin report", text: `Tracking code: ${result.code}`, url });
        setCopyMessage("Tracking details shared.");
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    try {
      await copyText(url);
      setCopyMessage("Tracking link copied.");
    } catch {
      setCopyMessage("Could not share automatically. Use Copy code instead.");
    }
  }

  if (result) {
    return (
      <section className="submission-success" aria-labelledby="submission-success-title">
        <span className="success-icon"><CheckIcon /></span>
        <p className="eyebrow">Report received</p>
        <h2 id="submission-success-title">Save your private tracking code</h2>
        <p>The service accepted your report. This code is the only way to look up its progress, so keep it somewhere safe.</p>
        <div className="tracking-code" aria-label={`Tracking code ${result.code}`}>{result.code}</div>
        <p className={result.saved ? "save-confirmation" : result.saveRequested ? "inline-warning" : "save-opt-out"}>
          {result.saved
            ? "Saved in this browser because you opted in. Anyone using this browser may be able to see it."
            : result.saveRequested
              ? "This browser could not save the code. Copy it now before leaving this page."
              : "Not saved in this browser. Copy the code or tracking link before leaving this page."}
        </p>
        <div className="success-actions">
          <button type="button" className="button button--primary" onClick={copyCode}>Copy code</button>
          <button type="button" className="button button--secondary" onClick={shareReport}>Share tracking link</button>
          <Link className="button button--amber" href={`/track?code=${encodeURIComponent(result.code)}`}>Track this report</Link>
        </div>
        <p className="action-feedback" role="status">{copyMessage}</p>
        <button type="button" className="text-button" onClick={() => {
          setResult(null);
          setType("");
          setDescription("");
          setPosition(null);
          setLatitude("");
          setLongitude("");
          updatePhoto(null);
          if (fileInput.current) fileInput.current.value = "";
          setCopyMessage("");
          setMapEnabled(false);
          setLocationVisibility("approximate");
          setPhotoVisibility("staff");
          setDeleteEvidenceOnResolution(false);
          setSaveOnDevice(false);
        }}>Submit another report</button>
      </section>
    );
  }

  return (
    <form className="report-form" onSubmit={submitReport} aria-busy={busy}>
      {errors.form && <div className="error-banner" role="alert">{errors.form}</div>}
      <fieldset disabled={busy} className="form-fieldset">
        <section className="form-card" aria-labelledby="location-heading">
          <div className="section-heading">
            <span className="step-number">01</span>
            <div>
              <h2 id="location-heading">Place the pin</h2>
              <p>Tap the exact location, or use your device location. You can also enter coordinates.</p>
            </div>
          </div>
          <div className="map-frame">
            {mapEnabled ? <MapPickerLoader position={position} onPick={pickPosition} /> : (
              <div className="map-consent">
                <PinIcon />
                <h3>Use a map or enter coordinates</h3>
                <p>The interactive map loads tiles from OpenStreetMap, which receives your IP address and map view. Loading it is optional.</p>
                <button type="button" className="button button--secondary" onClick={() => setMapEnabled(true)}>Load interactive map</button>
              </div>
            )}
          </div>
          <div className="location-toolbar">
            <button type="button" className="button button--secondary button--small" onClick={useMyLocation} disabled={locating}>
              <PinIcon />{locating ? "Finding location…" : "Use my location"}
            </button>
            {position && <span className="location-confirmation"><CheckIcon /> Pin selected</span>}
          </div>
          <div className="coordinate-grid">
            <div className="field">
              <label htmlFor="latitude">Latitude <span aria-hidden="true">*</span></label>
              <input id="latitude" name="latitude" type="number" inputMode="decimal" min="-90" max="90" step="any" value={latitude} onChange={(event) => updateCoordinate("lat", event.target.value)} placeholder="e.g. 31.5204" aria-required="true" aria-describedby={errors.location ? "location-error" : undefined} />
            </div>
            <div className="field">
              <label htmlFor="longitude">Longitude <span aria-hidden="true">*</span></label>
              <input id="longitude" name="longitude" type="number" inputMode="decimal" min="-180" max="180" step="any" value={longitude} onChange={(event) => updateCoordinate("lng", event.target.value)} placeholder="e.g. 74.3587" aria-required="true" aria-describedby={errors.location ? "location-error" : undefined} />
            </div>
          </div>
          {errors.location && <p id="location-error" className="field-error" role="alert">{errors.location}</p>}
          <p className="field-help">Staff receive the exact pin. Choose below whether your tracking page receives an approximate pin, the exact pin, or no location.</p>
        </section>

        <section className="form-card" aria-labelledby="evidence-heading">
          <div className="section-heading">
            <span className="step-number">02</span>
            <div>
              <h2 id="evidence-heading">Add photo evidence</h2>
              <p>A clear photo helps staff understand what needs attention.</p>
            </div>
          </div>
          <div className="field">
            <label htmlFor="incident-photo">Incident photo <span aria-hidden="true">*</span></label>
            <label className={`file-picker ${photo ? "file-picker--selected" : ""}`} htmlFor="incident-photo">
              <CameraIcon />
              <span>{phase === "processing" ? "Preparing photo…" : photo ? "Choose a different photo" : "Choose a photo"}</span>
              <small>JPEG, PNG, or WebP</small>
            </label>
            <input ref={fileInput} id="incident-photo" className="visually-hidden file-input" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} aria-required="true" aria-describedby={`photo-help${errors.photo ? " photo-error" : ""}`} />
            <p id="photo-help" className="field-help">Your photo is resized and converted to JPEG before upload. The new file does not retain EXIF metadata.</p>
            {errors.photo && <p id="photo-error" className="field-error" role="alert">{errors.photo}</p>}
          </div>
          {previewUrl && (
            <div className="photo-preview">
              {/* The preview is a local object URL, not a remotely optimizable image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview of the incident photo to be uploaded" />
              <div className="photo-preview__details">
                <span>Ready to upload · JPEG · {formatFileSize(photo.size)}</span>
                <button className="text-button" type="button" onClick={removePhoto}>Remove photo</button>
              </div>
            </div>
          )}
        </section>

        <section className="form-card" aria-labelledby="privacy-heading">
          <div className="section-heading">
            <span className="step-number">03</span>
            <div>
              <h2 id="privacy-heading">Choose your privacy options</h2>
              <p>These choices control public tracking and stored evidence. Staff can still assess the exact report.</p>
            </div>
          </div>
          <fieldset className="privacy-choice">
            <legend>Location on your tracking page</legend>
            <label className="choice-card">
              <input type="radio" name="locationVisibility" value="approximate" checked={locationVisibility === "approximate"} onChange={(event) => setLocationVisibility(event.target.value)} />
              <span><strong>Approximate area</strong><small>Round coordinates to about 1 km. Staff still receive the exact pin.</small></span>
            </label>
            <label className="choice-card">
              <input type="radio" name="locationVisibility" value="exact" checked={locationVisibility === "exact"} onChange={(event) => setLocationVisibility(event.target.value)} />
              <span><strong>Exact pin</strong><small>Anyone with your tracking code can view the exact coordinates.</small></span>
            </label>
            <label className="choice-card">
              <input type="radio" name="locationVisibility" value="staff" checked={locationVisibility === "staff"} onChange={(event) => setLocationVisibility(event.target.value)} />
              <span><strong>Staff only</strong><small>Your tracking page shows no location.</small></span>
            </label>
          </fieldset>
          <fieldset className="privacy-choice">
            <legend>Photo on your tracking page</legend>
            <label className="choice-card">
              <input type="radio" name="photoVisibility" value="staff" checked={photoVisibility === "staff"} onChange={(event) => setPhotoVisibility(event.target.value)} />
              <span><strong>Staff only</strong><small>The tracking response does not include the photo.</small></span>
            </label>
            <label className="choice-card">
              <input type="radio" name="photoVisibility" value="tracking" checked={photoVisibility === "tracking"} onChange={(event) => setPhotoVisibility(event.target.value)} />
              <span><strong>Include with tracking</strong><small>Anyone with your tracking code can view the photo.</small></span>
            </label>
          </fieldset>
          <div className="privacy-checks">
            <label className="check-control">
              <input type="checkbox" name="deleteEvidenceOnResolution" value="true" checked={deleteEvidenceOnResolution} onChange={(event) => setDeleteEvidenceOnResolution(event.target.checked)} />
              <span><strong>Delete evidence when resolved</strong><small>When staff mark the report fixed, delete the photo and exact location. Status history remains.</small></span>
            </label>
            <label className="check-control">
              <input type="checkbox" checked={saveOnDevice} onChange={(event) => setSaveOnDevice(event.target.checked)} />
              <span><strong>Save tracking code on this device</strong><small>Off by default. Saved codes are visible to other people using this browser and can be removed on the tracking page.</small></span>
            </label>
          </div>
        </section>

        <section className="form-card" aria-labelledby="details-heading">
          <div className="section-heading">
            <span className="step-number">04</span>
            <div>
              <h2 id="details-heading">Describe the issue</h2>
              <p>Choose a category and add any details that are safe to share.</p>
            </div>
          </div>
          <div className="field">
            <label htmlFor="incident-type">Issue type <span aria-hidden="true">*</span></label>
            <select id="incident-type" name="type" value={type} required aria-required="true" onChange={(event) => {
              setType(event.target.value);
              setErrors((current) => ({ ...current, type: "", form: "" }));
            }} aria-describedby={errors.type ? "type-error" : undefined}>
              <option value="">Choose an issue type</option>
              {REPORT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {errors.type && <p id="type-error" className="field-error" role="alert">{errors.type}</p>}
          </div>
          <div className="field">
            <div className="label-row">
              <label htmlFor="incident-description">Description <span className="optional">Optional</span></label>
              <span className="character-count">{description.length}/1000</span>
            </div>
            <textarea id="incident-description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={5} placeholder="What is wrong, and what should staff look for?" />
            <p className="field-help">Do not include names, contact details, or other private information.</p>
          </div>
        </section>

        <div className="submit-panel">
          <div>
            <h2>Ready to send?</h2>
            <p>No name, email, or account is required. A tracking code appears only after the service accepts the report.</p>
          </div>
          <button className="button button--primary button--submit" type="submit" disabled={busy}>
            {phase === "processing" ? "Preparing photo…" : phase === "submitting" ? "Sending report…" : "Send incident report"}
          </button>
        </div>
      </fieldset>
      <noscript><p className="error-banner">JavaScript is required to resize the photo and send this report.</p></noscript>
    </form>
  );
}
