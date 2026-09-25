import { type ReactNode, useEffect, useState } from "react";
import { cx } from "./ui";

// distance from the top of the viewport below which a section counts as scrolled to (below the
// sticky header and the section chips)
const HEADER_LINE = 140;

export type SectionDef ={ id: string; title: string; icon?: ReactNode; hidden?: boolean };

// Two-column settings page: sticky section navigation on the left (horizontal chips on
// small screens) and the sections on the right.
export function SettingsLayout({ sections, children }: { sections: SectionDef[]; children: ReactNode }) {
  const visible = sections.filter((s) => !s.hidden);
  const [active, setActive] = useState(visible[0]?.id);

  const ids = visible.map((s) => s.id).join();
  useEffect(() => {
    const els = visible.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const update = () => {
      // the active section is the last one whose top has scrolled past the header
      let current = els[0]?.id;
      for (const el of els) if (el.getBoundingClientRect().top < HEADER_LINE) current = el.id;
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = els[els.length - 1]?.id;
      setActive(current);
    };
    // No scroll handler (it would run on every frame): the answer can only change when a section
    // edge crosses the header line - watched through a 1px band there - or the end of the page
    // (the footer) comes fully into view.
    let observers: IntersectionObserver[] = [];
    const observe = () => {
      observers.forEach((o) => o.disconnect());
      const line = new IntersectionObserver(update, { rootMargin: `-${HEADER_LINE}px 0px -${Math.max(0, window.innerHeight - HEADER_LINE - 1)}px 0px` });
      els.forEach((el) => line.observe(el));
      // (4px of slack, like the bottom check in update(): subpixel layout can keep the footer
      // a fraction of a pixel from being entirely inside the viewport)
      const end = new IntersectionObserver(update, { threshold: 1, rootMargin: "0px 0px 4px 0px" });
      const footer = document.querySelector("footer");
      if (footer) end.observe(footer);
      observers = [line, end];
    };
    observe();
    update();
    // the band is in pixels from the bottom of the viewport, so it follows the window height
    window.addEventListener("resize", observe);
    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener("resize", observe);
    };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = (s: SectionDef, compact: boolean) => (
    <a
      key={s.id}
      href={`#${s.id}`}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#${s.id}`);
      }}
      className={cx(
        // no color transition: the highlight changes while scrolling and each change would animate (repaint) for several frames
        "flex items-center gap-2.5 text-sm no-underline hover:no-underline [&>svg]:size-4 [&>svg]:shrink-0",
        compact ? "shrink-0 rounded-full border px-3 py-1.5" : "rounded-lg px-3 py-2",
        active === s.id
          ? compact
            ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
            : "bg-neutral-200/60 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white"
          : compact
            ? "border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white",
      )}
    >
      {!compact && s.icon}
      {s.title}
    </a>
  );

  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <nav className="sticky top-16 z-10 -mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-neutral-200 bg-canvas px-4 py-3 lg:hidden dark:border-neutral-800 dark:bg-canvas-dark">
        {visible.map((s) => link(s, true))}
      </nav>
      <nav className="hidden lg:block">
        <div className="sticky top-24 space-y-0.5">{visible.map((s) => link(s, false))}</div>
      </nav>
      <div className="min-w-0 space-y-10">{children}</div>
    </div>
  );
}

export function SettingsSection({ id, title, description, children, className }: { id: string; title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cx("scroll-mt-32 lg:scroll-mt-24", className)}>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h2>
        {description && <div className="mt-1 max-w-3xl text-sm text-neutral-500 dark:text-neutral-400">{description}</div>}
      </div>
      <div className="card divide-y divide-neutral-200 overflow-hidden dark:divide-neutral-800">{children}</div>
    </section>
  );
}

// One setting: title / description on the left, the control on the right. `children` are
// detail fields shown below (e.g. when a feature is enabled); `footer` holds their buttons.
export function SettingsItem({
  title,
  description,
  badge,
  icon,
  control,
  children,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="flex min-w-0 flex-1 gap-3">
          {icon && <div className="mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500 [&>svg]:size-[18px]">{icon}</div>}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {title}
              {badge}
            </div>
            {description && <div className="mt-0.5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{description}</div>}
          </div>
        </div>
        {control && <div className="flex shrink-0 flex-wrap items-center gap-2">{control}</div>}
      </div>
      {children && <div className={cx("space-y-4 px-5 pb-5", icon && "sm:pl-[3.25rem]")}>{children}</div>}
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 bg-neutral-50/70 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-900/40">{footer}</div>}
    </div>
  );
}
