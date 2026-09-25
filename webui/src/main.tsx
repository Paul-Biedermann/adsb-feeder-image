import "./index.css";
import { render } from "preact";
import type { ComponentType } from "react";
import { Layout } from "./components/Layout";
import { getGlobal, getPage } from "./lib/data";
import { applyTheme } from "./lib/theme";
import { pages } from "./pages";

type PageDef = { component: ComponentType<{ data: never }>; bare?: boolean };

function App() {
  const { page, data } = getPage();
  const def = (pages as Record<string, PageDef>)[page] ?? pages.notfound;
  const Page = def.component as ComponentType<{ data: unknown }>;
  const content = <Page data={data} />;
  return def.bare ? content : <Layout>{content}</Layout>;
}

applyTheme(getGlobal().theme);
render(<App />, document.getElementById("root")!);
