"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectionError, readJson } from "@/components/reportUtils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!navigator.onLine) {
      setError("You appear to be offline. Reconnect before signing in.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await readJson(response);
      if (!response.ok) {
        setError(json.error || "Sign in failed. Check your details and try again.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError(connectionError("The sign-in service could not be reached. Try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="page-main login-page">
      <div className="login-layout">
        <section className="login-intro" aria-labelledby="staff-heading">
          <p className="eyebrow">Authorized staff</p>
          <h1 id="staff-heading">Incident response, in one workspace.</h1>
          <p>Sign in to review reports available to your staff account, assess photo evidence, and record status notes.</p>
          <ul className="plain-check-list">
            <li>Filter the assigned report queue.</li>
            <li>Open evidence and OpenStreetMap locations.</li>
            <li>Add a note whenever a status changes.</li>
          </ul>
        </section>
        <section className="login-card" aria-labelledby="login-heading">
          <h2 id="login-heading">Staff sign in</h2>
          <p>Use your staff account credentials.</p>
          {error && <div id="login-error" className="error-banner" role="alert">{error}</div>}
          <form onSubmit={handleSubmit} className="login-form" aria-busy={loading}>
            <div className="field">
              <label htmlFor="staff-email">Email address</label>
              <input
                id="staff-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                inputMode="email"
                required
                disabled={loading}
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>
            <div className="field">
              <label htmlFor="staff-password">Password</label>
              <div className="password-field">
                <input
                  id="staff-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  aria-describedby={error ? "login-error" : undefined}
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="button button--primary button--full">
              {loading ? "Signing in…" : "Sign in to dashboard"}
            </button>
          </form>
          <p className="public-route-note">Need to report an issue instead? <Link href="/report">Use the public form</Link>.</p>
        </section>
      </div>
    </main>
  );
}