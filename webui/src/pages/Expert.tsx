import { Activity, Braces, Container, Cpu, Link2, MapPinned, Network, SlidersHorizontal, Terminal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { FeatureSwitch, SettingsForm, UnsavedChangesBar } from "../components/form";
import { SettingsItem, SettingsLayout, SettingsSection } from "../components/Settings";
import { Badge, Collapsible, PageHeader, TextArea, TextField } from "../components/ui";

export interface ExpertData {
  stage2: boolean;
  ultrafeederExtraArgs: string;
  ultrafeederExtraArgsMicrosites: string;
  ultrafeederExtraEnv: string;
  tar1090QueryParams: string;
  hasGpsd: boolean;
  useGpsd: boolean;
  configLink: boolean;
  tar1090port: string;
  webport: string;
  dockerConcurrent: boolean;
  dockerIpv6: boolean;
  sdrplayIgnoreSerial: boolean;
  telegrafAdsb: boolean;
}

// an on / off setting that the backend switches with a pair of button keys
function Toggle({
  icon,
  title,
  description,
  enabled,
  keys,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode | ((on: boolean) => ReactNode);
  enabled: boolean;
  keys: [string, string];
  children?: ReactNode;
}) {
  const [on, setOn] = useState(enabled);
  return (
    <SettingsItem
      icon={icon}
      title={title}
      badge={on !== enabled && <Badge tone="warning">{on ? "Enabled on apply" : "Disabled on apply"}</Badge>}
      description={typeof description === "function" ? description(on) : description}
      control={<FeatureSwitch keys={keys} enabled={enabled} on={on} onChange={setOn} label={title} />}
    >
      {children}
    </SettingsItem>
  );
}

export function Expert({ data }: { data: ExpertData }) {
  return (
    <>
      <PageHeader eyebrow="Setup" title="Expert Setup" subtitle="Raw configuration for experienced users. It's reasonably simple to break your setup here – only change what you understand." />
      <SettingsForm>
        <ExpertSettings data={data} />
      </SettingsForm>
    </>
  );
}

// state lives below SettingsForm so "Discard" resets it
function ExpertSettings({ data }: { data: ExpertData }) {
  return (
    <SettingsLayout
      sections={[
        { id: "ultrafeeder", title: "Ultrafeeder", icon: <Braces /> },
        { id: "environment", title: "Environment", icon: <Terminal /> },
        { id: "map", title: "Map", icon: <SlidersHorizontal /> },
        { id: "system", title: "System", icon: <Container /> },
        { id: "metrics", title: "Metrics", icon: <Activity /> },
      ]}
    >
      <SettingsSection id="ultrafeeder" title="Ultrafeeder">
        <SettingsItem
          icon={<Braces />}
          title="Additional Ultrafeeder arguments"
          description="Appended to the Ultrafeeder config – e.g. to feed an aggregator that uses the 'standard' format of the account-less aggregators but isn't supported out of the box. End each entry / line with a semicolon (;)."
        >
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-6 break-all text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            adsb,feed.adsb.xyz,30004,beast_reduce_plus_out;
            <br />
            adsb,feed.adsb.xyz,30004,beast_reduce_plus_out,uuid=a67c44ce-[…];
            <br />
            mlat,feed.adsb.xyz,31009;
          </div>
          {data.stage2 && (
            <TextArea
              label="Applied to all microsite ultrafeeder instances"
              hint="SITENUM is replaced with 00, 01, 02 and so forth"
              name="ultrafeeder_extra_args_microsites"
              rows={5}
              placeholder="adsb,feed.adsb.xyz,234SITENUM,beast_reduce_plus_out"
              defaultValue={data.ultrafeederExtraArgsMicrosites}
            />
          )}
          <TextArea
            label={data.stage2 ? "Applied to the ultrafeeder instance with combined data" : "Arguments"}
            name="ultrafeeder_extra_args"
            rows={5}
            placeholder="adsb,feed.adsb.xyz,30004,beast_reduce_plus_out"
            defaultValue={data.ultrafeederExtraArgs}
          />
        </SettingsItem>
      </SettingsSection>

      <SettingsSection id="environment" title="Environment">
        <SettingsItem
          icon={<Terminal />}
          title="Container environment variables"
          description="The Docker containers support many more environment variables than this UI exposes. Enter them one per line as NAME=value. The name spaces of the containers are distinct, so they are all added here together."
        >
          <TextArea name="ultrafeeder_extra_env" rows={8} placeholder={"READSB_RTLSDR_PPM=22\nREADSB_RANGE_OUTLINE_HOURS=72"} defaultValue={data.ultrafeederExtraEnv} />
        </SettingsItem>
      </SettingsSection>

      <SettingsSection id="map" title="Map">
        <SettingsItem
          icon={<SlidersHorizontal />}
          title="Map URL arguments"
          description={
            <>
              tar1090 supports a plethora of URL <a href="https://github.com/wiedehopf/tar1090/blob/master/README-query.md">query parameters</a>. Add the ones you always want to use.
            </>
          }
        >
          <TextField name="tar1090_query_params" className="font-mono" placeholder="?autoselect&centerReceiver" defaultValue={data.tar1090QueryParams} />
        </SettingsItem>
        <Toggle
          icon={<Link2 />}
          title="Config link on the map page"
          enabled={data.configLink}
          keys={["allow_config_link", "no_config_link"]}
          description={(on) =>
            on
              ? `Shows the link to this feeder's configuration on the map. To share ONLY the map / statistics, hide it – users can still reach the configuration by changing the port from ${data.tar1090port} to ${data.webport} unless you block that with a firewall.`
              : `Show the link to the feeder home page on the map. Make sure both the map port ${data.tar1090port} and the feeder UI port ${data.webport} are accessible.`
          }
        />
      </SettingsSection>

      <SettingsSection id="system" title="System">
        {data.hasGpsd && (
          <Toggle
            icon={<MapPinned />}
            title="GPS based location"
            enabled={data.useGpsd}
            keys={["turn_on_gpsd", "turn_off_gpsd"]}
            description={(on) => (on ? "The location is taken from gpsd." : "gpsd appears to be installed and configured. Use GPS derived location data?")}
          />
        )}
        <Toggle
          icon={<Container />}
          title="Concurrent docker downloads"
          enabled={data.dockerConcurrent}
          keys={["enable_parallel_docker", "disable_parallel_docker"]}
          description="The default, and works well on most connections. Disabling can help on slow connections to avoid update failures."
        />
        <Toggle
          icon={<Network />}
          title="Docker bridge network IPv6"
          enabled={data.dockerIpv6}
          keys={["docker_ipv6--enable", "docker_ipv6--disable"]}
          description="Off by default. Rare connectivity issues make it useful to enable it; in general this is not recommended."
        />
        <Toggle
          icon={<Cpu />}
          title="SDRplay: ignore serial"
          enabled={data.sdrplayIgnoreSerial}
          keys={["sdrplay_ignore_serial--enable", "sdrplay_ignore_serial--disable"]}
          description="Some SDRplay / RSP devices don't always show up with a serial. If only one SDRplay device is connected, enable this to ignore the serial."
        />
      </SettingsSection>

      <SettingsSection id="metrics" title="Metrics">
        <Toggle
          icon={<Activity />}
          title="Prometheus / Grafana / Influx / Telegraf"
          enabled={data.telegrafAdsb}
          keys={["telegraf_adsb--enable", "telegraf_adsb--disable"]}
          description="Generally unsupported option to enable telegraf in the image. Only enable this if you really understand what you are doing."
        >
          <Collapsible>
            <div className="space-y-2">
              <p>
                Basic prometheus metrics are always available at the tar1090 map URL with <code className="code-chip">/metrics</code> added – e.g. a scrape target of{" "}
                <code className="code-chip">192.168.2.33:8080</code> (<code className="code-chip">:1099</code> on app install). For individual stage 2 sites, e.g. the map at{" "}
                <code className="code-chip">:8080/2</code>, use <code className="code-chip">metrics_path: /2/metrics</code>.
              </p>
              <p>
                This container is for feeding influx or fancier prometheus / grafana setups. On a stage 2 it only covers combined data. Prometheus output is available on port 9273; influx is configured
                via the environment variables of <a href="https://github.com/sdr-enthusiasts/docker-telegraf-adsb">docker-telegraf-adsb</a>.
              </p>
              <p>This is only meant for expert users and we are reluctant to fully support it – for questions try the non-adsb.im channels on the SDR-E discord.</p>
            </div>
          </Collapsible>
        </Toggle>
      </SettingsSection>

      <UnsavedChangesBar />
    </SettingsLayout>
  );
}
