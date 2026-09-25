import { Cpu, Network, RadioReceiver, RefreshCw, Settings2, Usb, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { SettingsForm, UnsavedChangesBar } from "../components/form";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Collapsible, cx, EmptyState, Modal, PageHeader, Segmented, Spinner, Switch, TextField } from "../components/ui";
import { getGlobal } from "../lib/data";
import { fetchJson } from "../lib/hooks";

export interface SdrSetupData {
  aggregatorChoice: string;
  stage2: boolean;
  acarsdec: boolean;
  acarsdec2: boolean;
  dumpvdl2: boolean;
  dumphfdl: boolean;
  shipfeeder: boolean;
  sonde: boolean;
  serial1090: string;
  airspy: boolean;
  remoteSdr: string;
}

type Sdr = { type: string; serial: string; purpose: string; gain: string; biastee: boolean; [k: string]: unknown };
type SdrInfo = { sdrdevices: Sdr[]; frequencies: Record<string, string>; duplicates: string; lsusb_output: string; sdr_warning: string };

type Validator = (t: string) => boolean;
const nonEmpty = (t: string) => t.replace(/\s/g, "") !== "";
const num = (t: string) => Number(t);
const v0_50_auto: Validator = (t) => nonEmpty(t) && (t.startsWith("auto") || (num(t) >= 0 && num(t) <= 50));
const v0_21_auto: Validator = (t) => nonEmpty(t) && (t.startsWith("auto") || (num(t) >= 0 && num(t) <= 21));
const v0_21_empty: Validator = (t) => t === "" || (num(t) >= 0 && num(t) <= 21);
const v0_21: Validator = (t) => nonEmpty(t) && num(t) >= 0 && num(t) <= 21;
const v0_50: Validator = (t) => nonEmpty(t) && num(t) >= 0 && num(t) <= 50;
const v0_50_m10: Validator = (t) => nonEmpty(t) && (num(t) === -10 || (num(t) >= 0 && num(t) <= 50));
const v20_59: Validator = (t) => nonEmpty(t) && num(t) >= 20 && num(t) <= 59;
const v20_59_m10: Validator = (t) => nonEmpty(t) && (num(t) === -10 || (num(t) >= 20 && num(t) <= 59));
const v20_59_empty: Validator = (t) => t === "" || (num(t) >= 20 && num(t) <= 59);
const v0_45_empty: Validator = (t) => t === "" || (num(t) >= 0 && num(t) <= 45);
const vEmpty: Validator = (t) => t === "";

// valid gain values per purpose and SDR type (same rules as the old UI)
const gainRules: Record<string, Record<string, [string, Validator]>> = {
  "1090": { rtlsdr: ['enter a value between 0 and 50 or "auto"', v0_50_auto], airspy: ['enter a value between 0 and 21 or "auto"', v0_21_auto], sdrplay: ["always uses agc - leave empty", vEmpty] },
  "1090_2": { rtlsdr: ['enter a value between 0 and 50 or "auto"', v0_50_auto], airspy: ['enter a value between 0 and 21 or "auto"', v0_21_auto], sdrplay: ["always uses agc - leave empty", vEmpty] },
  "978": { rtlsdr: ['enter a value between 0 and 50 or "auto"', v0_50_auto] },
  acars: { rtlsdr: ["enter a value between 0 and 50; use -10 for agc", v0_50_m10], airspy: ["enter a value between 0 and 21", v0_21], sdrplay: ["enter a value between 20 and 59; use -10 for agc", v20_59_m10] },
  acars_2: { rtlsdr: ["enter a value between 0 and 50; use -10 for agc", v0_50_m10], airspy: ["enter a value between 0 and 21", v0_21], sdrplay: ["enter a value between 20 and 59; use -10 for agc", v20_59_m10] },
  vdl2: { rtlsdr: ["enter a value between 0 and 50", v0_50], sdrplay: ["enter a value between 20 and 59, leave empty for agc", v20_59_empty] },
  hfdl: {
    rtlsdr: ["enter a value between 0 and 50", v0_50],
    airspy: ["enter a value between 0 and 21, leave empty for agc", v0_21_empty],
    airspyhf: ["enter a value between 0 and 21, leave empty for agc", v0_21_empty],
    sdrplay: ["enter a value between 0 and 45, leave empty for agc", v0_45_empty],
  },
  ais: { rtlsdr: ["enter a value between 0 and 50 or auto", v0_50_auto], airspy: ["enter a value between 0 and 21", v0_21], airspyhf: ["always uses agc - leave empty", vEmpty], sdrplay: ["enter a value between 20 and 59", v20_59] },
  sonde: { rtlsdr: ['enter a value between 0 and 50 or "auto"', v0_50_auto] },
};

