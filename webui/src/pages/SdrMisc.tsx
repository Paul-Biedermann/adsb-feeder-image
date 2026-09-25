import { FileText, Tag, Usb } from "lucide-react";
import { useEffect, useState } from "react";
import { PostForm } from "../components/form";
import { Alert, Button, Card, CardBody, CardFooter, CardHeader, EmptyState, PageHeader, Spinner, SubmitButton, TextField } from "../components/ui";
import { hideBusy, showBusy } from "../lib/busy";
import { fetchJson } from "../lib/hooks";

type Sdr = { type: string; serial: string; purpose: string };

export function ChangeSdrSerial() {
  const [rtl, setRtl] = useState<Sdr[] | null>(null);
  const [serial, setSerial] = useState("");
  const [result, setResult] = useState<{ tone: "success" | "danger" | "warning"; text: string } | null>(null);

  useEffect(() => {
    fetchJson<{ sdrdevices: Sdr[] }>("/api/sdr_info")
      .then((d) => setRtl(d.sdrdevices.filter((s) => s.type === "rtlsdr")))
      .catch(() => setRtl([]));
  }, []);

  const change = async () => {
    const old = rtl?.[0]?.serial ?? "";
    if (serial.length < 2) return setResult({ tone: "danger", text: "Serial number must be at least 2 characters long" });
    if (serial === old) return setResult({ tone: "danger", text: "New serial number must be different from the old serial number" });
    showBusy("Changing serial number – this takes about 30 seconds…");
    try {
      const response = await fetch(`/change_sdr_serial/${encodeURIComponent(old)}/${encodeURIComponent(serial)}`, { signal: AbortSignal.timeout(90000) });
      const text = await response.text();
      if (text.startsWith("[OK]")) {
        setResult({ tone: "success", text: `Serial number changed from ${old} to ${serial}. You need to disconnect and reconnect the SDR in order for the software to pick up the new serial number, then reload this page.` });
      } else if (text === `[ERROR] rtl_eeprom found serial number ${serial} but expected ${old}`) {
        setResult({ tone: "warning", text: `Serial number already changed to ${serial}. However, you need to disconnect and reconnect the SDR in order for the software to pick up the new serial number, then reload this page.` });
      } else {
        setResult({ tone: "danger", text: `Failed to change serial number from ${old} to ${serial}: ${text}` });
      }
    } catch (err) {
      setResult({ tone: "danger", text: `Failed to change serial number from ${old} to ${serial}: ${err}` });
    } finally {
      hideBusy();
    }
  };

  return (
    <>
      <PageHeader eyebrow="Setup" title="Change RTLSDR serial number" subtitle="Give each RTLSDR a distinct serial number so assignments can be tracked." />
      {result && (
        <Alert tone={result.tone} className="mb-6">
          {result.text}{" "}
          {result.tone !== "danger" && (
            <button type="button" className="cursor-pointer font-semibold underline" onClick={() => location.reload()}>
              Reload
            </button>
          )}
        </Alert>
      )}
      <Card>
        {rtl === null && (
          <CardBody className="flex items-center gap-2 text-sm text-neutral-500">
            <Spinner /> Looking for RTLSDRs…
          </CardBody>
        )}
        {rtl?.length === 0 && (
          <CardBody>
            <EmptyState icon={<Usb />} title="No RTLSDR devices connected">
              Please check that they are plugged in and reload this page.
            </EmptyState>
          </CardBody>
        )}
        {rtl?.length === 1 && (
          <>
            <CardHeader
              icon={<Tag />}
              title={
                <>
                  RTLSDR with serial <code className="code-chip">{rtl[0].serial}</code>
                </>
              }
              description="Enter a new serial number and click Change serial number. This can take about 30 seconds – you'll be told whether the change was successful."
            />
            <CardBody>
              <TextField
                label="New serial number"
                hint="Use up to 8 numbers and letters. Don't use single digit numbers as serials. Some practical examples: 1090, 978, rtlv3, nesdr, fablue, acars, ais"
                className="max-w-xs font-mono"
                minLength={2}
                maxLength={8}
                value={serial}
                onChange={(e) => setSerial(e.currentTarget.value)}
                onKeyDown={(e) => e.key === "Enter" && change()}
              />
            </CardBody>
            <CardFooter>
              <Button onClick={change}>Change serial number</Button>
            </CardFooter>
          </>
        )}
        {rtl && rtl.length > 1 && (
          <>
            <CardHeader icon={<Usb />} title="Multiple RTLSDRs connected" description="To change the serial number of an RTLSDR with this UI, first disconnect all other RTLSDR devices, then reload this page." />
            <CardBody>
              <ul className="space-y-2">
                {rtl.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-md bg-neutral-100 text-xs tabular-nums dark:bg-neutral-800">{i + 1}</span>
                    RTL SDR with serial number <code className="code-chip">{s.serial}</code>
                    {s.purpose && <span className="text-neutral-500">({s.purpose.startsWith("other") ? "other" : s.purpose})</span>}
                  </li>
                ))}
              </ul>
            </CardBody>
          </>
        )}
      </Card>
    </>
  );
}

export function SdrplayLicense() {
  const license = "https://sdr-e.com/docker-sdrplay-beast1090/blob/main/LICENSE-SDRplay";
  return (
    <>
      <PageHeader eyebrow="Setup" title="SDRplay required software license" />
      <Card className="max-w-3xl">
        <CardHeader icon={<FileText />} title="SDRPlay API V3" />
        <CardBody className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
          Support for SDRplay SDRs requires the use of the SDRPlay API V3. YOU MAY ONLY USE THIS FEATURE IN COMPLIANCE WITH THE{" "}
          <a href={license} target="_blank" rel="noopener">
            LICENSE FOR SDRPlay API V3
          </a>
          . In order to be able to use this SDR with this feeder image you must indicate that you have reviewed and accept{" "}
          <a href={license} target="_blank" rel="noopener">
            this license
          </a>
          .
        </CardBody>
        <PostForm>
          <CardFooter>
            <SubmitButton name="sdrplay_license_reject" variant="outline">
              I do NOT accept the license
            </SubmitButton>
            <SubmitButton name="sdrplay_license_accept">I have reviewed and ACCEPT the license</SubmitButton>
          </CardFooter>
        </PostForm>
      </Card>
    </>
  );
}
