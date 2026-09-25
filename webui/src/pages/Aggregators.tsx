import { KeyRound, Plane, Radio, Shield, ShieldAlert, Ship, Users } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SettingsForm, UnsavedChangesBar } from "../components/form";
import { SettingsLayout, SettingsSection } from "../components/Settings";
import { Alert, cx, PageHeader, Segmented, SubmitButton, Switch, TextField } from "../components/ui";

type NetConfig = { identifier: string; name: string; website: string; policy: string; enabled: boolean; uuid: string };
type KeyAgg = { enabled: boolean; key: string; user?: string };

export interface AggregatorsData {
  m: string;
  site: string;
  baseConfig: boolean;
  aggregatorChoice: string;
  mlatEnable: boolean;
  mlatPrivacy: boolean;
  lat: string;
  lon: string;
  uat978: boolean;
  siteName: string;
  mlatNameOverride: string;
  netconfigs: NetConfig[];
  flightradar: KeyAgg & { uatKey: string };
  flightaware: KeyAgg;
  radarbox: KeyAgg;
  planefinder: KeyAgg;
  adsbhub: KeyAgg;
  opensky: KeyAgg;
  planewatch: KeyAgg;
  uk1090: KeyAgg;
  sdrmap: KeyAgg & { user0: string };
  radarvirtuel: boolean;
  acarsSection: boolean;
  acars: Record<string, boolean>;
  aisSection: boolean;
  ais: Record<string, boolean>;
  aisValues: Record<string, string>;
}

/* ------------------------------------------------------------ building blocks */

function PolicyBadge({ policy }: { policy?: string }) {
  return policy ? (
    <a href={policy} title="Privacy policy" className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 no-underline ring-1 ring-emerald-600/15 ring-inset hover:no-underline dark:bg-emerald-500/10 dark:text-emerald-300">
      <Shield className="size-3" /> Policy
    </a>
  ) : (
    <span title="This site is missing a clear data / privacy policy" className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-600/20 ring-inset dark:bg-amber-500/10 dark:text-amber-300">
      <ShieldAlert className="size-3" /> No policy
    </span>
  );
}

