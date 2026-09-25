import type { JSX } from "preact";
import { createContext, Fragment, type FormHTMLAttributes, type ReactNode, type RefObject, useContext, useEffect, useRef, useState } from "react";
import { showBusy } from "../lib/busy";
import { Button, buttonClass, cx, Switch } from "./ui";

// A plain HTML form that posts to the current URL (or `action`), like every form in the
// original UI. The browser handles the submission and follows the backend's redirect or
// renders the "restarting" page, so all server-side flows stay as they were.
export function PostForm({
  children,
  busy = true,
  busyText,
  className,
  onSubmit,
  ...rest
}: Omit<FormHTMLAttributes<HTMLFormElement>, "method"> & { busy?: boolean; busyText?: string; children: ReactNode }) {
  const handleSubmit: FormHTMLAttributes<HTMLFormElement>["onSubmit"] = (e) => {
    onSubmit?.(e);
    if (!e.defaultPrevented && busy) showBusy(busyText);
  };
  return (
    <form method="post" className={className} onSubmit={handleSubmit} {...rest}>
      {children}
    </form>
  );
}

/* ------------------------------------------------------------ settings form */

// A settings page as one form with a single "Apply" bar that appears once something changed.
//
// update() in app.py handles every field of a POST in one loop, so all of a page's settings can
// go out together. To keep a submission as small as the old per-section forms, only changed
// fields are posted (plus everything inside a `data-submit-all` element, e.g. the fields of a
// feature that is being switched on). Inputs marked `data-change` always count as a change -
// FeatureSwitch uses them for the backend's `<id>--enable` / `<id>--disable` keys.
//
// Other submit buttons inside the form (e.g. "Move to disk") are actions: they post only
// themselves plus the fields of their surrounding ActionScope, as their own little forms did
// before. Fields inside an ActionScope are not settings and never count as changes.
//
// `postAll` keeps a page's old submission exactly (the whole form, natively validated) and
// only adds the change tracking and the bar - for pages that always posted everything.

type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Scan = { changed: Set<string>; submit: Set<string>; validate: FormField[] };

const fieldState = (el: FormField) => (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") ? String(el.checked) : el.value);

function scanForm(form: HTMLFormElement, baseline: WeakMap<FormField, string>): Scan {
  const changed = new Set<string>();
  const submit = new Set<string>();
  const validate: FormField[] = [];
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;
    if (!el.name || el.disabled || el.closest("[data-action-scope]")) continue;
    const now = fieldState(el);
    // first time we see a field: its current value is the baseline (unless it names its own)
    if (!baseline.has(el)) baseline.set(el, el.dataset.baseline ?? now);
    const differs = el.hasAttribute("data-change") || baseline.get(el) !== now;
    if (differs) changed.add(el.name);
    if (differs || el.closest("[data-submit-all]")) {
      submit.add(el.name);
      validate.push(el);
    }
  }
  return { changed, submit, validate };
}

// post name/value pairs to the current URL through a throwaway form, so the browser navigates
// to whatever the backend answers (redirect or the "restarting" page) exactly as before
function postEntries(entries: [string, FormDataEntryValue][], action?: string) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = action ?? window.location.href;
  form.hidden = true;
  for (const [name, value] of entries) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}

type SettingsFormState = { count: number; restart: boolean; applyRef: RefObject<HTMLButtonElement>; discard: () => void };
const SettingsFormContext = createContext<SettingsFormState | null>(null);

