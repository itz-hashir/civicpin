export const STORAGE_KEY = "civicpin.reports.v1";
const MAX_SAVED = 8;

export function readSavedReports() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item?.code === "string" && item.code).slice(0, MAX_SAVED);
  } catch {
    return [];
  }
}

export function saveReportLocally({ code, type }) {
  try {
    const next = [{ code, type, savedAt: new Date().toISOString() }];
    for (const report of readSavedReports()) {
      if (report.code !== code && next.length < MAX_SAVED) next.push(report);
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function removeSavedReport(code) {
  try {
    const next = readSavedReports().filter((report) => report.code !== code);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedReports() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy failed");
}
