import { Download, Eye, HardDrive, KeyRound, Lock, Network, Power, RefreshCw, RotateCw, ScrollText, ShieldCheck, Terminal, Wifi } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ActionScope, FeatureSwitch, SettingsForm, UnsavedChangesBar } from "../components/form";
import { SettingsItem, SettingsLayout, SettingsSection } from "../components/Settings";
import { Alert, Badge, Button, Checkbox, PageHeader, Spinner, SubmitButton, Switch, TextField } from "../components/ui";
import { fetchJson } from "../lib/hooks";
import { OnOff } from "./Advanced";

export interface SystemMgmtData {
  secureImage: boolean;
  fullImage: boolean;
  virtualized: boolean;
  rpw: string;
  webAuthEnabled: boolean;
  authPwd: string;
  hotspotEnabled: boolean;
  persistentJournal: boolean;
  nightlyBaseUpdate: boolean;
  nightlyFeederUpdate: boolean;
  currentBranch: string;
  channel: string;
  containers: string[];
  zerotierRunning: boolean;
  zerotierid: string;
  tailscaleName: string;
  tailscaleLl: string;
  tailscaleExtras: string;
  tailscaleRunning: boolean;
  netbirdRegistered: boolean;
  netbirdManagementUrl: string;
  netbirdFqdn: string;
  netbirdIp: string;
  netbirdRunning: boolean;
  wifi: string;
}

function SecretReveal({ secret, onReveal, testId }: { secret: string; onReveal?: () => void; testId?: string }) {
  const [shown, setShown] = useState(false);
  return shown ? (
    <code data-test={testId} className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-mono text-base font-semibold tracking-wide text-neutral-900 select-all dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
      {secret}
    </code>
  ) : (
    <Button
      size="sm"
      variant="outline"
      icon={<Eye className="size-4" />}
      data-test={testId ? "show_auth_passwd" : undefined}
      onClick={() => {
        setShown(true);
        onReveal?.();
      }}
    >
      Show password
    </Button>
  );
}

