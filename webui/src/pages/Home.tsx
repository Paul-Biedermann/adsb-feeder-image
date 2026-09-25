import { ArrowUpRight, ChartColumn, ChevronDown, CircleCheck, Ellipsis, Network, RadioReceiver, RefreshCw, Rocket, Share2 } from "lucide-react";
import { memo, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PostForm } from "../components/form";
import { LineChart, seriesColors, linePath } from "../components/LineChart";
import { type FeedState, FeedIcon, feedStateInfo, type Summary, summarize, SummaryPill } from "../components/Status";
import { Alert, Badge, Card, CardBody, CardHeader, Collapsible, cx, EmptyState, LinkButton, SubmitButton } from "../components/ui";
import { getGlobal, isMicroOrNano, productName, siteName } from "../lib/data";
import { fetchJson, useDismiss, useIpMismatch, useMediaQuery, usePolling } from "../lib/hooks";

type Site = {
  idx: number;
  name: string;
  lat: string;
  lon: string;
  mfIp: string;
  uat978: boolean;
  adsblol: boolean;
  adsbx: boolean;
  alive: boolean;
  flightradar: boolean;
  flightaware: boolean;
  planefinder: boolean;
  mlatPrivacy: boolean;
};

type Aggregator = { agg: string; name: string; map: string; status: string[]; table: number; enabled: boolean[] };

export interface HomeData {
  dnsState: boolean;
  ipv6Broken: boolean;
  composeUpFailed: boolean;
  underVoltage: boolean;
  pi5UsbCurrentLimited: boolean;
  healthcheckFailReason: string;
  lowDisk: boolean;
  localAddress: string;
  tailscaleAddress: string;
  zerotierAddress: string;
  adsb: boolean;
  stage2Suggestion: boolean;
  channel: string;
  acarsAggregatorsChosen: boolean;
  aisAggregatorsChosen: boolean;
  siteIndices: number[];
  sites: Site[];
  aggregators: Aggregator[];
  aggTables: number[];
  matrix: number[];
}

type MfStat = { nosdr?: number; pps: number; mps: number; planes: number; tplanes: number; uptime: number };
type AggState = { beast: FeedState; mlat: FeedState; adsblollink?: string | string[]; alivemaplink?: string | string[]; adsbxfeederid?: string };
// "<agg>-<site idx>" -> the last reported state; null once the aggregator answered without an
// entry for that site (or failed); no key at all while its status is being loaded
type StatusMap = Record<string, AggState | null>;

const statusSummary = (status: StatusMap, key: string): Summary => {
  if (!(key in status)) return "loading";
  const st = status[key];
  return st ? summarize(st.beast, st.mlat) : "enabled";
};
type ImStatus = { latest_tag?: string; latest_date?: string; advice?: string; show_update?: string; beta_changelog?: string; main_changelog?: string };

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";

/* ------------------------------------------------------------ stats */

function mfTone(s?: MfStat): "good" | "warn" | "bad" | "nosdr" | "loading" {
  if (!s) return "loading";
  if (s.nosdr === 1) return "nosdr";
  if (s.pps > 0) return "good";
  if (s.uptime > 60) return "warn";
  return "bad";
}

const toneText = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-rose-600 dark:text-rose-400",
  nosdr: "text-rose-600 dark:text-rose-400",
  loading: "text-neutral-400",
};

function MfStatusCell({ stat }: { stat?: MfStat }) {
  const tone = mfTone(stat);
  if (tone === "loading") return <span className="text-neutral-400">…</span>;
  if (tone === "nosdr")
    return (
      <span className={toneText.bad}>
        no SDR configured · <a href="/sdr_setup">SDR Setup</a>
      </span>
    );
  return (
    <span className={cx("text-xs tabular-nums", toneText[tone])} title={tone === "good" ? "receiving data (plane total since midnight UTC)" : tone === "warn" ? "receiving unusually little data" : "not receiving any data"}>
      {stat!.pps} pos / {stat!.mps} msg per sec
      <br />
      {stat!.planes} planes / {stat!.tplanes} today
    </span>
  );
}

const toneDot = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  nosdr: "bg-rose-500",
  loading: "bg-neutral-300 dark:bg-neutral-600",
};

const toneLabel = { good: "Receiving data", warn: "Little data", bad: "No data", nosdr: "No SDR", loading: "Checking…" };

const fmt = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString();

