// The Flask app renders templates/spa.html, which embeds two JSON blobs:
//   #adsbim-global: data every page needs (nav state, theme, versions, flashed messages, asset urls)
//   #adsbim-page:   {"page": "<name>", "data": {...}} with the context of the specific template
// Everything is produced by Jinja from the same helpers the old templates used, so the
// backend (routes, form handling, redirects) is unchanged.

export type FlashMessage = [category: string, message: string];

export interface Assets {
  logoAdsb: string;
  logoSdr: string;
  kofiSmall: string;
}

export interface GlobalData {
  hasEnv: boolean;
  widgetMode: boolean;
  theme: "light" | "dark" | "auto";
  aggregatorChoice: string;
  baseConfig: boolean;
  stage2: boolean;
  numMicroSites: number;
  siteNames: string[];
  tar1090QueryParams: string;
  acarshub: boolean;
  shipfeeder: boolean;
  runShipfeeder: boolean;
  runSonde: boolean;
  runHfdlobserver: boolean;
  runDumphfdl: boolean;
  acars2pos: boolean;
  skystats: boolean;
  temperatureBlock: boolean;
  freedomUnits: boolean;
  tempSensor: string;
  baseVersion: string;
  boardName: string;
  imageName: string;
  fqdn: string;
  webport: number | string;
  webAuthEnabled: boolean;
  messages: FlashMessage[];
  assets: Assets;
}

export interface PagePayload<T = Record<string, unknown>> {
  page: string;
  data: T;
}

const defaults: GlobalData = {
  hasEnv: false,
  widgetMode: false,
  theme: "auto",
  aggregatorChoice: "",
  baseConfig: false,
  stage2: false,
  numMicroSites: 0,
  siteNames: [],
  tar1090QueryParams: "",
  acarshub: false,
  shipfeeder: false,
  runShipfeeder: false,
  runSonde: false,
  runHfdlobserver: false,
  runDumphfdl: false,
  acars2pos: false,
  skystats: false,
  temperatureBlock: false,
  freedomUnits: false,
  tempSensor: "",
  baseVersion: "",
  boardName: "",
  imageName: "",
  fqdn: "",
  webport: 80,
  webAuthEnabled: false,
  messages: [],
  assets: {
    logoAdsb: "/static/images/adsbim-logo-64.png",
    logoSdr: "/static/images/sdrim-logo-64.png",
    kofiSmall: "/static/images/kofi_button_stroke_small.png",
  },
};

function readJson<T>(id: string): T | undefined {
  const el = document.getElementById(id);
  if (!el?.textContent) return undefined;
  try {
    return JSON.parse(el.textContent) as T;
  } catch (err) {
    console.error(`failed to parse #${id}`, err);
    return undefined;
  }
}

let cachedGlobal: GlobalData | undefined;
export function getGlobal(): GlobalData {
  if (!cachedGlobal) {
    const raw = readJson<Partial<GlobalData>>("adsbim-global") ?? {};
    cachedGlobal = { ...defaults, ...raw, assets: { ...defaults.assets, ...(raw.assets ?? {}) } };
    cachedGlobal.numMicroSites = Number(cachedGlobal.numMicroSites) || 0;
    if (!Array.isArray(cachedGlobal.siteNames)) cachedGlobal.siteNames = [String(cachedGlobal.siteNames ?? "")];
  }
  return cachedGlobal;
}

export function getPage(): PagePayload {
  return readJson<PagePayload>("adsbim-page") ?? { page: "notfound", data: {} };
}

// convenience helpers for derived state that multiple components need
export const isNonAdsb = (g: GlobalData) => g.aggregatorChoice === "nonadsb";
export const isMicroOrNano = (g: GlobalData) => ["micro", "nano"].includes(g.aggregatorChoice);
export const siteName = (g: GlobalData, idx = 0) => g.siteNames[idx] ?? "";
export const productName = (g: GlobalData) => (isNonAdsb(g) ? "SDR" : "ADS-B");

// ?m=<n> selects a micro feeder on stage 2 systems
export function currentTarget(): number {
  const m = new URLSearchParams(window.location.search).get("m");
  const n = m ? parseInt(m, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}
