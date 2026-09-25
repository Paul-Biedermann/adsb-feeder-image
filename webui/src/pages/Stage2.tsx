import { Check, Network, Pencil, Plus, Power, RefreshCw, Search, Trash, X } from "lucide-react";
import { useState } from "react";
import { PostForm, SettingsForm, UnsavedChangesBar } from "../components/form";
import { LAT_PATTERN, LocationFields, LON_PATTERN, NAME_PATTERN } from "../components/LocationFields";
import { Alert, Button, Card, CardBody, CardFooter, CardHeader, Checkbox, cx, EmptyState, PageHeader, Spinner, SubmitButton, TextField } from "../components/ui";
import { fetchJson, usePolling } from "../lib/hooks";

type MicroSite = { idx: number; name: string; mfIp: string; lat: string; lon: string; alt: string; mfVersion: string; uat978: boolean; brofm: boolean };

export interface Stage2Data {
  siteName: string;
  lat: string;
  lon: string;
  tz: string;
  dnsState: boolean;
  numMicroSites: number;
  editIndex: number;
  message: string;
  sites: MicroSite[];
}

type MfStat = { nosdr?: number; pps: number; mps: number; planes: number; tplanes: number; uptime: number };
type Stage2Info = { lat: string; lon?: string; lng?: string; alt: string; mf_version: string; uat_capable: boolean; brofm_capable: boolean };
type RemoteCheck = { name?: string; micro_settings?: boolean; dump978_at_port?: number; brofm_capable?: boolean; status?: string };

const ipDisplay = (ip: string) => ip.replace(",30006,beast_in", "");

function StatusCell({ stat }: { stat?: MfStat }) {
  if (!stat) return <span className="text-neutral-400">…</span>;
  if (stat.nosdr === 1) return <span className="text-rose-600 dark:text-rose-400">no SDR configured</span>;
  const cls = stat.pps > 0 ? "text-emerald-600 dark:text-emerald-400" : stat.uptime > 60 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  return (
    <span className={cx("text-xs tabular-nums", cls)}>
      {stat.pps} pos / {stat.mps} msg/s
      <br />
      {stat.planes} planes / {stat.tplanes} today
    </span>
  );
}

