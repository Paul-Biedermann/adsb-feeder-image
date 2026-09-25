# ADS-B Feeder web UI (Preact + Tailwind)

Source of the web interface served by `adsb-setup` (Flask). The build output is committed to
`src/modules/adsb-feeder/filesystem/root/opt/adsb/adsb-setup/static/spa/`, so building the image
does not need Node.

## How it fits together

- The components are written against the React API (hooks, `react` imports) but bundled with
  [Preact](https://preactjs.com) through `preact/compat` (aliased in `vite.config.ts` and
  `tsconfig.json`). That keeps the bundle around 250 kB instead of 450 kB, which matters on the
  slow boards and phones this UI runs on. Preact passes native DOM events, so read values from
  `e.currentTarget` in handlers.
- The UI must not cost more than the old jQuery / MDB one: no endless CSS animations on regular
  pages, no `backdrop-blur` on sticky or large elements (it re-blurs on every scroll frame), and
  polling intervals match the old UI's tasks (paused while the tab is hidden, see `usePolling`).
- The Flask routes in `app.py` are unchanged. Each Jinja template (`adsb-setup/templates/*.html`)
  extends `spa.html` and serializes its context into JSON (`{% block data %}`) plus the name of
  the React page to render (`{% block page %}`).
- Forms are plain HTML forms posting the same field names / button values as before, so
  `update()` handles them exactly as it always did. Checkboxes post `1` / `0` through hidden
  inputs (replacing the old jQuery "checkbox hack").
- `login.html`, `hotspot*.html` and `recovery*.html` are server-rendered (no JS bundle needed) and
  only use the Tailwind stylesheet — the captive portal and recovery app must work even when
  JavaScript can't load.
- The build emits exactly `adsbim-ui.js`, `adsbim-ui.css` and a font with fixed names and no
  code-split chunks, because `scripts/cachebust.sh` renames static files and rewrites the
  references in templates by basename. Asset URLs used from JS (logos etc.) are passed in from
  `spa.html` for the same reason.

## Development

```sh
npm install
npm run build -- --watch                 # rebuilds static/spa on change
pip install flask
python dev/mock_server.py                # http://127.0.0.1:5173
```

The mock server renders the real templates with fake data and flashes every submitted form
field back, so you can check what the backend would receive. Switch scenarios with
`/_scenario/integrated|stage2|micro|nonadsb|fresh`; `/_hotspot`, `/_recovery` and
`/_recovery-login` preview the helper apps; `/_last_post` shows the last POST as JSON.

`npm run build` type-checks and builds; commit the updated `static/spa` files together with
source changes.
