import { Eraser, Map as MapIcon, Mountain, Route } from "lucide-react";
import { useState } from "react";
import { SettingsForm, UnsavedChangesBar } from "../components/form";
import { Card, CardBody, PageHeader, SubmitButton, Switch, TextField } from "../components/ui";

export interface VisualizationData {
  m: string;
  site: string;
  stage2: boolean;
  routeApi: boolean;
  heywhatsthat: boolean;
  heywhatsthatId: string;
}

export function Visualization({ data }: { data: VisualizationData }) {
  return (
    <>
      <PageHeader eyebrow="Maps" title={`Map options${data.stage2 ? ` (${data.site})` : ""}`} subtitle="Configure what the tar1090 map shows." />
      <SettingsForm postAll>
        <VisualizationSettings data={data} />
      </SettingsForm>
    </>
  );
}

// state lives below SettingsForm so "Discard" resets it
function VisualizationSettings({ data }: { data: VisualizationData }) {
  const go = String(data.m) === "0" ? "go" : `go-${data.m}`;
  const [hwt, setHwt] = useState(data.heywhatsthat);
  return (
    <div className="max-w-3xl">
      <Card>
        <CardBody className="space-y-6">
          <Switch
            name="route_api--is_enabled"
            defaultChecked={data.routeApi}
            label={
              <span className="inline-flex items-center gap-2">
                <Route className="size-4 text-neutral-400" /> Show flight routes
              </span>
            }
            description="Use the Route API to show flight routes when known."
          />
          <div className="space-y-3">
            <Switch
              name="heywhatsthat--is_enabled"
              checked={hwt}
              onChange={setHwt}
              label={
                <span className="inline-flex items-center gap-2">
                  <Mountain className="size-4 text-neutral-400" /> Show theoretical range (HeyWhat'sThat)
                </span>
              }
              description={
                <>
                  <a href="https://www.heywhatsthat.com/">HeyWhat'sThat</a> is an incredibly cool web service that allows you to discover what you should be able to see from the location of your antenna –
                  including estimates for how far away you should be able to detect planes (depending on their altitude, and assuming there are no other obstructions).
                </>
              }
            />
            <div className="pl-14">
              {hwt && !data.heywhatsthatId && (
                <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
                  Click on the link, select "New Panorama" at the top, enter your address (or find the location on the map), enter a title on the lower left and click "Submit request". After a couple of
                  minutes you'll be offered to look at your panorama. At the top left you'll see the title you just entered, the latitude, longitude and elevation – and below that a link that ends with{" "}
                  <code className="code-chip">/?view=CODE</code>. Enter this code here to see the theoretical range information on your receiver map.
                </p>
              )}
              <TextField name="heywhatsthat_id" className="max-w-xs font-mono" placeholder="HeyWhat'sThat Panorama ID" defaultValue={data.heywhatsthatId} />
            </div>
          </div>
          <Switch
            name="clear_range"
            label={
              <span className="inline-flex items-center gap-2">
                <Eraser className="size-4 text-neutral-400" /> Clear range outline
              </span>
            }
            description="The tar1090 map maintains an outline for the area around your feeder where planes have been observed; sometimes it may be desirable to reset that (for example after you changed location). Enable this and apply to clear that range outline."
          />
        </CardBody>
      </Card>
      <UnsavedChangesBar
        name="visualization"
        value="go"
        className="mt-6"
        extra={
          <SubmitButton name="showmap" value={go} variant="outline" size="sm" icon={<MapIcon className="size-4" />}>
            Apply &amp; open map
          </SubmitButton>
        }
      />
    </div>
  );
}

