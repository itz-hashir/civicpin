import ReportForm from "@/components/ReportForm";

export const metadata = {
  title: "Report an issue | Civicpin",
  description: "Pin a local issue, add photo evidence, and receive a private tracking code without creating an account.",
};

export default function ReportPage() {
  return (
    <main id="main-content" className="page-main report-page">
      <div className="container">
        <header className="page-intro page-intro--split">
          <div>
            <p className="eyebrow">New incident report</p>
            <h1>Show what needs attention</h1>
          </div>
          <p>Place a pin, attach one clear photo, and choose an issue type. You will get a private tracking code after a successful submission.</p>
        </header>
        <div className="report-layout">
          <ReportForm />
          <aside className="report-aside" aria-labelledby="before-reporting-heading">
            <h2 id="before-reporting-heading">Before you report</h2>
            <ul className="plain-check-list">
              <li>Use a precise location so staff can find the issue.</li>
              <li>Keep people and private documents out of the photo where possible.</li>
              <li>Keep your tracking code private. It is the only lookup key.</li>
            </ul>
            <div className="aside-note">
              <strong>No account needed</strong>
              <p>Civicpin does not ask for your name, email address, or phone number in this form.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
