import { Activity, ChartLine, CloudSun, Eye, EyeOff, HardDrive, HeartPulse, Map as MapIcon, Palette, Radio, RadioTower, RotateCw, Ship, Thermometer } from "lucide-react";
import { type ReactNode, useState } from "react";
import { FeatureSwitch, PostForm, SettingsForm, UnsavedChangesBar } from "../components/form";
import { SettingsItem, SettingsLayout, SettingsSection } from "../components/Settings";
import { Badge, Button, Collapsible, cx, Modal, PageHeader, Segmented, SubmitButton, TextField } from "../components/ui";
import { applyTheme } from "../lib/theme";

export interface AdvancedData {
  cssTheme: string;
  tempSensor: string;
  freedomUnits: boolean;
  boardName: string;
  initials: string;
  closestAirport: string;
  skystats: boolean;
  skystatsValues: Record<string, string>;
  healthcheck: Record<string, string>;
  rebootOnMissingSdr: boolean;
  romsWait: string;
  romsMax: string;
  enabled: Record<string, boolean>;
  values: Record<string, string>;
  bestAcarsFrequencies: string;
  bestVdl2Frequencies: string;
}

/* ------------------------------------------------------------- small parts */

export function OnOff({ on, labels = ["Enabled", "Disabled"] }: { on: boolean; labels?: [string, string] }) {
  return on ? <Badge tone="success">{labels[0]}</Badge> : <Badge>{labels[1]}</Badge>;
}