export function SettingsForm({
  children,
  action,
  noRestartFields = [],
  onDiscard,
  busyText,
  postAll = false,
}: {
  children: ReactNode;
  // where to post (defaults to the current URL)
  action?: string;
  postAll?: boolean;
  // fields that take effect without restarting containers (posted with "stay" instead of "go")
  noRestartFields?: string[];
  onDiscard?: () => void;
  busyText?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const applyRef = useRef<HTMLButtonElement>(null);
  const baseline = useRef(new WeakMap<FormField, string>());
  const submitting = useRef(false);
  const [generation, setGeneration] = useState(0);
  const [changed, setChanged] = useState<string[]>([]);
  const noRestart = new Set(noRestartFields);
  const restart = changed.some((name) => !noRestart.has(name));

  // re-scan whenever the form's fields change: typing, clicks, fields appearing / disappearing
  // and hidden inputs that React updates
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    baseline.current = new WeakMap();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = [...scanForm(form, baseline.current).changed];
        setChanged((prev) => (prev.join("\n") === next.join("\n") ? prev : next));
      });
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(form, { subtree: true, childList: true, attributes: true, attributeFilter: ["value", "checked", "name", "disabled"] });
    const events = ["input", "change", "click"] as const;
    events.forEach((type) => form.addEventListener(type, schedule));
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      events.forEach((type) => form.removeEventListener(type, schedule));
    };
  }, [generation]);

  // warn before leaving the page with unapplied changes
  const dirty = changed.length > 0;
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submitting.current) e.preventDefault();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) submitting.current = false;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [dirty]);

  const discard = () => {
    setGeneration((g) => g + 1); // remounts the page content with the values it was loaded with
    setChanged([]);
    onDiscard?.();
  };

  const handleSubmit = (e: JSX.TargetedSubmitEvent<HTMLFormElement>) => {
    // only handle this form's own submissions (not those of forms rendered in dialogs)
    if (e.target !== e.currentTarget) return;
    const form = e.currentTarget;
    const submitter = e.submitter as HTMLButtonElement | null;
    if (postAll) {
      // the browser posts the whole form, as before
      submitting.current = true;
      showBusy(busyText);
      return;
    }
    e.preventDefault();
    const scan = scanForm(form, baseline.current);
    const scope = submitter?.closest<HTMLElement>("[data-action-scope]");
    let names: Set<string>;
    if (submitter && submitter === applyRef.current) {
      // validate only what is being submitted, so an untouched section can't block the rest
      const invalid = scan.validate.filter((el) => !el.checkValidity());
      if (invalid.length) {
        // checkValidity() fired "invalid", which opens collapsed sections - report once they render
        requestAnimationFrame(() => invalid[0].reportValidity());
        return;
      }
      names = scan.submit;
    } else {
      const fields = scope ? (Array.from(scope.querySelectorAll("input, select, textarea")) as FormField[]).filter((el) => el.name && !el.disabled) : [];
      const invalid = fields.find((el) => !el.checkValidity());
      if (invalid) {
        invalid.reportValidity();
        return;
      }
      if (scan.changed.size && !window.confirm("You have changes that haven't been applied. Continue without them?")) return;
      names = new Set(fields.map((el) => el.name));
    }
    const entries = [...new FormData(form, submitter)].filter(([name]) => names.has(name) || name === submitter?.name);
    submitting.current = true;
    showBusy(scope?.dataset.busyText ?? busyText);
    postEntries(entries, action);
  };

  // Enter in a text field applies the changes (the browser would otherwise "click" the first
  // submit button in the form, which may be an action like "Move to disk")
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const target = e.target;
    if (e.key !== "Enter" || !(target instanceof HTMLInputElement) || !formRef.current?.contains(target)) return;
    if (["checkbox", "radio", "button", "submit"].includes(target.type)) return;
    e.preventDefault();
    if (applyRef.current) formRef.current.requestSubmit(applyRef.current);
  };

  return (
    <SettingsFormContext.Provider value={{ count: changed.length, restart, applyRef, discard }}>
      <form ref={formRef} method="post" action={action} noValidate={!postAll} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <Fragment key={generation}>{children}</Fragment>
      </form>
    </SettingsFormContext.Provider>
  );
}

// The floating "N unsaved changes · Discard · Apply" bar; place it at the end of the page
// content. With `idle` it stays visible without changes too (for pages whose Apply also moves
// the setup along), showing that text instead. `name` / `value` override the Apply button's
// key for pages whose backend expects a specific one; `extra` adds buttons before it (e.g. a
// second submit button that applies and goes somewhere else).
export function UnsavedChangesBar({
  idle,
  name = "settings--submit",
  value,
  label = "Apply",
  extra,
  className,
}: {
  idle?: ReactNode;
  name?: string;
  value?: string;
  label?: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  const ctx = useContext(SettingsFormContext);
  if (!ctx || (ctx.count === 0 && !idle)) return null;
  const { count, restart, applyRef, discard } = ctx;
  return (
    <div className={cx("sticky bottom-4 z-20 animate-pop-in", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xl shadow-neutral-900/10 dark:border-neutral-700/80 dark:bg-neutral-900 dark:shadow-black/40">
        {count === 0 ? (
          <span className="min-w-0 text-sm text-neutral-500 dark:text-neutral-400">{idle}</span>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5 text-sm">
            <span className="size-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
            <span className="whitespace-nowrap font-medium text-neutral-900 dark:text-white">
              {count} unsaved {count === 1 ? "change" : "changes"}
            </span>
            <span className="hidden truncate text-neutral-500 sm:inline dark:text-neutral-400">
              · {restart ? "applying restarts the affected containers" : "applies without restarting anything"}
            </span>
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {count > 0 && (
            <Button variant="ghost" size="sm" onClick={discard}>
              Discard
            </Button>
          )}
          {extra}
          <button ref={applyRef} type="submit" name={name} value={value ?? (restart ? "go" : "stay")} className={buttonClass("primary", "sm")}>
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

// Switch for a feature the backend turns on / off with button keys - by default its
// `<id>--enable` / `<id>--disable` (which also update derived flags like is_acars_feeder), or
// the [on, off] `keys` given. Flipping it adds that key as a pending change; flipping it back
// removes it again.
export function FeatureSwitch({
  id,
  keys,
  enabled,
  on,
  onChange,
  disabled,
  label,
}: {
  id?: string;
  keys?: [string, string];
  enabled: boolean;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  const [onKey, offKey] = keys ?? [`${id}--enable`, `${id}--disable`];
  return (
    <>
      <Switch checked={on} onChange={onChange} disabled={disabled} ariaLabel={label} />
      {on !== enabled && <input type="hidden" name={on ? onKey : offKey} value="go" data-change="" />}
    </>
  );
}

// Wraps an action (e.g. "Connect" with its SSID and password fields) inside a SettingsForm:
// its buttons post their own fields only, and those fields are not counted as settings.
export function ActionScope({ children, busyText }: { children: ReactNode; busyText?: string }) {
  return (
    <div data-action-scope="" data-busy-text={busyText}>
      {children}
    </div>
  );
}