// SSID field with the networks found by /api/scan_wifi listed below it (inline, not a popover,
// so it isn't clipped by the surrounding card)
function WifiSsidInput() {
  const [state, setState] = useState<"idle" | "scanning" | "done" | "failed">("idle");
  const [ssids, setSsids] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const scanned = useRef(false);
  const scan = () => {
    setState("scanning");
    fetchJson<{ ssids: string[] }>("/api/scan_wifi")
      .then((d) => {
        setSsids(d.ssids ?? []);
        setState("done");
      })
      .catch(() => setState("failed"));
  };
  return (
    <div className="space-y-2">
      <TextField
        label="SSID"
        name="wifi_ssid"
        required
        autoComplete="off"
        placeholder="SSID"
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onFocus={() => {
          if (!scanned.current) {
            scanned.current = true;
            scan();
          }
        }}
        trailing={
          <Button size="sm" variant="ghost" className="h-7" onClick={scan} icon={state === "scanning" ? <Spinner /> : <RefreshCw className="size-3.5" />}>
            Scan
          </Button>
        }
      />
      {state === "failed" && <div className="text-xs text-neutral-500">Scan failed</div>}
      {state === "done" && ssids.length === 0 && <div className="text-xs text-neutral-500">No networks found</div>}
      {state === "done" && ssids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ssids.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setValue(s)}
              className={
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium " +
                (value === s
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-200 text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300")
              }
            >
              <Wifi className="size-3" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ContainerRestart({ containers }: { containers: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const n = selected.size;
  return (
    <ActionScope busyText="Restarting containers…">
      <SettingsItem
        icon={<RefreshCw />}
        title="Restart / recreate containers"
        description="Typically this shouldn't be necessary, but occasionally a container doesn't pick up a setting or gets otherwise stuck. Select containers, or leave all unselected to act on all of them."
        footer={
          <>
            <SubmitButton name="recreate_containers" size="sm" variant="outline">
              {n === 0 ? "Recreate all" : `Recreate selected (${n})`}
            </SubmitButton>
            <SubmitButton name="restart_containers" size="sm">
              {n === 0 ? "Restart all" : `Restart selected (${n})`}
            </SubmitButton>
          </>
        }
      >
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {containers.map((c) => (
            <Checkbox
              key={c}
              name={`restart-${c}`}
              label={<span className="font-mono text-[13px]">{c}</span>}
              checked={selected.has(c)}
              onChange={(v) => {
                const next = new Set(selected);
                if (v) next.add(c);
                else next.delete(c);
                setSelected(next);
              }}
            />
          ))}
        </div>
      </SettingsItem>
    </ActionScope>
  );
}

// a setting the backend flips with a single toggle key (it reads the current state itself)
function ToggleItem({ icon, title, description, enabled, toggleKey }: { icon: ReactNode; title: string; description: ReactNode | ((on: boolean) => ReactNode); enabled: boolean; toggleKey: string }) {
  const [on, setOn] = useState(enabled);
  return (
    <SettingsItem
      icon={icon}
      title={title}
      badge={on !== enabled && <Badge tone="warning">{on ? "Enabled on apply" : "Disabled on apply"}</Badge>}
      description={typeof description === "function" ? description(on) : description}
      control={<FeatureSwitch keys={[toggleKey, toggleKey]} enabled={enabled} on={on} onChange={setOn} label={title} />}
    />
  );
}

function DisableConfirm({ name, what }: { name: string; what: string }) {
  return (
    <div className="space-y-2">
      <TextField label={`To disable ${what}, type "disable" and confirm below`} name={name} placeholder="disable" className="max-w-xs" />
      <p className="text-sm text-rose-600 dark:text-rose-400">This will prevent you from accessing this feeder if you use a {what} network to connect to it.</p>
    </div>
  );
}

export function SystemMgmt({ data }: { data: SystemMgmtData }) {
  const full = data.fullImage;
  const secure = data.secureImage;
  const [authRevealed, setAuthRevealed] = useState(false);
  const [changelogs, setChangelogs] = useState<{ beta?: string; stable?: string }>({});
  useEffect(() => {
    fetchJson<{ beta_changelog?: string; main_changelog?: string }>("/api/status/im", 5000)
      .then((d) => setChangelogs({ beta: d.beta_changelog, stable: d.main_changelog }))
      .catch(() => {});
  }, []);
  const confirmSubmit = (text: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!confirm(text)) e.preventDefault();
  };
  const tailscaleSetup = (data.tailscaleName === "" && data.tailscaleLl === "") || !data.tailscaleRunning;

  return (
    <>
      <PageHeader eyebrow="System" title="System Management" subtitle="Updates, maintenance, access and networking of the feeder." />
      {secure && (
        <Alert tone="info" title="The feeder system is secured" className="mb-6">
          If you're looking for missing options, this is likely the reason. To unlock the system and re-enable all those options, log in locally or via SSH and run{" "}
          <code className="code-chip">/opt/adsb/scripts/secure-image-disable.sh</code>
        </Alert>
      )}
      {/* nightly updates are read by the update job, nothing needs to restart for them */}
      <SettingsForm noRestartFields={["nightly_base_update--is_enabled", "nightly_feeder_update--is_enabled"]}>
        <SettingsLayout
          sections={[
            { id: "updates", title: "Updates", icon: <Download /> },
            { id: "maintenance", title: "Maintenance", icon: <RefreshCw /> },
            { id: "access", title: "Access & security", icon: <Lock />, hidden: secure },
            { id: "network", title: "Network", icon: <Network />, hidden: secure || !full },
          ]}
        >
          <SettingsSection id="updates" title="Updates">
            <ActionScope busyText="Starting update…">
              <SettingsItem
                icon={<Download />}
                title="Update feeder software"
                description={
                  <>
                    Update the web UI, setup apps, and containers to the latest beta or stable version. With new container images this can easily take more than ten minutes; the web UI pauses while
                    the update runs, the feeder apps are only briefly interrupted.
                    {data.channel && (
                      <>
                        {" "}
                        You can also update to the latest state of the <code className="code-chip">{data.channel}</code> branch – typically far less tested, please create a backup first.
                      </>
                    )}
                  </>
                }
                footer={
                  <>
                    {data.channel && (
                      <SubmitButton name="update_feeder_aps_branch" size="sm" variant="outline">
                        Update ({data.channel})
                      </SubmitButton>
                    )}
                    <SubmitButton name="update_feeder_aps_beta" size="sm" variant="outline" title={changelogs.beta}>
                      Update (beta)
                    </SubmitButton>
                    <SubmitButton name="update_feeder_aps_stable" size="sm" title={changelogs.stable}>
                      Update (stable)
                    </SubmitButton>
                  </>
                }
              />
            </ActionScope>
            <SettingsItem icon={<RotateCw />} title="Automatic updates" description="Nightly updates run in the background.">
              {full && <Switch name="nightly_base_update--is_enabled" defaultChecked={data.nightlyBaseUpdate} label="Update base OS every night" />}
              <Switch
                name="nightly_feeder_update--is_enabled"
                defaultChecked={data.nightlyFeederUpdate}
                label="Update feeder software every night"
                description={
                  <>
                    Uses the branch of the last manual update – currently <code className="code-chip">{data.currentBranch}</code>.
                  </>
                }
              />
            </SettingsItem>
            {full && (
              <ActionScope>
                <SettingsItem
                  icon={<HardDrive />}
                  title="Operating system update"
                  description="Update the base OS packages now."
                  control={
                    <SubmitButton name="os_update" size="sm" variant="outline">
                      Update OS now
                    </SubmitButton>
                  }
                />
              </ActionScope>
            )}
          </SettingsSection>

          <SettingsSection id="maintenance" title="Maintenance">
            <ContainerRestart containers={data.containers} />
            {full && (
              <ToggleItem
                icon={<ScrollText />}
                title="Persistent system log"
                enabled={data.persistentJournal}
                toggleKey="log_persistence_toggle"
                description={(on) => (on ? "The system log is written to disk." : "The system log is only kept in memory.")}
              />
            )}
            {full && !secure && (
              <ToggleItem
                icon={<Wifi />}
                title="WiFi hotspot"
                enabled={data.hotspotEnabled}
                toggleKey="toggle_hotspot"
                description="When there is no network connectivity, this image provides a WiFi hotspot to configure WiFi."
              />
            )}
            {full && !secure && (
              <ActionScope>
                <SettingsItem
                  icon={<Power />}
                  title="Reboot or shut down"
                  description="Some boards can't reboot without manually power cycling, and most won't turn off power by themselves."
                  control={
                    <>
                      <SubmitButton name="reboot" value="wait" size="sm" variant="outline" onClick={confirmSubmit("Reboot the feeder now?")}>
                        Reboot
                      </SubmitButton>
                      <SubmitButton name="shutdown" value="wait" size="sm" variant="danger" onClick={confirmSubmit("Shut down the feeder now? You will need physical access to turn it back on.")}>
                        Shut down
                      </SubmitButton>
                    </>
                  }
                />
              </ActionScope>
            )}
          </SettingsSection>

          {!secure && (
            <SettingsSection id="access" title="Access & security">
              <ActionScope>
                <SettingsItem
                  icon={<Lock />}
                  title="Web authentication"
                  badge={<OnOff on={data.webAuthEnabled} />}
                  description="Protect the web interface with a username and password. When enabled, both the main setup app and recovery app require authentication."
                  control={
                    data.webAuthEnabled && (
                      <SubmitButton name="web_auth_disable" value="stay" size="sm" variant="outline">
                        Disable
                      </SubmitButton>
                    )
                  }
                  footer={
                    !data.webAuthEnabled && (
                      <SubmitButton name="web_auth_setup" value="stay" size="sm" id="web_auth_enable" disabled={!authRevealed}>
                        SSH is working – enable authentication
                      </SubmitButton>
                    )
                  }
                >
                  {!data.webAuthEnabled && (
                    <>
                      <Alert tone="warning">
                        Make sure you have an SSH key or password set up and tested before enabling this, or you risk permanently locking yourself out of this image if you misplace the password.
                      </Alert>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField label="Username" id="web_auth_username" name="web_auth--username" required placeholder="Username" />
                        <div>
                          <div className="label">Password</div>
                          <SecretReveal secret={data.authPwd} onReveal={() => setAuthRevealed(true)} testId="auth_passwd" />
                        </div>
                      </div>
                      <p className="hint mt-0">The system generates the password. Copy it to a safe place (e.g. a password manager) – this is the only time it is shown.</p>
                    </>
                  )}
                </SettingsItem>
              </ActionScope>
              {full && (
                <ActionScope>
                  <SettingsItem icon={<Terminal />} title="SSH public key" description="Install a public key to log in as root on the feeder." footer={<SubmitButton name="ssh" value="stay" size="sm">Install key</SubmitButton>}>
                    <TextField name="ssh_pub" required className="font-mono text-xs" placeholder="ssh-ed25519 AAAA… you@host" />
                  </SettingsItem>
                </ActionScope>
              )}
              {full && (
                <ActionScope>
                  <SettingsItem
                    icon={<KeyRound />}
                    title="Root password"
                    description="If you need to log in as root (and you almost never should), show the generated password, copy it, then accept it. You can then log in using an SSH client."
                    control={
                      <>
                        <SecretReveal secret={data.rpw} />
                        <SubmitButton name="rpw" value="stay" size="sm" variant="outline">
                          Accept
                        </SubmitButton>
                      </>
                    }
                  />
                </ActionScope>
              )}
              {full && (
                <SettingsItem
                  icon={<ShieldCheck />}
                  title="Secure feeder system"
                  description={
                    <>
                      Makes it harder for someone on the local network to gain access to the image and disables the WiFi hotspot. To enable, log in locally or via SSH and run{" "}
                      <code className="code-chip">/opt/adsb/scripts/secure-image-enable.sh</code>
                    </>
                  }
                />
              )}
            </SettingsSection>
          )}

          {!secure && full && (
            <SettingsSection id="network" title="Network">
              {!data.virtualized && (
                <ActionScope>
                  <SettingsItem
                    icon={<Wifi />}
                    title={data.wifi ? "Reconfigure WiFi" : "Connect to WiFi"}
                    badge={data.wifi ? <Badge tone="success">{data.wifi}</Badge> : <Badge>Ethernet</Badge>}
                    description="It can take several minutes for the connection to be established; if it appears stuck even after a longer wait, a forced reboot (pull power) may be required. If it succeeds, connect to the feeder on the new network – it can't forward you automatically."
                    footer={<SubmitButton name="wifi" value="stay" size="sm">Connect</SubmitButton>}
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <WifiSsidInput />
                      <TextField label="Password" name="wifi_password" placeholder="Password" />
                    </div>
                  </SettingsItem>
                </ActionScope>
              )}
              <ActionScope>
                <SettingsItem
                  icon={<Network />}
                  title="Tailscale"
                  badge={data.tailscaleName ? <Badge tone="success">{data.tailscaleName}</Badge> : null}
                  description={
                    data.tailscaleName
                      ? `This device should now be on your tailnet as '${data.tailscaleName}'.`
                      : "Connect the feeder to your tailnet. We start the tailscale client and then show a login link to authenticate the device."
                  }
                  footer={tailscaleSetup ? <SubmitButton name="tailscale" size="sm">Connect</SubmitButton> : <SubmitButton name="tailscale_disable_go" size="sm" variant="danger">Disconnect</SubmitButton>}
                >
                  {data.tailscaleLl && (
                    <Alert tone="info">
                      Open{" "}
                      <a href={data.tailscaleLl} target="_blank" rel="noopener">
                        {data.tailscaleLl}
                      </a>
                      . After you have logged in, come back to this tab and reload this page.
                    </Alert>
                  )}
                  {tailscaleSetup ? (
                    <TextField
                      label="Extra options"
                      hint={!data.tailscaleName && !data.tailscaleLl ? "e.g. a specific --login-server; --authkey isn't supported at this point" : undefined}
                      name="tailscale_extras"
                      placeholder="--login-server=https://…"
                      defaultValue={data.tailscaleExtras}
                    />
                  ) : (
                    <DisableConfirm name="tailscale_disable" what="Tailscale" />
                  )}
                </SettingsItem>
              </ActionScope>
              <ActionScope>
                <SettingsItem
                  icon={<Network />}
                  title="Zerotier"
                  badge={data.zerotierRunning ? <Badge tone="success">Running</Badge> : null}
                  description={data.zerotierRunning ? "This device should now be on your Zerotier network." : "Connect the feeder to your own global area network. Afterwards, accept the new device into the network on the Zerotier website."}
                  footer={
                    <SubmitButton name="zerotier" size="sm" variant={data.zerotierRunning ? "danger" : "primary"}>
                      {data.zerotierRunning ? "Leave network" : "Join network"}
                    </SubmitButton>
                  }
                >
                  {data.zerotierRunning ? <DisableConfirm name="zerotier_disable" what="Zerotier" /> : <TextField label="Network ID" name="zerotierid" required placeholder="Zerotier network ID" defaultValue={data.zerotierid} className="max-w-sm" />}
                </SettingsItem>
              </ActionScope>
              <ActionScope>
                <SettingsItem
                  icon={<KeyRound />}
                  title="Netbird"
                  badge={data.netbirdRegistered ? <OnOff on={data.netbirdRunning} labels={["Up", "Down"]} /> : null}
                  description={data.netbirdRegistered ? "This device should now be on your Netbird network." : "Add your Netbird setup key. The management URL is optional for self-hosted setups and can be left blank for Netbird Cloud."}
                  footer={
                    data.netbirdRegistered ? (
                      <>
                        <SubmitButton name="netbird_deregister" size="sm" variant="danger">
                          Deregister
                        </SubmitButton>
                        {data.netbirdRunning ? (
                          <SubmitButton name="netbird_down" size="sm" variant="outline">
                            Bring down
                          </SubmitButton>
                        ) : (
                          <SubmitButton name="netbird_up" size="sm">
                            Bring up
                          </SubmitButton>
                        )}
                      </>
                    ) : (
                      <SubmitButton name="netbird" size="sm">
                        Register
                      </SubmitButton>
                    )
                  }
                >
                  {data.netbirdRegistered ? (
                    <div className="space-y-2 text-sm">
                      {data.netbirdFqdn && (
                        <div>
                          FQDN: <code className="code-chip">{data.netbirdFqdn}</code>
                        </div>
                      )}
                      {data.netbirdIp && (
                        <div>
                          IP: <code className="code-chip">{data.netbirdIp}</code>
                        </div>
                      )}
                      <p className="text-rose-600 dark:text-rose-400">Bringing Netbird down or deregistering it may prevent you from accessing this feeder if you use a Netbird network to connect to it.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Management URL" name="netbird_management_url" placeholder="https://api.netbird.io" defaultValue={data.netbirdManagementUrl} />
                      <TextField label="Setup key" name="netbird_setup_key" required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" />
                    </div>
                  )}
                </SettingsItem>
              </ActionScope>
            </SettingsSection>
          )}

          <UnsavedChangesBar />
        </SettingsLayout>
      </SettingsForm>
    </>
  );
}
