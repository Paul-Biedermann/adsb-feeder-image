import { Advanced } from "./Advanced";
import { Aggregators } from "./Aggregators";
import { Expert } from "./Expert";
import { Home } from "./Home";
import { NotFound } from "./NotFound";
import { ChangeSdrSerial, SdrplayLicense } from "./SdrMisc";
import { SdrSetup } from "./SdrSetup";
import { Setup } from "./Setup";
import { Stage2 } from "./Stage2";
import { Backup, Info, Restore, RestoreExecute, Support } from "./SupportPages";
import { SystemMgmt } from "./SystemMgmt";
import { Restarting, Shutdown, Waiting } from "./Transitions";
import { Visualization } from "./Visualization";

// page name (as set by the Jinja template's `page` block) -> component.
// `bare` pages render full screen without navbar / footer.
export const pages = {
  index: { component: Home },
  setup: { component: Setup },
  stage2: { component: Stage2 },
  aggregators: { component: Aggregators },
  sdr_setup: { component: SdrSetup },
  change_sdr_serial: { component: ChangeSdrSerial },
  sdrplay_license: { component: SdrplayLicense },
  advanced: { component: Advanced },
  expert: { component: Expert },
  systemmgmt: { component: SystemMgmt },
  visualization: { component: Visualization },
  info: { component: Info },
  support: { component: Support },
  backup: { component: Backup },
  restore: { component: Restore },
  restoreexecute: { component: RestoreExecute },
  restarting: { component: Restarting, bare: true },
  waiting: { component: Waiting, bare: true },
  shutdown: { component: Shutdown, bare: true },
  notfound: { component: NotFound },
};