// small trend chart for a stat tile: fitted to its own min / max (labelled on the right so the
// scale is readable), the covered time span underneath, the change over the window next to it
// and a crosshair readout on hover (no change % for daily totals: today is still a partial day)
function Sparkline({ values, labels, span, delta: showDelta = true }: { values: number[]; labels: string[]; span: [string, string]; delta?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  if (n < 2) return <div className="flex h-[3.25rem] items-center text-[11px] text-neutral-400 dark:text-neutral-500">collecting data…</div>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, max * 0.05, 1);
  const lo = Math.max(0, min - (range - (max - min)) / 2);
  const H = 36;
  const y = (v: number) => H - 2 - ((v - lo) / range) * (H - 4);
  const x = (i: number) => (i / (n - 1)) * 100;
  const pts = values.map((v, i) => [x(i), y(v)] as const);
  const line = linePath(pts);
  const first = values[0];
  const last = values[n - 1];
  const delta = first > 0 ? ((last - first) / first) * 100 : 0;
  const trend = Math.abs(delta) < 1 ? "flat" : delta > 0 ? "up" : "down";
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const hi = hover ?? n - 1;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-stretch gap-1.5">
        <div className="relative min-w-0 flex-1 cursor-crosshair touch-pan-y" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-9 w-full overflow-visible" style={{ color: "var(--chart-1)" }} aria-hidden>
            <line x1={0} x2={100} y1={y(max)} y2={y(max)} className="stroke-neutral-100 dark:stroke-neutral-800" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            <line x1={0} x2={100} y1={y(min)} y2={y(min)} className="stroke-neutral-100 dark:stroke-neutral-800" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            <path d={`${line}L100,${H}L0,${H}Z`} fill="currentColor" opacity={0.08} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="stroke-neutral-300 dark:stroke-neutral-600" vectorEffect="non-scaling-stroke" />}
          </svg>
          {/* the dot is html so it stays round despite the stretched svg */}
          <span
            className="pointer-events-none absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-surface-dark"
            style={{
              left: `${x(hi)}%`,
              top: `${(y(values[hi]) / H) * 100}%`,
              background: "var(--chart-1)",
            }}
          />
          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-7 z-10 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[11px] whitespace-nowrap shadow-md dark:border-neutral-700 dark:bg-neutral-900"
              style={{
                left: `${x(hover)}%`,
                transform: `translateX(${x(hover) > 60 ? "-100%" : x(hover) < 40 ? "0" : "-50%"})`,
              }}
            >
              <span className="font-semibold text-neutral-900 tabular-nums dark:text-white">{fmt(values[hover])}</span>
              <span className="text-neutral-500 dark:text-neutral-400"> · {labels[hover]}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between text-right text-[10px] leading-none text-neutral-400 tabular-nums dark:text-neutral-500" aria-hidden>
          <span title="highest in this window">{fmt(max)}</span>
          <span title="lowest in this window">{fmt(min)}</span>
        </div>
      </div>
      <div className="flex justify-between gap-2 text-[10px] leading-tight text-neutral-400 dark:text-neutral-500">
        <span>{span[0]}</span>
        {showDelta && (
          <span
            className={cx("font-medium tabular-nums", trend === "up" ? "text-emerald-600 dark:text-emerald-400" : trend === "down" ? "text-rose-600 dark:text-rose-400" : "")}
            title={`change from ${span[0]} to ${span[1]}`}
          >
            {trend === "flat" ? "± 0%" : `${trend === "up" ? "▲" : "▼"} ${Math.abs(delta).toFixed(Math.abs(delta) < 10 ? 1 : 0)}%`}
          </span>
        )}
        <span>{span[1]}</span>
      </div>
    </div>
  );
}

// "4m ago" style label for a sample time
function ago(t: number, now: number) {
  const m = Math.round((now - t) / 60_000);
  return m < 1 ? "now" : `${m}m ago`;
}

// on phones: one row of four, short labels under the value and no sparkline, so the page below stays in view
function Metric({
  label,
  short,
  value,
  trend,
  trendLabels,
  span,
  delta,
}: {
  label: string;
  short: string;
  value: ReactNode;
  trend: number[];
  trendLabels: string[];
  span: [string, string];
  delta?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-white px-2.5 py-2 sm:px-5 sm:py-3 dark:bg-surface-dark">
      <div className="flex flex-col-reverse sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <span className="truncate text-[11px] text-neutral-500 sm:text-xs dark:text-neutral-400" title={label}>
          <span className="sm:hidden">{short}</span>
          <span className="max-sm:hidden">{label}</span>
        </span>
        <span className="truncate text-base font-semibold tracking-tight text-neutral-900 tabular-nums sm:text-xl dark:text-white">{value}</span>
      </div>
      <div className="max-sm:hidden">
        <Sparkline values={trend} labels={trendLabels} span={span} delta={delta} />
      </div>
    </div>
  );
}

// recent samples of the live numbers, kept in the browser so the sparklines survive a reload
type Sample = { t: number; pps: number; mps: number; planes: number };
const SAMPLE_WINDOW = 30 * 60_000;

function loadSamples(key: string): Sample[] {
  try {
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(arr) ? arr.filter((s: Sample) => Date.now() - s.t < SAMPLE_WINDOW) : [];
  } catch {
    return [];
  }
}

function useSamples(stat: MfStat | undefined, key: string) {
  const [samples, setSamples] = useState(() => loadSamples(key));
  useEffect(() => {
    if (!stat || stat.nosdr === 1) return;
    const now = Date.now();
    setSamples((prev) => [...prev.filter((s) => now - s.t < SAMPLE_WINDOW), { t: now, pps: stat.pps, mps: stat.mps, planes: stat.planes }]);
  }, [stat]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(samples));
    } catch {
      // storage unavailable - the sparklines just start fresh
    }
  }, [key, samples]);
  return samples;
}

type Stage2Contact = { stage2_connected: string; address: string };

// micro / nano feeders: a short note on which Stage 2 last picked up the data
// (`addresses` is a comma separated string so the memoized StatsStrip isn't re-rendered for a new array)
function Stage2Note({ contact, addresses }: { contact: Stage2Contact | null; addresses: string }) {
  if (!contact) return null;
  if (contact.stage2_connected === "recent")
    return (
      <span className="min-w-0 font-normal text-neutral-400" title={`Data from this feeder's antenna is being pulled by the Stage 2 at ${contact.address}`}>
        · feeding Stage 2 {contact.address}
      </span>
    );
  if (contact.stage2_connected === "never")
    return (
      <span className="min-w-0 font-normal text-amber-600 dark:text-amber-400" title={`Most likely ${addresses} will work as the address of this feeder on the Stage 2`}>
        · not feeding a Stage 2 yet{addresses && ` · use ${addresses.split(", ")[0]}`}
      </span>
    );
  return (
    <span className="min-w-0 font-normal text-amber-600 dark:text-amber-400" title={`Last contact from Stage 2 at ${contact.address} was ${contact.stage2_connected} ago`}>
      · Stage 2 {contact.address} last pulled data {contact.stage2_connected} ago
    </span>
  );
}

