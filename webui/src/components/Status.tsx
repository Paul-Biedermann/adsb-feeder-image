import { CircleCheck, CircleQuestionMark, CircleX, Hourglass, OctagonAlert, PowerOff, TriangleAlert, Wifi } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./ui";

// status values reported by /api/status/<agg> for the beast (data) and mlat connections
export type FeedState = "good" | "disconnected" | "bad" | "warning" | "starting" | "container_down" | "unknown" | "disabled" | "";

export const feedStateInfo: Record<string, { icon: ReactNode; color: string; label: string }> = {
  good: { icon: <Wifi />, color: "text-emerald-500", label: "connected" },
  disconnected: { icon: <CircleX />, color: "text-rose-500", label: "not connected" },
  bad: { icon: <OctagonAlert />, color: "text-rose-500", label: "sync errors" },
  warning: { icon: <TriangleAlert />, color: "text-amber-500", label: "intermittent / degraded" },
  starting: { icon: <Hourglass />, color: "text-neutral-400", label: "container starting" },
  container_down: { icon: <PowerOff />, color: "text-rose-500", label: "container down" },
  unknown: { icon: <CircleQuestionMark />, color: "text-neutral-400", label: "status unknown" },
};

export function FeedIcon({ state, loading }: { state?: FeedState; loading?: boolean }) {
  if (loading) return <CircleQuestionMark className="mx-auto size-[18px] animate-pulse text-neutral-300 dark:text-neutral-600" aria-label="loading" />;
  if (!state || state === "disabled") return <span className="text-neutral-300 dark:text-neutral-700">–</span>;
  const info = feedStateInfo[state] ?? feedStateInfo.unknown;
  return (
    <span className={cx("inline-flex justify-center [&>svg]:size-[18px]", info.color)} title={info.label}>
      {info.icon}
    </span>
  );
}

export type Summary = "good" | "starting" | "disconnected" | "degraded" | "enabled" | "loading";

export function summarize(beast?: FeedState, mlat?: FeedState): Summary {
  const ok = (s?: FeedState) => s === "good" || s === "unknown" || s === "disabled";
  if (beast === "good" && ok(mlat)) return "good";
  if (beast === "starting") return "starting";
  if (beast === "disconnected") return "disconnected";
  if (!ok(beast) || !ok(mlat)) return "degraded";
  return "enabled";
}

const summaryStyle: Record<Summary, { cls: string; label: string; icon: ReactNode }> = {
  good: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20", label: "Good", icon: <CircleCheck /> },
  starting: { cls: "bg-neutral-100 text-neutral-600 ring-neutral-500/15 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-400/15", label: "Starting", icon: <Hourglass /> },
  disconnected: { cls: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20", label: "Down", icon: <CircleX /> },
  degraded: { cls: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20", label: "Degraded", icon: <TriangleAlert /> },
  enabled: { cls: "bg-neutral-100 text-neutral-600 ring-neutral-500/15 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-400/15", label: "Enabled", icon: <CircleCheck /> },
  loading: { cls: "bg-neutral-100 text-neutral-400 ring-neutral-500/10 dark:bg-neutral-800/60 dark:text-neutral-500 dark:ring-neutral-400/10", label: "Checking", icon: <CircleQuestionMark /> },
};

export function SummaryPill({ summary, compact }: { summary: Summary; compact?: boolean }) {
  const s = summaryStyle[summary];
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset [&>svg]:size-3.5", compact ? "p-1" : "px-2 py-0.5 text-xs", s.cls, summary === "loading" && "animate-pulse")}
      title={summary === "enabled" ? "feed state is not supported" : s.label}
    >
      {s.icon}
      {!compact && s.label}
    </span>
  );
}
