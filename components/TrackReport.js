"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckIcon, SearchIcon } from "./Icons";
import {
  STATUSES,
  connectionError,
  formatDate,
  getCoordinates,
  osmUrl,
  readJson,
  statusLabel,
  typeLabel,
} from "./reportUtils";
import { clearSavedReports, readSavedReports, removeSavedReport } from "./trackingStorage";

function publicPhotoUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export default function TrackReport({ initialCode = "" }) {
  const [code, setCode] = useState(initialCode);
  const [loadedCode, setLoadedCode] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);
  const [liveAt, setLiveAt] = useState(null);
  const [live, setLive] = useState(true);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRecent(readSavedReports()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const lookup = useCallback(async (value, options = {}) => {
    const normalized = value.trim().toUpperCase();
    const silent = options?.silent === true;
    if (!normalized) {
      if (!silent) setError("Enter your tracking code.");
      return;
    }
    if (!navigator.onLine) {
      if (silent) setLive(false);
      else setError("You appear to be offline. Reconnect to check this report.");
      return;
    }

    if (!silent) {
      setCode(normalized);
      setLoadedCode(normalized);
      setLoading(true);
      setError("");
      setReport(null);
    }
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(normalized)}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const data = await readJson(response);
      if (!response.ok) {
        if (silent) {
          setLive(false);
        } else {
          setError(response.status === 404
            ? "No report matches that code. Check each letter and number, then try again."
            : data.error || "The report could not be loaded. Try again shortly.");
        }
        return;
      }
      setReport(data);
      setLive(true);
      setLiveAt(new Date());
    } catch {
      if (silent) setLive(false);
      else setError(connectionError("The reporting service could not be reached. Check your connection and try again."));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const normalized = initialCode.trim().toUpperCase();
    if (!normalized) return undefined;
    const frame = requestAnimationFrame(() => lookup(normalized));
    return () => cancelAnimationFrame(frame);
  }, [initialCode, lookup]);

  useEffect(() => {
    if (!loadedCode || !report) return undefined;
    let disposed = false;
    const refresh = () => {
      if (!disposed && document.visibilityState === "visible") lookup(loadedCode, { silent: true });
    };
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadedCode, report, lookup]);
  const inputPattern = "[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}";

  function submit(event) {
    event.preventDefault();
    lookup(code);
  }

  function removeCode(value) {
    if (removeSavedReport(value)) setRecent((current) => current.filter((item) => item.code !== value));
  }

  function removeAllCodes() {
    if (clearSavedReports()) setRecent([]);
  }

  const currentStatus = STATUSES.findIndex((status) => status.value === report?.status);
  const history = Array.isArray(report?.statusHistory)
    ? [...report.statusHistory].sort((a, b) => new Date(b?.changedAt || 0) - new Date(a?.changedAt || 0))
    : [];
  const coordinates = getCoordinates(report?.location);
  const photoUrl = publicPhotoUrl(report?.photoUrl);

  return (
    <div className="track-layout">
      <section className="lookup-card" aria-labelledby="lookup-heading">
        <p className="eyebrow">Private report lookup</p>
        <h1 id="lookup-heading">Track an incident report</h1>
        <p>Enter the code you received after submitting. No staff sign-in is needed.</p>
        <form onSubmit={submit} className="track-form">
          <label htmlFor="tracking-code">Tracking code</label>
          <div className="inline-form">
            <div className="input-with-icon">
              <SearchIcon />
              <input
                id="tracking-code"
                name="code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="Enter your private code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
                pattern={inputPattern}
                autoCorrect="off"
                required
                aria-describedby={error ? "tracking-error" : "tracking-privacy"}
              />
            </div>
            <button className="button button--primary" type="submit" disabled={loading}>
              {loading ? "Checking…" : "Check status"}
            </button>
          </div>
        </form>
        <p id="tracking-privacy" className="field-help">Treat the code like a password. Anyone who has it can view this report.</p>
        {error && <div id="tracking-error" className="error-banner" role="alert">{error}</div>}
      </section>

      {loading && (
        <div className="loading-panel" role="status">
          <span className="loading-dot" aria-hidden="true" /> Looking up {loadedCode}…
        </div>
      )}

      {report && !loading && (
        <article className="tracking-result" aria-labelledby="report-status-heading">
          <header className="tracking-result__header">
            <div>
              <p className="eyebrow">Report {loadedCode}</p>
              <h2 id="report-status-heading">{typeLabel(report.type)}</h2>
              <p>Submitted {formatDate(report.createdAt)}</p>
              {liveAt && (
                <p className={`tracking-live${live ? "" : " tracking-live--paused"}`}>
                  {live ? "Live" : "Live paused"} · checked at {liveAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
            <span className={`status-badge status-badge--${report.status || "submitted"}`}>{statusLabel(report.status)}</span>
          </header>

          <ol className="status-steps" aria-label="Report progress">
            {STATUSES.map((status, index) => {
              const complete = currentStatus >= index;
              const current = currentStatus === index;
              return (
                <li key={status.value} className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`} aria-current={current ? "step" : undefined}>
                  <span className="status-step__marker">{complete ? <CheckIcon /> : index + 1}</span>
                  <span>{status.label}</span>
                </li>
              );
            })}
          </ol>

          <div className="tracking-detail-grid">
            <section className="detail-card" aria-labelledby="history-heading">
              <div className="detail-card__heading">
                <h3 id="history-heading">Status history</h3>
                <button type="button" className="text-button" onClick={() => lookup(loadedCode)} disabled={loading}>Refresh</button>
              </div>
              {history.length ? (
                <ol className="timeline">
                  {history.map((entry, index) => (
                    <li key={`${entry?.changedAt || "update"}-${index}`}>
                      <span className={`timeline-dot timeline-dot--${entry?.status || "submitted"}`} aria-hidden="true" />
                      <div>
                        <strong>{statusLabel(entry?.status)}</strong>
                        <time dateTime={entry?.changedAt}>{formatDate(entry?.changedAt)}</time>
                        {entry?.note && <p>{entry.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty-detail">No status updates are available yet.</p>
              )}
            </section>

            <div className="evidence-column">
              <section className="detail-card" aria-labelledby="public-location-heading">
                <h3 id="public-location-heading">Reported location</h3>
                {report.evidenceRemoved ? (
                  <p className="empty-detail">The location was deleted when this report was resolved.</p>
                ) : coordinates ? (
                  <>
                    {report.locationPrecision === "approximate" && <p className="privacy-note">Approximate area, rounded by the reporter for privacy.</p>}
                    <p className="coordinates">{coordinates.lat.toFixed(report.locationPrecision === "approximate" ? 2 : 6)}, {coordinates.lng.toFixed(report.locationPrecision === "approximate" ? 2 : 6)}</p>
                    <a className="external-link" href={osmUrl(coordinates)} target="_blank" rel="noreferrer">
                      Open location in OpenStreetMap<span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                  </>
                ) : <p className="empty-detail">The reporter kept the exact location staff-only.</p>}
              </section>

              <section className="detail-card" aria-labelledby="public-evidence-heading">
                <h3 id="public-evidence-heading">Photo evidence</h3>
                {report.evidenceRemoved ? (
                  <p className="empty-detail">The photo was deleted when this report was resolved.</p>
                ) : photoUrl ? (
                  <>
                    <a className="evidence-image" href={photoUrl} target="_blank" rel="noreferrer" aria-label="Open full-size incident photo in a new tab">
                      {/* Blob storage URLs are supplied at runtime and are not configurable remote images. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl} alt="Evidence attached to this incident report" />
                    </a>
                    <a className="external-link" href={photoUrl} target="_blank" rel="noreferrer">Open full-size photo<span className="visually-hidden"> (opens in a new tab)</span></a>
                  </>
                ) : <p className="empty-detail">The reporter kept photo evidence staff-only.</p>}
              </section>
            </div>
          </div>
        </article>
      )}

      {!report && !loading && recent.length > 0 && (
        <section className="recent-reports" aria-labelledby="recent-heading">
          <div className="recent-reports__heading">
            <div>
              <h2 id="recent-heading">Saved on this device</h2>
              <p>Tracking codes saved in this browser appear here. Remove them when using a shared device.</p>
            </div>
            <button type="button" className="text-button" onClick={removeAllCodes}>Clear saved codes</button>
          </div>
          <ul>
            {recent.map((item) => (
              <li key={item.code}>
                <Link href={`/track?code=${encodeURIComponent(item.code)}`}>
                  <span><strong>{typeLabel(item.type)}</strong><code>{item.code}</code></span>
                  <span>View report</span>
                </Link>
                <button type="button" className="button button--secondary button--small" onClick={() => removeCode(item.code)} aria-label={`Remove saved code ${item.code}`}>Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