const purposeLabel: Record<string, string> = { "1090": "1090", "1090_2": "1090_2", "978": "978", acars: "ACARS", acars_2: "ACARS_2", vdl2: "VDLM2", hfdl: "HFDL", ais: "AIS", sonde: "Sonde", other: "Other" };

// "other-0" .. "other-15" are an implementation detail hidden from the user
const displayPurpose = (p: string) => (p.startsWith("other") ? "other" : p);

function showsBiastee(type: string, purpose: string) {
  return (
    (purpose === "ais" && (type === "rtlsdr" || type === "airspy")) ||
    (purpose === "vdl2" && type === "rtlsdr") ||
    ((purpose === "acars" || purpose === "acars_2") && ["rtlsdr", "airspy"].includes(type)) ||
    ["1090", "1090_2", "978", "sonde"].includes(purpose)
  );
}

function SdrDialog({ sdr, index, consumers, nonAdsb, stage2, onSave, onClose }: { sdr: Sdr; index: number; consumers: string[]; nonAdsb: boolean; stage2: boolean; onSave: (p: { purpose: string; gain: string; biastee: boolean }) => void; onClose: () => void }) {
  const initial = consumers.includes(displayPurpose(sdr.purpose)) ? displayPurpose(sdr.purpose) : "other";
  const [purpose, setPurpose] = useState(initial);
  const [gain, setGain] = useState(String(sdr.gain ?? ""));
  const [biastee, setBiastee] = useState(!!sdr.biastee);
  const [error, setError] = useState("");
  const t = sdr.type;
  const rule = gainRules[purpose]?.[t];

  const options = [
    { value: "1090", hidden: nonAdsb || t === "airspyhf" },
    { value: "1090_2", hidden: nonAdsb || !stage2 || t === "airspyhf" },
    { value: "978", hidden: nonAdsb || t !== "rtlsdr" },
    { value: "acars", hidden: !consumers.includes("acars") || t === "airspyhf" },
    { value: "acars_2", hidden: !consumers.includes("acars_2") || t === "airspyhf" },
    { value: "vdl2", hidden: !consumers.includes("vdl2") || t.startsWith("airspy") },
    { value: "hfdl", hidden: !consumers.includes("hfdl") },
    { value: "ais", hidden: !consumers.includes("ais") },
    { value: "sonde", hidden: !consumers.includes("sonde") || t !== "rtlsdr" },
    { value: "other", hidden: false },
  ].map((o) => ({ ...o, label: purposeLabel[o.value] }));

  const save = () => {
    if (rule && !rule[1](gain)) {
      setError(rule[0]);
      return;
    }
    onSave({ purpose, gain, biastee });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span>
          Set up SDR #{index} <span className="font-mono text-sm font-normal text-neutral-500">serial {sdr.serial}</span>
        </span>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>OK</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="label">Used for</div>
          <Segmented name="usage" size="sm" options={options} selected={purpose} onChange={(k) => { setPurpose(k); setError(""); }} />
        </div>
        {purpose !== "other" && (
          <TextField
            label="Gain"
            hint={rule ? rule[0] : "please check the docs for valid gain values"}
            value={gain}
            className="max-w-40"
            onChange={(e) => {
              setGain(e.currentTarget.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
          />
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {showsBiastee(t, purpose) && <Switch checked={biastee} onChange={setBiastee} label="Enable biastee" description="Powers an LNA / filter through the coax. Only enable this if your hardware needs it." />}
      </div>
    </Modal>
  );
}

// posted as a whole, as before; the bar stays visible because Apply also completes the setup
export function SdrSetup({ data }: { data: SdrSetupData }) {
  return (
    <SettingsForm postAll>
      <SdrSetupForm data={data} />
    </SettingsForm>
  );
}

function SdrSetupForm({ data }: { data: SdrSetupData }) {
  const [info, setInfo] = useState<SdrInfo | null>(null);
  const [sdrs, setSdrs] = useState<Sdr[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [changes, setChanges] = useState(false);
  const nonAdsb = data.aggregatorChoice === "nonadsb";
  // the backend shows this page in place of another one when SDRs need (re)assigning; Apply
  // is needed then even without changes, so keep the bar visible
  const confirmNeeded = !getGlobal().baseConfig || !window.location.pathname.endsWith("/sdr_setup");

  const consumers = [
    "1090",
    "978",
    "other",
    ...(data.stage2 ? ["1090_2"] : []),
    ...(data.acarsdec ? ["acars"] : []),
    ...(data.acarsdec2 ? ["acars_2"] : []),
    ...(data.dumpvdl2 ? ["vdl2"] : []),
    ...(data.dumphfdl ? ["hfdl"] : []),
    ...(data.shipfeeder ? ["ais"] : []),
    ...(data.sonde ? ["sonde"] : []),
  ];

  const load = () => {
    setLoading(true);
    fetchJson<SdrInfo>("/api/sdr_info")
      .then((d) => {
        setInfo(d);
        setSdrs(d.sdrdevices);
        setChanges(false);
      })
      .catch((err) => console.error("API Error for /api/sdr_info:", err))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // until the user changes something, show the purpose the backend has assigned by serial
  const purposeOf = (sdr: Sdr) => {
    if (changes || !info) return displayPurpose(sdr.purpose);
    let p = sdr.purpose;
    for (const [freq, serial] of Object.entries(info.frequencies ?? {})) if (serial === sdr.serial) p = freq;
    return displayPurpose(p);
  };

  const save = (i: number, v: { purpose: string; gain: string; biastee: boolean }) => {
    const next = sdrs.map((s) => ({ ...s }));
    const purpose = v.purpose === "other" ? `other-${i}` : v.purpose;
    let changed = next[i].gain !== v.gain || next[i].biastee !== v.biastee;
    next[i].gain = v.gain;
    next[i].biastee = v.biastee;
    if (purpose !== next[i].purpose) {
      // if another SDR already had this purpose, switch that one to 'other'
      next.forEach((s, j) => {
        if (s.purpose === purpose) s.purpose = `other-${j}`;
      });
      next[i].purpose = purpose;
      changed = true;
    }
    setSdrs(next);
    if (changed) setChanges(true);
    setEditing(null);
  };

  const hasRtl = sdrs.some((s) => s.type === "rtlsdr");
  const showRemote = !(data.stage2 || data.serial1090 !== "" || data.airspy);

  return (
    <>
      <PageHeader
        eyebrow="Setup"
        title="SDR Setup"
        subtitle="Assign each receiver to what it should decode and adjust gain and biastee. Changes are applied when you click Apply settings."
        actions={
          <Button variant="outline" onClick={load} disabled={loading} icon={loading ? <Spinner /> : <RefreshCw className="size-4" />}>
            Check SDRs
          </Button>
        }
      />
      <div className="space-y-6">
        {info?.sdr_warning && (
          <Alert tone="warning" title="The number of SDRs connected to your system may be too much for your hardware.">
            <div dangerouslySetInnerHTML={{ __html: info.sdr_warning }} />
            <p className="mt-2">
              It's hard to give any specific hard limits, but generally speaking, most single board computers (maybe with the exception of the RPi5) can't handle more than 3 SDRs, possibly only 2 if one of
              them is an Airspy. An RPi5 appears to be able to handle 4 SDRs as long as they are split across the two USB controllers. For PCs the number depends on a lot of factors, including how many
              separate USB controllers you can use.
            </p>
          </Alert>
        )}
        {info?.duplicates && (
          <Alert tone="danger" title={`There are multiple SDRs with serial number ${info.duplicates}`}>
            This will not work correctly. Please ensure that all SDRs have distinct serial numbers. You can try the experimental <a href="/change_sdr_serial_ui">change SDR serial number</a> page, but that
            process isn't automatic and requires access to the system that you are working on.
          </Alert>
        )}

        <Card>
          <CardHeader
            icon={<RadioReceiver />}
            title="Detected SDRs"
            description={!info?.duplicates && "If this list isn't consistent with your hardware, click Check SDRs. Click an SDR to edit its properties."}
            actions={changes && <Badge tone="warning">Unsaved changes</Badge>}
          />
          <CardBody>
            {!info && loading && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Spinner /> Looking for SDRs…
              </div>
            )}
            {info && sdrs.length === 0 && (
              <EmptyState icon={<Usb />} title="No SDRs found">
                If you have SDRs attached to the computer this software is running on, then a reboot may be required before the web UI can see the SDRs.
              </EmptyState>
            )}
            {sdrs.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sdrs.map((sdr, i) => {
                  const p = purposeOf(sdr);
                  return (
                    <button
                      key={`${sdr.serial}-${i}`}
                      type="button"
                      onClick={() => setEditing(i)}
                      title="Click to configure this SDR"
                      className="group flex cursor-pointer flex-col gap-3 rounded-xl border border-neutral-200 p-4 text-left transition hover:border-neutral-400 hover:shadow-md hover:shadow-black/5 dark:border-neutral-800 dark:hover:border-neutral-600"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                            <Cpu className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-neutral-900 dark:text-white">{sdr.type}</div>
                            <div className="font-mono text-xs break-all text-neutral-500 dark:text-neutral-400">{sdr.serial}</div>
                          </div>
                        </div>
                        <Settings2 className="size-4 text-neutral-300 transition group-hover:text-neutral-900 dark:text-neutral-600" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone={p && p !== "other" ? "brand" : "neutral"}>{p ? purposeLabel[p] ?? p : "unassigned"}</Badge>
                        <span className="text-neutral-500 dark:text-neutral-400">
                          gain <span className="font-medium text-neutral-700 dark:text-neutral-200">{String(sdr.gain ?? "") || "–"}</span>
                        </span>
                        {sdr.biastee && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                            <Zap className="size-3" /> biastee
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {hasRtl && (
              <p className="hint mt-4">
                If needed, you can <a href="/change_sdr_serial_ui">change the serial number of an RTLSDR</a> on a separate page. Please do that before making assignments as those are tracked by serial number.
              </p>
            )}
          </CardBody>
        </Card>

        {info && (
          <Collapsible title="lsusb output">
            <pre className="prose-pre">{info.lsusb_output}</pre>
          </Collapsible>
        )}

        <Card className={cx(!showRemote && "hidden")}>
          <CardHeader icon={<Network />} title="Remote SDR" description="If this feeder uses a remote device that has the ADS-B SDR connected to it and offers beast_out (like the micro feeder setup this image supports), enter its IPv4 address here – and the port if it's not 30005." />
          <CardBody>
            <TextField
              name="remote_sdr"
              className="max-w-sm"
              placeholder="IP-address[,port]"
              pattern={String.raw`^\s*(?:\d{1,3}\.){3}\d{1,3}(?:,\s*\d+)?\s*$`}
              title="IPv4 address and port, separated by a comma"
              defaultValue={data.remoteSdr}
            />
          </CardBody>
        </Card>
      </div>

      <input type="hidden" name="sdr_setup_data" value={changes ? JSON.stringify(sdrs) : ""} />
      <UnsavedChangesBar name="sdr_setup" value="go" label="Apply settings" idle={confirmNeeded && "Confirm the SDR assignments to continue."} className="mt-8" />

      {editing !== null && sdrs[editing] && (
        <SdrDialog sdr={sdrs[editing]} index={editing} consumers={consumers} nonAdsb={nonAdsb} stage2={data.stage2} onClose={() => setEditing(null)} onSave={(v) => save(editing, v)} />
      )}
    </>
  );
}