function PasswordField(props: React.ComponentProps<typeof TextField>) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      {...props}
      type={show ? "text" : "password"}
      trailing={
        <button type="button" onClick={() => setShow(!show)} className="cursor-pointer rounded-md p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}

// frequencies of one decoder must fit into the SDR bandwidth (2.4 MHz / 1.2 MHz)
function frequencySpanOk(value: string, rangeMHz: number) {
  const freqs = value
    .replaceAll(";", " ")
    .replaceAll(",", " ")
    .split(" ")
    .filter(Boolean)
    .map(Number)
    .filter((f) => Number.isFinite(f))
    .sort((a, b) => a - b);
  if (freqs.length === 0) return true;
  const scale = freqs[0] < 200 ? 1 : freqs[0] < 200000 ? 1000 : 1000000;
  return freqs[freqs.length - 1] - freqs[0] <= rangeMHz * scale;
}

function NoSdr({ what }: { what: string }) {
  return (
    <div className="text-sm text-amber-700 sm:col-span-2 dark:text-amber-400">
      No SDR is assigned for {what} – you can change that on the <a href="/sdr_setup">SDR Setup</a> page.
    </div>
  );
}

// shown next to a feature whose switch was flipped but not applied yet
function Pending({ on }: { on: boolean }) {
  return <Badge tone="warning">{on ? "Enabled on apply" : "Disabled on apply"}</Badge>;
}

// a container that is switched on / off with the backend's <id>--enable / <id>--disable keys;
// its settings show while it is on and are all submitted when it is being switched on
function Decoder({
  id,
  title,
  description,
  icon,
  enabled,
  enableDisabled,
  children,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  icon: ReactNode;
  enabled: boolean;
  enableDisabled?: boolean;
  children?: ReactNode;
}) {
  const [on, setOn] = useState(enabled);
  return (
    <SettingsItem
      icon={icon}
      title={title}
      badge={on !== enabled && <Pending on={on} />}
      description={description}
      control={<FeatureSwitch id={id} enabled={enabled} on={on} onChange={setOn} disabled={!on && enableDisabled} label={`Enable ${typeof title === "string" ? title : id}`} />}
    >
      {on && children ? (
        <div className="grid gap-4 sm:grid-cols-2" data-submit-all={on !== enabled || undefined}>
          {children}
        </div>
      ) : null}
    </SettingsItem>
  );
}

function FrequencyField({ name, label, value, onChange, ok, span, best }: { name: string; label: string; value: string; onChange: (v: string) => void; ok: boolean; span: string; best?: string }) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <TextField
        label={label}
        name={name}
        placeholder={best ? "copying the suggested frequencies is a good starting point" : "default values should work as a starting point"}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        // blocks "Apply" while the frequencies don't fit the SDR bandwidth
        validationMessage={ok ? "" : `Values must fit in ${span}.`}
        className={cx(!ok && "border-rose-400 dark:border-rose-500/70")}
      />
      {!ok && <div className="text-xs font-medium text-rose-600 dark:text-rose-400">Values must fit in {span}.</div>}
      {best && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          <span>Based on your location, these frequencies appear to carry the most messages:</span>
          <code className="font-mono font-semibold text-neutral-900 dark:text-white">{best}</code>
          <Button size="sm" variant="outline" className="h-7" onClick={() => onChange(best)}>
            Use these
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- page */

const setFreedomUnits = (on: boolean) => window.dispatchEvent(new CustomEvent("adsbim:freedom-units", { detail: on }));

export function Advanced({ data }: { data: AdvancedData }) {
  return (
    <>
      <PageHeader eyebrow="Setup" title="Advanced Setup" subtitle="Appearance, sensors, statistics, health monitoring and additional decoders." />
      {/* theme and units are previewed right away; Discard puts the previews back */}
      <SettingsForm
        noRestartFields={["css_theme", "freedom_units"]}
        onDiscard={() => {
          applyTheme(data.cssTheme);
          setFreedomUnits(data.freedomUnits);
        }}
      >
        <AdvancedSettings data={data} />
      </SettingsForm>
    </>
  );
}

// all state lives here, below SettingsForm, so "Discard" resets it by remounting
function AdvancedSettings({ data }: { data: AdvancedData }) {
  const en = data.enabled;
  const v = data.values;
  const [tempDialog, setTempDialog] = useState(false);
  const [sensor, setSensor] = useState("");
  const [pin, setPin] = useState("");
  const [skystats, setSkystats] = useState(data.skystats);
  const [roms, setRoms] = useState(data.rebootOnMissingSdr);
  const isPi = data.boardName.startsWith("Raspberry Pi");

  // feed ids default to <initials>-<closest airport>-<TYPE>, like the old UI
  const feedId = (current: string, type: string) => current || `${data.initials}-${data.closestAirport}-${type}`;
  const [feedIds, setFeedIds] = useState({
    acars_feed_id: feedId(v.acars_feed_id, "ACARS"),
    acars_2_feed_id: feedId(v.acars_2_feed_id, "ACARS"),
    vdl2_feed_id: feedId(v.vdl2_feed_id, "VDL2"),
    hfdl_feed_id: feedId(v.hfdl_feed_id, "HFDL"),
    hfdlobserver_feed_id: feedId(v.hfdlobserver_feed_id, "HFDL"),
    ais_station_name: feedId(v.ais_station_name, "AIS"),
  });
  // an empty stored id gets the same default from the backend, so the suggestion isn't a change
  const feedField = (name: keyof typeof feedIds, type: string, label: string) => (
    <TextField
      label={label}
      name={name}
      required
      placeholder={`required ${label}`}
      value={feedIds[name]}
      onChange={(e) => setFeedIds({ ...feedIds, [name]: e.currentTarget.value })}
      onBlur={() => !feedIds[name] && setFeedIds({ ...feedIds, [name]: feedId("", type) })}
    />
  );
  const [freqs, setFreqs] = useState({ acars_frequencies: v.acars_frequencies, acars_2_frequencies: v.acars_2_frequencies, vdl2_frequencies: v.vdl2_frequencies });
  const acarsOk = frequencySpanOk(freqs.acars_frequencies, 2.4);
  const acars2Ok = frequencySpanOk(freqs.acars_2_frequencies, 2.4);
  const vdl2Ok = frequencySpanOk(freqs.vdl2_frequencies, 1.2);

  return (
    <SettingsLayout
      sections={[
        { id: "appearance", title: "Appearance", icon: <Palette /> },
        { id: "temperature", title: "Temperature", icon: <Thermometer /> },
        { id: "statistics", title: "Statistics", icon: <ChartLine /> },
        { id: "monitoring", title: "Monitoring", icon: <HeartPulse /> },
        { id: "datalink", title: "Aircraft datalink", icon: <Radio /> },
        { id: "ships-weather", title: "Ships & weather", icon: <Ship /> },
      ]}
    >
      <SettingsSection id="appearance" title="Appearance">
        <SettingsItem
          icon={<Palette />}
          title="Theme"
          description="Color scheme of this web interface. Auto follows the setting of your device."
          control={
            <Segmented
              name="css_theme"
              size="sm"
              defaultSelected={data.cssTheme}
              onChange={(key) => applyTheme(key)}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "auto", label: "Auto" },
              ]}
            />
          }
        />
      </SettingsSection>

      <SettingsSection id="temperature" title="Temperature">
        {data.tempSensor ? (
          <SettingsItem
            icon={<Thermometer />}
            title="Temperature sensor"
            badge={<Badge tone="success">{data.tempSensor}</Badge>}
            description="Ambient temperature is shown next to the CPU temperature in the header."
            control={
              <SubmitButton name="temp_sensor_disable" size="sm" variant="outline">
                Disable
              </SubmitButton>
            }
          />
        ) : (
          <SettingsItem
            icon={<Thermometer />}
            title="Temperature sensor"
            badge={<OnOff on={false} />}
            description="A small number of temperature sensors for ambient temperature monitoring are supported."
            control={
              <Button size="sm" variant="outline" onClick={() => setTempDialog(true)}>
                Enable…
              </Button>
            }
          >
            <Collapsible title="Supported sensors">
              <ul className="list-disc space-y-1 pl-5">
                <li>DHT11 or DHT22 temperature sensor connected to GPIO pins 1 (Vcc), 7 (Data) and 9 (Ground) on a Raspberry Pi</li>
                <li>BME280 temperature sensor connected to I2C pins on a Raspberry Pi</li>
                <li>TEMPer USB temperature sensor</li>
              </ul>
            </Collapsible>
          </SettingsItem>
        )}
        <SettingsItem
          title="Units"
          description="Used for the temperatures shown in the header."
          control={
            <Segmented
              name="freedom_units"
              size="sm"
              defaultSelected={data.freedomUnits ? "1" : "0"}
              onChange={(key) => setFreedomUnits(key === "1")}
              options={[
                { value: "0", label: "°C" },
                { value: "1", label: "°F" },
              ]}
            />
          }
        />
      </SettingsSection>

      {/* rendered in a portal, so this form isn't nested in the settings form */}
      <Modal
        open={tempDialog}
        onClose={() => setTempDialog(false)}
        title="Pick your temperature sensor"
        footer={
          <>
            <Button variant="outline" onClick={() => setTempDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" form="temp_sensor_enable_form" disabled={!sensor}>
              Save
            </Button>
          </>
        }
      >
        <PostForm id="temp_sensor_enable_form" className="space-y-5">
          <input type="hidden" name="temp_sensor_enable" value="go" />
          <input type="hidden" name="freedom_units" value={data.freedomUnits ? "1" : "0"} />
          <div>
            <div className="label">Sensor type</div>
            <Segmented
              name="temp_sensor"
              selected={sensor}
              onChange={setSensor}
              options={[
                { value: "dht22", label: "DHT11 / DHT22", hidden: !isPi },
                { value: "bme280", label: "BME280", hidden: !isPi },
                { value: "temper_usb", label: "TEMPer USB" },
              ]}
            />
          </div>
          {sensor === "dht22" && <TextField label="GPIO pin" hint="Typically 4" name="dht22_pin" className="max-w-24" value={pin} onChange={(e) => setPin(e.currentTarget.value)} />}
        </PostForm>
      </Modal>

      <SettingsSection id="statistics" title="Statistics">
        <SettingsItem
          icon={<ChartLine />}
          title="Skystats"
          badge={skystats !== data.skystats && <Pending on={skystats} />}
          description="Extended ADS-B statistics: detailed data about the aircraft seen, the most common types, routes and airports, and a list of the most interesting aircraft."
          control={<FeatureSwitch id="skystats" enabled={data.skystats} on={skystats} onChange={setSkystats} label="Enable Skystats" />}
        >
          {/* the backend fills in the database defaults when Skystats is first enabled */}
          {skystats && data.skystats && (
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Radius (km)" name="skystats_radius" placeholder="500" defaultValue={data.skystatsValues.skystats_radius} />
              <TextField label="Above radius (km)" name="skystats_above_radius" placeholder="20" defaultValue={data.skystatsValues.skystats_above_radius} />
              <TextField label="Domestic country" hint="ISO 2-letter code" name="skystats_domestic_country_iso" placeholder="e.g. US, DE, GB" maxLength={2} defaultValue={data.skystatsValues.skystats_domestic_country_iso} />
            </div>
          )}
          {skystats && data.skystats && (
            <Collapsible title="Database configuration" keepMounted>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField fieldClassName="sm:col-span-2" label="Aircraft JSON URL" name="skystats_aircraft_json" placeholder="http://ultrafeeder:8080/data/aircraft.json" defaultValue={data.skystatsValues.skystats_aircraft_json} />
                <TextField label="Database host" name="skystats_db_host" placeholder="skystats-db" defaultValue={data.skystatsValues.skystats_db_host} />
                <TextField label="Database port" name="skystats_db_port" placeholder="5432" defaultValue={data.skystatsValues.skystats_db_port} />
                <TextField label="Database user" name="skystats_db_user" required placeholder="skystats-user" defaultValue={data.skystatsValues.skystats_db_user} />
                <PasswordField label="Database password" name="skystats_db_password" required placeholder="required password" defaultValue={data.skystatsValues.skystats_db_password} />
                <TextField label="Database name" name="skystats_db_name" required placeholder="skystats_db" defaultValue={data.skystatsValues.skystats_db_name} />
              </div>
            </Collapsible>
          )}
          {skystats && !data.skystats && <div className="text-sm text-neutral-500 dark:text-neutral-400">Radius and database settings become available once Skystats is enabled.</div>}
          <Collapsible title="About disk usage">
            Skystats uses a PostgreSQL database to store and analyze aircraft positions, flights, and patterns. This causes additional write activity on the system (which has otherwise been optimized
            for minimum disk writes). On an SBC with an SD card this may cause wear on the card and could lead to reduced lifespan. In the database configuration you can point Skystats to a database on
            a different machine instead. Note that this database MUST exist on that machine.
          </Collapsible>
        </SettingsItem>
      </SettingsSection>

      <SettingsSection id="monitoring" title="Monitoring">
        <SettingsItem icon={<HeartPulse />} title="Healthcheck" description="Ping a URL (e.g. healthchecks.io) every 60 minutes while the system is healthy. Leave empty to disable.">
          <TextField label="Ping URL" name="healthcheck_url" placeholder="https://hc-ping.com/…" defaultValue={data.healthcheck.healthcheck_url} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Fail after no planes on 1090 for (hours)" hint="0 disables the check" name="healthcheck_noplane_hours_1090" inputMode="numeric" defaultValue={data.healthcheck.healthcheck_noplane_hours_1090} />
            <TextField label="Fail after no planes on 978 for (hours)" hint="0 disables the check" name="healthcheck_noplane_hours_978" inputMode="numeric" defaultValue={data.healthcheck.healthcheck_noplane_hours_978} />
          </div>
          <Collapsible>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                If the system is considered unhealthy for more than 5 minutes, a POST request is sent with <code className="code-chip">/fail</code> added to the URL. The reason is shown on the
                feeder homepage and sent as the body of the request.
              </li>
              <li>Feeds are not part of the health status – those issues are pretty much always on the aggregator side (bad MLAT sync may be added in the future).</li>
              <li>No planes for the configured time means unhealthy. The default is 24 hours; with traffic around the clock it can safely be reduced to 1 or 2 hours.</li>
              <li>Decoder failures (1090 + 978 only) mean unhealthy.</li>
            </ul>
          </Collapsible>
        </SettingsItem>
        <SettingsItem
          icon={<RotateCw />}
          title="Reboot on missing SDR"
          badge={roms !== data.rebootOnMissingSdr && <Pending on={roms} />}
          description="Automatically reboot when a configured SDR disappears from USB."
          control={<FeatureSwitch id="reboot_on_missing_sdr" enabled={data.rebootOnMissingSdr} on={roms} onChange={setRoms} label="Enable reboot on missing SDR" />}
        >
          {roms && (
            <div className="grid gap-4 sm:grid-cols-2" data-submit-all={!data.rebootOnMissingSdr || undefined}>
              <TextField label="Wait time (seconds)" name="roms_wait" type="number" min={1} defaultValue={data.romsWait} />
              <TextField label="Max reboots before giving up" name="roms_max" type="number" min={1} defaultValue={data.romsMax} />
            </div>
          )}
          <Collapsible>
            Sometimes an SDR drops from USB but reappears after a reboot. Usually this indicates a real hardware issue (dying SDR, bad power, USB connector issues, etc), but especially with hard to get to
            feeder setups it can be useful to limp along by forcing a reboot. Only if the SDR is missing for longer than the wait time will a reboot be considered, and after the maximum number of
            reboots the system keeps running as it did before.
          </Collapsible>
        </SettingsItem>
      </SettingsSection>

      <SettingsSection
        id="datalink"
        title="Aircraft datalink decoders"
        description={
          <>
            Enable a decoder here, then assign an SDR on the <a href="/sdr_setup">SDR Setup page</a> and pick aggregators on the <a href="/aggregators">Data Sharing page</a>. Feed IDs typically look like{" "}
            <code className="code-chip">FL-ICAO-ACARSn</code>: your initials, the closest airport, the protocol and a number to distinguish multiple feeds.
          </>
        }
      >
        <Decoder id="acarsdec" title="ACARS decoder" description="First analog ACARS decoder (VHF)" icon={<Radio />} enabled={en.acarsdec}>
          {feedField("acars_feed_id", "ACARS", "ACARS feed ID")}
          <FrequencyField name="acars_frequencies" label="ACARS frequencies" value={freqs.acars_frequencies} onChange={(val) => setFreqs({ ...freqs, acars_frequencies: val })} ok={acarsOk} span="2.4MHz" best={data.bestAcarsFrequencies} />
          {!v.acarsserial && <NoSdr what="ACARS" />}
        </Decoder>
        <Decoder id="acarsdec2" title="Second ACARS decoder" description="Covers the rarely used frequencies below 130MHz – rarely useful outside of the US" icon={<Radio />} enabled={en.acarsdec2}>
          {feedField("acars_2_feed_id", "ACARS", "ACARS2 feed ID")}
          <FrequencyField name="acars_2_frequencies" label="ACARS2 frequencies" value={freqs.acars_2_frequencies} onChange={(val) => setFreqs({ ...freqs, acars_2_frequencies: val })} ok={acars2Ok} span="2.4MHz" />
          {!v.acars_2serial && <NoSdr what="ACARS_2" />}
        </Decoder>
        <Decoder id="dumpvdl2" title="VDL Mode 2 decoder" description="Decode VDL Mode 2 datalink messages" icon={<Radio />} enabled={en.dumpvdl2}>
          {feedField("vdl2_feed_id", "VDL2", "VDL2 feed ID")}
          <FrequencyField name="vdl2_frequencies" label="VDL2 frequencies" value={freqs.vdl2_frequencies} onChange={(val) => setFreqs({ ...freqs, vdl2_frequencies: val })} ok={vdl2Ok} span="1.2MHz" best={data.bestVdl2Frequencies} />
          {!v.vdl2serial && <NoSdr what="VDL2" />}
        </Decoder>
        <Decoder id="dumphfdl" title="HFDL" description="Decode HF datalink with a local SDR" icon={<RadioTower />} enabled={en.dumphfdl}>
          {feedField("hfdl_feed_id", "HFDL", "HFDL feed ID")}
          <TextField label="SDR sample rate" name="hfdl_samplerate" placeholder="3000000 for Airspy" defaultValue={v.hfdl_samplerate} />
          <TextField fieldClassName="sm:col-span-2" label="HFDL frequencies" name="hfdl_frequencies" placeholder="recommended to leave empty to use frequency scanner" defaultValue={v.hfdl_frequencies} />
          {!v.hfdlserial && <NoSdr what="HFDL" />}
        </Decoder>
        <Decoder id="hfdlobserver" title="hfdlobserver" description="HFDL via a web-888 SDR on your network" icon={<RadioTower />} enabled={en.hfdlobserver}>
          {feedField("hfdlobserver_feed_id", "HFDL", "HFDLOBSERVER feed ID")}
          <TextField label="Web-888 IP address" name="hfdlobserver_ip" placeholder="IP address of the web-888 SDR" defaultValue={v.hfdlobserver_ip} />
        </Decoder>
        <Decoder id="acars2pos" title="acars2pos" description="Show ACARS / VDL2 / HFDL positions on the ADS-B live map (requires ACARS Hub)" icon={<MapIcon />} enabled={en.acars2pos} enableDisabled={!en.acarshub} />
        {en.acarshub &&
          (v.acarshub_data_path === "/run/acars_data" ? (
            <SettingsItem
              icon={<HardDrive />}
              title="ACARS Hub data storage"
              badge={<Badge>tmpfs</Badge>}
              description="Data is only saved to disk on shutdown. You can always keep it on disk instead (not recommended for SD cards)."
              control={
                <SubmitButton name="acarshub_to_disk" size="sm" variant="outline">
                  Move to disk
                </SubmitButton>
              }
            />
          ) : (
            <SettingsItem
              icon={<HardDrive />}
              title="ACARS Hub data storage"
              badge={<Badge>disk</Badge>}
              description="Data is always kept on disk. You can keep it in memory instead and only save it on shutdown."
              control={
                <SubmitButton name="acarshub_to_run" size="sm" variant="outline">
                  Move to tmpfs
                </SubmitButton>
              }
            />
          ))}
      </SettingsSection>

      <SettingsSection id="ships-weather" title="Ships & weather">
        <Decoder id="shipfeeder" title="AIS / Shipfeeder" description="Track ship positions" icon={<Ship />} enabled={en.shipfeeder}>
          {feedField("ais_station_name", "AIS", "AIS station name")}
          <TextField label="AIS extra options" name="ais_sx_extra_options" defaultValue={v.ais_sx_extra_options} />
          {!v.aisserial && <NoSdr what="AIS" />}
        </Decoder>
        <Decoder id="show_ships_on_map" title="Ships on the live map" description="Show AIS ships on the ADS-B map (requires AIS / Shipfeeder)" icon={<Activity />} enabled={en.show_ships_on_map} enableDisabled={!en.shipfeeder} />
        <Decoder id="sonde" title="Radio Sonde" description="Track weather balloon radiosondes" icon={<CloudSun />} enabled={en.sonde}>
          <TextField fieldClassName="sm:col-span-2" label="Sondehub callsign" name="sonde_callsign" required placeholder="required sondehub callsign" defaultValue={v.sonde_callsign} />
          <TextField label="Minimum frequency" hint="Region specific" name="sonde_min_freq" defaultValue={v.sonde_min_freq} />
          <TextField label="Maximum frequency" hint="Region specific" name="sonde_max_freq" defaultValue={v.sonde_max_freq} />
          <TextField label="Share station location" name="sonde_share_position" defaultValue={v.sonde_share_position} />
          <TextField label="Enable web control" name="sonde_web_control" defaultValue={v.sonde_web_control} />
          <TextField fieldClassName="sm:col-span-2" label="Web control password" name="sonde_web_password" defaultValue={v.sonde_web_password} />
          {!v.sondeserial && <NoSdr what="Sonde" />}
        </Decoder>
      </SettingsSection>

      <UnsavedChangesBar />
    </SettingsLayout>
  );
}
