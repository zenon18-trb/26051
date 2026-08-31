"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, LoaderCircle, Server } from "lucide-react";

import { ApiConfigError, fetchHealth } from "@/lib/api";

type Status = "checking" | "connected" | "unavailable" | "misconfigured";

export function SystemStatus() {
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState("Checking FastAPI…");

  const requestHealth = useCallback(async () => {
    try {
      const payload = await fetchHealth();
      setStatus("connected");
      setDetail(`Backend connected (${payload.service}).`);
    } catch (error) {
      if (error instanceof ApiConfigError) {
        setStatus("misconfigured");
        setDetail(error.message);
        return;
      }
      setStatus("unavailable");
      setDetail(
        "Backend unavailable. Make sure the FastAPI server is running on the URL in NEXT_PUBLIC_API_BASE_URL.",
      );
    }
  }, []);

  useEffect(() => {
    void requestHealth();
  }, [requestHealth]);

  function handleCheckAgain() {
    setStatus("checking");
    setDetail("Checking FastAPI…");
    void requestHealth();
  }

  return (
    <section
      aria-labelledby="system-status-heading"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="system-status-heading" className="text-sm font-semibold text-slate-900">
            System status
          </h2>
          <p className="mt-1 text-sm text-slate-600">Live check of GET /api/health</p>
        </div>
        <Server className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
      </div>

      <p
        className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-900"
        role="status"
        aria-live="polite"
      >
        <StatusMark status={status} />
        <span>{statusLabel(status)}</span>
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>

      {status !== "checking" && status !== "misconfigured" ? (
        <button
          type="button"
          onClick={handleCheckAgain}
          className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Check again
        </button>
      ) : null}
    </section>
  );
}

function statusLabel(status: Status): string {
  switch (status) {
    case "checking":
      return "Checking";
    case "connected":
      return "Backend Connected";
    case "unavailable":
      return "Backend Unavailable";
    case "misconfigured":
      return "Frontend configuration error";
  }
}

function StatusMark({ status }: { status: Status }) {
  if (status === "checking") {
    return <LoaderCircle className="h-4 w-4 animate-spin text-blue-700" aria-hidden />;
  }
  if (status === "connected") {
    return (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600"
        aria-hidden
      />
    );
  }
  return <CircleAlert className="h-4 w-5 text-amber-700" aria-hidden />;
}
