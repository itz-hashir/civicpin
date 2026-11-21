import Link from "next/link";
import HomeTrackForm from "@/components/HomeTrackForm";
import { ArrowIcon, CameraIcon, CheckIcon, PinIcon, SearchIcon } from "@/components/Icons";

export default function Home() {
  return (
    <main id="main-content" className="home-main">
      <section className="home-hero container" aria-labelledby="home-heading">
        <div className="home-hero__copy">
          <p className="eyebrow">Anonymous civic reporting</p>
          <h1 id="home-heading">A clear route from local issue to status update.</h1>
          <p className="hero-lede">Civicpin lets you document a problem on a map, attach photo evidence, and follow staff updates with a private code. No account required.</p>
          <div className="hero-actions">
            <Link href="/report" className="button button--primary">Report an issue <ArrowIcon /></Link>
            <Link href="/track" className="button button--secondary">Track a report</Link>
          </div>
          <ul className="hero-facts" aria-label="Reporting facts">
            <li><CheckIcon /> No name or email</li>
            <li><CheckIcon /> Photo metadata removed</li>
            <li><CheckIcon /> Private tracking code</li>
          </ul>
        </div>
        <div className="process-panel" aria-label="How incident reporting works">
          <div className="process-panel__top">
            <span className="process-panel__pin"><PinIcon /></span>
            <div><span>One report. Three clear steps.</span><strong>From evidence to update</strong></div>
          </div>
          <ol className="process-list">
            <li>
              <span className="process-icon"><PinIcon /></span>
              <div><span>01 · Locate</span><h2>Pin the issue</h2><p>Tap the map, use device location, or enter coordinates.</p></div>
            </li>
            <li>
              <span className="process-icon"><CameraIcon /></span>
              <div><span>02 · Document</span><h2>Add the evidence</h2><p>Choose a category and attach a clear incident photo.</p></div>
            </li>
            <li>
              <span className="process-icon"><SearchIcon /></span>
              <div><span>03 · Follow up</span><h2>Keep your code</h2><p>Return any time to view status notes and public evidence.</p></div>
            </li>
          </ol>
        </div>
      </section>

      <section className="home-track-section">
        <div className="container home-track-grid">
          <div>
            <p className="eyebrow">Already reported?</p>
            <h2>Check the latest status</h2>
            <p>Use the private code shown after a successful report. Anyone with the code can view the tracking page.</p>
          </div>
          <HomeTrackForm />
        </div>
      </section>

      <section className="container home-details" aria-labelledby="before-you-start-heading">
        <div className="section-title-row">
          <div><p className="eyebrow">Useful by design</p><h2 id="before-you-start-heading">Before you start</h2></div>
          <p>Three things make a report useful to the staff reviewing it.</p>
        </div>
        <div className="detail-feature-grid">
          <article><span>01</span><h3>A precise pin</h3><p>Move as close to the actual issue as you can. Always check the coordinates before sending.</p></article>
          <article><span>02</span><h3>A clear photo</h3><p>Show the problem in context while avoiding faces, documents, and other private details.</p></article>
          <article><span>03</span><h3>A short description</h3><p>Add safe, practical details that help staff identify what needs attention.</p></article>
        </div>
      </section>
    </main>
  );
}