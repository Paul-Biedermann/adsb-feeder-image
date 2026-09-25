import {
  ChartColumn,
  ChartLine,
  Check,
  ChevronDown,
  CloudSun,
  Download,
  Flame,
  Heart,
  Info,
  Layers,
  LifeBuoy,
  LogOut,
  Map as MapIcon,
  Menu,
  Radio,
  RadioReceiver,
  Rewind,
  Route,
  ScrollText,
  Server,
  Settings2,
  Share2,
  Ship,
  SlidersHorizontal,
  Terminal,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { currentTarget, getGlobal, isMicroOrNano, isNonAdsb, siteName } from "../lib/data";
import { fetchJson, useDismiss, usePolling } from "../lib/hooks";
import { cx } from "./ui";

type ClickHandler = (e: React.MouseEvent<HTMLAnchorElement>) => void;
type MenuItem = { label: ReactNode; href: string; icon: ReactNode; onClick?: ClickHandler };
type Menu = { key: string; label: ReactNode; icon: ReactNode; items?: MenuItem[]; href?: string; onClick?: ClickHandler; hidden?: boolean };

function useNavModel() {
  const g = getGlobal();
  const target = g.stage2 ? currentTarget() : 0;
  const nano = g.aggregatorChoice === "nano";
  const fullMaps = !nano && !isNonAdsb(g);
  const mapBase = target > 0 ? `/map_${target}/` : "/map/";
  const targetName = target > 0 ? siteName(g, target) || `#${target}` : "Combined";

  // map buttons: same visibility logic as the old navbar (ADS-B map is shown for ADS-B
  // feeders and for HFDL / acars2pos positions)
  const showLiveMap = g.baseConfig && (!isNonAdsb(g) || g.runHfdlobserver || g.runDumphfdl || g.acars2pos);
  const quick = [
    showLiveMap && { key: "map", label: "Map", short: "Map", href: `/map/${g.tar1090QueryParams}`, icon: <MapIcon /> },
    g.acarshub && { key: "acars", label: "ACARS Hub", short: "ACARS", href: "/acarshub", icon: <Radio /> },
    g.runShipfeeder && { key: "ais", label: "AIS Catcher", short: "AIS", href: "/aiscatcher", icon: <Ship /> },
    g.runSonde && { key: "sonde", label: "Sonde", short: "Sonde", href: "/radiosonde", icon: <CloudSun /> },
  ].filter(Boolean) as QuickItem[];

  const maps: MenuItem[] = [
    { label: "Live Traffic", href: target > 0 ? mapBase : `/map/${g.tar1090QueryParams}`, icon: <MapIcon /> },
    ...(fullMaps ? [{ label: "Heatmap", href: `${mapBase}?heatmap`, icon: <Flame /> }] : []),
    { label: "Tracks", href: `${mapBase}?pTracks`, icon: <Route /> },
    ...(fullMaps ? [{ label: "Replay", href: `${mapBase}?replay`, icon: <Rewind /> }] : []),
    { label: "Options", href: target > 0 ? `/visualization?m=${target}` : "/visualization", icon: <SlidersHorizontal /> },
    ...(g.acarshub ? [{ label: "ACARS Hub", href: "/acarshub", icon: <Radio /> }] : []),
    ...(g.runShipfeeder ? [{ label: "AIS Catcher", href: "/aiscatcher", icon: <Ship /> }] : []),
  ];

  const setup: MenuItem[] = [
    { label: g.stage2 ? "Stage 2" : "Basic", href: "/setup", icon: <Settings2 /> },
    ...(g.baseConfig
      ? [
          { label: "SDR", href: "/sdr_setup", icon: <RadioReceiver /> },
          { label: "Advanced", href: "/advanced", icon: <Wrench /> },
          { label: "Expert", href: "/expert", icon: <Terminal /> },
        ]
      : []),
  ];

  const system: MenuItem[] = [
    { label: "Logs", href: "/logs/", icon: <ScrollText /> },
    { label: "Support Info", href: "/info", icon: <Info /> },
    { label: "Share Diagnostics", href: "/support", icon: <LifeBuoy /> },
    { label: "Management", href: "/systemmgmt", icon: <Server /> },
    { label: "Backup", href: "/backup", icon: <Download /> },
    { label: "Restore", href: "/restore", icon: <Upload /> },
    ...(!nano && !isNonAdsb(g)
      ? [
          { label: g.stage2 ? "Combined Stats" : "Stats", href: "/stats/", icon: <ChartColumn /> },
          ...(g.stage2 && target > 0 ? [{ label: `${targetName} Stats`, href: `/stats_${target}/`, icon: <ChartColumn /> }] : []),
        ]
      : []),
    ...(g.skystats ? [{ label: "Skystats", href: "/skystats/", icon: <ChartLine /> }] : []),
    ...(g.webAuthEnabled ? [{ label: "Log out", href: "/logout", icon: <LogOut /> }] : []),
  ];

  const showDataSharing = !((!g.baseConfig || isMicroOrNano(g)) && !g.shipfeeder && !g.acarshub);
  const menus: Menu[] = [
    { key: "maps", label: "Maps", icon: <MapIcon />, items: maps, hidden: !g.baseConfig },
    g.stage2
      ? {
          key: "sharing",
          label: "Data Sharing",
          icon: <Share2 />,
          href: target > 0 ? `/aggregators?m=${target}` : "#",
          onClick: (e) => {
            if (target > 0) return;
            e.preventDefault();
            alert("Please select a target site, Data Sharing is not available for combined data.");
          },
        }
      : { key: "sharing", label: "Data Sharing", icon: <Share2 />, href: "/aggregators", hidden: !showDataSharing },
    { key: "setup", label: "Setup", icon: <Settings2 />, items: setup },
    { key: "system", label: "System", icon: <Server />, items: system },
  ];

  return { g, target, targetName, quick, menus };
}

function selectTarget(n: number) {
  const base = window.location.href.split("?")[0];
  window.location.replace(n > 0 ? `${base}?m=${n}` : base);
}

function Dropdown({ menu, open, onToggle, onClose }: { menu: Menu; open: boolean; onToggle: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, onClose, ref);

  const path = window.location.pathname;
  const active = menu.items?.some((i) => i.href.split("?")[0] === path) || menu.href?.split("?")[0] === path;
  const itemClass = cx(
    "relative inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm font-medium no-underline transition hover:no-underline",
    active ? "text-neutral-900 dark:text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white",
    open && "bg-neutral-100 dark:bg-neutral-800",
  );

  if (!menu.items) {
    return (
      <a href={menu.href} onClick={menu.onClick} className={itemClass} aria-current={active ? "page" : undefined}>
        {menu.label}
        {active && <ActiveDot />}
      </a>
    );
  }
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={itemClass} onClick={onToggle} aria-expanded={open}>
        {menu.label}
        <ChevronDown className={cx("size-3.5 opacity-60 transition-transform", open && "rotate-180")} />
        {active && <ActiveDot />}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-2 w-64 animate-pop-in rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl shadow-neutral-900/10 dark:border-neutral-700/80 dark:bg-neutral-900 dark:shadow-black/40">
          {menu.items.map((item) => (
            <MenuLink key={item.href + String(item.label)} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveDot() {
  return <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-neutral-900 dark:bg-white" aria-hidden />;
}

function MenuLink({ item }: { item: MenuItem }) {
  const active = item.href.split("?")[0] === window.location.pathname;
  return (
    <a
      href={item.href}
      onClick={item.onClick}
      className={cx(
        "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm no-underline hover:no-underline",
        active ? "bg-neutral-100 text-neutral-900 dark:bg-white/[0.06] dark:text-white" : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800",
      )}
    >
      <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4", active ? "bg-neutral-200 dark:bg-white/10" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400")}>{item.icon}</span>
      <span className="min-w-0 truncate font-medium">{item.label}</span>
    </a>
  );
}

function MobileChip({ item, className }: { item: Pick<MenuItem, "label" | "href" | "icon" | "onClick">; className?: string }) {
  return (
    <a
      href={item.href}
      onClick={item.onClick}
      className={cx(
        "inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 px-3.5 text-sm font-medium text-neutral-700 no-underline hover:no-underline dark:border-neutral-700 dark:text-neutral-200 [&_svg]:size-4 [&_svg]:text-neutral-500 dark:[&_svg]:text-neutral-400",
        className,
      )}
    >
      {item.icon}
      {item.label}
    </a>
  );
}

function MobileMenu({ menus, extraQuick, onClose, children }: { menus: Menu[]; extraQuick: QuickItem[]; onClose: () => void; children?: ReactNode }) {
  const path = window.location.pathname;
  // start with the section containing the current page expanded
  const [expanded, setExpanded] = useState<string | null>(() => menus.find((m) => m.items?.some((i) => i.href.split("?")[0] === path))?.key ?? null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const rowClass = "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[15px] font-semibold text-neutral-900 no-underline hover:bg-neutral-100 hover:no-underline dark:text-white dark:hover:bg-neutral-800";
  const iconClass = "flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 [&>svg]:size-4";

  return (
    <div className="lg:hidden">
      <div className="fixed inset-x-0 top-16 bottom-0 animate-fade-in bg-neutral-950/20 backdrop-blur-sm dark:bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] animate-fade-in overflow-y-auto rounded-b-2xl border-b border-neutral-200 bg-white px-3 pt-3 pb-5 shadow-xl shadow-neutral-900/10 dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-black/40">
        {children && <div className="mb-2 px-1">{children}</div>}
        {extraQuick.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1 sm:hidden">
            {extraQuick.map((q) => (
              <MobileChip key={q.key} item={q} />
            ))}
          </div>
        )}
        <nav className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
          {menus.map((m) => {
            if (!m.items) {
              return (
                <div key={m.key} className="py-1">
                  <a href={m.href} onClick={m.onClick} className={rowClass}>
                    <span className={iconClass}>{m.icon}</span>
                    <span className="flex-1">{m.label}</span>
                  </a>
                </div>
              );
            }
            const open = expanded === m.key;
            return (
              <div key={m.key} className="py-1">
                <button type="button" className={rowClass} onClick={() => setExpanded(open ? null : m.key)} aria-expanded={open}>
                  <span className={iconClass}>{m.icon}</span>
                  <span className="flex-1">{m.label}</span>
                  <span className="text-xs font-medium text-neutral-400 tabular-nums">{m.items.length}</span>
                  <ChevronDown className={cx("size-4 text-neutral-400 transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="mt-0.5 mb-1 ml-[1.625rem] animate-fade-in border-l border-neutral-200 pl-3 dark:border-neutral-800">
                    {m.items.map((item) => (
                      <MenuLink key={item.href + String(item.label)} item={item} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <a href="https://ko-fi.com/H2H2H3JS5" target="_blank" rel="noopener" className="mt-3 ml-2.5 inline-flex items-center gap-2 text-sm text-neutral-500 no-underline dark:text-neutral-400">
          <Heart className="size-4 text-rose-500" /> Help sustain this project on Ko-fi
        </a>
      </div>
    </div>
  );
}

function TargetSelector({ target, targetName, inline = false }: { target: number; targetName: string; inline?: boolean }) {
  const g = getGlobal();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);
  const sites = Array.from({ length: g.numMicroSites }, (_, i) => i + 1);
  const options = [
    { id: 0, label: "Combined", description: "All sites merged", icon: <Layers /> },
    ...sites.map((i) => ({ id: i, label: siteName(g, i) || `#${i}`, description: `Site ${i}`, icon: <RadioReceiver /> })),
  ];
  return (
    <div className={cx("relative", inline && "max-w-sm")} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title="Select the target for maps / sharing"
        className={cx(
          "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition",
          open
            ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
            : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white",
        )}
      >
        {target > 0 ? <RadioReceiver className="size-4 opacity-60" /> : <Layers className="size-4 opacity-60" />}
        <span className="max-w-32 truncate">{targetName}</span>
        <ChevronDown className={cx("size-3.5 opacity-60 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className={cx(
            // in the mobile menu, expand in place under the button instead of floating off to the far edge
            inline ? "mt-2 w-full animate-fade-in" : "absolute top-full right-0 z-40 mt-2 w-64 animate-pop-in",
            "rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl shadow-neutral-900/10 dark:border-neutral-700/80 dark:bg-neutral-900 dark:shadow-black/40",
          )}
        >
          <div className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">Target for maps / sharing</div>
          <div className="max-h-80 overflow-y-auto">
            {options.map((o) => {
              const active = target === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => selectTarget(o.id)}
                  className={cx(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm",
                    active ? "bg-neutral-100 text-neutral-900 dark:bg-white/[0.06] dark:text-white" : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800",
                  )}
                >
                  <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4", active ? "bg-neutral-200 dark:bg-white/10" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400")}>{o.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.label}</span>
                    <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{o.description}</span>
                  </span>
                  {active && <Check className="size-4 shrink-0 text-neutral-900 dark:text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type Temps = { cpu?: string | number | null; ext?: string | number | null; age?: number };

function Temperatures() {
  const g = getGlobal();
  const [temps, setTemps] = useState<Temps>({});
  const [freedom, setFreedom] = useState(g.freedomUnits);
  usePolling(async () => setTemps(await fetchJson<Temps>("/api/get_temperatures.json")), 15000, g.temperatureBlock);
  // the Advanced page switches units live before the setting is applied
  useEffect(() => {
    const handler = (e: Event) => setFreedom(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener("adsbim:freedom-units", handler);
    return () => window.removeEventListener("adsbim:freedom-units", handler);
  }, []);
  if (!g.temperatureBlock) return null;
  const age = Number.isFinite(Number(temps.age)) ? Number(temps.age) : 1;
  const opacity = Math.min(1, 120 / (1 + age));
  const fmt = (v: number) => (freedom ? `${Math.round(v * 1.8 + 32)}°F` : `${v}°C`);
  const cpuTone = (v: number) => (v < 55 ? "good" : v < 80 ? "warn" : "bad");
  const extTone = (v: number) => (v < -10 ? "warn" : v < 40 ? "good" : v < 50 ? "warn" : "bad");
  const chips = [
    temps.cpu != null && temps.cpu !== "" && { label: "CPU", value: Number(temps.cpu), tone: cpuTone(Number(temps.cpu)) },
    temps.ext != null && temps.ext !== "" && { label: "EXT", value: Number(temps.ext), tone: extTone(Number(temps.ext)) },
  ].filter(Boolean) as { label: string; value: number; tone: "good" | "warn" | "bad" }[];
  if (!chips.length) return null;
  return (
    <div className="flex items-center gap-1" style={{ opacity }}>
      {chips.map((c) => (
        <div
          key={c.label}
          className="flex items-baseline gap-1.5 pr-1.5"
          title={`${c.label} temperature`}
        >
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{c.label}</span>
          <span
            className={cx(
              "text-sm font-medium",
              c.tone === "good" && "text-emerald-600 dark:text-emerald-400",
              c.tone === "warn" && "text-amber-600 dark:text-amber-400",
              c.tone === "bad" && "text-rose-600 dark:text-rose-400",
            )}
          >
            {fmt(c.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

type QuickItem = { key: string; label: string; short: string; href: string; icon: ReactNode };

function QuickLink({ q, primary }: { q: QuickItem; primary?: boolean }) {
  return (
    <a
      href={q.href}
      className={cx(
        "group h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-neutral-600 no-underline transition hover:bg-neutral-100 hover:text-neutral-900 hover:no-underline dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white [&_svg]:size-4",
        primary ? "inline-flex" : "hidden sm:inline-flex",
        "border border-neutral-200 dark:border-neutral-800",
      )}
      title={q.label}
    >
      <span className="flex text-neutral-400 transition group-hover:text-neutral-700 dark:text-neutral-500 dark:group-hover:text-neutral-200">{q.icon}</span>
      <span className="hidden md:inline">{q.label}</span>
      <span className="md:hidden">{q.short}</span>
    </a>
  );
}

export function Navbar() {
  const { g, target, targetName, quick, menus } = useNavModel();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const nonAdsb = isNonAdsb(g);
  const visibleMenus = menus.filter((m) => !m.hidden);
  // quick links not already reachable from a menu section (mobile only)
  const menuHrefs = new Set(visibleMenus.flatMap((m) => m.items?.map((i) => i.href) ?? []));
  const extraQuick = quick.slice(1).filter((q) => !menuHrefs.has(q.href));

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto flex h-16 max-w-[120rem] items-center gap-3 px-3 sm:px-4 lg:px-5">
        <a href="/" className="flex shrink-0 items-center gap-2.5 text-neutral-900 no-underline hover:no-underline dark:text-white">
          <img src={nonAdsb ? g.assets.logoSdr : g.assets.logoAdsb} alt="" className="size-8 rounded-lg" />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-[15px] font-bold tracking-tight">{nonAdsb ? "SDR Feeder" : "ADS-B Feeder"}</span>
            {siteName(g) && <span className="max-w-40 truncate text-xs text-neutral-500 dark:text-neutral-400">{siteName(g)}</span>}
          </span>
        </a>

        {quick.length > 0 && (
          <>
            <span className="hidden h-5 w-px bg-neutral-200 sm:block dark:bg-neutral-800" aria-hidden />
            <div className="flex items-center gap-1.5">
              {quick.map((q, i) => (
                <QuickLink key={q.key} q={q} primary={i === 0} />
              ))}
            </div>
          </>
        )}

        <Temperatures />

        <div className="flex-1" />

        <a href="https://ko-fi.com/H2H2H3JS5" target="_blank" rel="noopener" className="block h-8 w-[2.6rem] shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white transition hover:bg-neutral-50 dark:border-neutral-700" title="Help sustain this project at ko-fi.com">
          {/* scale up to crop the image's own baked-in border so ours is the only one */}
          <img src={g.assets.kofiSmall} alt="Support on Ko-fi" className="size-full scale-[1.18] object-contain" />
        </a>

        <nav className="hidden items-center gap-0 lg:flex lg:-mr-2">
          {g.stage2 && (
            <div className="mr-1 flex items-center gap-1.5">
              <TargetSelector target={target} targetName={targetName} />
              <span className="h-5 w-px bg-neutral-200 dark:bg-neutral-800" aria-hidden />
            </div>
          )}
          {visibleMenus.map((m) => (
            <Dropdown key={m.key} menu={m} open={openMenu === m.key} onToggle={() => setOpenMenu(openMenu === m.key ? null : m.key)} onClose={() => setOpenMenu(null)} />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="-mr-1 inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 lg:hidden dark:text-neutral-300 dark:hover:bg-neutral-800"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobileOpen && (
        <MobileMenu menus={visibleMenus} extraQuick={extraQuick} onClose={() => setMobileOpen(false)}>
          {g.stage2 && <TargetSelector target={target} targetName={targetName} inline />}
        </MobileMenu>
      )}
    </header>
  );
}