// one compact strip with the live numbers and their recent trend
// memoized (like PlanesChart) so the frequent aggregator status updates don't re-render it
const StatsStrip = memo(function StatsStrip({
  stat,
  daily,
  stage2,
  nano,
  stage2Contact,
  addresses = "",
}: {
  stat?: MfStat;
  daily?: number[];
  stage2: boolean;
  nano: boolean;
  stage2Contact?: Stage2Contact | null;
  addresses?: string;
}) {
  const tone = mfTone(stat);
  const samples = useSamples(stat, `adsbim:samples:${stage2 ? "stage2" : "local"}`);
  const v = (n?: number) => (stat && n !== undefined ? n.toLocaleString() : "–");
  // /api/stats lists today first; show the last two weeks oldest → newest
  const days = daily ? daily.slice(0, 14).reverse() : [];
  const dayLabels = days.map((_, i) => {
    const d = days.length - 1 - i;
    return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
  });
  const now = samples.length ? samples[samples.length - 1].t : Date.now();
  const sampleLabels = samples.map((s) => ago(s.t, now));
  const sampleSpan: [string, string] = [samples.length ? `${Math.max(1, Math.round((now - samples[0].t) / 60_000))} min ago` : "", "now"];
  const daySpan: [string, string] = [`${Math.max(1, days.length - 1)}d ago`, "today"];
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-3.5 py-2 sm:px-5 dark:border-neutral-800">
        <div className={cx("flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs font-medium", toneText[tone])} title={tone === "warn" ? "receiving unusually little data" : undefined}>
          <span className={cx("size-2 shrink-0 rounded-full", toneDot[tone])} />
          <span className="shrink-0 whitespace-nowrap">{toneLabel[tone]}</span>
          {stage2 && <span className="hidden shrink-0 font-normal text-neutral-400 sm:inline">· all sites combined</span>}
          {stage2Contact !== undefined && <Stage2Note contact={stage2Contact} addresses={addresses} />}
        </div>
        {!nano && (
          <a href="/stats/" className="inline-flex shrink-0 items-center gap-0.5 text-xs text-neutral-500 no-underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
            Stats <ArrowUpRight className="size-3.5" />
          </a>
        )}
      </div>
      <div className="grid grid-cols-4 gap-px bg-neutral-100 sm:grid-cols-2 lg:grid-cols-4 dark:bg-neutral-800">
        <Metric label="Messages/s" short="Msg/s" value={v(stat?.mps)} trend={samples.map((s) => s.mps)} trendLabels={sampleLabels} span={sampleSpan} />
        <Metric label={stage2 ? "Positions/s (all)" : "Positions/s"} short="Pos/s" value={v(stat?.pps)} trend={samples.map((s) => s.pps)} trendLabels={sampleLabels} span={sampleSpan} />
        <Metric label="Planes now" short="Planes" value={v(stat?.planes)} trend={samples.map((s) => s.planes)} trendLabels={sampleLabels} span={sampleSpan} />
        <Metric label="Today (UTC)" short="Today" value={v(stat?.tplanes)} trend={days} trendLabels={dayLabels} span={daySpan} delta={false} />
      </div>
    </div>
  );
});

// planes seen per day for every site, today first; reloaded together with the status table
function usePlaneHistory() {
  const [history, setHistory] = useState<number[][] | null>(null);
  const load = useCallback(() => {
    fetchJson<number[][]>("/api/stats")
      .then(setHistory)
      .catch((e) => console.log("stats", e));
  }, []);
  return [history, load] as const;
}

function planesChartCaption(short = false) {
  const today = new Date();
  if (short) return `Planes/day, until ${today.toLocaleString("en-us", { month: "short", timeZone: "UTC" })} ${today.getUTCDate()} UTC`;
  return `Planes seen per day, ending ${today.toLocaleString("en-us", { month: "long", timeZone: "UTC" })} ${today.getUTCDate()} (UTC)`;
}

const PlanesChart = memo(function PlanesChart({ sites, history, height = 260, caption = true }: { sites: Site[]; history: number[][] | null; height?: number; caption?: boolean }) {
  if (!history) return <div className="flex h-60 items-center justify-center text-sm text-neutral-400">Loading statistics…</div>;
  const days = Math.max(0, ...history.map((h) => h.length));
  const labels: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.getUTCDate());
  }
  const names = new Map(sites.map((s) => [s.idx, s.name]));
  const series = history.map((h, i) => ({ label: names.get(i) || `#${i}`, data: [...h].reverse(), color: seriesColors[i % seriesColors.length] }));
  return (
    <div>
      {caption && <div className="mb-2 text-center text-xs text-neutral-500 dark:text-neutral-400">{planesChartCaption()}</div>}
      <LineChart labels={labels} series={series} height={height} />
    </div>
  );
});

/* ----------------------------------------------------------- aggregators */

type AggLink = { label: string; href: string; title?: string };

// the per-site links shown next to an aggregator: its status page plus whatever personal
// map / stats pages it offers
function aggLinks(a: Aggregator, site: Site | undefined, st: AggState | undefined): AggLink[] {
  const idx = site?.idx ?? 0;
  const sfx = idx ? `_${idx}` : "";
  const status = a.status[idx] ?? "";
  const links: AggLink[] = [];
  switch (a.agg) {
    case "adsblol":
      links.push({ label: "My planes", href: first(st?.adsblollink) || "https://my.adsb.lol/" });
      if (site)
        links.push({
          label: "MLAT map",
          href: `https://mlat.adsb.lol/syncmap/#lat=${site.lat}#lon=${site.lon}#zoom=10`,
          title: site.mlatPrivacy ? "MLAT privacy is on, so this feeder isn't shown on the MLAT map" : "Only feeders with MLAT privacy disabled are shown",
        });
      links.push({ label: "Status", href: status });
      break;
    case "adsbx": {
      const id = st?.adsbxfeederid;
      if (id) {
        links.push({ label: "My map", href: `https://globe.adsbexchange.com/?feed=${id}` });
        links.push({ label: "Stats", href: `https://www.adsbexchange.com/api/feeders/?feed=${id}` });
      }
      links.push({ label: "Status", href: status });
      break;
    }
    case "alive":
      links.push({ label: "My map", href: first(st?.alivemaplink) });
      links.push({ label: "Status", href: status });
      break;
    case "planefinder":
      links.push({ label: "Map", href: `/planefinder${sfx}/` });
      links.push({ label: "Stats", href: status });
      break;
    case "flightradar":
      links.push({ label: "Status", href: status, title: "Monitoring only – changes made on that page are not saved" });
      break;
    case "flightaware":
      links.push({ label: "Status", href: status, title: "The SkyAware map isn't needed and disabled (PIAWARE_MINIMAL=false on the Expert page re-enables it)" });
      break;
    default:
      links.push({ label: "Status", href: status });
  }
  return links.filter((l) => l.href);
}

