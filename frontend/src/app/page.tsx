import { SystemStatus } from "@/components/SystemStatus";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium tracking-wide text-blue-800">SIH26051 · DRDO prototype</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
        Shelter Thermal Designer
      </h1>
      <p className="mt-3 text-lg text-slate-700">
        Area-Specific Thermal Analysis for Extreme Environments
      </p>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
        First-order estimation tool for comparing shelter envelope choices against
        location climate. Not CFD, EnergyPlus, or a certification model. Physics
        and recommendation engines are not wired in this build step (Phase 0).
      </p>

      <div className="mt-8">
        <SystemStatus />
      </div>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">This session</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Phase 0 only confirms that the browser can reach FastAPI. Location
          climate, shelter configuration, and the 24-hour RC simulation will
          appear in later phases. No sample heat-flow numbers are shown here.
        </p>
      </section>
    </main>
  );
}
