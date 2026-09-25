import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

// Poll a function while the tab is visible. Like the old registerTask/scheduleTask helpers,
// timers stop when the tab is hidden and restart shortly after it becomes visible again.
// `delay` may be a function so callers can implement backoff.
export function usePolling(fn: (opts: { visibilityChange: boolean }) => void | Promise<void>, delay: number | (() => number), enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const delayRef = useRef(delay);
  delayRef.current = delay;

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let lastVisChange = 0;
    let stopped = false;

    const nextDelay = () => (typeof delayRef.current === "function" ? delayRef.current() : delayRef.current);
    const run = async (visibilityChange = false) => {
      clearTimeout(timer);
      try {
        await fnRef.current({ visibilityChange });
      } catch (err) {
        console.log("polling task failed", err);
      }
      if (!stopped && !document.hidden) timer = window.setTimeout(() => run(), nextDelay());
    };
    const onVisibility = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      // if the tab was only briefly in the background, wait a moment before refreshing
      const delayMs = Date.now() - lastVisChange < 20_000 ? 2000 : 50;
      lastVisChange = Date.now();
      timer = window.setTimeout(() => run(true), delayMs);
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) run(true);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}

export async function fetchJson<T = unknown>(url: string, timeoutMs = 15000, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), ...init });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

// close a popover on Escape or a click outside of `refs` while it is open
export function useDismiss(open: boolean, close: () => void, ...refs: RefObject<HTMLElement | null>[]) {
  const closeRef = useRef(close);
  closeRef.current = close;
  // (a layout effect, so the listeners are in place right after the popover renders)
  useLayoutEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !refs.some((r) => r.current?.contains(e.target as Node)) && closeRef.current();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    mql.addEventListener("change", handler);
    handler();
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

// compare the external IP of the browser with the one of the feeder
export function useIpMismatch(enabled = true) {
  const [state, setState] = useState<"unknown" | "match" | "mismatch">("unknown");
  useEffect(() => {
    if (!enabled) return;
    let browserIp: string | null = null;
    let feederIp: string | null = null;
    const compare = () => {
      if (browserIp == null || feederIp == null) return;
      setState(browserIp === feederIp ? "match" : "mismatch");
    };
    fetchJson<{ ip: string }>("https://api.ipify.org?format=json")
      .then((d) => {
        browserIp = d.ip;
        compare();
      })
      .catch(() => {});
    fetchJson<{ feeder_ip: string }>("/api/ip_info")
      .then((d) => {
        feederIp = d.feeder_ip;
        compare();
      })
      .catch(() => {});
  }, [enabled]);
  return state;
}