function SitesTable({ data }: { data: Stage2Data }) {
  const [stats, setStats] = useState<MfStat[]>([]);
  const [info, setInfo] = useState<Stage2Info[]>([]);
  const n = data.numMicroSites;
  const editing = data.editIndex > 0;
  const [order, setOrder] = useState(String(data.editIndex));

  usePolling(async () => setStats(await fetchJson<MfStat[]>("/api/stage2_stats")), 15_000);
  usePolling(async () => {
    if (n > 0) setInfo(await fetchJson<Stage2Info[]>("/api/stage2_info", 8000));
  }, 300_000);

  // while a row is being moved, show the resulting order numbers for the other rows
  const newIdx = parseInt(order, 10);
  const displayOrder = (i: number) => {
    if (!editing || !Number.isFinite(newIdx) || newIdx < 1 || newIdx > n) return i;
    const e = data.editIndex;
    if (i <= newIdx && i > e) return i - 1;
    if (i >= newIdx && i < e) return i + 1;
    return i;
  };

  return (
    <PostForm action="/update">
      <div className="overflow-x-auto">
        <table className="table-modern">
          <thead>
            <tr>
              <th className="w-14">#</th>
              <th>Site</th>
              <th>IP</th>
              <th className="hidden md:table-cell">Lat / Lon @ Alt</th>
              <th>Version</th>
              <th className="hidden sm:table-cell">Status / Stats</th>
              <th className="text-center">UAT</th>
              <th className="text-center" title="Bandwidth Reduce">
                BWR
              </th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.sites.map((s) => {
              const live = info[s.idx - 1];
              const lla = live ? `${live.lat} / ${live.lon ?? live.lng} @ ${live.alt}m` : `${s.lat} / ${s.lon} @ ${s.alt}m`;
              const version = (live?.mf_version ?? s.mfVersion).split("(")[0];
              if (s.idx === data.editIndex) {
                const accept = (e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit(e.currentTarget.form.querySelector<HTMLButtonElement>(`button[name="save_edit_micro_${s.idx}"]`));
                };
                return (
                  <tr key={s.idx} className="bg-neutral-50 dark:bg-white/[0.03]">
                    <td>
                      <input
                        className="input w-14 px-2 py-1"
                        name={`site_order_${s.idx}`}
                        value={order}
                        title="Row number"
                        onChange={(e) => setOrder(e.currentTarget.value)}
                        onBlur={() => {
                          const v = parseInt(order, 10);
                          if (String(v) !== order.trim() || v < 1 || v > n) setOrder(String(data.editIndex));
                        }}
                        onKeyDown={accept}
                      />
                    </td>
                    <td>
                      <input className="input min-w-32 px-2 py-1" name={`site_name_${s.idx}`} defaultValue={s.name} pattern={NAME_PATTERN} title="Letters, numbers, -, _, ." onKeyDown={accept} />
                    </td>
                    <td>
                      <input className="input min-w-32 px-2 py-1" name={`mf_ip_${s.idx}`} defaultValue={ipDisplay(s.mfIp)} onKeyDown={accept} />
                    </td>
                    <td className="hidden text-xs text-neutral-500 md:table-cell">{lla}</td>
                    <td className="text-xs">{version}</td>
                    <td className="hidden sm:table-cell">
                      <StatusCell stat={stats[s.idx]} />
                    </td>
                    <td className="text-center">
                      <Checkbox name={`mf_uat_${s.idx}`} defaultChecked={s.uat978} disabled={live?.uat_capable === false} className="justify-center" />
                    </td>
                    <td className="text-center">
                      <Checkbox name={`mf_brofm_${s.idx}`} defaultChecked={s.brofm} disabled={live?.brofm_capable === false} className="justify-center" />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <SubmitButton name={`save_edit_micro_${s.idx}`} size="sm" variant="success" title="Save changes" icon={<Check className="size-4" />} />
                        <SubmitButton name={`cancel_edit_micro_${s.idx}`} size="sm" variant="outline" title="Cancel" icon={<X className="size-4" />} formNoValidate />
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={s.idx}>
                  <td className="text-neutral-500 tabular-nums">{displayOrder(s.idx)}</td>
                  <td className="font-medium">
                    <a href={`/map_${s.idx}/`}>{s.name}</a>
                  </td>
                  <td className="text-xs">
                    <a href={`http://${s.mfIp.split(",")[0]}`}>{ipDisplay(s.mfIp)}</a>
                  </td>
                  <td className="hidden text-xs text-neutral-500 md:table-cell">{lla}</td>
                  <td className="text-xs">{version}</td>
                  <td className="hidden sm:table-cell">
                    <a href={`/stats_${s.idx}/`} className="no-underline">
                      <StatusCell stat={stats[s.idx]} />
                    </a>
                  </td>
                  <td className="text-center">{s.uat978 && <Check className="mx-auto size-4 text-emerald-500" />}</td>
                  <td className="text-center">{s.brofm && <Check className="mx-auto size-4 text-emerald-500" />}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <SubmitButton name={`edit_micro_${s.idx}`} size="sm" variant="ghost" title="Edit this micro feeder" icon={<Pencil className="size-4" />} />
                      <SubmitButton name={`remove_micro_${s.idx}`} size="sm" variant="ghost" title="Remove this micro feeder" className="text-rose-600 hover:text-rose-700 dark:text-rose-400" icon={<Trash className="size-4" />} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PostForm>
  );
}

function AddMicroFeeder() {
  const [ip, setIp] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<RemoteCheck | null>(null);
  const [label, setLabel] = useState("");

  const check = () => {
    if (ip.length <= 3) return;
    setChecking(true);
    setLabel("");
    fetchJson<RemoteCheck>(`/api/check_remote_feeder/${encodeURIComponent(ip)}`, 8000)
      .then((d) => {
        if (d.name) {
          setLabel(d.name);
          setResult(d);
        } else if (d.status === "ok") {
          setLabel("Unknown (not a recent adsb.im feeder)");
          setResult({ ...d, dump978_at_port: 1 });
        } else {
          setLabel(`Unable to detect feeder at ${ip}`);
          setResult(null);
        }
      })
      .catch(() => {
        setLabel(`Unable to detect feeder at ${ip}`);
        setResult(null);
      })
      .finally(() => setChecking(false));
  };

  const adsbim = !!result?.name;
  const other = result && !result.name;

  return (
    <Card>
      <CardHeader
        icon={<Plus />}
        title="Add micro feeder"
        description="Enter the IP address and check the micro feeder. This ensures it's reachable and detects whether it's an ADSB.im feeder, which lets you import its settings. All site names need to be unique – duplicates get '_' appended."
      />
      <PostForm action="/update">
        <CardBody className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextField
              fieldClassName="flex-1"
              label="Micro feeder IP address"
              id="add_micro_feeder_ip"
              name="add_micro_feeder_ip"
              required
              placeholder="1.2.3.4"
              title="valid IPv4 address"
              value={ip}
              readOnly={!!result}
              onChange={(e) => setIp(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!result) check();
                }
              }}
            />
            {!result ? (
              <Button onClick={check} disabled={checking || ip.length <= 3} icon={checking ? <Spinner /> : <Search className="size-4" />}>
                Check micro feeder
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setLabel("");
                }}
              >
                Change IP
              </Button>
            )}
          </div>
          {label && (
            <div className={cx("text-sm font-semibold", result ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {result ? "Found: " : ""}
              {label}
            </div>
          )}

          {/* these stay in the form (hidden) like in the old UI */}
          <div className={cx("flex flex-wrap gap-x-8 gap-y-3", !result && "hidden")}>
            <div className={cx(!(result?.dump978_at_port && result.dump978_at_port > 0) && "hidden")}>
              <Checkbox name="micro_uat" label="Also receive UAT data on port 30978" />
            </div>
            <div className={cx(!result?.brofm_capable && "hidden")}>
              <Checkbox name="micro_reduce" defaultChecked label="Drop some redundant messages to save bandwidth" />
            </div>
          </div>

          {adsbim && (
            <div className="grid gap-3">
              {result?.micro_settings && (
                <>
                  <ImportOption name="import_micro" title="Import settings" description="Import settings for data sharing and some other options from the micro feeder." primary />
                  <ImportOption
                    name="import_micro_full"
                    title="Full import"
                    description="Import settings for data sharing and some other options as well as historical data and graphs. Depending on connection speed and amount of historical data, this can take a significant amount of time during which this web UI will be unresponsive. This will fail if you switch between 32 and 64 bit architectures (e.g. arm32 micro feeder with an arm64 / AMD64 stage 2)."
                  />
                </>
              )}
              <ImportOption name="add_micro" title="Manual" description="You will need to manually create settings for data sharing." />
            </div>
          )}

          {other && (
            <div className="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                As long as the feeder exposes port 30005 with Beast-Out at this IP address, you should be able to connect to it and use this system as stage 2 – a number of more advanced features will
                be missing.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField fieldClassName="sm:col-span-2" label="Micro feeder name" hint="Shows up on public maps if enabled later" name="micro_site_name" placeholder="my-awesome-antenna" pattern={NAME_PATTERN} title="Letters, numbers, -, _, ." />
                <TextField label="Latitude" name="micro_lat" placeholder="Antenna latitude" pattern={LAT_PATTERN} title="Number between -90 and 90" />
                <TextField label="Longitude" name="micro_lon" placeholder="Antenna longitude" pattern={LON_PATTERN} title="Number between -180 and 180" />
                <TextField label="Altitude above MSL (m)" name="micro_alt" placeholder="Antenna MSL altitude (in m)" pattern={String.raw`(?:\+|-|)\d+`} />
              </div>
              <SubmitButton name="add_other">Attach this feeder</SubmitButton>
            </div>
          )}
        </CardBody>
      </PostForm>
    </Card>
  );
}

function ImportOption({ name, title, description, primary }: { name: string; title: string; description: string; primary?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 sm:flex-row sm:items-center dark:border-neutral-800">
      <div className="flex-1">
        <div className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</div>
        <div className="text-sm text-neutral-500 dark:text-neutral-400">{description}</div>
      </div>
      <SubmitButton name={name} variant={primary ? "primary" : "outline"}>
        {title}
      </SubmitButton>
    </div>
  );
}

export function Stage2({ data }: { data: Stage2Data }) {
  return (
    <>
      <PageHeader eyebrow="Setup" title={`Stage 2 feeder ${data.siteName}`} subtitle="Combine data from multiple micro feeders into one map and feed aggregators per micro site." />
      {!data.dnsState && (
        <Alert tone="danger" className="mb-6">
          The feeder cannot resolve DNS queries. This will most likely prevent it from working at all.
        </Alert>
      )}
      <div className="space-y-6">
        <SettingsForm postAll>
          <Card>
            <CardHeader icon={<Network />} title="Stage 2 station" description="The position you want to be the center of your combined map display." />
            <CardBody>
              <LocationFields siteName={data.siteName} lat={data.lat} lon={data.lon} tz={data.tz} showAlt={false} siteHint="" />
            </CardBody>
          </Card>
          <UnsavedChangesBar name="set_stage2_data" value="go" className="mt-3" />
        </SettingsForm>

        <Card>
          <CardHeader title="Feeder sites" description="To configure aggregators for the individual feeders, select a target micro site at the top of the page and open the Data Sharing menu." />
          <CardBody>
            {data.numMicroSites === 0 ? <EmptyState icon={<Network />} title="No micro feeder sites configured" /> : <SitesTable data={data} />}
          </CardBody>
        </Card>

        <AddMicroFeeder />

        <Card>
          <PostForm action="/update">
            <CardBody className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
              <p>When a location on a micro feeder has been updated, wait until the change shows on this page and apply, so the updated location is used by stage 2.</p>
              {data.message && <p>{data.message}</p>}
            </CardBody>
            <CardFooter className="justify-between">
              <SubmitButton name="turn_off_stage2" variant="outline" className="w-full sm:w-auto" icon={<Power className="size-4" />}>
                Turn off Stage 2 mode
              </SubmitButton>
              {/* the full label is too wide for phones (buttons don't wrap), so stack full-width with a shorter label there */}
              <SubmitButton name="stage2" size="lg" className="order-first w-full sm:order-none sm:w-auto" icon={<RefreshCw className="size-4" />}>
                <span className="sm:hidden">Apply and restart proxies</span>
                <span className="hidden sm:inline">Apply settings and (re)start micro feeder proxies</span>
              </SubmitButton>
            </CardFooter>
          </PostForm>
        </Card>
      </div>
    </>
  );
}
