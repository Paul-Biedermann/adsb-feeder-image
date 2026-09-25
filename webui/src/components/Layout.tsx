import { BookOpen, CirclePlay, Globe, Heart, House, MessageCircle, MessagesSquare, Plane } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useBusy } from "../lib/busy";
import { getGlobal, isNonAdsb } from "../lib/data";
import { fetchJson } from "../lib/hooks";
import { Navbar } from "./Navbar";
import { Alert, Button, cx, flashTone, Modal } from "./ui";

const CLOUD_PATH =
  "m3 13.649c0 2.9551 2.4177 5.3507 5.4 5.3507h8.1c2.4853 0 4.5-2.0161 4.5-4.5031 0-1.8466-1.1107-3.552-2.7-4.2469-0.1683-2.9275-2.616-5.25-5.6107-5.25-2.3379 0-4.3424 1.4864-5.1893 3.5-2.7 0.4375-4.5 2.7001-4.5 5.1493z";

// clouds drifting past the plane: vertical position (% of the sky), width (px), seconds per pass;
// smaller clouds are further away, so they are fainter and slower (parallax)
const CLOUDS = [
  { top: 8, width: 26, seconds: 15, delay: -11, opacity: 0.55 },
  { top: 14, width: 44, seconds: 8, delay: -2, opacity: 0.95 },
  { top: 34, width: 30, seconds: 13, delay: -6, opacity: 0.65 },
  { top: 56, width: 38, seconds: 9, delay: -7, opacity: 0.9 },
  { top: 70, width: 24, seconds: 16, delay: -3, opacity: 0.5 },
  { top: 78, width: 42, seconds: 7.5, delay: -5, opacity: 0.95 },
];

// the plane flying through the clouds from the original "Processing..." splash screen;
// `scale` shrinks the clouds and the plane for smaller skies
export function SkyLoader({ text, progress, scale = 1, className = "w-64 sm:w-72", skyClassName = "h-40 sm:h-44" }: { text?: string; progress?: boolean; scale?: number; className?: string; skyClassName?: string }) {
  return (
    <div className={cx("flex flex-col items-center", className)} role="status">
      <div className={cx("relative w-full overflow-hidden rounded-xl bg-gradient-to-b from-neutral-100 to-neutral-50 ring-1 ring-neutral-200 dark:from-neutral-900 dark:to-neutral-950 dark:ring-neutral-800", skyClassName)}>
        {CLOUDS.map((c) => (
          <svg
            key={c.top}
            viewBox="0 0 21 19"
            className="absolute animate-drift fill-neutral-200 motion-reduce:animate-none dark:fill-neutral-800"
            style={{ top: `${c.top}%`, left: `${(c.delay / -c.seconds) * 100}%`, width: c.width * scale, opacity: c.opacity, animationDuration: `${c.seconds}s`, animationDelay: `${c.delay}s` }}
            aria-hidden
          >
            <path d={CLOUD_PATH} />
          </svg>
        ))}
        <div className="absolute top-[42%] left-[38%] flex animate-fly items-center motion-reduce:animate-none">
          <div className="h-0.5 rounded-full bg-gradient-to-r from-transparent to-neutral-300 dark:to-neutral-600" style={{ width: 64 * scale }} />
          <Plane className="shrink-0 fill-current text-neutral-900 dark:text-neutral-100" strokeWidth={1} style={{ width: 36 * scale, height: 36 * scale, transform: "rotate(45deg)" }} />
        </div>
      </div>
      {progress && (
        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div className="h-full w-1/3 animate-progress rounded-full bg-neutral-900 dark:bg-neutral-100 motion-reduce:w-full motion-reduce:animate-none" />
        </div>
      )}
      {text && <div className="mt-4 animate-pulse-soft text-sm font-medium text-neutral-700 motion-reduce:animate-none dark:text-neutral-200">{text}</div>}
    </div>
  );
}

function BusyOverlay() {
  const { active, text } = useBusy();
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-white/85 px-4 backdrop-blur-sm dark:bg-neutral-950/85" aria-live="polite" aria-busy>
      <div className="card animate-pop-in p-5 shadow-2xl sm:p-6">
        <SkyLoader text={text} progress />
      </div>
    </div>
  );
}

function FlashMessages() {
  const g = getGlobal();
  const [messages, setMessages] = useState(g.messages);
  if (!messages.length) return null;
  return (
    <div className="mb-6 space-y-2">
      {messages.map(([category, message], i) => (
        <Alert key={i} tone={flashTone(category)} onDismiss={() => setMessages(messages.filter((_, j) => j !== i))}>
          {message}
        </Alert>
      ))}
    </div>
  );
}

type ChangelogStatus = { show_changelog: boolean; previous_version?: string; new_version?: string; changelog?: string };

function ChangelogPopup() {
  const [status, setStatus] = useState<ChangelogStatus | null>(null);
  useEffect(() => {
    fetchJson<ChangelogStatus>("/api/check_changelog_status", 5000)
      .then((d) => d.show_changelog && setStatus(d))
      .catch((err) => console.log("Error checking changelog status:", err));
  }, []);
  const close = () => {
    setStatus(null);
    fetch("/api/mark_changelog_seen", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(5000) }).catch((err) =>
      console.log("Error marking changelog as seen:", err),
    );
  };
  if (!status) return null;
  return (
    <Modal
      open
      onClose={close}
      size="lg"
      title="Your feeder has been updated!"
      footer={<Button onClick={close}>Cool! 😎</Button>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-500">Updated from</span>
        <span className="code-chip">{status.previous_version}</span>
        <span className="text-neutral-500">to</span>
        <span className="code-chip bg-neutral-100 text-neutral-900 dark:bg-white/[0.06] dark:text-white">{status.new_version}</span>
      </div>
      <pre className="max-h-[50vh] overflow-y-auto rounded-xl bg-neutral-50 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
        {typeof status.changelog === "string" ? status.changelog : JSON.stringify(status.changelog, null, 2)}
      </pre>
    </Modal>
  );
}

