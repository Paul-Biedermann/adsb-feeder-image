import { Cloud, MapPin, Plane, Radio, RadioTower, Ship, Upload } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SettingsForm, UnsavedChangesBar } from "../components/form";
import { type Airport, LocationFields } from "../components/LocationFields";
import { Alert, Card, CardBody, CardHeader, Checkbox, cx, LinkButton, PageHeader, Segmented, TextField } from "../components/ui";
import { getGlobal } from "../lib/data";

export interface SetupData {
  siteName: string;
  lat: string;
  lon: string;
  alt: string;
  tz: string;
  dnsState: boolean;
  mem: number;
  message: string;
  aggregatorChoice: string;
  isAdsbFeeder: boolean;
  isAcarsFeeder: boolean;
  acarsdec: boolean;
  acarsdec2: boolean;
  dumpvdl2: boolean;
  acarsFeedId: string;
  acars2FeedId: string;
  vdl2FeedId: string;
  isHfdlFeeder: boolean;
  dumphfdl: boolean;
  hfdlobserver: boolean;
  hfdlFeedId: string;
  hfdlobserverFeedId: string;
  isAisFeeder: boolean;
  aisStationName: string;
  isSondeFeeder: boolean;
  initials: string;
}

const feederTypes = [
  { key: "integrated", value: "individual", label: "Default (integrated)" },
  { key: "micro", value: "micro", label: "Micro" },
  { key: "nano", value: "nano", label: "Nano" },
  { key: "stage2", value: "stage2", label: "Stage 2" },
];

