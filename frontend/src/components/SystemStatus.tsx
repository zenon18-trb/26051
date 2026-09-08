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
    const timer = window.setTimeout(() => {
      void requestHealth();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestHealth]);

  function handleCheckAgain() {
    setStatus("checking");
    setDetail("Checking FastAPI…");
    void requestHealth();
  }

  const chipTone =
    status === "connected" ? "pass" : status === "checking" ? "warn" : "fail";

  return (
    <section aria-labelledby="system-status-heading" className="status-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="system-status-heading">System status</h2>
          <p>Live check of GET /api/health</p>
        </div>
        <Server aria-hidden />
      </div>

      <p className="status-line" role="status" aria-live="polite">
        {status === "checking" ? (
          <LoaderCircle className="spin" aria-hidden />
        ) : status === "connected" ? null : (
          <CircleAlert aria-hidden />
        )}
        <span className={`v-chip v-chip-${chipTone}`}>
          <span className="v-chip-dot" />
          {statusLabel(status)}
        </span>
      </p>
      <p className="status-detail">{detail}</p>

      {status !== "checking" && status !== "misconfigured" ? (
        <button type="button" onClick={handleCheckAgain} className="btn-square btn-square-ghost">
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
