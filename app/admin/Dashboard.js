"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  REPORT_TYPES,
  STATUSES,
  connectionError,
  formatDate,
  getCoordinates,
  osmUrl,
  readJson,
  statusLabel,
  typeLabel,
} from "@/components/reportUtils";

export default function Dashboard({ email, types = [] }) {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState({});
  const [actionPending, setActionPending] = useState(null);
  const [actionErrors, setActionErrors] = useState({});
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [live, setLive] = useState(true);
  const [syncedAt, setSyncedAt] = useState(null);

  const load = useCallback(async (options = {}) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await fetch("/api/admin/reports", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const json = await readJson(response);
      if (!response.ok) {
        setLive(false);
        setError(json.error || "Reports could not be loaded. Any existing list may be out of date.");
        return;
      }
      if (!Array.isArray(json.reports)) {
        setLive(false);
        setError("The service returned an unexpected report list. Refresh to try again.");
        return;
      }
      setReports(json.reports);
      setLive(true);
      setSyncedAt(new Date());
      setError("");
    } catch {
      setLive(false);
      setError(connectionError("The report queue could not be refreshed. Any existing list may be out of date."));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && actionPending === null) load({ silent: true });
    };
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, actionPending]);

  const visibleReports = useMemo(
    () => filter ? reports.filter((report) => report.status === filter) : reports,
    [filter, reports],
  );

  const statusCounts = useMemo(() => Object.fromEntries(
    STATUSES.map((status) => [status.value, reports.filter((report) => report.status === status.value).length]),
  ), [reports]);

  const typeCounts = useMemo(() => {
    const counts = Object.fromEntries(REPORT_TYPES.map((type) => [type.value, 0]));
    for (const report of reports) counts[report.type] = (counts[report.type] || 0) + 1;
    return counts;
  }, [reports]);

  async function setStatus(id, status) {
    setActionPending({ id, status });
    setNotice("");
    setError("");
    setActionErrors((current) => ({ ...current, [id]: "" }));
    try {
      const response = await fetch(`/api/admin/reports/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status, note: notes[id] || "" }),
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const json = await readJson(response);
      if (!response.ok) {
        setActionErrors((current) => ({ ...current, [id]: json.error || "The status could not be updated. Try again." }));
        return;
      }
      setNotes((current) => ({ ...current, [id]: "" }));
      setNotice(`Report status changed to ${statusLabel(status)}. Refreshing the queue…`);
      await load();
      setNotice(`Report status changed to ${statusLabel(status)}.`);
    } catch {
      setActionErrors((current) => ({
        ...current,
        [id]: connectionError("The update was not confirmed. Check the connection and refresh before trying again."),
      }));
    } finally {
      setActionPending(null);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/staff/logout", { method: "POST" });
      if (!response.ok) {
        setLogoutError("Sign out failed. Try again.");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setLogoutError(connectionError("The sign-out service could not be reached."));
    } finally {
      setLoggingOut(false);
    }
  }

  const assignedContext = Array.isArray(types) && types.length
    ? types.includes("all") ? "Assigned scope: all report types" : `Assigned scope: ${types.map(typeLabel).join(", ")}`
    : "Showing reports available to your staff account";

  return (
    <main id="main-content" className="page-main dashboard-page">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">Staff workspace</p>
            <h1>Incident report queue</h1>
            <p>{assignedContext}</p>
          </div>
          <div className="account-controls">
            <span>Signed in as <strong>{email}</strong></span>
            <button type="button" onClick={logout} className="button button--secondary button--small" disabled={loggingOut}>
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>
        {logoutError && <div className="error-banner" role="alert">{logoutError}</div>}

        <section className="status-summary" aria-label="Status summary">
          {STATUSES.map((status) => (
            <article key={status.value} className={`summary-card summary-card--${status.value}`}>
              <span>{status.label}</span>
              <strong>{statusCounts[status.value]}</strong>
              <small>{statusCounts[status.value] === 1 ? "report" : "reports"} in this queue</small>
            </article>
          ))}
        </section>

        <section className="type-summary" aria-labelledby="type-summary-heading">
          <div><h2 id="type-summary-heading">Reports by type</h2><span>{reports.length} loaded</span></div>
          <ul>
            {REPORT_TYPES.map((type) => <li key={type.value}><span>{type.label}</span><strong>{typeCounts[type.value] || 0}</strong></li>)}
          </ul>
        </section>

        <div className="dashboard-toolbar">
          <div className="filter-control">
            <label htmlFor="status-filter">Filter by status</label>
            <select id="status-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
          <div className="queue-controls">
            <span aria-live="polite">Showing {visibleReports.length} of {reports.length}</span>
            <span className={`tracking-live${live ? "" : " tracking-live--paused"}`} title="This queue refreshes automatically every 5 seconds while the tab is visible">
              {live ? "Live" : "Live paused"}{syncedAt ? ` · ${syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
            </span>
            <button type="button" onClick={() => load()} className="button button--secondary button--small" disabled={loading || actionPending !== null}>
              {loading ? "Refreshing…" : "Refresh queue"}
            </button>
          </div>
        </div>

        {notice && <div className="success-banner" role="status">{notice}</div>}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {loading && reports.length === 0 && <div className="loading-panel" role="status"><span className="loading-dot" aria-hidden="true" /> Loading assigned reports…</div>}
        {!loading && !error && reports.length === 0 && (
          <div className="empty-state"><h2>No reports in your queue</h2><p>Refresh later to check for newly submitted incidents.</p></div>
        )}
        {!loading && reports.length > 0 && visibleReports.length === 0 && (
          <div className="empty-state"><h2>No reports match this filter</h2><p>Choose All statuses to return to the full loaded queue.</p></div>
        )}

        {visibleReports.length > 0 && (
          <div className={`report-table-wrap ${loading ? "is-refreshing" : ""}`} aria-busy={loading}>
            <table className="report-table">
              <caption className="visually-hidden">Incident reports available to this staff account</caption>
              <thead>
                <tr>
                  <th scope="col">Report</th>
                  <th scope="col">Type</th>
                  <th scope="col">Description</th>
                  <th scope="col">Evidence</th>
                  <th scope="col">Location</th>
                  <th scope="col">Status</th>
                  <th scope="col">Update</th>
                </tr>
              </thead>
              <tbody>
                {visibleReports.map((report) => {
                  const coordinates = getCoordinates(report.location);
                  const pending = actionPending?.id === report._id;
                  const anyPending = actionPending !== null;
                  return (
                    <tr key={report._id}>
                      <td data-label="Report">
                        <time dateTime={report.createdAt}>{formatDate(report.createdAt)}</time>
                        {report.trackingCode && <code className="staff-code">{report.trackingCode}</code>}
                      </td>
                      <td data-label="Type"><strong>{typeLabel(report.type)}</strong></td>
                      <td data-label="Description"><p className="report-description">{report.description || "No description provided."}</p></td>
                      <td data-label="Evidence">
                        {report.photoUrl ? (
                          <a href={report.photoUrl} target="_blank" rel="noreferrer" className="external-link">Open photo<span className="visually-hidden"> for report {report.trackingCode || report._id} (opens in a new tab)</span></a>
                        ) : <span className="muted">Not available</span>}
                      </td>
                      <td data-label="Location">
                        {coordinates ? (
                          <a href={osmUrl(coordinates)} target="_blank" rel="noreferrer" className="external-link">Open OSM map<span className="visually-hidden"> for report {report.trackingCode || report._id} (opens in a new tab)</span></a>
                        ) : <span className="muted">Not available</span>}
                      </td>
                      <td data-label="Status"><span className={`status-badge status-badge--${report.status || "submitted"}`}>{statusLabel(report.status)}</span></td>
                      <td data-label="Update" className="actions-cell">
                        {report.status !== "fixed" ? (
                          <div className="status-update-form">
                            <label htmlFor={`note-${report._id}`}>Status note <span className="optional">Optional</span></label>
                            <textarea
                              id={`note-${report._id}`}
                              rows={2}
                              maxLength={300}
                              value={notes[report._id] || ""}
                              onChange={(event) => setNotes((current) => ({ ...current, [report._id]: event.target.value }))}
                              placeholder="Add a public progress note"
                              disabled={anyPending}
                              aria-describedby={`note-help-${report._id}${actionErrors[report._id] ? ` note-error-${report._id}` : ""}`}
                            />
                            <p id={`note-help-${report._id}`} className="note-help">Notes appear in report history. Do not include private staff information.</p>
                            <div className="status-actions">
                              {report.status !== "in_progress" && (
                                <button type="button" className="button button--secondary button--small" disabled={anyPending} onClick={() => setStatus(report._id, "in_progress")}>
                                  {pending && actionPending.status === "in_progress" ? "Saving…" : "Mark in progress"}
                                </button>
                              )}
                              <button type="button" className="button button--primary button--small" disabled={anyPending} onClick={() => setStatus(report._id, "fixed")}>
                                {pending && actionPending.status === "fixed" ? "Saving…" : "Mark fixed"}
                              </button>
                            </div>
                          </div>
                        ) : <p className="completed-note">No further status actions.</p>}
                        {actionErrors[report._id] && <p id={`note-error-${report._id}`} className="field-error" role="alert">{actionErrors[report._id]}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="dashboard-footnote">This view shows the reports returned for your account. Status updates and notes are saved by the reporting service.</p>
      </div>
    </main>
  );
}