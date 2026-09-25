import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "./ui";

export type Series = { label: string; data: number[]; color: string };

// categorical palette validated for both light and dark backgrounds
export const seriesColors = ["var(--chart-1)", "#d97706", "#059669", "#db2777", "#7c3aed", "#0d9488", "#dc2626", "#65a30d", "#0891b2", "#ea580c", "#4f46e5", "#9333ea"];

// nearest 1/2/2.5/5 step rather than the next one up, which could double the step (540 -> 1000)
function niceStep(v: number) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  return (f < 1.5 ? 1 : f < 2.25 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10) * exp;
}

// y-axis fitted tightly to the data range rather than starting at zero, so a change from
// 3600 to 4100 planes a day reads as a clear rise instead of a flat line. Only uses a zero
// baseline when the data already reaches down close to it. The tick count follows the chart
// height (one gridline every ~30px) so the steps stay fine enough to read trends off.
function niceDomain(values: number[], plotHeight: number) {
  const tickCount = Math.max(4, Math.min(8, Math.floor(plotHeight / 30)));
  if (!values.length) return { lo: 0, hi: 10, step: 2 };
  let min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) min = Math.max(0, max - Math.max(1, max * 0.1));
  if (min < (max - min) * 0.15) min = 0;
  const step = niceStep((max - min) / tickCount);
  const lo = Math.max(0, Math.floor(min / step) * step);
  const hi = Math.max(lo + step, Math.ceil(max / step) * step);
  return { lo, hi, step };
}

