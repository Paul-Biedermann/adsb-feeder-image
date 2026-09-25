import { Power, TerminalSquare } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SkyLoader } from "../components/Layout";
import { cx } from "../components/ui";
import { getGlobal, isNonAdsb } from "../lib/data";

function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-neutral-200),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,var(--color-neutral-900),transparent_60%)]" />
      <div className="relative w-full">{children}</div>
    </div>
  );
}

const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return seconds;
}

const extraArgsFromQuery = () => {
  const target = new URLSearchParams(window.location.search).get("m");
  return target ? `?m=${target}` : "";
};

async function getRestartState(timeoutMs: number): Promise<string | null> {
  try {
    const response = await fetch("/restart", { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (!response.ok) return null;
    return await response.text();
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") return "timeout";
    return null;
  }
}

// polls /restart until onState returns false; returns a cleanup function
function pollRestartState(onState: (state: string | null) => boolean) {
  // wait_restart in the backend waits 0.9s, so the timeout starts a bit longer than that and
  // increases automatically if the round trip is slow
  let httpTimeout = 1000;
  let timer: number | undefined;
  let cancelled = false;
  const check = async () => {
    if (cancelled) return;
    const state = await getRestartState(httpTimeout);
    if (cancelled) return;
    if (state === "timeout") {
      httpTimeout = Math.min(10000, httpTimeout * 1.5);
      return check();
    }
    if (!onState(state)) return;
    // the main app already waited while busy; everything else answers right away
    timer = window.setTimeout(check, state === "busy" ? 0 : 1000);
  };
  check();
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

// shown while the backend applies settings / restarts containers / updates (restarting.html)
export function Restarting({ data }: { data: { extraArgs?: string } }) {
  const g = getGlobal();
  const extraArgs = data.extraArgs ?? "";
  const seconds = useElapsedSeconds();
  const [phase, setPhase] = useState<"contacting" | "applying" | "updating" | "reconnecting">("contacting");
  const [showLog, setShowLog] = useState(true);
  const lines = useLogStream(showLog);

  useEffect(() => {
    return pollRestartState((state) => {
      if (state === "done") {
        window.location.replace(`/${extraArgs}`);
        return false;
      }
      if (state === "busy") {
        setPhase("applying");
      } else if (state === "stream-log") {
        // the feeder update replaced the web UI with waiting-app.py
        setPhase("updating");
      } else {
        // "exiting", errors or unexpected responses: the server may be restarting, keep waiting
        setPhase((p) => (p === "updating" ? p : "reconnecting"));
      }
      return true;
    });
  }, [extraArgs]);

  const phaseLabel = {
    contacting: "Contacting the feeder…",
    applying: "Applying your changes…",
    updating: "Installing the update…",
    reconnecting: "Waiting for the feeder to come back…",
  }[phase];
  const what = isNonAdsb(g) ? "SDR" : "ADS-B";

  return (
    <Backdrop>
      <div className="isolate mx-auto flex max-w-md animate-pop-in flex-col items-center text-center">
        <SkyLoader
          progress
          className={cx("transition-all duration-500", showLog ? "w-56 sm:w-72" : "w-72 sm:w-96")}
          skyClassName={cx("shadow-xl shadow-neutral-900/5 dark:shadow-black/40", showLog ? "h-32 sm:h-40" : "h-44 sm:h-56")}
          scale={showLog ? 1 : 1.25}
        />
        <h1 className="mt-8 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {phase === "updating" ? "Updating" : "Restarting"} the {what} Feeder
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">You'll be taken back automatically once the feeder is ready.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white py-1.5 pr-3 pl-3.5 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300" aria-live="polite">
            <span className="size-2 rounded-full bg-emerald-500" />
            {phaseLabel}
            <span className="border-l border-neutral-200 pl-2.5 font-mono text-neutral-400 tabular-nums dark:border-neutral-700">{formatElapsed(seconds)}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowLog(!showLog)}
            aria-expanded={showLog}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <TerminalSquare className="size-3.5" />
            {showLog ? "Hide log" : "Show log"}
          </button>
        </div>
        <p className={cx("mt-4 max-w-sm text-xs text-neutral-400 transition-opacity duration-700", seconds < 45 && "opacity-0")} aria-hidden={seconds < 45}>
          This can take a few minutes on slower boards or when containers need to be updated. It's safe to keep this page open.
        </p>
      </div>
      {showLog && (
        <div className="mx-auto mt-6 w-full max-w-5xl animate-pop-in">
          <LogPanel lines={lines} className="h-[45vh]" />
        </div>
      )}
    </Backdrop>
  );
}

// tails /stream-log (main app and waiting-app); every (re)connect starts with the last 16 kB of
// the log again, so the buffer is replaced instead of appended after a reconnect
function useLogStream(enabled: boolean) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;
    // docker pulls can log hundreds of lines per second: collect them and render once per frame
    let pending: string[] = [];
    let replace = false;
    let frame = 0;
    const flush = () => {
      frame = 0;
      const add = pending;
      const fresh = replace;
      pending = [];
      replace = false;
      setLines((prev) => {
        const next = fresh ? add : prev.concat(add);
        return next.length > 4000 ? next.slice(-3000) : next;
      });
    };
    const source = new EventSource("/stream-log");
    source.onopen = () => {
      pending = [];
      replace = true;
    };
    source.onmessage = (e) => {
      pending.push(e.data);
      if (!frame) frame = requestAnimationFrame(flush);
    };
    return () => {
      source.close();
      cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return lines;
}

function LogPanel({ lines, seconds, className }: { lines: string[]; seconds?: number; className?: string }) {
  const logRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = logRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-left shadow-2xl shadow-neutral-900/20">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2.5 text-xs text-neutral-400">
        <TerminalSquare className="size-4" />
        Setup log
        <span className="ml-auto flex items-center gap-3">
          {seconds !== undefined && <span className="font-mono tabular-nums text-neutral-500">{formatElapsed(seconds)}</span>}
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> live
          </span>
        </span>
      </div>
      <div
        ref={logRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className={cx("overflow-auto p-4 font-mono text-[11px] leading-[1.55] whitespace-pre text-neutral-300 sm:text-xs", className)}
      >
        {lines.length === 0 ? <span className="text-neutral-500">Waiting for log output…</span> : lines.join("\n")}
      </div>
    </div>
  );
}

// streams the setup log while longer operations run (waiting.html, also used by waiting-app.py)
export function Waiting({ data }: { data: { title?: string } }) {
  const seconds = useElapsedSeconds();
  const lines = useLogStream(true);

  useEffect(() => {
    const extraArgs = extraArgsFromQuery();
    return pollRestartState((state) => {
      if (state === "done") {
        window.location.href = `/${extraArgs}`;
        return false;
      }
      return true;
    });
  }, []);

  return (
    <Backdrop>
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex animate-pop-in items-center gap-4">
          <SkyLoader className="w-24 shrink-0 sm:w-28" skyClassName="h-14 sm:h-16" scale={0.5} />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl dark:text-white">{data.title || "The feeder is performing requested actions"}</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Please be patient – this could take several minutes. This page continues automatically.</p>
          </div>
        </div>
        <LogPanel lines={lines} seconds={seconds} className="h-[65vh]" />
      </div>
    </Backdrop>
  );
}

export function Shutdown() {
  const g = getGlobal();
  return (
    <Backdrop>
      <div className="mx-auto max-w-md text-center">
        <div className="card px-8 py-10">
          <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            <Power className="size-7" />
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight text-neutral-900 dark:text-white">Shutting down the {isNonAdsb(g) ? "SDR" : "ADS-B"} Feeder system</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Not all SBCs will be able to turn off, so please wait for about 30 seconds and if necessary just pull the power.</p>
        </div>
      </div>
    </Backdrop>
  );
}
