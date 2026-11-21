import TrackReport from "@/components/TrackReport";

export const metadata = {
  title: "Track a report | Civicpin",
  description: "Use a private Civicpin tracking code to view an incident report status, updates, location, and public evidence.",
};

export default async function TrackPage({ searchParams }) {
  const params = await searchParams;
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const initialCode = typeof rawCode === "string" ? rawCode.slice(0, 64).toUpperCase() : "";
  return (
    <main id="main-content" className="page-main track-page">
      <div className="container container--narrow">
        <TrackReport initialCode={initialCode} />
      </div>
    </main>
  );
}
