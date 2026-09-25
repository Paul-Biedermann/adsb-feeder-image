import { ChevronDown, CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export function cx(...classes: unknown[]) {
  return classes.filter((c): c is string => typeof c === "string" && c !== "").join(" ");
}

/* ------------------------------------------------------------------ buttons */

type Variant = "primary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-neutral-900 text-white shadow-sm shadow-black/10 hover:bg-neutral-700 active:bg-black focus-visible:ring-neutral-400/40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white",
  outline:
    "border border-neutral-300 bg-white text-neutral-700 shadow-sm shadow-neutral-900/[0.03] hover:border-neutral-400 hover:bg-neutral-50 focus-visible:ring-neutral-400/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-800",
  ghost:
    "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-neutral-400/30 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-500 focus-visible:ring-rose-500/40",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 focus-visible:ring-emerald-500/40",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-lg px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-[15px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cx(
    "inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold whitespace-nowrap no-underline transition select-none hover:no-underline",
    "focus-visible:ring-4 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

// (Preact's attribute types also allow signals for className - these components take plain strings)
type Styled<T> = Omit<T, "className"> & { className?: string; variant?: Variant; size?: Size; icon?: ReactNode };
type ButtonProps = Styled<ButtonHTMLAttributes<HTMLButtonElement>>;

export function Button({ variant = "primary", size = "md", icon, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

// a submit button whose name/value pair is what the Flask update() handler dispatches on
export function SubmitButton({
  name,
  value = "go",
  ...rest
}: Omit<ButtonProps, "type" | "name" | "value"> & { name: string; value?: string }) {
  return <Button type="submit" name={name} value={value} {...rest} />;
}

export function LinkButton({ variant = "outline", size = "md", icon, className, children, ...rest }: Styled<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  return (
    <a className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </a>
  );
}

/* -------------------------------------------------------------------- cards */

export function Card({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className={cx("card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap gap-x-4 gap-y-3 px-5 pt-5 sm:px-6",
        description ? "items-start" : "items-center",
        className,
      )}
    >
      {icon && (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 ring-1 ring-neutral-900/5 dark:bg-white/[0.06] dark:text-neutral-400 dark:ring-white/10 [&>svg]:size-[18px]">
          {icon}
        </div>
      )}
      <div className="min-w-24 flex-1 basis-0">
        <h2 className="text-[15px] leading-6 font-semibold text-neutral-900 dark:text-white">{title}</h2>
        {description && <div className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{description}</div>}
      </div>
      {actions && <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("px-5 py-5 sm:px-6", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-neutral-100 bg-neutral-50/70 px-5 py-3 sm:px-6 dark:border-neutral-800 dark:bg-neutral-900/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ page chrome */

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">{title}</h1>
        {subtitle && <div className="mt-1.5 max-w-3xl text-sm text-neutral-500 sm:text-[15px] dark:text-neutral-400">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ alerts */

type Tone = "danger" | "warning" | "info" | "success";
const toneClasses: Record<Tone, string> = {
  danger: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
  info: "border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-neutral-500/30 dark:bg-neutral-500/10 dark:text-neutral-100",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
};
const toneIcon: Record<Tone, ReactNode> = {
  danger: <CircleAlert className="size-5 text-rose-500" />,
  warning: <TriangleAlert className="size-5 text-amber-500" />,
  info: <Info className="size-5 text-neutral-500" />,
  success: <CircleCheck className="size-5 text-emerald-500" />,
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  onDismiss,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  onDismiss?: () => void;
}) {
  return (
    <div role="alert" className={cx("flex gap-3 rounded-xl border px-4 py-3 text-sm animate-pop-in", toneClasses[tone], className)}>
      <div className="mt-px shrink-0">{toneIcon[tone]}</div>
      <div className="min-w-0 flex-1 [&_a]:font-medium [&_a]:text-current [&_a]:underline">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cx(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="-m-1 shrink-0 cursor-pointer rounded-md p-1 opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

// flashed messages come as [category, message]; the backend uses "message", "danger", "error", "success"
export function flashTone(category: string): Tone {
  if (category === "danger" || category === "error") return "danger";
  if (category === "success") return "success";
  return "warning";
}

/* ------------------------------------------------------------------ badges */

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "success" | "warning" | "danger"; className?: string }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-700 ring-neutral-500/10 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-400/10",
    brand: "bg-neutral-100 text-neutral-900 ring-neutral-900/10 dark:bg-white/[0.06] dark:text-white dark:ring-white/10",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
    warning: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
    danger: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>{children}</span>;
}

/* ------------------------------------------------------------ form fields */

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
  aside,
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={className}>
      {(label || aside) && (
        <div className="flex items-end justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="label">
              {label}
            </label>
          )}
          {aside && <div className="mb-1.5">{aside}</div>}
        </div>
      )}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

type FieldProps<T> = Omit<T, "className" | "id" | "name" | "label"> & { className?: string; id?: string; name?: string; label?: ReactNode; hint?: ReactNode; fieldClassName?: string };

// the id defaults to f-<name>, so labels (and tests) can find fields by their form name
const useFieldId = (id?: string, name?: string) => {
  const autoId = useId();
  return id ?? (name ? `f-${name}` : autoId);
};

type TextFieldProps = FieldProps<InputHTMLAttributes<HTMLInputElement>> & {
  aside?: ReactNode;
  trailing?: ReactNode;
  // custom validation error; while set, the field is invalid and blocks the form submission
  validationMessage?: string;
};

export function TextField({ label, hint, fieldClassName, id, className, aside, trailing, validationMessage = "", type = "text", ...rest }: TextFieldProps) {
  const inputId = useFieldId(id, rest.name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.setCustomValidity(validationMessage), [validationMessage]);
  const input = <input ref={ref} id={inputId} type={type} aria-invalid={validationMessage ? true : undefined} className={cx("input", trailing && "pr-10", className)} {...rest} />;
  return (
    <Field label={label} htmlFor={inputId} hint={hint} className={fieldClassName} aside={aside}>
      {trailing ? (
        <div className="relative">
          {input}
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{trailing}</div>
        </div>
      ) : (
        input
      )}
    </Field>
  );
}

export function TextArea({ label, hint, fieldClassName, id, className, ...rest }: FieldProps<TextareaHTMLAttributes<HTMLTextAreaElement>>) {
  const inputId = useFieldId(id, rest.name);
  return (
    <Field label={label} htmlFor={inputId} hint={hint} className={fieldClassName}>
      <textarea id={inputId} className={cx("input", className)} {...rest} />
    </Field>
  );
}

// controlled-or-uncontrolled boolean state
function useBool(checked: boolean | undefined, defaultChecked: boolean | undefined, onChange?: (v: boolean) => void) {
  const [inner, setInner] = useState(!!defaultChecked);
  const value = checked ?? inner;
  const set = (v: boolean) => {
    if (checked === undefined) setInner(v);
    onChange?.(v);
  };
  return [value, set] as const;
}

type BoolProps = {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  className?: string;
  id?: string;
  ariaLabel?: string;
};

// A toggle switch. When `name` is given it posts "1" or "0" through a hidden input, exactly
// like the checkbox handling of the original UI (Flask needs to see unchecked boxes too).
export function Switch({ name, checked, defaultChecked, onChange, disabled, label, description, className, id, ariaLabel }: BoolProps) {
  const [on, setOn] = useBool(checked, defaultChecked, onChange);
  const autoId = useId();
  const switchId = id ?? autoId;
  const control = (
    <button
      type="button"
      role="switch"
      id={switchId}
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => setOn(!on)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:ring-4 focus-visible:ring-neutral-400/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        on ? "bg-neutral-900 dark:bg-neutral-100" : "bg-neutral-300 dark:bg-neutral-700",
      )}
    >
      <span className={cx("inline-block size-5 rounded-full bg-white shadow-sm ring-1 ring-neutral-900/5 transition-transform", on ? "translate-x-[22px] dark:bg-neutral-900" : "translate-x-0.5")} />
    </button>
  );
  return (
    <div className={cx("flex items-start gap-3", className)}>
      {name && <input type="hidden" name={name} value={on ? "1" : "0"} />}
      <div className="pt-px">{control}</div>
      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && (
            <label htmlFor={switchId} className="block cursor-pointer text-sm leading-6 font-medium text-neutral-800 dark:text-neutral-200">
              {label}
            </label>
          )}
          {description && <div className="text-sm text-neutral-500 dark:text-neutral-400">{description}</div>}
        </div>
      )}
    </div>
  );
}

// checkbox visual with the same 1/0 hidden-input semantics as Switch
export function Checkbox({ name, checked, defaultChecked, onChange, disabled, label, description, className, id }: BoolProps) {
  const [on, setOn] = useBool(checked, defaultChecked, onChange);
  const autoId = useId();
  const boxId = id ?? autoId;
  return (
    <div className={cx("flex items-start gap-3", className)}>
      {name && <input type="hidden" name={name} value={on ? "1" : "0"} />}
      <input
        id={boxId}
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => setOn(e.currentTarget.checked)}
        className="mt-[3px] size-4 shrink-0 cursor-pointer rounded border-neutral-300 accent-neutral-900 dark:accent-neutral-200"
      />
      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label && (
            <label htmlFor={boxId} className="block cursor-pointer text-sm leading-6 text-neutral-800 dark:text-neutral-200">
              {label}
            </label>
          )}
          {description && <div className="text-sm text-neutral-500 dark:text-neutral-400">{description}</div>}
        </div>
      )}
    </div>
  );
}

