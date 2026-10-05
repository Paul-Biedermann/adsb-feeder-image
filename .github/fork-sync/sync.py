#!/usr/bin/env python3
"""Merge dirkhh/adsb-feeder-image ("upstream") into this fork - see FORK.md.

Run by .github/workflows/upstream-sync.yml every 30 minutes, and by hand when it got stuck.

The fork's channel branches (beta, main, stable, oldstable) follow upstream's branches of the
same name. New upstream commits are merged step by step: every new upstream v* tag (and every
commit upstream main / stable point at) gets its own merge commit, then the branch tip. So each
upstream release has an exact counterpart in the fork, and that counterpart gets the same tag
name - feeder-update and the "Latest: stable ... / beta ..." line (from adsb.im) then agree.

beta leads: main, stable and oldstable move to the fork commit on beta that corresponds to the
upstream commit their upstream branch points at (normally a fast-forward), so UI ports done on
beta are not needed twice. Commits made directly on the fork's main are merged into beta first.

A merge step is only kept if
- it merged without conflicts (the fork's template shells win over upstream's templates),
- upstream did not change the old Jinja / jQuery UI (templates/, static/): the fork's UI lives
  in webui/, those changes have to be ported by hand,
- the Python code still compiles.
Otherwise the branch stays at the last good step, nothing past it is pushed, and the problem is
reported in a GitHub issue (--issue).

Local use (with a clean working tree):
  python3 .github/fork-sync/sync.py                 # dry run: merge into fork-sync/* branches
  python3 .github/fork-sync/sync.py --stop-at-port  # keep a UI-touching merge, port, commit, rerun
  python3 .github/fork-sync/sync.py --push          # push the fork-sync/* results and new tags
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

FORK_REPO = os.environ.get("GITHUB_REPOSITORY", "Paul-Biedermann/adsb-feeder-image")
UPSTREAM_REPO = "dirkhh/adsb-feeder-image"
UPSTREAM_URL = f"https://github.com/{UPSTREAM_REPO}.git"
ADSB_SETUP = "src/modules/adsb-feeder/filesystem/root/opt/adsb/adsb-setup"
TEMPLATES = f"{ADSB_SETUP}/templates/"
STATIC = f"{ADSB_SETUP}/static/"
SPA = f"{ADSB_SETUP}/static/spa/"
WEBUI = "webui/"
WORKFLOWS = ".github/workflows/"
# the upstream commit (v3.0.14) the fork's web UI was built on: older upstream releases have no
# counterpart in the fork and are not tagged here
FORK_BASE = "620aadc6d35bdbfaca3c4e00e067a6b1a5e856c7"
CHANNELS = ["beta", "main", "stable", "oldstable"]
WORK = "fork-sync/"
ISSUE_LABEL = "upstream-sync"
ISSUE_TITLE = "Upstream sync needs manual work"
VERSION_TAG = re.compile(r"^v[0-9]")


def run(cmd: list[str], check: bool = True, cwd: str | None = None, env: dict | None = None) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, cwd=cwd, env=env, text=True, capture_output=True)
    if check and r.returncode != 0:
        sys.exit(f"command failed: {' '.join(cmd)}\n{r.stdout}{r.stderr}")
    return r


def git(*args: str, check: bool = True) -> str:
    return run(["git", *args], check=check).stdout.strip()


def commit_of(ref: str) -> str | None:
    return run(["git", "rev-parse", "--verify", "-q", f"{ref}^{{commit}}"], check=False).stdout.strip() or None


def is_ancestor(a: str, b: str) -> bool:
    return run(["git", "merge-base", "--is-ancestor", a, b], check=False).returncode == 0


def lines(text: str) -> list[str]:
    return [line for line in text.splitlines() if line]


def short(c: str | None) -> str:
    return c[:8] if c else "-"


def tail(text: str, n: int = 30) -> list[str]:
    return text.strip().splitlines()[-n:]


@dataclass
class Problem:
    branch: str
    kind: str  # port | conflict | python | build | push | tag
    step: str
    files: list[str] = field(default_factory=list)
    commits: list[str] = field(default_factory=list)
    output: list[str] = field(default_factory=list)
    compare: str = ""

    def signature(self) -> str:
        return f"{self.branch}|{self.kind}|{self.step}|{','.join(self.files)}"


@dataclass
class Branch:
    name: str
    origin: str | None  # head on the fork
    head: str | None  # local result
    steps: list[str] = field(default_factory=list)
    before: str | None = None

    def __post_init__(self) -> None:
        self.before = self.origin


class Sync:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.problems: list[Problem] = []
        self.notes: list[str] = []
        self.stopped = False
        self.branches: dict[str, Branch] = {}
        self.upstream: dict[str, str | None] = {}
        self.upstream_commits: set[str] = set()
        self.utags: list[tuple[str, str, str]] = []  # (name, commit, date) newer than FORK_BASE
        self.new_tags: dict[str, str] = {}
        self.pushed_tags: list[str] = []
        self.dispatched: list[str] = []

    # ---- setup

    def fetch(self) -> None:
        if "upstream" not in git("remote").split():
            git("remote", "add", "upstream", UPSTREAM_URL)
        git("config", "remote.upstream.tagOpt", "--no-tags")
        # upstream's tags have the same names as the fork's (on different commits): keep them apart
        git(
            "fetch", "-q", "--prune", "--no-tags", "upstream",
            "+refs/heads/*:refs/remotes/upstream/*", "+refs/tags/*:refs/upstream-tags/*",
        )  # fmt: skip
        git("fetch", "-q", "--prune", "--no-tags", "origin", "+refs/heads/*:refs/remotes/origin/*")
        # never forced: a published fork tag is never moved ('latest' is left out on purpose)
        git("fetch", "-q", "--no-tags", "origin", "refs/tags/v*:refs/tags/v*")

    def load(self) -> None:
        for ch in CHANNELS:
            self.upstream[ch] = commit_of(f"refs/remotes/upstream/{ch}")
        refs = [f"refs/remotes/upstream/{ch}" for ch in CHANNELS if self.upstream[ch]]
        self.upstream_commits = set(lines(git("rev-list", *refs, "--glob=refs/upstream-tags/*")))
        fmt = "%(refname:lstrip=2)%09%(*objectname)%09%(objectname)%09%(creatordate:iso-strict)"
        for line in lines(git("for-each-ref", f"--format={fmt}", "refs/upstream-tags/")):
            name, peeled, obj, date = line.split("\t")
            commit = peeled or obj
            if not VERSION_TAG.match(name) or (commit != FORK_BASE and is_ancestor(commit, FORK_BASE)):
                continue
            if any(self.upstream[ch] and is_ancestor(commit, self.upstream[ch]) for ch in CHANNELS):
                self.utags.append((name, commit, date))
        self.utags.sort(key=lambda t: t[2])
        for ch in CHANNELS:
            origin = commit_of(f"refs/remotes/origin/{ch}")
            local = commit_of(f"refs/heads/{WORK}{ch}")
            head = origin
            if local and (origin is None or is_ancestor(origin, local)):
                head = local  # continue a local run (e.g. with a UI port committed on the work branch)
            self.branches[ch] = Branch(ch, origin, head)

    # ---- helpers

    def checkout(self, b: Branch, start: str | None = None) -> None:
        git("checkout", "-q", "-B", f"{WORK}{b.name}", start or b.head or "")

    def problem(self, p: Problem) -> None:
        self.problems.append(p)
        print(f"!! {p.branch}: {p.kind} at {p.step}", file=sys.stderr)

    def counterpart(self, head: str | None, target: str) -> str | None:
        """newest first-parent commit of `head` whose upstream content is exactly `target`"""
        if not head or not is_ancestor(target, head):
            return None
        for c in lines(git("rev-list", "--first-parent", "-n", "1000", head)):
            if not is_ancestor(target, c):
                return None
            if not any(x in self.upstream_commits for x in lines(git("rev-list", c, f"^{target}"))):
                return c
        return None

    def take_ours(self, pre: str, path: str) -> None:
        if run(["git", "cat-file", "-e", f"{pre}:{path}"], check=False).returncode == 0:
            git("checkout", pre, "--", path)
        else:
            git("rm", "-q", "-f", "--ignore-unmatch", "--", path)

    def python_check(self) -> list[str]:
        files = sorted(str(p) for p in Path(ADSB_SETUP).rglob("*.py"))
        r = run([sys.executable, "-m", "py_compile", *files], check=False)
        return tail(r.stdout + r.stderr) if r.returncode else []

    def rebuild_spa(self) -> list[str]:
        if not shutil.which("npm"):
            return ["npm not found - run `cd webui && npm ci && npm run build` and commit static/spa"]
        for cmd in (["npm", "ci", "--no-audit", "--no-fund"], ["npm", "run", "build"]):
            r = run(cmd, check=False, cwd="webui")
            if r.returncode:
                return tail(r.stdout + r.stderr)
        git("add", "-A", "--", SPA)
        if run(["git", "diff", "--cached", "--quiet"], check=False).returncode:
            git("commit", "-q", "--amend", "--no-edit")
        return []

    # ---- merging

    def merge(self, b: Branch, target: str, label: str, upstream: bool) -> bool:
        """merge `target` into fork branch `b` as one step; True if the step was kept"""
        self.checkout(b)
        pre = b.head or ""
        base = git("merge-base", pre, target)
        theirs = lines(git("diff", "--name-only", base, target))
        commits = lines(git("log", "--no-merges", "--format=%h %s", f"{pre}..{target}"))
        title = f"Merge upstream {label} into {b.name}" if upstream else f"Merge {label} into {b.name}"
        body = "\n".join(commits[:60] + (["..."] if len(commits) > 60 else [])) or "(merge commits only)"
        compare = f"https://github.com/{UPSTREAM_REPO}/compare/{base}...{target}" if upstream else ""
        r = run(["git", "merge", "--no-ff", "--no-edit", "-m", title, "-m", body, target], check=False)
        conflicts = lines(git("diff", "--name-only", "--diff-filter=U"))
        if r.returncode and not conflicts:
            run(["git", "merge", "--abort"], check=False)
            self.problem(Problem(b.name, "conflict", label, [], commits, tail(r.stdout + r.stderr), compare))
            return False
        unresolved = []
        for path in conflicts:
            # upstream merges: the fork's template shells win (base.html stays deleted);
            # fork-internal merges: the bundle is rebuilt below anyway
            if (upstream and path.startswith(TEMPLATES)) or (not upstream and path.startswith(SPA)):
                self.take_ours(pre, path)
            else:
                unresolved.append(path)
        if unresolved:
            run(["git", "merge", "--abort"], check=False)
            self.problem(Problem(b.name, "conflict", label, unresolved, commits, [], compare))
            return False
        if upstream:
            # also where git merged an upstream template change into a shell without conflict
            for path in theirs:
                if path.startswith(TEMPLATES) and path not in conflicts:
                    if run(["git", "cat-file", "-e", f"{pre}:{path}"], check=False).returncode == 0:
                        git("checkout", pre, "--", path)
        if conflicts:
            git("commit", "-q", "--no-edit", "--cleanup=strip")
        elif run(["git", "diff", "--cached", "--quiet"], check=False).returncode:
            git("commit", "-q", "--amend", "--no-edit")
        if not upstream and any(p.startswith((WEBUI, SPA)) for p in lines(git("diff", "--name-only", pre, "HEAD"))):
            out = self.rebuild_spa()
            if out:
                git("reset", "-q", "--hard", pre)
                self.problem(Problem(b.name, "build", label, [], commits, out))
                return False
        out = self.python_check()
        if out:
            git("reset", "-q", "--hard", pre)
            self.problem(Problem(b.name, "python", label, [], commits, out, compare))
            return False
        ui = [p for p in theirs if p.startswith((TEMPLATES, STATIC)) and not p.startswith(SPA)] if upstream else []
        if ui:
            self.problem(Problem(b.name, "port", label, ui, commits, [], compare))
            if self.args.stop_at_port:
                b.head = git("rev-parse", "HEAD")
                b.steps.append(f"{label} (merged, UI port pending)")
                self.stopped = True
            else:
                git("reset", "-q", "--hard", pre)
            return False
        b.head = git("rev-parse", "HEAD")
        b.steps.append(label)
        return True

    def waypoints(self, head: str, target: str, name: str) -> list[tuple[str, str]]:
        """the merge steps that bring upstream `target` into a fork branch at `head`"""
        if is_ancestor(target, head):
            return []
        order = lines(git("rev-list", "--topo-order", "--reverse", target, f"^{head}"))
        new = set(order)
        labels: dict[str, list[str]] = {}
        for tag, commit, _ in self.utags:
            if commit in new:
                labels.setdefault(commit, []).append(f"tag {tag}")
        for ch in CHANNELS:
            u = self.upstream[ch]
            if u and u in new and u != target:
                labels.setdefault(u, []).append(f"{ch} ({short(u)})")
        labels.setdefault(target, []).append(f"{name} ({short(target)})")
        return [(c, ", ".join(labels[c])) for c in order if c in labels]

    def merge_upstream(self, b: Branch, target: str) -> None:
        for commit, label in self.waypoints(b.head or "", target, b.name):
            if not self.merge(b, commit, label, upstream=True):
                return

    def sync_beta(self) -> None:
        b, main = self.branches["beta"], self.branches["main"]
        target = self.upstream["beta"]
        if b.head is None:
            if not main.head:
                sys.exit("the fork has neither beta nor main")
            self.checkout(b, main.head)
            b.head = main.head
            b.steps.append(f"created from main ({short(main.head)})")
        if main.head and not is_ancestor(main.head, b.head):
            # fork changes committed directly on main
            if not self.merge(b, main.head, "branch 'main'", upstream=False):
                return
        if target:
            self.merge_upstream(b, target)

    def follow(self, name: str, sources: list[str]) -> None:
        """move a fork branch to the fork counterpart of the commit its upstream branch is at"""
        b, target = self.branches[name], self.upstream[name]
        if not target or (b.head and is_ancestor(target, b.head)):
            return
        if b.head is None and target != FORK_BASE and is_ancestor(target, FORK_BASE):
            # e.g. oldstable: upstream's predates the fork, use the fork's first release
            target = FORK_BASE
            self.notes.append(f"{name}: upstream {name} predates the fork, using the fork's first release")
        for source in sources:
            c = self.counterpart(self.branches[source].head, target)
            if c:
                if b.head is None or is_ancestor(b.head, c):
                    self.checkout(b, c)
                    b.steps.append(f"fast-forward to {source} {short(c)} (upstream {short(target)})")
                    b.head = c
                else:
                    self.merge(b, c, f"{source} ({short(c)}, upstream {short(target)})", upstream=False)
                return
        if b.head is None:
            self.notes.append(f"{name}: no fork commit for upstream {short(target)} yet, branch not created")
        elif self.upstream["beta"] and is_ancestor(target, self.upstream["beta"]):
            self.notes.append(f"{name}: waits until beta has merged upstream {short(target)}")
        else:
            # upstream committed to this branch directly, not through beta
            self.merge_upstream(b, target)

    def make_tags(self) -> None:
        published = {ref.rsplit("/", 1)[-1] for ref in lines(git("ls-remote", "--tags", "--refs", "origin", "refs/tags/v*"))}
        for name, commit, date in self.utags:
            if name in published:
                continue
            if commit_of(f"refs/tags/{name}"):
                git("tag", "-d", name)  # left by an earlier local run that did not push, recreate it
            fc = None
            for ch in CHANNELS:
                fc = self.counterpart(self.branches[ch].head, commit)
                if fc:
                    break
            if fc:
                message = (
                    f"{name}\n\nupstream {UPSTREAM_REPO} {name} ({short(commit)}) with this fork's web UI"
                    f" - created by .github/fork-sync/sync.py"
                )
                # upstream's tag date keeps `git describe` picking the same name as upstream
                # when two tags share a commit (v3.0.14 / v3.0.14-beta.8)
                run(["git", "tag", "-a", name, "-m", message, fc], env=dict(os.environ, GIT_COMMITTER_DATE=date))
                self.new_tags[name] = fc
            elif any(b.head and is_ancestor(commit, b.head) for b in self.branches.values()):
                self.problem(
                    Problem(
                        "tags", "tag", f"tag {name}",
                        output=[
                            f"upstream {name} ({short(commit)}) was merged together with later upstream commits,"
                            " so no fork commit corresponds to it exactly - tag the right fork commit by hand"
                        ],
                    )  # fmt: skip
                )

    # ---- publishing

    def push(self) -> None:
        on_fork: list[str] = []
        for name in CHANNELS:
            b = self.branches[name]
            if not b.head:
                continue
            if b.head != b.origin:
                wf = lines(git("diff", "--name-only", b.origin, b.head, "--", WORKFLOWS)) if b.origin else []
                if wf and self.args.restricted_token:
                    self.problem(
                        Problem(
                            name, "push", f"push {short(b.origin)}..{short(b.head)}", wf,
                            output=["GITHUB_TOKEN may not push changes to workflow files: push this branch by hand"
                                    " or add a SYNC_TOKEN secret (see FORK.md)"],
                        )  # fmt: skip
                    )
                    continue
                r = run(["git", "push", "-q", "origin", f"{b.head}:refs/heads/{name}"], check=False)
                if r.returncode:
                    self.problem(Problem(name, "push", f"push {short(b.origin)}..{short(b.head)}", output=tail(r.stderr)))
                    continue
                b.origin = b.head
            on_fork.append(b.head)
        for tag, commit in self.new_tags.items():
            if not any(is_ancestor(commit, h) for h in on_fork):
                continue
            r = run(["git", "push", "-q", "origin", f"refs/tags/{tag}"], check=False)
            if r.returncode:
                self.problem(Problem("tags", "push", f"tag {tag}", output=tail(r.stderr)))
            else:
                self.pushed_tags.append(tag)

    def dispatch_builds(self) -> None:
        for tag in self.pushed_tags:
            r = run(["gh", "workflow", "run", "build-images.yml", "-R", FORK_REPO, "--ref", tag], check=False)
            if r.returncode:
                self.problem(Problem("tags", "build", f"image build for {tag}", output=tail(r.stderr)))
            else:
                self.dispatched.append(tag)

    # ---- reporting

    def run_url(self) -> str:
        if os.environ.get("GITHUB_RUN_ID"):
            server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
            return f"{server}/{FORK_REPO}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
        return ""

    def summary(self) -> str:
        out = ["## Upstream sync", ""]
        out.append("| branch | upstream | fork before | fork now | local result | steps |")
        out.append("|---|---|---|---|---|---|")
        for name in CHANNELS:
            b = self.branches.get(name)
            if b:
                steps = "<br>".join(b.steps) or "-"
                up = short(self.upstream.get(name))
                out.append(f"| {name} | {up} | {short(b.before)} | {short(b.origin)} | {short(b.head)} | {steps} |")
        out.append("")
        if self.new_tags:
            out.append("Tags: " + ", ".join(f"`{t}` → {short(c)}" for t, c in self.new_tags.items()))
        if self.pushed_tags:
            out.append("Pushed tags: " + ", ".join(self.pushed_tags))
        if self.dispatched:
            out.append("Image builds started: " + ", ".join(self.dispatched))
        out += [f"- {n}" for n in self.notes]
        if self.problems:
            out += ["", "### Problems", ""] + self.problem_text()
        return "\n".join(out) + "\n"

    def problem_text(self) -> list[str]:
        what = {
            "port": "upstream changed the old web UI - port it to webui/",
            "conflict": "merge conflict",
            "python": "Python check failed after the merge",
            "build": "the web UI build failed",
            "push": "push failed",
            "tag": "tag needs manual work",
        }
        out = []
        for p in self.problems:
            out.append(f"#### {p.branch}: {what[p.kind]} ({p.step})")
            if p.compare:
                out.append(f"Upstream changes: {p.compare}")
            if p.files:
                out.append("Files:")
                out += [f"- `{f}`" for f in p.files]
            if p.commits:
                out.append("Upstream commits:")
                out += [f"- {c}" for c in p.commits[:40]] + (["- ..."] if len(p.commits) > 40 else [])
            if p.output:
                out += ["```", *p.output, "```"]
            out.append("")
        return out

    def issue(self) -> None:
        r = run(
            ["gh", "issue", "list", "-R", FORK_REPO, "--label", ISSUE_LABEL, "--state", "open", "--json", "number,body"],
            check=False,
        )
        existing = json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else []
        if not self.problems:
            for issue in existing:
                run(["gh", "issue", "close", str(issue["number"]), "-R", FORK_REPO, "-c",
                     f"The upstream sync went through cleanly again. {self.run_url()}"], check=False)  # fmt: skip
            return
        sig = hashlib.sha256("\n".join(sorted(p.signature() for p in self.problems)).encode()).hexdigest()[:16]
        body = "\n".join(
            [
                "The upstream sync stopped at the steps below. Nothing past them was pushed: the fork's",
                "branches stay at the last good step and devices keep updating to the last fork release.",
                f"Last run: {self.run_url() or 'local'}",
                "",
                *self.problem_text(),
                "### What to do",
                "See FORK.md → *When the sync opens an issue*. In short, in a clean checkout:",
                "```sh",
                "python3 .github/fork-sync/sync.py --stop-at-port   # merges up to the problem, stops there",
                "# port the upstream UI change into webui/src, cd webui && npm run build, commit",
                "# (or resolve the conflict and commit the merge), then repeat until it runs through:",
                "python3 .github/fork-sync/sync.py --push",
                "```",
                "This issue is closed automatically once a sync run goes through cleanly.",
                f"<!-- sync-signature: {sig} -->",
            ]
        )
        path = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "upstream-sync-issue.md"
        path.write_text(body)
        if existing:
            number = str(existing[0]["number"])
            if f"sync-signature: {sig}" not in existing[0]["body"]:
                run(["gh", "issue", "edit", number, "-R", FORK_REPO, "--body-file", str(path)])
                run(["gh", "issue", "comment", number, "-R", FORK_REPO, "-b",
                     f"The sync is stuck at a new place, see the updated description. {self.run_url()}"])  # fmt: skip
        else:
            run(["gh", "label", "create", ISSUE_LABEL, "-R", FORK_REPO, "--force", "--color", "d93f0b",
                 "--description", "the upstream sync needs manual work"], check=False)  # fmt: skip
            run(["gh", "issue", "create", "-R", FORK_REPO, "--title", ISSUE_TITLE, "--label", ISSUE_LABEL,
                 "--body-file", str(path)])  # fmt: skip


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--push", action="store_true", help="push the merged branches and new tags to the fork")
    ap.add_argument("--issue", action="store_true", help="open / update / close the GitHub issue")
    ap.add_argument("--dispatch-builds", action="store_true", help="start build-images.yml for pushed tags")
    ap.add_argument("--restricted-token", action="store_true", help="pushing with GITHUB_TOKEN: no workflow file changes")
    ap.add_argument("--stop-at-port", action="store_true", help="keep a merge that needs a UI port and stop there")
    ap.add_argument("--summary", help="append a markdown summary to this file")
    args = ap.parse_args()

    os.chdir(git("rev-parse", "--show-toplevel"))
    if git("status", "--porcelain", "--untracked-files=no"):
        sys.exit("the working tree has uncommitted changes")
    if run(["git", "rev-parse", "-q", "--verify", "MERGE_HEAD"], check=False).returncode == 0:
        sys.exit("a merge is in progress")
    original = git("rev-parse", "--abbrev-ref", "HEAD")
    if original == "HEAD":
        original = git("rev-parse", "HEAD")

    s = Sync(args)
    s.fetch()
    s.load()
    try:
        s.sync_beta()
        for name, sources in (("main", ["beta"]), ("stable", ["beta", "main"]), ("oldstable", ["beta", "main", "stable"])):
            if not s.stopped:
                s.follow(name, sources)
        if not s.stopped:
            s.make_tags()
            if args.push:
                s.push()
                if args.dispatch_builds:
                    s.dispatch_builds()
    finally:
        if s.stopped:
            print(f"\nstopped on branch {git('rev-parse', '--abbrev-ref', 'HEAD')} - port the UI change, commit, rerun")
        else:
            git("checkout", "-q", original)

    text = s.summary()
    print(text)
    if args.summary:
        with open(args.summary, "a") as f:
            f.write(text)
    if args.issue:
        s.issue()
        return 0
    return 2 if s.problems else 0


if __name__ == "__main__":
    sys.exit(main())
