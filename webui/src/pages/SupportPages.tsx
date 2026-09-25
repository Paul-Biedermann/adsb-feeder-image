import { Check, ClipboardCopy, CloudUpload, Cpu, Database, Download, Eye, FileArchive, HardDrive, Info as InfoIcon, LifeBuoy, MessagesSquare, Upload } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { PostForm } from "../components/form";
import { Alert, Badge, Button, Card, CardBody, CardFooter, CardHeader, Checkbox, LinkButton, PageHeader, SubmitButton } from "../components/ui";
import { useIpMismatch } from "../lib/hooks";

/* -------------------------------------------------------------- support info */

export interface InfoData {
  current: string;
  board: string;
  base: string;
  kernel: string;
  underVoltage: boolean;
  journal: string;
  dnsState: boolean;
  ipv6: string;
  netdog: string;
  containers: string[];
  sdrs: string[];
  ufargs: string;
  envvars: string;
  memory: string;
  storage: string;
  top: string;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="min-w-0 text-sm text-neutral-900 dark:text-neutral-100">{children}</dd>
    </div>
  );
}

function Pre({ children }: { children: ReactNode }) {
  return <pre className="prose-pre whitespace-pre">{children}</pre>;
}

export function Info({ data }: { data: InfoData }) {
  const ip = useIpMismatch();
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = ref.current?.innerText ?? "";
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Support Info"
        subtitle="Please copy and paste (or provide a screenshot of) this data when asking for help."
        actions={
          <Button variant="outline" onClick={copy} icon={copied ? <Check className="size-4 text-emerald-500" /> : <ClipboardCopy className="size-4" />}>
            {copied ? "Copied" : "Copy all"}
          </Button>
        }
      />
      <div ref={ref} className="space-y-6">
        <Card>
          <CardHeader icon={<InfoIcon />} title="System" />
          <CardBody>
            <dl className="divide-y divide-neutral-100 dark:divide-neutral-800">
              <Row label="Current">{data.current}</Row>
              <Row label="Board">{data.board}</Row>
              <Row label="Base">{data.base}</Row>
              <Row label="Kernel">{data.kernel}</Row>
              <Row label="Power">{data.underVoltage ? <Badge tone="danger">Undervoltage reported</Badge> : "Undervoltage not reported"}</Row>
              <Row label="Journal">{data.journal}</Row>
              <Row label="DNS">{data.dnsState ? "DNS appears to be working" : <Badge tone="danger">The feeder cannot resolve DNS queries</Badge>}</Row>
              <Row label="IPv6">{data.ipv6}</Row>
              {ip !== "unknown" && <Row label="Network / IP">{ip === "match" ? "Your browser and the feeder have the same external IP address." : "Your browser and the feeder have different external IP addresses."}</Row>}
              <Row label="Netdog reboots">{data.netdog.trim() ? <Pre>{data.netdog}</Pre> : <span className="text-neutral-400">none</span>}</Row>
            </dl>
          </CardBody>
        </Card>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader icon={<Cpu />} title="Containers" />
            <CardBody>
              <ul className="flex flex-wrap gap-2">
                {data.containers.map((c) => (
                  <li key={c}>
                    <span className="code-chip">{c}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader icon={<HardDrive />} title="SDR(s)" />
            <CardBody className="space-y-2">
              {data.sdrs.map((s, i) => (
                <Pre key={i}>{s}</Pre>
              ))}
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="Configuration" />
          <CardBody className="space-y-4">
            <div>
              <div className="label">Ultrafeeder args</div>
              <Pre>{data.ufargs || " "}</Pre>
            </div>
            <div>
              <div className="label">Env variables</div>
              <Pre>{data.envvars || " "}</Pre>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Resources" />
          <CardBody className="space-y-4">
            <div>
              <div className="label">Memory</div>
              <Pre>{data.memory}</Pre>
            </div>
            <div>
              <div className="label">Storage</div>
              <Pre>{data.storage}</Pre>
            </div>
            <div>
              <div className="label">Top</div>
              <Pre>{data.top}</Pre>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ share diagnostics */

export function Support({ data }: { data: { url: string } }) {
  const isLink = /^https?:\/\//.test(data.url);
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Share diagnostics"
        subtitle="Create an anonymized log that removes IP addresses, locations, aggregator keys and other secrets, and upload it for easier sharing with the developers."
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {data.url && (
          <div className="lg:col-span-2">
            {isLink ? (
              <Alert tone="success" title="The link to the uploaded log is:">
                <a href={data.url} className="font-mono text-base">
                  {data.url}
                </a>
                <p className="mt-1">Please share this link with the developers who are trying to help you (and who most likely asked you to provide this info in the first place).</p>
              </Alert>
            ) : (
              <Alert tone="danger">{data.url}</Alert>
            )}
          </div>
        )}
        <Card>
          <CardHeader
            icon={<CloudUpload />}
            title="Upload anonymized logs"
            description="After uploading you get a link that you can share on one of the support forums. The services don't reliably work from every location at all times – if you get an error, try the other option."
          />
          <PostForm encType="multipart/form-data" busyText="Uploading logs…">
            <CardFooter>
              <SubmitButton name="upload" value="termbin.com" variant="outline">
                Upload to termbin.com (netcat)
              </SubmitButton>
              <SubmitButton name="upload" value="0x0.st">
                Upload to 0x0.st (curl)
              </SubmitButton>
            </CardFooter>
          </PostForm>
        </Card>
        <Card>
          <CardHeader
            icon={<Download />}
            title="Download or view logs"
            description={
              <>
                Instead of uploading, you can download the log and upload it on the <a href="https://discord.gg/gducED2VC3">adsb.im Discord server</a>.
              </>
            }
          />
          <CardFooter>
            <PostForm encType="multipart/form-data" busy={false}>
              <SubmitButton name="upload" value="local_download" variant="outline" icon={<Download className="size-4" />}>
                Download logs
              </SubmitButton>
            </PostForm>
            <PostForm encType="multipart/form-data">
              <SubmitButton name="upload" value="local_view" icon={<Eye className="size-4" />}>
                View logs
              </SubmitButton>
            </PostForm>
          </CardFooter>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<MessagesSquare />}
            title="Get help"
            description={
              <>
                For help and questions, please go to the <a href="https://adsblol.zulipchat.com/#narrow/stream/391168-adsb-feeder-image">adsb-feeder-image Zulip channel</a> or the{" "}
                <a href="https://discord.gg/gducED2VC3">adsb.im Discord server</a>.
              </>
            }
          />
          <div className="h-5" />
        </Card>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ backup / restore */

export function Backup({ data }: { data: { skystatsDb: boolean } }) {
  const options = [
    { href: "/backupexecuteconfig", title: "Config backup", description: "A zip file with your configuration settings.", icon: <FileArchive />, recommended: true },
    { href: "/backupexecutegraphs", title: "Config + graphs backup", description: "Adds the data used to generate the statistical graphs (roughly +15MB).", icon: <FileArchive />, recommended: true },
    {
      href: "/backupexecutefull",
      title: "Full backup",
      description:
        "Adds the replay / heatmap data on top of all that. Creates significantly larger backups that take much longer to create and restore – unless you know that you need that data, stick with one of the options above. To limit the data retained on disk, you can use MAX_GLOBE_HISTORY=365 in the environment variables on the expert page (graph data is not affected).",
      icon: <HardDrive />,
    },
    ...(data.skystatsDb ? [{ href: "/backupexecuteskystatsdb", title: "Skystats DB backup", description: "A SQL dump of the Skystats PostgreSQL database (restore currently not supported).", icon: <Database /> }] : []),
  ];
  return (
    <>
      <PageHeader eyebrow="System" title="Backup" subtitle="Create a backup of your configuration." actions={<LinkButton href="/restore" icon={<Upload className="size-4" />}>Restore a backup</LinkButton>} />
      <div className="grid gap-4 md:grid-cols-2">
        {options.map((o) => (
          <Card key={o.href} className="flex flex-col">
            <CardHeader icon={o.icon} title={o.title} description={o.description} actions={"recommended" in o && o.recommended ? <Badge tone="brand">Recommended</Badge> : null} />
            <div className="flex-1" />
            <CardFooter className="mt-5">
              <LinkButton href={o.href} variant={"recommended" in o && o.recommended ? "primary" : "outline"} icon={<Download className="size-4" />}>
                Download
              </LinkButton>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}

export function Restore() {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <PageHeader eyebrow="System" title="Restore" subtitle="Restore your setup from a configuration backup file." />
      <Card className="max-w-2xl">
        <PostForm encType="multipart/form-data" busyText="Uploading backup…">
          <CardBody>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer?.files[0];
                if (f && input.current) {
                  const dt = new DataTransfer();
                  dt.items.add(f);
                  input.current.files = dt.files;
                  setFile(f);
                }
              }}
              className={
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition " +
                (drag ? "border-neutral-500 bg-neutral-50 dark:bg-white/[0.03]" : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600")
              }
            >
              <Upload className="mb-3 size-8 text-neutral-400" />
              <div className="font-medium text-neutral-800 dark:text-neutral-200">{file ? file.name : "Drop your backup file here, or click to browse"}</div>
              <div className="mt-1 text-sm text-neutral-500">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ".zip or .backup files created by this feeder"}</div>
              <input ref={input} type="file" name="file" accept=".zip,.backup" className="sr-only" onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} />
            </label>
          </CardBody>
          <CardFooter>
            <Button type="submit" disabled={!file} icon={<Upload className="size-4" />}>
              Upload
            </Button>
          </CardFooter>
        </PostForm>
      </Card>
    </>
  );
}

export function RestoreExecute({ data }: { data: { changed: string[]; unchanged: string[] } }) {
  return (
    <>
      <PageHeader eyebrow="System" title="Restore setup from a backup" subtitle="Select the files you want to restore from the backup." />
      <div className="grid max-w-3xl gap-6">
        {data.unchanged.length > 0 && (
          <Card>
            <CardHeader title="Unchanged files" description="These files appear identical to the installed versions." />
            <CardBody className="flex flex-wrap gap-2">
              {data.unchanged.map((n) => (
                <span key={n} className="code-chip">
                  {n}
                </span>
              ))}
            </CardBody>
          </Card>
        )}
        {data.changed.length > 0 ? (
          <Card>
            <CardHeader title="Modified files" description="These files differ from the installed versions. Select the ones you want to restore." icon={<LifeBuoy />} />
            <PostForm busyText="Restoring…">
              <CardBody className="space-y-2">
                {data.changed.map((n) => (
                  <Checkbox key={n} name={n} label={<span className="font-mono text-[13px]">{n}</span>} />
                ))}
              </CardBody>
              <CardFooter>
                <Button type="submit">Restore</Button>
              </CardFooter>
            </PostForm>
          </Card>
        ) : (
          <Alert tone="info">Nothing to restore – all files in the backup match the current configuration.</Alert>
        )}
      </div>
    </>
  );
}