// one aggregator: toggle + name + optional description; `children` (fields) show while enabled
function AggRow({
  name,
  title,
  href,
  policy,
  showPolicy = true,
  checked,
  onChange,
  description,
  children,
}: {
  name: string;
  title: string;
  href: string;
  policy?: string;
  showPolicy?: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={cx("py-4 first:pt-0 last:pb-0")}>
      <div className="flex items-start gap-3">
        <Switch name={name} checked={checked} onChange={onChange} id={name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={name} className="cursor-pointer text-sm font-semibold text-neutral-900 dark:text-white">
              {title}
            </label>
            <a href={href} target="_blank" rel="noopener" className="text-xs text-neutral-400 hover:text-neutral-900">
              {href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
            {showPolicy && <PolicyBadge policy={policy} />}
          </div>
          {description && <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</div>}
          {/* fields stay in the form when hidden so values aren't lost, like the old UI */}
          {children && <div className={cx("mt-3 space-y-3", !checked && "hidden")}>{children}</div>}
        </div>
      </div>
    </div>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-neutral-100 dark:divide-neutral-800">{children}</div>;
}

function RequestKey({ name, stay }: { name: string; stay: string }) {
  return (
    <SubmitButton name={name} value={stay} size="sm" variant="outline" icon={<KeyRound className="size-3.5" />}>
      Request key
    </SubmitButton>
  );
}

const aisAggs: { key: string; title: string; href: string; description: ReactNode; field?: { name: string; label: ReactNode; placeholder: string; port?: boolean } }[] = [
  { key: "ais_feed_airframes", title: "Airframes.io", href: "https://airframes.io/", description: "An unbiased and unfiltered transportation aggregation service that also supports AIS." },
  {
    key: "ais_feed_aiscatcher",
    title: "AIS Catcher",
    href: "https://aiscatcher.org/",
    description: "A community of AIS enthusiasts dedicated to maritime tracking.",
    field: { name: "aiscatcher_feeder_key", label: <>Get a sharing key by <a href="https://aiscatcher.org/addstation">registering your station</a>.</>, placeholder: "AIS Catcher Sharing Key" },
  },
  {
    key: "ais_feed_aisfriends",
    title: "AIS Friends",
    href: "https://aisfriends.com/",
    description: "A volunteer AIS network aggregating data.",
    field: { name: "aisfriends_udp_port", label: <>Get a dedicated UDP port assigned by <a href="https://www.aisfriends.com/register">registering your station</a> and enter it here.</>, placeholder: "AIS Friends UDP Port", port: true },
  },
  {
    key: "ais_feed_aishub",
    title: "AISHub",
    href: "https://www.aishub.net/",
    description: "A free AIS data sharing community.",
    field: { name: "aishub_udp_port", label: <>Get a dedicated UDP port assigned by <a href="https://www.aishub.net/join-us">registering your station</a> and enter it here.</>, placeholder: "AISHub UDP Port", port: true },
  },
  { key: "ais_feed_ais_hpradar", title: "HPRadar", href: "https://sea.hpradar.com/", description: "A free aggregator for AIS (and ADS-B) data." },
  { key: "ais_feed_sdrmap", title: "sdrmap", href: "https://sdrmap.org/", description: "A German community aggregator for AIS (and ADS-B) data." },
  {
    key: "ais_feed_marinetraffic",
    title: "MarineTraffic",
    href: "https://www.marinetraffic.com/",
    description: "A British commercial aggregator for AIS data.",
    field: { name: "ais_marinetraffic_udp_port", label: <>Get a dedicated UDP port assigned by <a href="https://www.marinetraffic.com/en/join-us/cover-your-area">registering your station</a> and enter it here.</>, placeholder: "MarineTraffic UDP Port", port: true },
  },
  {
    key: "ais_feed_myshiptracking",
    title: "MyShipTracking",
    href: "https://www.myshiptracking.com/",
    description: "A Greek commercial aggregator for AIS data.",
    field: { name: "ais_myshiptracking_udp_port", label: <>Get a dedicated UDP port assigned by <a href="https://www.myshiptracking.com/help-center/contributors/add-your-station">registering your station</a> and enter it here.</>, placeholder: "MyShipTracking UDP Port", port: true },
  },
  {
    key: "ais_feed_boatbeacon",
    title: "pocketmariner / BoatBeacon",
    href: "https://pocketmariner.com/",
    description: "A British commercial AIS data sharing company.",
    field: { name: "ais_boatbeacon_udp_port", label: <>Get a dedicated UDP port assigned by sending an email to <a href="mailto:support@pocketmariner.com">support@pocketmariner.com</a> registering your station and enter it here.</>, placeholder: "BoatBeacon UDP Port", port: true },
  },
  { key: "ais_feed_shipfinder", title: "shipfinder", href: "https://shipfinder.co/about", description: "A British commercial aggregator for AIS data and pictures." },
  {
    key: "ais_feed_shippingexplorer",
    title: "ShippingExplorer",
    href: "https://www.shippingexplorer.net/",
    description: "A Spanish commercial aggregator for AIS data.",
    field: { name: "ais_shippingexplorer_udp_port", label: <>Get a dedicated UDP port assigned by <a href="https://www.shippingexplorer.net/en/contact">registering your station</a> and enter it here.</>, placeholder: "ShippingExplorer UDP Port", port: true },
  },
  {
    key: "ais_feed_shipxplorer",
    title: "ShipXplorer",
    href: "https://www.shipxplorer.com/",
    description: "A US commercial aggregator for AIS data, part of AirNav Radar.",
    field: { name: "ais_shipxplorer_udp_port", label: <>Get a dedicated UDP port assigned by <a href="https://www.shipxplorer.com/addcoverage">registering your station</a> and enter it here.</>, placeholder: "ShipXplorer UDP Port", port: true },
  },
  {
    key: "ais_feed_vesselfinder",
    title: "VesselFinder",
    href: "https://stations.vesselfinder.com/",
    description: "A Bulgarian commercial aggregator for AIS data.",
    field: { name: "ais_vesselfinder_udp_port", label: <>Get a dedicated UDP port assigned by <a href="https://stations.vesselfinder.com/become-partner">registering your station</a> and enter it here.</>, placeholder: "VesselFinder UDP Port", port: true },
  },
];

const acarsAggs: { key: string; title: string; href: string; description: ReactNode }[] = [
  { key: "feed_acars_airframes", title: "Airframes.io", href: "https://airframes.io/", description: "An unbiased and unfiltered transportation aggregation service for data sources such as ACARS, VDL, HFDL, and SATCOM. Most people interested in tracking this kind of data want to feed this aggregator." },
  {
    key: "feed_acars_acarsdrama",
    title: "AcarsDrama",
    href: "https://acarsdrama.com/",
    description: (
      <>
        A rather different type of aggregator, mainly focused on picking out things that are funny (or drama) from the large amount of ACARS data that's available. The volunteers behind AcarsDrama request
        that you please <a href="mailto:feeders@acarsdrama.com">send email to them</a> to let them know that you are feeding them data and give them an approximate location of your feeder.
      </>
    ),
  },
  { key: "feed_acars_adsblol", title: "adsb.lol", href: "https://www.adsb.lol/docs/open-data/aircraft-data-links/", description: "Focused on dumping the raw data into a publicly available github repository." },
  {
    key: "feed_acars_avdelphi",
    title: "AVDelphi",
    href: "https://avdelphi.com/",
    description: (
      <>
        Another aggregator for ACARS data. Note that you need to claim your feed on their <a href="https://www.avdelphi.com/claim_feed.html">website</a> before you are allowed to feed them.
      </>
    ),
  },
  { key: "feed_acars_flightdeck", title: "FlightDeck", href: "https://www.tryflightdeck.com/", description: "" },
];

/* ------------------------------------------------------------------- page */

// the whole form is posted as before (the key requests read their fields from it); the bar adds
// change tracking and stays visible, because Apply also completes the initial setup
export function Aggregators({ data }: { data: AggregatorsData }) {
  return (
    <SettingsForm postAll>
      <AggregatorsForm data={data} />
    </SettingsForm>
  );
}

function AggregatorsForm({ data }: { data: AggregatorsData }) {
  const m = data.m;
  const go = m === "0" ? "go" : `go-${m}`;
  const stay = m === "0" ? "stay" : `stay-${m}`;
  const showAdsb = data.baseConfig && !["micro", "nano", "nonadsb"].includes(data.aggregatorChoice);
  const adsbHandledByStage2 = data.baseConfig && ["micro", "nano"].includes(data.aggregatorChoice);

  // account-less aggregators (ultrafeeder based + RadarVirtuel) with quick select
  const [uf, setUf] = useState<Record<string, boolean>>(() => Object.fromEntries(data.netconfigs.map((c) => [c.identifier, c.enabled])));
  const [radarvirtuel, setRadarvirtuel] = useState(data.radarvirtuel);
  const [choice, setChoice] = useState(["all", "privacy", "individual"].includes(data.aggregatorChoice) ? data.aggregatorChoice : "");
  const applyQuick = (key: string) => {
    setChoice(key);
    if (key === "all") {
      setUf(Object.fromEntries(data.netconfigs.map((c) => [c.identifier, true])));
      setRadarvirtuel(true);
    } else if (key === "privacy") {
      setUf(Object.fromEntries(data.netconfigs.map((c) => [c.identifier, !!c.policy])));
      setRadarvirtuel(false);
    } else if (key === "none") {
      setUf(Object.fromEntries(data.netconfigs.map((c) => [c.identifier, false])));
      setRadarvirtuel(false);
    }
  };

  const [others, setOthers] = useState({
    flightradar: data.flightradar.enabled,
    flightaware: data.flightaware.enabled,
    radarbox: data.radarbox.enabled,
    planefinder: data.planefinder.enabled,
    adsbhub: data.adsbhub.enabled,
    opensky: data.opensky.enabled,
    planewatch: data.planewatch.enabled,
    uk1090: data.uk1090.enabled,
    sdrmap: data.sdrmap.enabled,
  });
  const setOther = (k: keyof typeof others) => (v: boolean) => setOthers({ ...others, [k]: v });
  const [acars, setAcars] = useState(data.acars);
  const [ais, setAis] = useState(data.ais);
  // the sdrmap credentials are shared between the ADS-B and AIS sections (same form fields)
  const [sdrmapUser, setSdrmapUser] = useState(data.sdrmap.user ?? "");
  const [sdrmapKey, setSdrmapKey] = useState(data.sdrmap.key);
  const faSuffix = m !== "0" ? `_${m}` : "";

  return (
    <>
      <PageHeader eyebrow="Data Sharing" title={`Data Sharing Setup${data.site ? ` for feeder ${data.site}` : ""}`} subtitle="Choose the aggregators this feeder sends its data to." />

      <SettingsLayout
        sections={[
          { id: "mlat", title: "MLAT", icon: <Plane />, hidden: !showAdsb },
          { id: "community", title: "Community", icon: <Users />, hidden: !showAdsb },
          { id: "accounts", title: "Account-based", icon: <KeyRound />, hidden: !showAdsb },
          { id: "acars", title: "ACARS / VDL2 / HFDL", icon: <Radio />, hidden: !data.acarsSection },
          { id: "ais", title: "AIS", icon: <Ship />, hidden: !data.aisSection },
          { id: "station", title: "Station name", icon: <Users /> },
        ]}
      >
        <Alert tone="info" title="Support the community!">
          If you're not already, consider feeding at least one (or all?) non-commercial aggregator(s). Unlike commercial aggregators, they don't require accounts and some of them keep their data freely open
          for everyone.
        </Alert>

        {adsbHandledByStage2 && (
          <Alert tone="warning" title="ADS-B">
            ADS-B is enabled, however, for micro and nano feeders, the data sharing settings are handled on your stage 2 system.
          </Alert>
        )}

        {showAdsb && (
          <>
            <SettingsSection id="mlat" title="ADS-B: MLAT" description="Multilateration lets aggregators locate aircraft without ADS-B positions.">
              <div className="space-y-4 px-5 py-4">
                <Switch name="mlat_enable--is_enabled" defaultChecked={data.mlatEnable} label="Enable MLAT" description="For selected aggregators supporting MLAT" />
                <Switch
                  name="mlat_privacy--is_enabled"
                  defaultChecked={data.mlatPrivacy}
                  label="Enable privacy flag"
                  description={
                    <>
                      ON = your site won't be visible at all on{" "}
                      <a href={`https://mlat.adsb.lol/syncmap/#lat=${data.lat}#lon=${data.lon}#zoom=10`}>public aggregator maps</a> – OFF = your site will be visible at an approximate location.
                    </>
                  }
                />
              </div>
            </SettingsSection>

            <SettingsSection id="community" title="Community ADS-B aggregators" description="Account-less aggregators – no sign-up required.">
              <div className="px-5 py-4">
                <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800/40">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Quick select</span>
                  <Segmented
                    name="aggregator_choice"
                    required
                    selected={choice}
                    onChange={(k) => applyQuick(k)}
                    options={[
                      { value: "all", label: "All" },
                      { value: "privacy", label: "Privacy" },
                      { value: "individual", label: "Individual" },
                      { key: "none", value: "individual", label: "None" },
                    ]}
                  />
                </div>
                <Rows>
                  {data.netconfigs.map((c) => (
                    <AggRow
                      key={c.identifier}
                      name={`${c.identifier}--ultrafeeder--is_enabled`}
                      title={c.name}
                      href={c.website}
                      policy={c.policy}
                      checked={!!uf[c.identifier]}
                      onChange={(v) => {
                        setUf({ ...uf, [c.identifier]: v });
                        setChoice("individual");
                      }}
                    >
                      <TextField
                        label="UUID"
                        name={`${c.identifier}--ultrafeeder--uuid`}
                        className="max-w-md font-mono text-xs"
                        placeholder={`${c.name} UUID`}
                        defaultValue={c.uuid}
                        required={!!uf[c.identifier]}
                      />
                    </AggRow>
                  ))}
                  <AggRow
                    name="radarvirtuel--is_enabled"
                    title="RadarVirtuel"
                    href="https://www.radarvirtuel.com/"
                    checked={radarvirtuel}
                    onChange={(v) => {
                      setRadarvirtuel(v);
                      setChoice("individual");
                    }}
                  />
                </Rows>
              </div>
            </SettingsSection>

            <SettingsSection id="accounts" title="Account-based ADS-B aggregators" description="These require an account, a sharing key or a feeder ID.">
              <div className="px-5 py-4">
                <Rows>
                  <AggRow name="flightradar--is_enabled" title="Flightradar24" href="https://www.flightradar24.com/" policy="https://www.flightradar24.com/privacy-policy" checked={others.flightradar} onChange={setOther("flightradar")}>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {data.uat978
                        ? "Enter your two FR24 sharing keys (first one for ADS-B/1090, second one for UAT). For either or both of the fields you can also enter your email address and the feeder will request the corresponding key for you."
                        : "Enter your FR24 sharing key (or enter your email address and click the button to request a sharing key)."}{" "}
                      Requesting a feeder key by email will fail if you already have three feeders associated with that email address. In that case you will need to email FR24 support and request that
                      they manually add another key for you (or simply use a different email address).
                    </p>
                    <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                      <TextField name="flightradar--key" placeholder="ADS-B sharing key or email address" defaultValue={data.flightradar.key} required={others.flightradar} />
                      <TextField name="flightradar_uat--key" placeholder="UAT sharing key or email address" defaultValue={data.flightradar.uatKey} fieldClassName={cx(!data.uat978 && "hidden")} />
                    </div>
                    <RequestKey name="flightradar--submit" stay={stay} />
                  </AggRow>

                  <AggRow name="flightaware--is_enabled" title="FlightAware" href="https://www.flightaware.com/" policy="https://www.flightaware.com/about/privacy/" checked={others.flightaware} onChange={setOther("flightaware")}>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      You need a FlightAware / Piaware feeder ID. If you already have one, enter it below. Otherwise, leave the field empty and click the button and we will try to get one for you. Once this
                      completes and the feeder ID has been filled in, open the local{" "}
                      <a href={`/fa-status${faSuffix}/`} target="_blank" rel="noopener">
                        Piaware page
                      </a>{" "}
                      and click on the "Claim this feeder on FlightAware" button.
                    </p>
                    <TextField name="flightaware--key" placeholder="Piaware key" className="max-w-md" defaultValue={data.flightaware.key} />
                    <RequestKey name="flightaware--submit" stay={stay} />
                  </AggRow>

                  <AggRow name="radarbox--is_enabled" title="AirNav Radar" href="https://www.airnavradar.com/" policy="https://www.airnavradar.com/privacy-policy" checked={others.radarbox} onChange={setOther("radarbox")}>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      You need an AirNav Radar (formerly RadarBox) sharing key. If you already have one, enter it below. Otherwise, leave the field empty and click the button and we will try to get one for
                      you. Please log into the <a href="https://www.radarbox.com/sharing-data/claim">AirNav Radar website</a> once this process has completed in order to claim the key for your account.
                    </p>
                    <TextField name="radarbox--key" placeholder="AirNav Radar sharing key" className="max-w-md" defaultValue={data.radarbox.key} />
                    <RequestKey name="radarbox--submit" stay={stay} />
                  </AggRow>

                  <AggRow name="planefinder--is_enabled" title="PlaneFinder" href="https://planefinder.net/" policy="https://planefinder.net/legal/privacy-information-notice" checked={others.planefinder} onChange={setOther("planefinder")}>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      You need a PlaneFinder sharecode. If you don't have one, request it from their <a href="https://planefinder.net/sharing/create-sharecode">sharing portal</a>. Make sure you enter the
                      exact same location data in that form.
                    </p>
                    <TextField name="planefinder--key" placeholder="PlaneFinder sharecode" className="max-w-md" defaultValue={data.planefinder.key} required={others.planefinder} />
                  </AggRow>

                  <AggRow name="adsbhub--is_enabled" title="ADSBHub" href="https://www.adsbhub.org/" policy="https://www.adsbhub.org/privacy-policy.php" checked={others.adsbhub} onChange={setOther("adsbhub")}>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      To sign up for an ADSBHub station key go to <a href="https://www.adsbhub.org/howtofeed.php">ADSBHub how to feed</a>, setting your station up as feeder type "Linux" in "Client" mode,
                      feeding via the "SBS" protocol. Existing users can find their station key on the Settings page of the ADSBHub site.
                    </p>
                    <TextField name="adsbhub--key" placeholder="ADSBHub station key" className="max-w-md" defaultValue={data.adsbhub.key} required={others.adsbhub} />
                  </AggRow>

                  <AggRow name="opensky--is_enabled" title="OpenSky Network" href="https://opensky-network.org/" policy="https://opensky-network.org/about/privacy-policy" checked={others.opensky} onChange={setOther("opensky")}>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      You need an OpenSky username and serial number. Otherwise, please go to the <a href="https://opensky-network.org/">OpenSky website</a> and register. Once you have an OpenSky username,
                      enter it below and click Request key; we will get a serial for you.
                    </p>
                    <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                      <TextField name="opensky--user" placeholder="OpenSky username" defaultValue={data.opensky.user} required={others.opensky} />
                      <TextField name="opensky--key" placeholder="OpenSky serial number" defaultValue={data.opensky.key} />
                    </div>
                    <RequestKey name="opensky--submit" stay={stay} />
                  </AggRow>

                  <AggRow name="planewatch--is_enabled" title="Plane.watch" href="https://plane.watch" checked={others.planewatch} onChange={setOther("planewatch")}>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      To sign up for an API key go to <a href="https://atc.plane.watch/">atc.plane.watch</a>, sign up for an account, log in and click on <b>Feeders, + New Feeder</b>. Fill out the details
                      and save the data. This will show you an API key that you can enter here.
                    </p>
                    <TextField name="planewatch--key" placeholder="Plane.watch API key" className="max-w-md" defaultValue={data.planewatch.key} required={others.planewatch} />
                  </AggRow>

                  <AggRow name="1090uk--is_enabled" title="1090MHz UK" href="https://1090mhz.uk/" policy="https://1090mhz.uk/legal.html#privacy" checked={others.uk1090} onChange={setOther("uk1090")}>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      1090MHz UK is only interested in the UK and surrounding countries out to 1000nm including Ireland, Jersey, Guernsey, France, Belgium, Netherlands, North Germany, Denmark, Norway, Faroe
                      Islands. If you are in one of those locations, please contact them at info@1090mhz.uk to get a sharing key.
                    </p>
                    <TextField name="1090uk--key" placeholder="1090MHz UK sharing key" className="max-w-md" defaultValue={data.uk1090.key} required={others.uk1090} />
                  </AggRow>

                  <AggRow name="sdrmap--is_enabled" title="sdrmap" href="https://sdrmap.org/" checked={others.sdrmap} onChange={setOther("sdrmap")}>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      You need an sdrmap username and password. Otherwise, please send them an email at <code className="code-chip">feed@sdrmap.org</code> and request an account. To make things easier,
                      include your broad location (city / state / country) in the email.
                    </p>
                    <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                      <TextField name="sdrmap--user" placeholder="sdrmap username" value={sdrmapUser} onChange={(e) => setSdrmapUser(e.currentTarget.value)} required={others.sdrmap} />
                      <TextField name="sdrmap--key" placeholder="sdrmap password" value={sdrmapKey} onChange={(e) => setSdrmapKey(e.currentTarget.value)} required={others.sdrmap} />
                    </div>
                  </AggRow>
                </Rows>
              </div>
            </SettingsSection>
          </>
        )}

        {data.acarsSection && (
          <SettingsSection id="acars" title="ACARS / VDL2 / HFDL" description="Select the ACARS (including VDL2 / HFDL) aggregators you want to feed.">
            <div className="px-5 py-4">
              <Rows>
                {acarsAggs.map((a) => (
                  <AggRow
                    key={a.key}
                    name={`${a.key}--is_enabled`}
                    title={a.title}
                    href={a.href}
                    showPolicy={false}
                    checked={!!acars[a.key]}
                    onChange={(v) => setAcars({ ...acars, [a.key]: v })}
                    description={a.description}
                  />
                ))}
              </Rows>
            </div>
          </SettingsSection>
        )}

        {data.aisSection && (
          <SettingsSection id="ais" title="AIS" description="Select the AIS aggregators you want to feed.">
            <div className="px-5 py-4">
              <Rows>
                {aisAggs.map((a) => (
                  <AggRow key={a.key} name={`${a.key}--is_enabled`} title={a.title} href={a.href} showPolicy={false} checked={!!ais[a.key]} onChange={(v) => setAis({ ...ais, [a.key]: v })} description={a.description}>
                    {a.field && (
                      <TextField
                        label={<span className="font-normal text-neutral-500 dark:text-neutral-400">{a.field.label}</span>}
                        name={a.field.name}
                        className="max-w-md"
                        placeholder={a.field.placeholder}
                        pattern={a.field.port ? String.raw`^\d{3,5}$` : undefined}
                        title={a.field.port ? "3 to 5 digit port number" : undefined}
                        defaultValue={data.aisValues[a.field.name] ?? ""}
                        required={!!ais[a.key]}
                      />
                    )}
                    {a.key === "ais_feed_sdrmap" && (
                      <>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          You need an sdrmap username and password. Please send an email to <a href="mailto:feed@sdrmap.org">feed@sdrmap.org</a> and request an account. If you are feeding both ADS-B and
                          AIS, you will use the same credentials.
                        </p>
                        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                          <TextField name="sdrmap--user" placeholder="sdrmap username" value={showAdsb ? sdrmapUser : undefined} defaultValue={showAdsb ? undefined : data.sdrmap.user0} onChange={showAdsb ? (e) => setSdrmapUser(e.currentTarget.value) : undefined} required={!!ais[a.key]} />
                          <TextField name="sdrmap--key" placeholder="sdrmap password" value={showAdsb ? sdrmapKey : undefined} defaultValue={showAdsb ? undefined : data.sdrmap.key} onChange={showAdsb ? (e) => setSdrmapKey(e.currentTarget.value) : undefined} required={!!ais[a.key]} />
                        </div>
                      </>
                    )}
                  </AggRow>
                ))}
              </Rows>
            </div>
          </SettingsSection>
        )}

        <SettingsSection id="station" title="MLAT station name" description="Override the station name that is used for MLAT.">
          <div className="px-5 py-4">
            <TextField name="mlat_name_override" className="max-w-md" placeholder={data.siteName} defaultValue={data.mlatNameOverride} />
          </div>
        </SettingsSection>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <PolicyBadge policy="#" /> links to the site's privacy / data policy
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PolicyBadge /> site does not provide a clear privacy / data policy
          </span>
        </div>
      </SettingsLayout>

      <UnsavedChangesBar name="aggregators" value={go} label="Apply settings" className="mt-8" />
    </>
  );
}
