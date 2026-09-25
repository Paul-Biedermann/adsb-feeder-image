// css_theme is "light", "dark" or "auto" (follow the OS). Tailwind's dark: variant keys off
// the "dark" class on <html>. spa.html sets it before first paint to avoid a flash; this
// keeps it in sync when the OS setting changes while the page is open. It is called again
// when the theme is previewed on the Advanced page, so there is only one OS listener.
let current = "auto";
let listening = false;

export function applyTheme(theme: string) {
  current = theme;
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const update = () => {
    const dark = current === "dark" || (current !== "light" && mql.matches);
    document.documentElement.classList.toggle("dark", dark);
  };
  update();
  if (!listening) {
    mql.addEventListener("change", update);
    listening = true;
  }
}