const chipClass =
  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-neutral-600 no-underline ring-1 ring-neutral-200 ring-inset hover:bg-neutral-100 hover:text-neutral-900 hover:no-underline dark:text-neutral-300 dark:ring-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-white";

function LinkChips({ links }: { links: AggLink[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {links.map((l) => (
        <a key={l.label} href={l.href} title={l.title} className={chipClass}>
          {l.label}
          <ArrowUpRight className="size-3 opacity-60" />
        </a>
      ))}
    </div>
  );
}

// compact per-site variant for stage 2 tables: one icon that opens the list of links.
// Rendered through a portal with fixed positioning so the table's overflow doesn't clip it.
function LinkMenu({ links, label }: { links: AggLink[]; label: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const open = pos !== null;
  useDismiss(open, () => setPos(null), menu, btn);
  // the menu is positioned once, so it closes when the page moves under it
  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (links.length === 1)
    return (
      <a href={links[0].href} title={links[0].title ?? `${label}: ${links[0].label}`} className="-m-1.5 inline-flex p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
        <ArrowUpRight className="size-4" />
      </a>
    );
  const toggle = () => {
    if (pos) return setPos(null);
    const r = btn.current!.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  };
  return (
    <>
      <button ref={btn} type="button" onClick={toggle} aria-expanded={!!pos} title={`${label} links`} className="-m-1.5 inline-flex cursor-pointer p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
        <Ellipsis className="size-4" />
      </button>
      {pos &&
        createPortal(
          <div
            ref={menu}
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-50 min-w-40 animate-pop-in rounded-xl border border-neutral-200 bg-white p-1 text-left shadow-xl shadow-neutral-900/10 dark:border-neutral-700/80 dark:bg-neutral-900 dark:shadow-black/40"
          >
            <div className="px-2.5 pt-1.5 pb-1 text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                title={l.title}
                className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-sm text-neutral-700 no-underline hover:bg-neutral-100 hover:no-underline dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {l.label}
                <ArrowUpRight className="size-3.5 opacity-60" />
              </a>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

type AggTableProps = { aggs: Aggregator[]; sites: Site[]; siteIndices: number[]; status: StatusMap };

// phone layout: instead of a wide table that has to be scrolled sideways, one compact row per
// aggregator. With several sites that row holds one status icon per site; tapping it expands
// the data / MLAT details and links for each site.
const aggListCols = "grid grid-cols-[minmax(0,1fr)_5.75rem_1.75rem_1.75rem_1.5rem] items-center gap-x-2";
const aggDetailCols = "grid grid-cols-[minmax(0,1fr)_1.75rem_1.75rem_1.5rem] items-center gap-x-2";

function AggregatorList({ aggs, sites, siteIndices, status }: AggTableProps) {
  const multi = siteIndices.length > 1;
  const siteByIdx = new Map(sites.map((s) => [s.idx, s]));
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (agg: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(agg)) next.add(agg);
      return next;
    });
  const summary = (key: string) => statusSummary(status, key);
  const feedCells = (a: Aggregator, idx: number) => {
    const key = `${a.agg}-${idx}`;
    const st = status[key] ?? undefined;
    const loading = !(key in status);
    const site = siteByIdx.get(idx);
    const links = aggLinks(a, site, st);
    return (
      <>
        <div className="text-center">
          <FeedIcon loading={loading} state={st?.beast} />
        </div>
        <div className="text-center">
          <FeedIcon loading={loading} state={st?.mlat} />
        </div>
        <div className="text-right">{links.length > 0 && <LinkMenu links={links} label={multi ? `${a.name} · ${site?.name ?? `#${idx}`}` : a.name} />}</div>
      </>
    );
  };
  const headCls = "border-b border-neutral-200 pb-2 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:text-neutral-400";

  if (!multi) {
    const idx = siteIndices[0];
    return (
      <div className="text-sm">
        <div className={cx(aggListCols, headCls)}>
          <span>Aggregator</span>
          <span>Status</span>
          <span className="text-center">Data</span>
          <span className="text-center">MLAT</span>
          <span />
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
          {aggs.map((a) => (
            <div key={a.agg} className={cx(aggListCols, "py-2")}>
              <a href={a.map} title={`${a.name} map`} className="min-w-0 truncate font-medium text-neutral-800 no-underline dark:text-neutral-100">
                {a.name}
              </a>
              <div>{a.enabled[0] && <SummaryPill summary={summary(`${a.agg}-${idx}`)} />}</div>
              {a.enabled[0] ? feedCells(a, idx) : <span className="col-span-3" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const siteCols = { gridTemplateColumns: `minmax(0,1fr) repeat(${siteIndices.length}, 1.75rem) 1rem` };
  return (
    <div className="text-sm">
      <div className={cx("grid items-center gap-x-1.5", headCls)} style={siteCols}>
        <span>Aggregator</span>
        {siteIndices.map((idx, i) => (
          <span key={idx} className="text-center tabular-nums" title={siteByIdx.get(idx)?.name}>
            {i + 1}
          </span>
        ))}
        <span />
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
        {aggs.map((a) => {
          const isOpen = open.has(a.agg);
          return (
            <div key={a.agg}>
              <button
                type="button"
                onClick={() => toggle(a.agg)}
                aria-expanded={isOpen}
                className="grid w-full cursor-pointer items-center gap-x-1.5 py-2 text-left"
                style={siteCols}
              >
                <span className="min-w-0 truncate font-medium text-neutral-800 dark:text-neutral-100">{a.name}</span>
                {siteIndices.map((idx, i) => (
                  <span key={idx} className="flex justify-center">
                    {a.enabled[i] && <SummaryPill compact summary={summary(`${a.agg}-${idx}`)} />}
                  </span>
                ))}
                <ChevronDown className={cx("size-4 text-neutral-400 transition-transform", !isOpen && "-rotate-90")} />
              </button>
              {isOpen && (
                <div className="animate-fade-in mb-2 rounded-lg bg-neutral-50 px-2.5 py-1 dark:bg-white/[0.03]">
                  <div className={cx(aggDetailCols, "py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400")}>
                    <a href={a.map} className="inline-flex items-center gap-0.5 text-neutral-600 no-underline dark:text-neutral-300">
                      Open map <ArrowUpRight className="size-3" />
                    </a>
                    <span className="text-center">Data</span>
                    <span className="text-center">MLAT</span>
                    <span />
                  </div>
                  {siteIndices.map(
                    (idx, i) =>
                      a.enabled[i] && (
                        <div key={idx} className={cx(aggDetailCols, "py-1")}>
                          <span className="flex min-w-0 items-center gap-2 text-neutral-600 dark:text-neutral-400">
                            <span className="w-3 shrink-0 text-center text-[11px] font-medium tabular-nums">{i + 1}</span>
                            <span className="truncate text-[13px]">{siteByIdx.get(idx)?.name || `Feeder ${i + 1}`}</span>
                          </span>
                          {feedCells(a, idx)}
                        </div>
                      ),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AggregatorTable({ phone, ...props }: AggTableProps & { phone: boolean }) {
  if (phone) return <AggregatorList {...props} />;
  const { aggs, sites, siteIndices, status } = props;
  const multi = siteIndices.length > 1;
  const siteByIdx = new Map(sites.map((s) => [s.idx, s]));
  const groups: { key: "status" | "beast" | "mlat" | "link"; label: string }[] = [
    { key: "status", label: "Status" },
    { key: "beast", label: "Data" },
    { key: "mlat", label: "MLAT" },
    { key: "link", label: "Links" },
  ];
  return (
    <div className="overflow-x-auto">
      <table className={cx("table-modern", !multi && "table-fixed")}>
        {/* fixed widths keep the columns of the separate aggregator tables aligned. With several feeders the
            compact link menus get narrow columns and an empty spacer takes the rest; with one feeder the link
            chips get a fixed right-aligned column and status/data/mlat share the rest equally */}
        <colgroup>
          <col className="w-48" />
          {siteIndices.map((idx) => (
            <col key={`s-${idx}`} className={multi ? "w-16" : undefined} />
          ))}
          {(["beast", "mlat"] as const).flatMap((metric) => siteIndices.map((idx) => <col key={`${metric}-${idx}`} className={multi ? "w-12" : undefined} />))}
          {siteIndices.map((idx) => (
            <col key={`l-${idx}`} className={multi ? "w-12" : "w-96"} />
          ))}
          {multi && <col />}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky left-0 z-[1] bg-white dark:bg-surface-dark">Aggregator</th>
            {groups.map((gr) => (
              <th key={gr.key} colSpan={siteIndices.length} className={gr.key === "link" && !multi ? "text-right" : "text-center"}>
                {gr.label}
              </th>
            ))}
            {multi && <th />}
          </tr>
          {multi && (
            <tr>
              <th className="sticky left-0 z-[1] bg-white dark:bg-surface-dark">Feeder #</th>
              {groups.flatMap((gr) =>
                siteIndices.map((idx, i) => (
                  <th key={`${gr.key}-${idx}`} className="text-center font-medium normal-case tabular-nums">
                    {i + 1}
                  </th>
                )),
              )}
              <th />
            </tr>
          )}
        </thead>
        <tbody>
          {aggs.map((a) => (
            <tr key={a.agg} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30">
              <td className="sticky left-0 z-[1] bg-white font-medium whitespace-nowrap dark:bg-surface-dark">
                <a href={a.map} title={`${a.name} map`} className="group inline-flex items-center gap-1 text-neutral-800 no-underline hover:underline dark:text-neutral-100">
                  {a.name}
                  <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-60" />
                </a>
              </td>
              {siteIndices.map((idx, i) => (
                <td key={`s-${idx}`} className="text-center">
                  {a.enabled[i] && <SummaryPill compact={multi} summary={statusSummary(status, `${a.agg}-${idx}`)} />}
                </td>
              ))}
              {(["beast", "mlat"] as const).flatMap((metric) =>
                siteIndices.map((idx, i) => {
                  const key = `${a.agg}-${idx}`;
                  return (
                    <td key={`${metric}-${idx}`} className="text-center">
                      {a.enabled[i] && <FeedIcon loading={!(key in status)} state={status[key]?.[metric]} />}
                    </td>
                  );
                }),
              )}
              {siteIndices.map((idx, i) => {
                if (!a.enabled[i]) return <td key={`l-${idx}`} />;
                const site = siteByIdx.get(idx);
                const links = aggLinks(a, site, status[`${a.agg}-${idx}`] ?? undefined);
                return (
                  <td key={`l-${idx}`} className={multi ? "text-center" : ""}>
                    {links.length > 0 && (multi ? <LinkMenu links={links} label={`${a.name} · ${site?.name ?? `#${idx}`}`} /> : <LinkChips links={links} />)}
                  </td>
                );
              })}
              {multi && <td />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">Data / MLAT icons</div>
      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {(
          [
            ["good", "feed / mlat is connected"],
            ["disconnected", "feed / mlat is not connected"],
            ["bad", "mlat sync errors (if this persists for hours, check the mlat-check wiki page)"],
            ["warning", "feed is intermittent / degraded, or mlat sync warning (lack of traffic / no other receivers nearby)"],
            ["starting", "container is up for less than 30 seconds, not checking status"],
            ["container_down", "container is down"],
            ["unknown", "status information is not available at this time or not supported"],
          ] as const
        ).map(([state, text]) => (
          <div key={state} className="flex items-start gap-2">
            <span className={cx("mt-0.5 [&>svg]:size-4", feedStateInfo[state].color)}>{feedStateInfo[state].icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
      <p className="mt-3">
        See the <a href="https://github.com/wiedehopf/adsb-wiki/wiki/mlat-check">mlat-check wiki page</a> for help with persistent MLAT sync errors.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- update */

function SoftwareCard({ channel, im }: { channel: string; im: ImStatus | null }) {
  const g = getGlobal();

  const showUpdate = im?.show_update === "1";
  const dev = !!im?.advice?.startsWith("you are running a development version");
  const betaEnabled = showUpdate && (dev || !!im?.beta_changelog);
  const stableIsDowngrade = !dev && im?.main_changelog === "this will get you back to the last release version";
  const stableEnabled = showUpdate && (dev || !!im?.main_changelog) && !stableIsDowngrade;
  const betaText = (() => {
    const t = im?.latest_date ?? "";
    if (t.includes("beta")) return t.match(/v[\d.]+-beta\.[\d]+/)?.[0] ?? t;
    return t;
  })();
  const version = g.baseVersion.replace("(beta)", "").replace("(stable)", "").replace("(dietpi)", "");
  const hasNotes = betaEnabled || stableEnabled;

  const [notesOpen, setNotesOpen] = useState(false);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
        <div className="flex size-9 shrink-0 items-center justify-center self-start rounded-xl bg-neutral-100 text-neutral-500 ring-1 ring-neutral-900/5 dark:bg-white/[0.06] dark:text-neutral-400 dark:ring-white/10">
          <Rocket className="size-[18px]" />
        </div>
        <div className="min-w-0 flex-1 basis-60">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-[15px] leading-6 font-semibold text-neutral-900 dark:text-white">Software</h2>
            <span className="font-mono text-[13px] text-neutral-700 dark:text-neutral-300">{version || "–"}</span>
            {im && (showUpdate && hasNotes ? <Badge tone="warning">Update available</Badge> : <Badge tone="success">Up to date</Badge>)}
          </div>
          <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Latest: stable <span className="font-mono">{im?.latest_tag || "…"}</span> · beta <span className="font-mono">{betaText || "…"}</span>
            {im?.advice && (
              <>
                <span className="mx-1.5 hidden sm:inline">·</span>
                <span className="block sm:inline" dangerouslySetInnerHTML={{ __html: im.advice }} />
              </>
            )}
          </div>
        </div>
        {(hasNotes || channel.includes("dev")) && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            {hasNotes && (
              <button
                type="button"
                onClick={() => setNotesOpen(!notesOpen)}
                aria-expanded={notesOpen}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                <ChevronDown className={cx("size-3.5 transition-transform", !notesOpen && "-rotate-90")} />
                Changelog
              </button>
            )}
            <PostForm className="ml-auto flex flex-wrap gap-2 sm:ml-0" busyText="Starting update…">
              {stableEnabled && (
                <SubmitButton name="update_feeder_aps_stable" size="sm" icon={<RefreshCw className="size-3.5" />}>
                  Update (stable)
                </SubmitButton>
              )}
              {betaEnabled && (
                <SubmitButton name="update_feeder_aps_beta" size="sm" variant={stableEnabled ? "outline" : "primary"} icon={!stableEnabled && <RefreshCw className="size-3.5" />}>
                  Update (beta)
                </SubmitButton>
              )}
              {channel.includes("dev") && (
                <SubmitButton name="update_feeder_aps_branch" size="sm" variant="danger">
                  DANGER: Update ({channel})
                </SubmitButton>
              )}
            </PostForm>
          </div>
        )}
      </div>
      {stableIsDowngrade && showUpdate && <p className="-mt-1 px-5 pb-4 pl-[4.25rem] text-xs sm:px-6 sm:pl-[4.75rem] text-neutral-500 dark:text-neutral-400">You can downgrade to the last release version on the System → Management page.</p>}
      {hasNotes && notesOpen && (
        <div className="animate-fade-in space-y-3 border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 sm:px-6 dark:border-neutral-800 dark:bg-white/[0.015]">
          <div className={cx("grid gap-4", betaEnabled && stableEnabled && im?.beta_changelog && im?.main_changelog && "lg:grid-cols-2")}>
            {betaEnabled && im?.beta_changelog && <Changelog title={`What's new in beta ${betaText}`} text={im.beta_changelog} />}
            {stableEnabled && im?.main_changelog && <Changelog title={`What's new in stable ${im.latest_tag}`} text={im.main_changelog} />}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Updates with new container images can take more than ten minutes; feeding is only briefly interrupted.</p>
        </div>
      )}
    </Card>
  );
}

function Changelog({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">{title}</div>
      <div className="max-h-60 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">{text}</div>
    </div>
  );
}

/* ----------------------------------------------------------------- page */

export function Home({ data }: { data: HomeData }) {
  const g = getGlobal();
  const stage2 = g.stage2;
  const microNano = isMicroOrNano(g) && !stage2;
  const numSites = data.siteIndices.length;
  // live numbers and plane history (the widget only shows the aggregator table)
  const showStats = (data.adsb || stage2) && !g.widgetMode;
  const [mf, setMf] = useState<MfStat[]>([]);
  const [status, setStatus] = useState<StatusMap>({});
  const [lastUpdate, setLastUpdate] = useState("");
  const [im, setIm] = useState<ImStatus | null>(null);
  const [stage2Contact, setStage2Contact] = useState<Stage2Contact | null>(null);
  const [planeHistory, loadPlaneHistory] = usePlaneHistory();
  const [ipNoticeDismissed, setIpNoticeDismissed] = useState(() => {
    try {
      return localStorage.getItem("ipMismatchDismissed") === "1";
    } catch {
      return false;
    }
  });
  // (skip the external lookup once the notice has been dismissed)
  const ipState = useIpMismatch(!["micro", "nano"].includes(g.aggregatorChoice) && !ipNoticeDismissed);
  const dismissIpNotice = () => {
    setIpNoticeDismissed(true);
    try {
      localStorage.setItem("ipMismatchDismissed", "1");
    } catch {
      // storage unavailable - it only stays hidden until the next reload
    }
  };
  const delay = useRef(35_000);

  // micro feeder / local stats, every 15s
  usePolling(async () => setMf(await fetchJson<MfStat[]>("/api/stage2_stats")), 15_000);

  // the start page task: aggregator status, versions, chart; backs off from 35s to 5 minutes
  usePolling(
    async ({ visibilityChange }) => {
      delay.current = visibilityChange ? 35_000 : Math.min(300_000, delay.current * 1.5);
      setLastUpdate(new Date().toLocaleTimeString());
      if (microNano) {
        fetchJson<Stage2Contact>("/api/stage2_connection")
          .then(setStage2Contact)
          .catch(() => {});
      }
      if (!g.widgetMode) {
        fetchJson<ImStatus>("/api/status/im")
          .then(setIm)
          .catch(() => {});
      }
      if (showStats) loadPlaneHistory();
      // show every status as loading again, then fill in each aggregator as it answers
      setStatus({});
      await Promise.all(
        data.aggregators.map(async (a) => {
          const dict = await fetchJson<Record<string, AggState>>(`/api/status/${a.agg}`).catch(() => ({}) as Record<string, AggState>);
          setStatus((prev) => {
            const next = { ...prev };
            for (const idx of data.siteIndices) next[`${a.agg}-${idx}`] = dict[idx] ?? null;
            return next;
          });
        }),
      );
    },
    () => delay.current,
  );

  const isPhone = !useMediaQuery("(min-width: 640px)");
  const shownSites = data.sites.filter((s) => data.siteIndices.includes(s.idx));
  const tables = [...data.aggTables].sort((a, b) => a - b);
  const combined = mf[0];
  const tone = mfTone(combined);
  const nano = g.aggregatorChoice === "nano";
  const hasMaps = !["nano", "nonadsb"].includes(g.aggregatorChoice);
  const addresses = [data.localAddress, data.tailscaleAddress, data.zerotierAddress].filter(Boolean);
  const anyAggregators = (data.adsb && data.aggregators.length > 0) || (g.acarshub && data.acarsAggregatorsChosen) || (g.shipfeeder && data.aisAggregatorsChosen);
  const uatSites = shownSites.filter((s) => s.uat978);

  const feeding =
    data.aggregators.length > 0 ? (
      <Card>
        <CardHeader
          icon={<Share2 />}
          title={
            <span className="flex flex-wrap items-baseline gap-x-2">
              Aggregators
              {lastUpdate && <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">Status updated at {lastUpdate}</span>}
            </span>
          }
          description={
            isPhone && stage2 && g.numMicroSites > 0 && !g.widgetMode && <span className="text-xs">Pick a target site to change data sharing</span>
          }
          actions={
            !g.widgetMode &&
            (stage2 ? (
              g.numMicroSites > 0 && !isPhone && <span className="text-xs text-neutral-500">Pick a target site to change data sharing</span>
            ) : (
              !isMicroOrNano(g) && (
                <LinkButton href="/aggregators" size="sm">
                  Manage
                </LinkButton>
              )
            ))
          }
        />
        <CardBody className="space-y-5">
          <div className={cx("grid gap-6", numSites === 1 && tables.length > 1 && "2xl:grid-cols-2")}>
            {tables.map((t) => (
              <AggregatorTable key={t} phone={isPhone} aggs={data.aggregators.filter((a) => a.table === t)} sites={data.sites} siteIndices={data.siteIndices} status={status} />
            ))}
          </div>
          {!g.widgetMode && (
            <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <Collapsible title="Legend & notes">
                <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  {(
                    [
                      ["good", "good"],
                      ["degraded", "degraded"],
                      ["disconnected", "down"],
                      ["enabled", "not reported"],
                    ] as const
                  ).map(([summary, text]) => (
                    <span key={summary} className="flex items-center gap-1.5">
                      <SummaryPill summary={summary} compact /> {text}
                    </span>
                  ))}
                </div>
                <Legend />
                <p className="mt-3 text-xs">
                  Click an aggregator's name to open its map. Degraded MLAT for many of the aggregators tends to be a server-side issue. Only report issues if you are feeding adsb.lol /
                  adsb.fi / airplanes.live and all aggregators show degraded MLAT.
                </p>
              </Collapsible>
            </div>
          )}
        </CardBody>
      </Card>
    ) : (
      !g.widgetMode &&
      !isMicroOrNano(g) &&
      !stage2 && (
        <Card>
          <CardBody>
            <EmptyState icon={<Share2 />} title={anyAggregators ? "Data sharing" : "No aggregators configured"}>
              {anyAggregators ? "Add or remove aggregators on the Data Sharing page." : "Share your data with aggregators to see your feeder on their maps."}
              <div className="mt-4">
                <LinkButton href="/aggregators" variant="primary" size="sm">
                  Set up data sharing
                </LinkButton>
              </div>
            </EmptyState>
          </CardBody>
        </Card>
      )
    );

  const stage2SuggestionAlert = data.stage2Suggestion && !["micro", "nano", "nonadsb"].includes(g.aggregatorChoice) && (
    <Alert tone="info" title="Consider a two stage setup">
      Account-based aggregator containers on systems with 1GB of RAM or less often cause random issues like MLAT errors or unreliable connections. A two stage setup that off-loads the aggregators to a
      different system might be a good idea.
    </Alert>
  );

  if (g.widgetMode) {
    return <div className="space-y-6">{feeding}</div>;
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {!stage2 && <>{productName(g)} feeder</>}
            {stage2 && <Badge>Stage 2 · {g.numMicroSites} sites</Badge>}
            {microNano && <Badge>{g.aggregatorChoice} feeder</Badge>}
          </div>
          <h1 className="truncate text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">{siteName(g) || "My feeder"}</h1>
        </div>
        {hasMaps && uatSites.length > 0 && (
          <div className="flex max-w-full gap-2 max-sm:overflow-x-auto sm:flex-wrap">
            {uatSites.map((s) => (
              <LinkButton key={s.idx} href={s.idx === 0 || s.mfIp === "local" ? "/dump978/" : `http://${s.mfIp}/dump978/`} size="sm" icon={<RadioReceiver className="size-4" />}>
                {s.idx !== 0 ? `${s.name} ` : ""}Dump978
              </LinkButton>
            ))}
          </div>
        )}
      </div>

      {/* problems */}
      <div className="space-y-2 empty:hidden">
        {!data.dnsState && <Alert tone="danger">The feeder cannot resolve DNS queries. This will most likely prevent it from working at all. Try System → Management → Reboot to see if that will fix it.</Alert>}
        {data.ipv6Broken && <Alert tone="danger">The feeder has an IPv6 address but IPv6 isn't working. This can cause docker and other issues.</Alert>}
        {data.composeUpFailed && (
          <Alert tone="danger" title="docker compose up has failed">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>If the retry doesn't work, go to System → Share Diagnostics and include that link when reporting the issue.</span>
              <PostForm>
                <SubmitButton name="submit" size="sm" variant="danger">
                  Retry
                </SubmitButton>
              </PostForm>
            </div>
          </Alert>
        )}
        {data.underVoltage && (
          <Alert tone="danger" title="Under-voltage detected">
            This can lead to random crashes and various issues with clock stability, reduced reception, failing SDRs, etc. Please check and likely replace your power supply.
          </Alert>
        )}
        {data.pi5UsbCurrentLimited && (
          <Alert tone="danger" title="USB current limited">
            This Pi 5 limits USB current to 600 mA, which is insufficient for more than 1 SDR or additional USB devices. Use an official RPi power supply, or add{" "}
            <code className="code-chip">usb_max_current_enable=1</code> to <code className="code-chip">/boot/firmware/config.txt</code> if you're confident your power supply is sufficient.
          </Alert>
        )}
        {data.healthcheckFailReason && <Alert tone="danger">The system has been deemed unhealthy for this reason: {data.healthcheckFailReason}</Alert>}
        {data.lowDisk && <Alert tone="warning">You are running low on disk space. This can lead to odd problems and even crashes. Consider upgrading to a larger storage device.</Alert>}
        {ipState === "mismatch" && !ipNoticeDismissed && (
          <Alert tone="info" onDismiss={dismissIpNotice}>The external IP of your browser and the feeder are different. The information in the status links for some of the aggregators may be incorrect.</Alert>
        )}
      </div>

      {microNano && !(showStats && tone !== "nosdr") && (
        <div className="card flex min-w-0 items-center gap-2 px-3.5 py-2 text-sm sm:px-5">
          <Network className="size-4 shrink-0 text-neutral-400" />
          {stage2Contact ? <Stage2Note contact={stage2Contact} addresses={addresses.join(", ")} /> : <span className="text-xs text-neutral-400">Checking on Stage 2 connection…</span>}
        </div>
      )}

      {/* live numbers */}
      {showStats &&
        (tone === "nosdr" ? (
          <Alert tone="danger" title="No SDR configured as data source">
            Go to <a href="/sdr_setup">SDR Setup</a> to address this.
          </Alert>
        ) : (
          <StatsStrip
            stat={combined}
            daily={planeHistory?.[0]}
            stage2={stage2}
            nano={nano}
            stage2Contact={microNano ? stage2Contact : undefined}
            addresses={addresses.join(", ")}
          />
        ))}

      {stage2 && (
        <Card>
          <CardHeader
            icon={<Network />}
            title={
              <>
                Feeders
                <span className="ml-3 text-xs font-normal text-neutral-500 max-sm:hidden dark:text-neutral-400">{planesChartCaption()}</span>
              </>
            }
            actions={
              <LinkButton href="/stage2" size="sm">
                Manage sites
              </LinkButton>
            }
          />
          <CardBody className="pt-3">
            {g.numMicroSites === 0 ? (
              <EmptyState icon={<Network />} title="No feeders yet">
                Add feeders on the <a href="/stage2">Stage 2 setup page</a>.
              </EmptyState>
            ) : (
              <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                <div className="overflow-x-auto">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th className="w-10">#</th>
                        <th>Site</th>
                        <th className="text-right">Status / stats</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownSites.map((s) => (
                        <tr key={s.idx}>
                          <td className="text-neutral-400 tabular-nums">
                            <a href={`/?m=${s.idx}`} className="text-inherit no-underline">
                              {s.idx}
                            </a>
                          </td>
                          <td className="font-medium">
                            <a href={`/map_${s.idx}/`} className="inline-flex items-center gap-1 no-underline hover:underline">
                              {s.name}
                              <ArrowUpRight className="size-3.5 opacity-60" />
                            </a>
                          </td>
                          <td className="text-right">
                            <a href={`/stats_${s.idx}/`} className="no-underline">
                              <MfStatusCell stat={mf[s.idx]} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="max-xl:order-first">
                  <PlanesChart sites={data.sites} history={planeHistory} height={isPhone ? 200 : 280} caption={isPhone} />
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* stage 2 tables have a column per site and metric - give them the full width */}
      {stage2 && feeding}

      {!stage2 && data.adsb && (
        <Card>
          <CardHeader
            icon={<ChartColumn />}
            title={
              <>
                Statistics
                <span className="ml-3 text-xs font-normal text-neutral-500 max-sm:hidden dark:text-neutral-400">{planesChartCaption()}</span>
                <span className="ml-2.5 text-xs font-normal whitespace-nowrap text-neutral-500 sm:hidden dark:text-neutral-400">{planesChartCaption(true)}</span>
              </>
            }
          />
          <CardBody className="pt-2">
            <PlanesChart sites={data.sites} history={planeHistory} caption={false} />
          </CardBody>
        </Card>
      )}

      {!stage2 && feeding}
      {stage2SuggestionAlert}
      <SoftwareCard channel={data.channel} im={im} />

      <p className="flex items-center gap-1.5 text-xs text-neutral-400">
        <CircleCheck className="size-3.5" />
        After a restart (or first install) it can take a couple of minutes for maps and statistics to respond.
      </p>
    </div>
  );
}