// straight segments between the samples: every rise and dip in the data stays visible
export function linePath(pts: readonly (readonly [number, number])[]) {
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${+x.toFixed(2)},${+y.toFixed(2)}`).join("");
}

const PAD = { top: 14, right: 14, bottom: 26, left: 44 };

// Lightweight responsive SVG line chart (replaces Chart.js from the old UI).
// Legend click shows only that series (click it again to show all); shift-click hides / shows
// a single series; hovering a legend entry with the mouse highlights its line.
export function LineChart({ labels, series, height = 240 }: { labels: (string | number)[]; series: Series[]; height?: number }) {
  const gradientId = useId();
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastPointer = useRef("mouse");

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const n = labels.length;
  // the geometry only changes with the data, size or hidden series - not on hover
  const { lo, step, ticks, x, y, paths } = useMemo(() => {
    const visible = series.map((s, i) => ({ ...s, i })).filter((s) => !hidden.has(s.i));
    const { lo, hi, step } = niceDomain(visible.flatMap((s) => s.data.filter((v) => Number.isFinite(v))), innerH);
    const ticks: number[] = [];
    for (let k = 0; lo + k * step <= hi + step / 2; k++) ticks.push(lo + k * step);
    const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
    const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
    return { lo, step, ticks, x, y, paths: visible.map((s) => ({ ...s, d: linePath(s.data.map((v, i) => [x(i), y(v || 0)] as const)) })) };
  }, [series, hidden, n, innerW, innerH]);
  // a dot on every day while there's room for them
  const markers = n > 1 && n <= 45 && innerW / n >= 8;
  const dim = focus !== null && paths.some((s) => s.i === focus) ? focus : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round(((px - PAD.left) / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };

  const toggle = (i: number, shift: boolean, mouse: boolean) => {
    const isolated = hidden.size === series.length - 1 && !hidden.has(i);
    let next: Set<number>;
    if (shift) {
      next = new Set(hidden);
      if (next.has(i)) next.delete(i);
      else next.add(i);
    } else {
      next = new Set(isolated ? [] : series.map((_, j) => j).filter((j) => j !== i));
    }
    if (next.size === series.length) next.clear();
    setHidden(next);
    // touch has no hover to end the highlight, so it would keep the other lines dimmed
    setFocus(mouse && !next.has(i) ? i : null);
  };

  const single = paths.length === 1;
  const glide = "transition-transform duration-150 ease-out motion-reduce:transition-none";
  // with many series, list the tooltip biggest-first so it reads like a ranking
  const tipRows = hover === null ? [] : paths.length > 3 ? [...paths].sort((a, b) => (b.data[hover] ?? 0) - (a.data[hover] ?? 0)) : paths;
  return (
    <div className="relative" ref={wrapRef}>
      <svg ref={svgRef} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full touch-pan-y select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: paths[0]?.color ?? "var(--chart-1)" }} stopOpacity="0.18" />
            <stop offset="100%" style={{ stopColor: paths[0]?.color ?? "var(--chart-1)" }} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className={t === lo ? "stroke-neutral-200 dark:stroke-neutral-700" : "stroke-neutral-100 dark:stroke-neutral-800"} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-neutral-400 text-[11px] tabular-nums dark:fill-neutral-500">
              {t.toLocaleString(undefined, { maximumFractionDigits: step < 1 ? 2 : step < 10 && step % 1 ? 1 : 0 })}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          n <= 16 || i % Math.ceil(n / 14) === 0 ? (
            <text
              key={i}
              x={x(i)}
              y={height - 6}
              textAnchor="middle"
              className={cx("text-[11px] tabular-nums transition-colors", hover === i ? "fill-neutral-900 font-medium dark:fill-white" : "fill-neutral-400 dark:fill-neutral-500")}
            >
              {l}
            </text>
          ) : null,
        )}
        {single && paths[0].data.length > 1 && (
          <path d={`${paths[0].d}L${x(paths[0].data.length - 1)},${y(lo)}L${x(0)},${y(lo)}Z`} fill={`url(#${gradientId})`} className="motion-safe:animate-fade-in" />
        )}
        {hover !== null && (
          <line x1={0} x2={0} y1={PAD.top} y2={PAD.top + innerH} className={cx("stroke-neutral-300 dark:stroke-neutral-600", glide)} style={{ transform: `translateX(${x(hover)}px)` }} />
        )}
        {paths.map((s) => (
          <path
            key={s.i}
            d={s.d}
            pathLength={1}
            fill="none"
            style={{ stroke: s.color, opacity: dim === null || dim === s.i ? 1 : 0.15 }}
            strokeWidth={dim === s.i ? 2.5 : 2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="transition-opacity duration-200 motion-safe:animate-draw"
          />
        ))}
        {markers &&
          paths.map((s) => (
            <g key={s.i} style={{ fill: s.color, opacity: dim === null || dim === s.i ? 1 : 0.15 }} className="transition-opacity duration-200 motion-safe:animate-fade-in">
              {s.data.map((v, i) => (v != null && Number.isFinite(v) ? <circle key={i} cx={x(i)} cy={y(v)} r={paths.length > 3 ? 1.75 : 2.5} /> : null))}
            </g>
          ))}
        {hover !== null &&
          paths.map((s) =>
            s.data[hover] != null && (dim === null || dim === s.i) ? (
              <circle
                key={s.i}
                cx={0}
                cy={0}
                r={4}
                style={{ fill: s.color, transform: `translate(${x(hover)}px, ${y(s.data[hover])}px)` }}
                className={cx("stroke-white dark:stroke-neutral-900", glide)}
                strokeWidth={2}
              />
            ) : null,
          )}
      </svg>
      {hover !== null && (
        <div
          className={cx(
            "pointer-events-none absolute top-2 left-0 z-10 min-w-36 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900",
            "transition-transform duration-150 ease-out motion-reduce:transition-none",
          )}
          style={{
            transform: `translateX(calc(${x(hover).toFixed(1)}px ${x(hover) > width / 2 ? "- 100% - 12px" : "+ 12px"}))`,
          }}
        >
          <div className="mb-1 font-semibold text-neutral-900 dark:text-white">Day {labels[hover]}</div>
          {tipRows.map((s) => (
            <div key={s.i} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-medium tabular-nums">{(s.data[hover] ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      {series.length > 1 && (
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5" onPointerLeave={() => setFocus(null)}>
          {series.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => toggle(i, e.shiftKey, lastPointer.current === "mouse")}
              onPointerDown={(e) => (lastPointer.current = e.pointerType)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setFocus(hidden.has(i) ? null : i)}
              onFocus={(e) => e.currentTarget.matches(":focus-visible") && setFocus(hidden.has(i) ? null : i)}
              onBlur={() => setFocus(null)}
              className={cx("flex cursor-pointer items-center gap-1.5 text-xs font-medium transition-colors", hidden.has(i) ? "text-neutral-400 line-through dark:text-neutral-600" : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white")}
            >
              <span className="h-2 w-3 rounded-sm" style={{ background: s.color, opacity: hidden.has(i) ? 0.35 : 1 }} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