// A card-style toggle for one of the data types. It posts 1/0 like every checkbox in this UI.
function DataTypeTile({
  name,
  title,
  description,
  icon,
  checked,
  onChange,
  children,
}: {
  name: string;
  title: string;
  description: string;
  icon: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border p-4 transition",
        checked ? "border-neutral-400 bg-neutral-50 ring-1 ring-neutral-900/10 dark:border-neutral-600 dark:bg-white/[0.04]" : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700",
      )}
    >
      <input type="hidden" name={name} value={checked ? "1" : "0"} />
      <button type="button" onClick={() => onChange(!checked)} className="flex w-full cursor-pointer items-start gap-3 text-left" aria-pressed={checked}>
        <span
          className={cx(
            "flex size-10 shrink-0 items-center justify-center rounded-xl transition [&>svg]:size-5",
            checked ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-neutral-900 dark:text-white">{title}</span>
          <span className="block text-sm text-neutral-500 dark:text-neutral-400">{description}</span>
        </span>
        <span
          className={cx(
            "mt-1 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition",
            checked ? "border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900" : "border-neutral-300 dark:border-neutral-600",
          )}
        >
          {checked && (
            <svg viewBox="0 0 12 12" className="size-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M2.5 6.5l2.5 2.5 4.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>
      {/* sub-options stay in the form while hidden, just like the old UI */}
      <div className={cx("mt-4 border-t border-neutral-200/70 pt-4 dark:border-neutral-700/60", !checked && "hidden")}>{children}</div>
    </div>
  );
}

export function Setup({ data }: { data: SetupData }) {
  return (
    <>
      <PageHeader
        eyebrow="Setup"
        title="Basic Setup"
        subtitle="The data below should match the exact location of your antenna. For a Stage 2 feeder that connects to already running micro feeders, it defines the center of your combined map display."
        actions={
          <LinkButton href="/restore" icon={<Upload className="size-4" />}>
            Restore previous backup
          </LinkButton>
        }
      />
      {!data.dnsState && (
        <Alert tone="danger" className="mb-6">
          The feeder cannot resolve DNS queries. This will most likely prevent it from working at all.
        </Alert>
      )}

      <SettingsForm action="/setup" postAll>
        <SetupFields data={data} />
      </SettingsForm>
    </>
  );
}

// state lives below SettingsForm so "Discard" resets it
function SetupFields({ data }: { data: SetupData }) {
  const [adsb, setAdsb] = useState(data.isAdsbFeeder);
  const initialType = ["integrated", "all", "privacy", "individual"].includes(data.aggregatorChoice)
    ? "integrated"
    : ["micro", "nano", "stage2"].includes(data.aggregatorChoice)
      ? data.aggregatorChoice
      : "";
  const [feederType, setFeederType] = useState(initialType);
  const [acars, setAcars] = useState(data.isAcarsFeeder);
  const [hfdl, setHfdl] = useState(data.isHfdlFeeder);
  const [ais, setAis] = useState(data.isAisFeeder);
  const [sonde, setSonde] = useState(data.isSondeFeeder);
  const [initials, setInitials] = useState(data.initials);
  const [airport, setAirport] = useState<Airport>(null);
  const [showInitials] = useState(() => data.isAcarsFeeder || data.isHfdlFeeder || data.isAisFeeder || data.isSondeFeeder);
  const nonAdsbSelected = showInitials || acars || hfdl || ais || sonde;

  const feedLabel = (value: string, suffix: string) => value || `${initials}-${airport?.icao ?? ""}-${suffix}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={<MapPin />}
          title="Station location"
          description={
            <>
              Use the{" "}
              <a href="https://www.freemaptools.com/elevation-finder.htm" target="_blank" rel="noopener">
                location and elevation finder tool
              </a>{" "}
              to find your latitude, longitude, and altitude based on your address.
            </>
          }
        />
        <CardBody>
          <LocationFields siteName={data.siteName} lat={data.lat} lon={data.lon} alt={data.alt} tz={data.tz} onAirport={setAirport} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={<RadioTower />} title="What data do you want to track?" description="Select each data type you want to track – you can always change this later." />
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-2">
            <DataTypeTile
              name="is_adsb_feeder"
              title="ADS-B"
              description="Aircraft positions on 1090 MHz (and UAT 978 MHz)"
              icon={<Plane />}
              checked={adsb}
              onChange={(v) => {
                setAdsb(v);
                // if nothing has been selected, default to integrated
                if (v && !feederType) setFeederType("integrated");
              }}
            >
              <div className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Type of feeder</div>
              <Segmented name="aggregator_choice" size="sm" options={feederTypes} selected={feederType} onChange={(k) => setFeederType(k)} />
              <div className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                {feederType === "integrated" && (
                  <>
                    <strong className="text-neutral-700 dark:text-neutral-300">Integrated feeder:</strong> the default option that most users will want. Collect data using attached SDRs and send
                    to one or more aggregators.
                  </>
                )}
                {feederType === "micro" && (
                  <>
                    <strong className="text-neutral-700 dark:text-neutral-300">Micro feeder:</strong> collect data using attached SDRs and otherwise minimize memory use and disable local features.
                    Designed to work with a second stage image that uses this feeder as its input and creates the map, feeds the aggregators, etc.
                  </>
                )}
                {feederType === "nano" && (
                  <>
                    <strong className="text-neutral-700 dark:text-neutral-300">Nano feeder:</strong> like micro, but minimizes memory use even more and disables most local features, including the
                    graphs. Additionally optimized to reduce disk IO.
                  </>
                )}
                {feederType === "stage2" && (
                  <>
                    <strong className="text-neutral-700 dark:text-neutral-300">Stage 2:</strong> connects to one or more micro feeders. You can select for each of them individually which
                    aggregators you want to feed, and you get a combined map of all the planes that the micro feeders see.
                    {data.mem < 1800000 && (
                      <span className="mt-2 block font-medium text-amber-600 dark:text-amber-400">
                        Warning: Stage 2 setup with only {Math.floor(data.mem / 1024)} MB of memory (400 to 600MB per microsite recommended).
                      </span>
                    )}
                  </>
                )}
              </div>
            </DataTypeTile>

            <DataTypeTile name="is_acars_feeder" title="ACARS / VDL2" description="Aircraft datalink messages" icon={<Radio />} checked={acars} onChange={setAcars}>
              <div className="space-y-2">
                <Checkbox name="acarsdec" defaultChecked={data.acarsdec} label={feedLabel(data.acarsFeedId, "ACARS")} />
                <Checkbox name="acarsdec2" defaultChecked={data.acarsdec2} label={feedLabel(data.acars2FeedId, "ACARS2")} />
                <Checkbox name="dumpvdl2" defaultChecked={data.dumpvdl2} label={feedLabel(data.vdl2FeedId, "VDL2")} />
              </div>
            </DataTypeTile>

            <DataTypeTile name="is_hfdl_feeder" title="HFDL" description="High frequency datalink" icon={<RadioTower />} checked={hfdl} onChange={setHfdl}>
              <div className="space-y-2">
                <Checkbox name="dumphfdl" defaultChecked={data.dumphfdl} label={feedLabel(data.hfdlFeedId, "HFDL (SDR)")} />
                <Checkbox name="hfdlobserver" defaultChecked={data.hfdlobserver} label={feedLabel(data.hfdlobserverFeedId, "HFDL (WEB-888)")} />
              </div>
            </DataTypeTile>

            <DataTypeTile name="is_ais_feeder" title="AIS" description="Ship positions" icon={<Ship />} checked={ais} onChange={setAis}>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">Station name: {feedLabel(data.aisStationName, "AIS")}</div>
            </DataTypeTile>

            <DataTypeTile name="is_sonde_feeder" title="Sonde" description="Weather balloon radiosondes" icon={<Cloud />} checked={sonde} onChange={setSonde} />

            <div className={cx("rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700", !nonAdsbSelected && "hidden")}>
              <TextField
                label="Initials for non-ADS-B station names"
                hint="Used to create feed IDs like FL-ICAO-ACARS"
                name="initials"
                placeholder="initials"
                className="max-w-40"
                value={initials}
                onChange={(e) => setInitials(e.currentTarget.value)}
                data-1p-ignore
              />
            </div>
          </div>
        </CardBody>
      </Card>
      {/* before the initial setup is done, Apply is what moves it along, so keep it visible */}
      <UnsavedChangesBar name="submit" value="go" label="Apply settings" idle={data.message || (!getGlobal().baseConfig && "Settings take effect after applying.")} />
    </div>
  );
}
