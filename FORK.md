# This fork

`Paul-Biedermann/adsb-feeder-image` is [dirkhh/adsb-feeder-image](https://github.com/dirkhh/adsb-feeder-image)
(adsb.im, "upstream") with a modern web UI. Everything else is upstream's, merged in automatically.

## What differs from upstream

- **Web UI**: Preact + Tailwind in [`webui/`](webui/README.md), built into
  `adsb-setup/static/spa/` (the build output is committed). The Jinja templates in
  `adsb-setup/templates/` are shells that extend `spa.html` and only serialize their context to
  JSON; `base.html` is gone, the old jQuery / MDB files in `static/js` and `static/css` are unused.
- **Updates come from this fork**: `feeder-update`, the recovery app (`recovery-app.py`) and
  `src/tools/app-install.sh` clone / fetch `Paul-Biedermann/adsb-feeder-image` (an existing
  checkout that still points at upstream is switched over on the next update).
- **Image build** (`build-images.yml`): can be started by hand / by the sync
  (`workflow_dispatch`), has write permission for the `latest` tag and the releases, uses
  `GITHUB_TOKEN` when there is no `PAT_GITHUB_TOKEN`, and refuses to build without the
  credential secrets (below).
- **Upstream sync**: `.github/workflows/upstream-sync.yml` + `.github/fork-sync/sync.py`.

Deliberately still upstream's:

- **adsb.im's API** (`https://adsb.im/api/status`): the "Latest: stable … · beta …" line, the
  update notice and the changelogs on the home page, plus my.adsb.im names and the check-in. The
  fork uses upstream's version names, so this information is right as long as the fork has each
  upstream release shortly after it is published - which is what the sync is for. There is no
  replacement API for the fork.
- Base images and build tooling (`dirkhh/DietPi`, `dirkhh/CustomPiOS`, `test.adsb.im`,
  raspberrypi.com), the DHT sensor binary (`dirkhh/DHT-read`).
- README links (releases, install script, docs) and the maintainer tools in `src/tools`
  (`get-changelog.sh`, `safe-get-version.sh`, `update-secrets.sh`, boot testing, github
  reporter / webhook) - they belong to adsb.im's own infrastructure.

## Branches, channels and tags

| fork branch | follows upstream | update channel |
|---|---|---|
| `beta` | `beta`, merged step by step - UI ports happen here | "Update (beta)" |
| `main` | `main` - moves to the `beta` commit that matches upstream `main` | (`stable` is used) |
| `stable` | `stable` - same as `main` | "Update (stable)" |
| `oldstable` | `oldstable` - upstream's (v3.0.0) predates the fork's UI, so until upstream moves it past v3.0.14 this is the fork's first release, v3.0.14 | `oldstable` (URL only) |

`feeder-update` turns a channel into the newest `v*` tag merged into `origin/<channel>` and checks
that tag out. The fork therefore has **the same tag names as upstream** (`v3.0.14`,
`v3.0.15-beta.3`, …), each an annotated tag on the fork commit that corresponds exactly to
upstream's tagged commit: the merge of that upstream commit, or the UI port committed right after
it. The tagger date is copied from upstream so that `git describe` picks the same name as upstream
when two tags share a commit (`v3.0.14` / `v3.0.14-beta.8`). Releases older than v3.0.14 have no
fork counterpart and are not tagged here. Published tags are never moved; `latest` is moved by
`build-images.yml`, as upstream does.

## How the sync works

Every 30 minutes (and via *Actions → upstream sync → Run workflow*, optionally as a dry run):

1. Fetch upstream (its tags go to `refs/upstream-tags/*` - they have the same names as the fork's).
2. Merge commits made directly on the fork's `main` into `beta` (rebuilding `static/spa` if needed).
3. Merge upstream `beta` into `beta`, one merge commit per new upstream tag (and per commit
   upstream `main` / `stable` point at), then the tip. A step is kept only if it merged cleanly
   (the fork's template shells win over upstream's templates automatically), upstream did not
   change `templates/` or `static/`, and `python3 -m py_compile` passes for `adsb-setup`.
   Otherwise `beta` stays at the last good step.
4. Fast-forward `main`, `stable` and `oldstable` to the `beta` commit matching their upstream
   branch (upstream commits that only went to `main` / `stable` are merged there directly).
5. Create the new upstream tags on their fork commits.
6. Push (never forced), then start `build-images.yml` for each new tag.
7. Open / update the issue labeled `upstream-sync` for everything it could not do; close it again
   once a run goes through cleanly.

### Secrets

| secret | needed for |
|---|---|
| `USER_PASSWORD`, `ROOT_PASSWORD`, `SSH_KEY` | **required** for image builds: the passwords baked into the images and the public SSH key added to them. `src/tools/update-secrets.sh` shows how upstream generates and sets them (it hardcodes `-r dirkhh/adsb-feeder-image` - use `-R Paul-Biedermann/adsb-feeder-image`). Without them the sync starts no builds and `build-images.yml` stops at its first step. |
| `SYNC_TOKEN` (optional, recommended) | fine-grained PAT for this repository with *Contents* and *Workflows* read/write. With it the sync can push upstream changes to `.github/workflows/` (`GITHUB_TOKEN` may not - such pushes end up in the issue instead), and its tag pushes start the image builds by themselves. |

## When the sync opens an issue

The issue lists the stuck step, the upstream commits and files and a compare link. In a clean
checkout (`git remote add upstream https://github.com/dirkhh/adsb-feeder-image.git` once; the
script keeps upstream's tags apart by itself):

```sh
python3 .github/fork-sync/sync.py --stop-at-port
```

It merges into local `fork-sync/<branch>` work branches and stops right after a merge that needs a
UI port, with that merge committed (template shells kept). Then:

- **port**: look at what upstream changed (`git show <commit> -- <template>`, or the compare
  link) and implement the *feature* in `webui/src`: new form fields with the same names / button
  values, new texts, new pages / routes, new context keys (add them to the template shell's
  `{% block data %}` JSON). Keep the template a shell. Rebuild (`cd webui && npm ci && npm run build`),
  check with `python webui/dev/mock_server.py`, commit source and `static/spa` together.
- **conflict**: the script aborted that merge. `git checkout fork-sync/<branch>`,
  `git merge <upstream commit>`, resolve, commit (port the UI part as above).
- **python**: upstream's code does not compile - usually fixed upstream soon; the next run picks it up.
- **push** of workflow files: push from your machine (below) or set `SYNC_TOKEN`.
- **tag**: an upstream release was merged together with later commits; tag the right commit by
  hand (next section).

Rerun `--stop-at-port` until it goes through, then publish with
`python3 .github/fork-sync/sync.py --push` (pushes the `fork-sync/*` results and the new tags;
start the image builds as below). The next scheduled run closes the issue.

## Cutting a fork release by hand

Fork releases use upstream's version names, so a release is "upstream release X with this fork's
UI". If the sync could not tag one (or you are re-doing one):

```sh
git tag -a v3.0.16 -m "v3.0.16" <fork commit>   # annotated! git describe ignores lightweight tags
git push origin refs/tags/v3.0.16                # never `git push --tags`, never move a pushed tag
gh workflow run build-images.yml -R Paul-Biedermann/adsb-feeder-image --ref v3.0.16
```

The branch the tag is on must be pushed too (`beta` for betas, `stable` for releases), otherwise
`feeder-update` does not see it. Fork-only changes (UI fixes) go out with the next upstream
release; for test images without a release push a `build-<name>` branch (images end up in the
`latest` pre-release). Don't invent version names of your own - they would collide with
upstream's next tags and adsb.im's "Latest" line would not know them.
