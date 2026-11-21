import Link from "next/link";
import { PinIcon } from "./Icons";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand" aria-label="Civicpin home">
          <span className="brand__mark"><PinIcon /></span>
          <span>Civicpin</span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/report">Report an issue</Link>
          <Link href="/track">Track a report</Link>
          <Link href="/login">Staff sign in</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>Civicpin · Anonymous civic reporting</p>
        <p>No account required for public reports.</p>
      </div>
    </footer>
  );
}
