import { Clock, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fetchJson } from "../lib/hooks";
import { Button, TextField } from "./ui";

export const LAT_PATTERN = String.raw`(?:\+|-|)(?:(?:[0-8]?\d)(?:\.\d+)?|90(?:\.0+)?)(,(?:\+|-|)(:?(:?\d?\d|1[0-7]\d)(?:\.\d+)?|180(?:\.0+)?))?`;
export const LON_PATTERN = String.raw`(?:\+|-|)(:?(:?\d?\d|1[0-7]\d)(?:\.\d+)?|180(?:\.0+)?)`;
export const NAME_PATTERN = String.raw`[\-_.a-zA-Z0-9 ]+`;

export function browserTZ() {
  try {
    return Intl.DateTimeFormat("en-US").resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

// convert "1234ft" to meters and make sure the value ends with "m" (like fixAlt() in the old UI)
export function fixAlt(value: string) {
  const factor = value.toLowerCase().includes("ft") ? 0.3048 : 1.0;
  const alt = Math.round(parseFloat(value) * factor);
  return Number.isNaN(alt) ? "" : `${alt}m`;
}

export type Airport = { icao: string; name: string } | null;

export function LocationFields({
  siteName,
  lat,
  lon,
  alt,
  tz,
  showAlt = true,
  siteLabel = "Station name",
  siteHint = "Shows up on public maps if enabled later",
  onAirport,
}: {
  siteName: string;
  lat: string;
  lon: string;
  alt?: string;
  tz: string;
  showAlt?: boolean;
  siteLabel?: string;
  siteHint?: string;
  onAirport?: (a: Airport) => void;
}) {
  const [latV, setLat] = useState(lat);
  const [lonV, setLon] = useState(lon);
  const [altV, setAlt] = useState(alt ? fixAlt(alt) : "");
  const [tzV, setTz] = useState(tz || browserTZ());
  const [airport, setAirport] = useState<Airport>(null);
  const checked = useRef({ lat: "", lon: "" });

  const checkAirport = (la: string, lo: string) => {
    if (!la || !lo || (la === checked.current.lat && lo === checked.current.lon)) return;
    checked.current = { lat: la, lon: lo };
    fetchJson<Airport>(`/api/closest_airport/${encodeURIComponent(la)}/${encodeURIComponent(lo)}`)
      .then((a) => {
        setAirport(a);
        onAirport?.(a);
      })
      .catch((err) => console.log(`closest_airport(${la}, ${lo}) -> ${err}`));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => checkAirport(lat, lon), []);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        fieldClassName="sm:col-span-2"
        label={siteLabel}
        hint={siteHint}
        name="site_name"
        required
        placeholder="my-awesome-antenna"
        pattern={NAME_PATTERN}
        title="Letters, numbers, -, _, ."
        defaultValue={siteName}
      />
      <TextField
        label="Latitude"
        hint="-90 … +90, please use 5 decimals, e.g. 45.12345. You can also paste “lat, lon”."
        name="lat"
        required
        placeholder="Antenna latitude"
        inputMode="decimal"
        pattern={LAT_PATTERN}
        title="Number between -90 and 90"
        value={latV}
        onChange={(e) => setLat(e.currentTarget.value)}
        onBlur={() => {
          const parts = latV.split(",");
          let la = latV;
          let lo = lonV;
          if (parts.length > 1) {
            la = parts[0].trim();
            lo = parts[1].trim();
            setLat(la);
            setLon(lo);
          }
          checkAirport(la, lo);
        }}
      />
      <TextField
        label="Longitude"
        hint="-180 … +180, please use 5 decimals, e.g. -122.12345"
        name="lon"
        required
        placeholder="Antenna longitude"
        inputMode="decimal"
        pattern={LON_PATTERN}
        title="Number between -180 and 180"
        value={lonV}
        onChange={(e) => setLon(e.currentTarget.value)}
        onBlur={() => checkAirport(latV, lonV)}
      />
      {showAlt && (
        <TextField
          label="Altitude above mean sea level"
          hint="Rounded to whole meters – or add “ft” to enter feet"
          name="alt"
          required
          placeholder="in m – or add 'ft' to enter in ft"
          pattern={String.raw`(?:\+|-|)\d+(?:m|ft)`}
          value={altV}
          onChange={(e) => setAlt(e.currentTarget.value)}
          onBlur={() => setAlt(fixAlt(altV))}
        />
      )}
      <TextField
        label="Timezone"
        name="tz"
        required
        placeholder="populate from the browser timezone"
        value={tzV}
        onChange={(e) => setTz(e.currentTarget.value)}
        trailing={
          <Button size="sm" variant="ghost" onClick={() => setTz(browserTZ())} title="Use the timezone of this browser" icon={<Clock className="size-3.5" />}>
            Browser
          </Button>
        }
      />
      <div className="flex items-center gap-2 text-sm text-neutral-500 sm:col-span-2 dark:text-neutral-400">
        <MapPin className="size-4 text-neutral-500" />
        Closest airport suggestion:{" "}
        {airport ? (
          <span className="font-medium text-neutral-700 dark:text-neutral-200">
            {airport.icao} ({airport.name})
          </span>
        ) : (
          <span>–</span>
        )}
      </div>
    </div>
  );
}
