import UtahRoadsDashboard from "./components/UtahRoadsDashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-6">
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900/70 backdrop-blur shadow-sm p-5">
            <h1 className="text-2xl font-semibold tracking-tight">Utah Roads Dashboard</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Live UDOT + NPS view · I-15 · I-70 · US-191 · SR-313 · SR-24 · SR-12 · SR-63 · US-89 · SR-9
            </p>
          </div>
        </header>
        <UtahRoadsDashboard />
      </div>
    </main>
  );
}