function GlobalName() {
  const g = getGlobal();
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!g.fqdn) return;
    const port = Number(g.webport) || 80;
    const candidate = `http://${g.fqdn}${port !== 80 ? `:${port}` : ""}/`;
    fetch(candidate, { method: "HEAD", mode: "no-cors", signal: AbortSignal.timeout(3000) })
      .then(() => setUrl(candidate))
      .catch(() => {});
  }, [g.fqdn, g.webport]);
  if (!url) return null;
  return (
    <AddressLink href={url} icon={<House className="size-3.5" />} title={`Address of this feeder on your local network: ${url}`} />
  );
}

// small icon link chip; shows the bare host without scheme / trailing slash
function AddressLink({ href, icon, title, className = "" }: { href: string; icon: ReactNode; title: string; className?: string }) {
  const host = href.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <a
      href={href}
      title={title}
      className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-neutral-600 no-underline transition-colors hover:border-neutral-300 hover:text-neutral-900 hover:no-underline dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:text-white ${className}`}
    >
      <span className="shrink-0 text-neutral-400 dark:text-neutral-500">{icon}</span>
      <span className="truncate font-mono text-neutral-800 dark:text-neutral-200">{host}</span>
    </a>
  );
}

const footerLink =
  "inline-flex items-center gap-1.5 text-neutral-600 no-underline hover:text-neutral-900 hover:no-underline dark:text-neutral-400 dark:hover:text-white";

function Footer() {
  const g = getGlobal();
  const nonAdsb = isNonAdsb(g);
  // base_version looks like "v3.0.4-beta.7(beta)" - show the channel as its own badge
  const m = (g.baseVersion || "").match(/^([^(]*)(?:\(([^)]*)\))?/);
  const version = m?.[1]?.trim();
  const channel = m?.[2]?.trim();
  return (
    <footer className="mt-4 border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-[120rem] flex-col gap-5 px-3 py-6 text-center text-sm text-neutral-500 sm:px-4 lg:px-5 lg:flex-row lg:text-left lg:items-center lg:justify-between lg:gap-10 dark:text-neutral-400">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <a href={nonAdsb ? "https://sdre.im" : "https://adsb.im"} target="_blank" rel="noopener" className="font-semibold text-neutral-900 no-underline hover:underline dark:text-white">
              {nonAdsb ? "SDR Feeder Image" : "ADS-B Feeder Image"}
            </a>
            {version && <span className="code-chip text-xs">{version}</span>}
            {channel && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{channel}</span>
            )}
          </div>
          {(g.boardName || g.imageName) && (
            <div className="flex flex-wrap justify-center gap-x-1.5 text-xs lg:justify-start">
              {g.boardName && <span>Running on {g.boardName}</span>}
              {g.boardName && g.imageName && <span aria-hidden>·</span>}
              {g.imageName && <span className="break-all">{g.imageName}</span>}
            </div>
          )}
          {g.fqdn && (
            <div className="flex flex-nowrap items-center justify-center gap-2 pt-1.5 text-xs lg:justify-start">
              <GlobalName />
              <AddressLink
                className="shrink-0"
                href="https://my.adsb.im"
                icon={<Globe className="size-3.5" />}
                title="Most people with simple setups can connect to their feeder via my.adsb.im"
              />
            </div>
          )}
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:shrink-0 lg:justify-end">
          <div className="flex flex-nowrap items-center justify-center gap-x-3 whitespace-nowrap text-[13px] sm:gap-x-5 sm:text-sm">
            <a href={nonAdsb ? "https://sdre.im/using" : "https://adsb.im/using"} target="_blank" rel="noopener" className={footerLink}>
              <BookOpen className="size-3.5 sm:size-4" /> Documentation
            </a>
            <a href="https://youtube.com/@adsb" target="_blank" rel="noopener" className={footerLink}>
              <CirclePlay className="size-3.5 sm:size-4" /> YouTube
            </a>
            <a href="https://adsblol.zulipchat.com/#narrow/stream/391168-adsb-feeder-image" target="_blank" rel="noopener" className={footerLink}>
              <MessagesSquare className="size-3.5 sm:size-4" /> Zulip
            </a>
            <a href="https://discord.gg/gducED2VC3" target="_blank" rel="noopener" className={footerLink}>
              <MessageCircle className="size-3.5 sm:size-4" /> Discord
            </a>
          </div>
          <span className="hidden h-4 w-px bg-neutral-200 sm:block dark:bg-neutral-800" aria-hidden />
          <a
            href="https://ko-fi.com/H2H2H3JS5"
            target="_blank"
            rel="noopener"
            title="Help sustain this project at ko-fi.com"
            className="group inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-medium text-rose-700 no-underline transition-colors hover:border-rose-300 hover:bg-rose-100 hover:no-underline dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/15"
          >
            <Heart className="size-4 transition group-hover:scale-110 group-hover:fill-current" /> Support on Ko-fi
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const g = getGlobal();
  // widget mode (iframe embed of the status table) renders without chrome
  if (g.widgetMode) {
    return (
      <>
        <main className="mx-auto max-w-[120rem] px-3 py-6 sm:px-4 lg:px-5">{children}</main>
        <BusyOverlay />
      </>
    );
  }
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-[120rem] flex-1 px-3 pt-4 pb-4 sm:px-4 sm:pt-5 sm:pb-6 lg:px-5">
        <FlashMessages />
        {children}
      </main>
      <Footer />
      <BusyOverlay />
      {g.hasEnv && <ChangelogPopup />}
    </div>
  );
}
