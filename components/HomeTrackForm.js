"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "./Icons";

export default function HomeTrackForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function submit(event) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (normalized) router.push(`/track?code=${encodeURIComponent(normalized)}`);
  }

  return (
    <form className="home-track-form" onSubmit={submit}>
      <label htmlFor="home-tracking-code">Tracking code</label>
      <div className="inline-form">
        <div className="input-with-icon">
          <SearchIcon />
          <input
            id="home-tracking-code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Enter your private code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={64}
            required
          />
        </div>
        <button className="button button--secondary" type="submit">Track report</button>
      </div>
    </form>
  );
}
