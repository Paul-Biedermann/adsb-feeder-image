# Rules for agent sessions in this repository

This is Paul Biedermann's fork of dirkhh/adsb-feeder-image (adsb.im) with a modern web UI.
Read [FORK.md](FORK.md) first (branch / tag model, sync, secrets) and
[webui/README.md](webui/README.md) for the UI.

## Upstream

- Always **merge** upstream - never rebase onto it, never cherry-pick it in, never replace fork
  files with upstream's wholesale. Use `python3 .github/fork-sync/sync.py` (`--stop-at-port`
  locally, `--push` to publish); it merges one upstream release at a time and tags correctly.
- Never force-push `main`, `beta`, `stable` or `oldstable`, never rewrite published history.
- Tags: same names as upstream, annotated, only ever created - never moved or deleted once
  pushed (`latest` is moved by build-images.yml only). Never `git push --tags`: upstream's tags
  live in `refs/upstream-tags/*` and must not end up in the fork.
- `gh` commands always with `-R Paul-Biedermann/adsb-feeder-image` - the local clone has
  `upstream` set as gh's default repository, without `-R` issues / runs would go to dirkhh's repo.
- `feeder-update`, `recovery-app.py` and `src/tools/app-install.sh` must keep pointing at this
  fork. Base images, CustomPiOS / DietPi tooling and adsb.im's API stay upstream's.

## Keep the modern dashboard

- The UI lives in `webui/src` (Preact + Tailwind). Templates in `adsb-setup/templates/` stay JSON
  shells extending `spa.html` (`login`, `hotspot*`, `recovery*` extend `standalone_base.html`);
  `base.html` stays deleted; never bring back upstream's Jinja / jQuery markup.
- When upstream changes a template or `static/` JS / CSS, port the **feature** into `webui/src`:
  new form fields (same `name` / button `value` as upstream, so `app.py` handles them unchanged),
  texts, buttons, pages / routes, new context keys (add them to the shell's `{% block data %}`
  JSON). Backend (Python) changes merge normally.
- After every change under `webui/`: `cd webui && npm ci && npm run build` and commit the
  rebuilt `static/spa/` together with the source.
- Verify with `python webui/dev/mock_server.py` (port 5173) and real requests (curl the page,
  check the new field / text is in the page data, POST the form and check `/_last_post`). Add
  new fields to the mock server's fake data too.

## Checks

- Python: `uv sync --group dev && uv run pytest` (test.yml lists the known failures, see
  tests/TEST_STATUS.md); `uv run black --check --line-length=130` on changed adsb-setup files.
- Never run the image build locally - images are built by `build-images.yml` on GitHub.
- This host runs production services with little free memory: no parallel heavy jobs.
- Commit as Paul Biedermann <paul.biedermann2104@gmail.com>.
