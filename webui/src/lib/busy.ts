import { useSyncExternalStore } from "react";

// global "processing..." overlay shown while a form submission navigates away
type BusyState = { active: boolean; text: string };
let state: BusyState = { active: false, text: "" };
const listeners = new Set<() => void>();

function emit(next: BusyState) {
  state = next;
  listeners.forEach((l) => l());
}

export function showBusy(text = "Processing…") {
  emit({ active: true, text });
}

export function hideBusy() {
  emit({ active: false, text: "" });
}

export function useBusy(): BusyState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// when the user navigates back to a page that was left with the overlay showing,
// the browser may restore it from the back/forward cache - hide the overlay then
window.addEventListener("pageshow", (e) => {
  if (e.persisted) hideBusy();
});