// Segmented control backed by real radio inputs so the value posts natively.
// Selection is tracked by option key (defaults to the value) because some option
// groups have several options posting the same value.
export function Segmented({
  name,
  options,
  selected,
  defaultSelected,
  onChange,
  className,
  required,
  size = "md",
}: {
  name: string;
  options: { value: string; label: ReactNode; key?: string; hidden?: boolean }[];
  selected?: string;
  defaultSelected?: string;
  onChange?: (key: string, value: string) => void;
  className?: string;
  required?: boolean;
  size?: "sm" | "md";
}) {
  const [inner, setInner] = useState<string>(defaultSelected ?? "");
  const [invalid, setInvalid] = useState(false);
  const current = selected ?? inner;
  const baseId = useId();
  const group = (
    <div
      role="radiogroup"
      className={cx(
        "inline-flex flex-wrap gap-1 rounded-xl bg-neutral-100 p-1 ring-1 ring-inset dark:bg-neutral-800/70",
        invalid && !current ? "ring-2 ring-rose-500" : "ring-neutral-200 dark:ring-neutral-700/60",
        className,
      )}
    >
      {options
        .filter((o) => !o.hidden)
        .map((o) => {
          const key = o.key ?? o.value;
          const isSelected = current === key;
          const id = `${baseId}-${key}`;
          return (
            <label
              key={key}
              htmlFor={id}
              className={cx(
                "relative flex cursor-pointer items-center justify-center rounded-lg font-medium transition select-none has-focus-visible:ring-4 has-focus-visible:ring-neutral-400/40",
                size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
                isSelected
                  ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-900/5 dark:bg-neutral-950 dark:text-white dark:ring-white/10"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={o.value}
                checked={isSelected}
                required={required}
                onChange={() => {
                  setInner(key);
                  setInvalid(false);
                  onChange?.(key, o.value);
                }}
                onInvalid={() => setInvalid(true)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
    </div>
  );
  if (!required) return group;
  return (
    <span className="inline-flex flex-col gap-1">
      {group}
      {invalid && !current && <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Please select one of these options.</span>}
    </span>
  );
}

/* ------------------------------------------------------------- disclosure */

// `keepMounted` keeps the (hidden) content in the DOM while closed, so form fields inside keep
// their edits; the section opens by itself when one of them fails validation.
export function Collapsible({
  title = "More information",
  children,
  defaultOpen = false,
  keepMounted = false,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  keepMounted?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!keepMounted || !el) return;
    // "invalid" doesn't bubble, so listen in the capture phase
    const onInvalid = () => setOpen(true);
    el.addEventListener("invalid", onInvalid, true);
    return () => el.removeEventListener("invalid", onInvalid, true);
  }, [keepMounted]);
  return (
    <div className={className} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
      >
        <ChevronDown className={cx("size-4 transition-transform", !open && "-rotate-90")} />
        {title}
      </button>
      {(open || keepMounted) && (
        <div hidden={!open} className="mt-2 animate-fade-in text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-neutral-950/60" onClick={onClose} />
      <div
        className={cx(
          "relative flex max-h-[92vh] w-full animate-pop-in flex-col rounded-t-xl bg-white shadow-2xl ring-1 ring-neutral-900/10 sm:rounded-xl dark:bg-neutral-900 dark:ring-white/10",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h3>
          <button type="button" onClick={onClose} className="-m-1.5 cursor-pointer rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-3 dark:border-neutral-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------------- spinner */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-neutral-700">
      {icon && <div className="mb-3 text-neutral-400 [&>svg]:size-8">{icon}</div>}
      <div className="font-medium text-neutral-800 dark:text-neutral-200">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">{children}</div>}
    </div>
  );
}
