"""
Development server for the web UI.

Renders the *real* Jinja templates from adsb-setup/templates with fake env data and serves
the built bundle from adsb-setup/static, so UI work can happen without a feeder. Every form
POST is echoed back as a flashed message (and printed), which makes it easy to check that the
field names / values match what app.py's update() expects.

    pip install flask
    npm run build            # in webui/, or `npm run build -- --watch`
    python dev/mock_server.py [--port 5173] [--scenario integrated|stage2|micro|nonadsb|fresh]

Switch scenarios at runtime with /_scenario/<name>.
"""

import argparse
import json
import random
import time
from pathlib import Path

from flask import Flask, Response, flash, has_request_context, redirect, render_template, request

ROOT = Path(__file__).resolve().parents[2]
SETUP = ROOT / "src/modules/adsb-feeder/filesystem/root/opt/adsb/adsb-setup"

app = Flask(__name__, template_folder=str(SETUP / "templates"), static_folder=str(SETUP / "static"))
app.secret_key = "mock"

SCENARIOS = ["integrated", "stage2", "micro", "nonadsb", "fresh"]
state = {"scenario": "integrated", "last_post": {}, "css_theme": "auto", "temp_sensor": "dht22"}


class NetConfig:
    def __init__(self, identifier, name, website, policy, ordinal):
        self.identifier, self.name, self.website, self.policy, self.ordinal = identifier, name, website, policy, ordinal


NETCONFIGS = {
    c.identifier: c
    for c in [
        NetConfig("adsblol", "adsb.lol", "https://adsb.lol", "https://adsb.lol/privacy-license/", 0),
        NetConfig("flyitaly", "Fly Italy ADSB", "https://flyitalyadsb.com", "https://flyitalyadsb.com/informativa-privacy-cookie/", 1),
        NetConfig("adsbx", "ADSBExchange", "https://www.adsbexchange.com", "https://www.adsbexchange.com/privacy-policy/", 2),
        NetConfig("tat", "TheAirTraffic", "https://globe.theairtraffic.com", "https://theairtraffic.com/privacy-policy/", 3),
        NetConfig("planespotters", "Planespotters", "https://radar.planespotters.net", "https://www.planespotters.net/legal/privacypolicy/", 4),
        NetConfig("adsbfi", "adsb.fi", "https://adsb.fi", "https://adsb.fi/privacy", 5),
        NetConfig("alive", "airplanes.live", "https://airplanes.live", "https://airplanes.live/privacy", 6),
        NetConfig("hpradar", "HPRadar", "https://skylink.hpradar.com/", "", 7),
    ]
}


def sites():
    s = state["scenario"]
    if s == "stage2":
        return ["pve-Cluster-Stage 2", "north-roof", "lake-house", "office-attic"]
    if s == "fresh":
        return [""]
    return ["my-awesome-antenna"]


def base_env():
    s = state["scenario"]
    n = len(sites())
    env = {
        "css_theme": state["css_theme"],
        "aggregator_choice": {"stage2": "stage2", "micro": "micro", "nonadsb": "nonadsb", "fresh": ""}.get(s, "individual"),
        "base_config": s != "fresh",
        "stage2": s == "stage2",
        "num_micro_sites": n - 1 if s == "stage2" else 0,
        "site_name": sites(),
        "lat": ["47.60621"] * n,
        "lon": ["-122.33207"] * n,
        "alt": ["85"] * n,
        "tz": ["America/Los_Angeles"] * n,
        "mf_ip": ["local", "192.168.1.21,30006,beast_in", "192.168.1.22,30006,beast_in", "10.0.0.5,30006,beast_in"][:n],
        "mf_version": ["", "v3.0.4(beta)", "v3.0.3(stable)", "v2.3.5"][:n],
        "mf_brofm": [False, True, False, True][:n],
        "tar1090_query_params": "",
        "acarshub": s in ["integrated", "nonadsb"],
        "shipfeeder": s in ["integrated", "nonadsb"],
        "run_shipfeeder": s in ["integrated", "nonadsb"],
        "run_sonde": False,
        "sonde": False,
        "skystats": s == "integrated",
        "skystats_db": s == "integrated",
        "temperature_block": s != "fresh",
        "freedom_units": False,
        "temp_sensor": state["temp_sensor"] if s != "fresh" else "",
        "base_version": "v3.0.4-beta.7(beta)",
        "board_name": "Raspberry Pi 5 Model B Rev 1.0",
        "image_name": "adsb-im-raspberrypi64-pi-2-3-4-5 v3.0.4",
        # point the local-address link at this mock server so its reachability probe succeeds
        "fqdn": request.host.rsplit(":", 1)[0] if has_request_context() else "",
        "webport": (request.host.rsplit(":", 1)[1] if ":" in request.host else 80) if has_request_context() else 80,
        "web_auth_enabled": False,
        "dns_state": True,
        "under_voltage": False,
        "healthcheck_fail_reason": "",
        "low_disk": False,
        "acars_aggregators_chosen": True,
        "ais_aggregators_chosen": True,
        "is_adsb_feeder": s != "nonadsb",
        "is_acars_feeder": s in ["integrated", "nonadsb"],
        "acarsdec": s in ["integrated", "nonadsb"],
        "acarsdec2": False,
        "dumpvdl2": s == "integrated",
        "acars_feed_id": "",
        "acars_2_feed_id": "",
        "vdl2_feed_id": "PB-KSEA-VDL2",
        "is_hfdl_feeder": False,
        "dumphfdl": False,
        "hfdlobserver": False,
        "hfdl_feed_id": "",
        "hfdlobserver_feed_id": "",
        "is_ais_feeder": s in ["integrated", "nonadsb"],
        "ais_station_name": "",
        "is_sonde_feeder": False,
        "initials": ["PB"] * n,
        "closest_airport": ["KSEA"] * n,
        "uat978": [True, True, False, False][:n],
        "mlat_enable": [True] * n,
        "mlat_privacy": [False] * n,
        "route_api": [True] * n,
        "heywhatsthat": [False] * n,
        "heywhatsthat_id": [""] * n,
        "mlat_name_override": [""] * n,
        "flightradar": [True, True, False, True][:n],
        "flightradar--key": ["abc123def456"] * n,
        "flightradar_uat--key": [""] * n,
        "flightaware": [True, False, True, False][:n],
        "flightaware--key": ["0f1e2d3c-aaaa-bbbb-cccc-1234567890ab"] * n,
        "planefinder": [False] * n,
        "sdrmap--user": [""] * n,
        "sdrmap--key": [""] * n,
        "feed_acars_airframes": [True] * n,
        "ais_feed_aiscatcher": [True] * n,
        "aiscatcher_feeder_key": ["f00d-cafe"] * n,
        "acars_frequencies": "130.025;130.450;131.125;131.550",
        "vdl2_frequencies": "136.650;136.975",
        "acarsserial": "acars",
        "vdl2serial": "",
        "aisserial": "ais",
        "acarshub_data_path": "/run/acars_data",
        "healthcheck_url": "",
        "healthcheck_noplane_hours_1090": "24",
        "healthcheck_noplane_hours_978": "24",
        "healthcheck_noacars_hours": "0",
        "reboot_on_missing_sdr": False,
        "roms_wait": 300,
        "roms_max": 3,
        "skystats_radius": "500",
        "skystats_db_user": "skystats-user",
        "skystats_db_password": "hunter2",
        "skystats_db_name": "skystats_db",
        "ultrafeeder_extra_args": "",
        "ultrafeeder_extra_args_microsites": "",
        "ultrafeeder_extra_env": "READSB_RTLSDR_PPM=22",
        "has_gpsd": False,
        "use_gpsd": False,
        "tar1090_image_config_link": "http://x",
        "tar1090port": 8080,
        "docker_concurrent": True,
        "docker_ipv6": False,
        "sdrplay_ignore_serial": False,
        "telegraf_adsb": False,
        "secure_image": False,
        "nightly_base_update": True,
        "nightly_feeder_update": True,
        "zerotierid": "",
        "tailscale_name": "",
        "tailscale_ll": "",
        "tailscale_extras": "",
        "netbird_management_url": "",
        "1090serial": "1090",
        "airspy": False,
        "remote_sdr": "",
        "adsblol": [True] * n,
        "adsbx": [True] * n,
        "alive": [s == "stage2"] * n,
    }
    for ident in NETCONFIGS:
        env.setdefault(ident, [ident in ["adsblol", "adsbfi", "adsbx", "tat"]] * n)
        env[f"{ident}--uuid"] = [f"8b0f9a1c-4f2e-4a7b-9c3d-{ident[:4].ljust(12, '0')}"] * n
    return env


def key_for(tags):
    if isinstance(tags, str):
        tags = [tags]
    tags = [t for t in tags if t not in ("ultrafeeder", "other_aggregator", "is_enabled")]
    return "--".join(tags)


def lookup(tags, idx=None):
    env = base_env()
    v = env.get(key_for(tags), "")
    if idx is not None:
        idx = int(idx)
        if isinstance(v, list):
            return v[idx] if idx < len(v) else (v[0] if v else "")
        return v
    return v


@app.context_processor
def env_functions():
    return {
        "is_enabled": lambda tag: bool(lookup(tag, 0) if isinstance(lookup(tag), list) else lookup(tag)),
        "list_is_enabled": lambda tag, idx: bool(lookup(tag, idx)),
        "env_value_by_tag": lambda tag: lookup(tag),
        "env_value_by_tags": lambda tags: lookup(tags),
        "list_value_by_tag": lambda tag, idx: lookup(tag, idx),
        "list_value_by_tags": lambda tags, idx: lookup(tags, idx),
        "env_values": {},
    }


def indices():
    return list(range(len(sites())))


def agg_structure():
    rows = [["adsblol", "adsb.lol", "https://adsb.lol", ["https://my.adsb.lol"] * 4, 0], ["adsbfi", "adsb.fi", "https://globe.adsb.fi", ["https://adsb.fi/?feed=x"] * 4, 0]]
    rows += [["adsbx", "ADSBExchange", "https://globe.adsbexchange.com", [""] * 4, 0], ["tat", "TheAirTraffic", "https://globe.theairtraffic.com", [""] * 4, 0]]
    rows += [["flightradar", "flightradar24", "https://www.flightradar24.com/", ["/fr24/", "/fr24_1/", "/fr24_2/", "/fr24_3/"], 1]]
    rows += [["flightaware", "FlightAware", "https://www.flightaware.com/live/map", ["/fa-status/", "/fa-status_1/", "/fa-status_2/", "/fa-status_3/"], 1]]
    if state["scenario"] == "stage2":
        rows.append(["alive", "airplanes.live", "https://globe.airplanes.live", [""] * 4, 1])
    return rows


# ---------------------------------------------------------------- pages


def handle_post():
    form = [(k, v) for k, v in request.form.items(multi=True)]
    files = [(k, f.filename) for k, f in request.files.items()]
    state["last_post"] = {"path": request.full_path, "form": form, "files": files}
    # remember the theme so the UI can be checked in light / dark / auto
    if request.form.get("css_theme") in ("light", "dark", "auto"):
        state["css_theme"] = request.form["css_theme"]
    # external temperature sensor on/off, so the header's EXT chip can be previewed
    if "temp_sensor_enable" in request.form:
        state["temp_sensor"] = request.form.get("temperature_sensor") or request.form.get("temp_sensor") or "dht22"
    if "temp_sensor_disable" in request.form:
        state["temp_sensor"] = ""
    print(f"POST {request.full_path}: {form} {files}", flush=True)
    submit = [f"{k}={v}" for k, v in form if v in ("go", "wait", "stay") or v.startswith(("go-", "stay-"))]
    flash(f"POST {request.path} → {', '.join(submit) or 'no button'} ({len(form)} fields)", "success")
    if any(v == "go" for _, v in form) and request.path not in ("/update",):
        return render_template("restarting.html", extra_args="")
    return redirect(request.full_path.rstrip("?"))


@app.route("/", methods=["GET", "POST"])
@app.route("/index", methods=["GET", "POST"])
def index(widget_mode=False):
    if request.method == "POST":
        return handle_post()
    if state["scenario"] == "fresh":
        return setup()
    return render_template(
        "index.html",
        aggregators=agg_structure(),
        agg_tables=[0, 1],
        local_address="192.168.1.20",
        tailscale_address="",
        zerotier_address="",
        stage2_suggestion=False,
        matrix=[1] * len(indices()),
        compose_up_failed=False,
        ipv6_broken=False,
        channel="beta",
        adsb=state["scenario"] in ["integrated", "micro", "stage2"],
        pi5_usb_current_limited=False,
        widget_mode=widget_mode,
    )


@app.route("/widget")
def widget():
    return index(widget_mode=True)


@app.route("/setup", methods=["GET", "POST"])
def setup():
    if request.method == "POST":
        return handle_post()
    if state["scenario"] == "stage2":
        return render_template("stage2.html")
    return render_template("setup.html", mem=950000)


@app.route("/stage2", methods=["GET", "POST"])
def stage2():
    if request.method == "POST":
        return handle_post()
    return render_template("stage2.html", edit_index=int(request.args.get("edit", -1)))


@app.route("/update", methods=["POST"])
def update():
    for key in request.form:
        if key.startswith("edit_micro_"):
            return render_template("stage2.html", edit_index=int(key[len("edit_micro_") :]))
    return handle_post()


@app.route("/aggregators", methods=["GET", "POST"])
def aggregators():
    if request.method == "POST":
        return handle_post()
    m = int(request.args.get("m", "0"))

    def enabled(prefix):
        return lambda tag, m=0: "checked" if lookup(tag, m) else ""

    return render_template(
        "aggregators.html",
        uf_enabled=enabled("uf"),
        others_enabled=enabled("other"),
        nonadsb_enabled=enabled("nonadsb"),
        site=sites()[m] if state["scenario"] == "stage2" else "",
        m=str(m),
        piastatport="",
        netconfigs=NETCONFIGS,
    )


@app.route("/sdr_setup", methods=["GET", "POST"])
def sdr_setup():
    return handle_post() if request.method == "POST" else render_template("sdr_setup.html")


@app.route("/advanced", methods=["GET", "POST"])
def advanced():
    if request.method == "POST":
        return handle_post()
    return render_template("advanced.html", is_image=True, best_acars_frequencies="130.025; 130.450; 131.550", best_vdl2_frequencies="136.650; 136.975")


@app.route("/expert", methods=["GET", "POST"])
def expert():
    return handle_post() if request.method == "POST" else render_template("expert.html")


@app.route("/systemmgmt", methods=["GET", "POST"])
def systemmgmt():
    if request.method == "POST":
        return handle_post()
    return render_template(
        "systemmgmt.html",
        tailscale_running=False,
        zerotier_running=False,
        netbird_running=False,
        netbird_connected=False,
        netbird_registered=False,
        netbird_fqdn="",
        netbird_ip="",
        hotspot_enabled=True,
        rpw="Xk3pQ9vT2mLr",
        auth_pwd="Hq7wZ2nB5cVd",
        channel="",
        current_branch="beta",
        containers=["ultrafeeder", "dump978", "fr24feed", "piaware", "acarsdec", "acarshub", "shipfeeder", "dozzle"],
        persistent_journal=False,
        wifi="",
    )


@app.route("/visualization", methods=["GET", "POST"])
def visualization():
    if request.method == "POST":
        return handle_post()
    m = int(request.args.get("m", "0"))
    return render_template("visualization.html", site=sites()[m], m=m)


@app.route("/info")
def info():
    return render_template(
        "info.html",
        board="Raspberry Pi 5 Model B Rev 1.0",
        memory="               total        used        free      shared  buff/cache   available\nMem:           7.9Gi       1.2Gi       5.1Gi        52Mi       1.8Gi       6.7Gi",
        top="top - 21:14:03 up 3 days,  2:11,  0 user,  load average: 0.41, 0.52, 0.49",
        storage="Filesystem      Size  Used Avail Use% Mounted on\n/dev/mmcblk0p2   29G  7.1G   21G  26% /",
        base="adsb-im-raspberrypi64-pi-2-3-4-5",
        kernel="6.6.51+rpt-rpi-2712 #1 SMP PREEMPT Debian aarch64 GNU/Linux",
        journal="in memory",
        ipv6="IPv6 is working or disabled",
        current="v3.0.4-beta.7(beta)",
        containers=["ultrafeeder", "dump978", "fr24feed", "piaware", "acarsdec", "acarshub"],
        sdrs=["SDR(type: 'rtlsdr' serial: '1090')", "SDR(type: 'rtlsdr' serial: '978')"],
        ufargs="",
        envvars="READSB_RTLSDR_PPM=22",
        netdog="",
    )


@app.route("/support", methods=["GET", "POST"])
def support():
    if request.method == "POST":
        state["last_post"] = {"path": request.path, "form": list(request.form.items())}
        return render_template("support.html", url="https://termbin.com/abcd")
    return render_template("support.html", url="")


@app.route("/backup")
def backup():
    return render_template("backup.html")


@app.route("/restore", methods=["GET", "POST"])
def restore():
    if request.method == "POST":
        handle_post()
        return redirect("/executerestore?zipfile=x.zip")
    return render_template("restore.html")


@app.route("/executerestore", methods=["GET", "POST"])
def executerestore():
    if request.method == "POST":
        return handle_post()
    return render_template("restoreexecute.html", changed=["config.json", "ultrafeeder/globe_history/"], unchanged=["custom_aggregators.csv"])


@app.route("/change_sdr_serial_ui")
def change_sdr_serial_ui():
    return render_template("change_sdr_serial_ui.html")


@app.route("/change_sdr_serial/<old>/<new>")
def change_sdr_serial(old, new):
    time.sleep(2)
    return f"[OK] changed {old} to {new}"


@app.route("/sdplay_license", methods=["GET", "POST"])
def sdrplay_license():
    return handle_post() if request.method == "POST" else render_template("sdrplay_license.html")


# /restarting?update=1 pretends a feeder update is running (waiting-app.py answers "stream-log")
update_until = 0.0


@app.route("/restarting")
def restarting():
    global update_until
    if request.args.get("update"):
        update_until = time.time() + 45
    return render_template("restarting.html")


@app.route("/shutdownpage")
def shutdownpage():
    return render_template("shutdownpage.html")


@app.route("/waiting")
def waiting():
    return render_template("waiting.html", title="ADS-B Feeder is performing requested actions")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        return render_template("login.html", error="Invalid username or password", next="")
    return render_template("login.html", error=None, next=request.args.get("next", ""))


# the standalone helper apps (hotspot-app.py, recovery-app.py) - rendered without env helpers
@app.route("/_hotspot", methods=["GET", "POST"])
def hotspot():
    if request.method == "POST":
        handle_post()
        return redirect("/_hotspot-restarting")
    return render_template("hotspot.html", version="v3.0.4", comment="", ssids=["HomeNet", "HomeNet-5G", "Guest", "Neighbor 2.4"])


@app.route("/_hotspot-restarting")
def hotspot_restarting():
    return render_template("hotspot-restarting.html")


@app.route("/_recovery")
def recovery():
    return render_template("recovery.html", theme="auto", current_version="v3.0.4", previous_version="v3.0.3", rollback_in_progress=False, rollback_target_version=None)


@app.route("/_recovery-login")
def recovery_login():
    return render_template("recovery-login.html", error=None, next="", theme="dark")


# ------------------------------------------------------------------ APIs


@app.route("/api/stage2_stats")
def stage2_stats():
    return json.dumps(
        [{"pps": random.randint(20, 90), "mps": random.randint(600, 1400), "planes": random.randint(30, 80), "tplanes": random.randint(600, 900), "uptime": 5000, "nosdr": 0} for _ in indices()]
    )


@app.route("/api/stats")
def stats():
    return json.dumps([[random.randint(500, 900) - i * 10 for i in range(14)] for _ in indices()])


@app.route("/api/status/<agg>")
def agg_status(agg):
    if agg == "im":
        return json.dumps(
            {
                "latest_tag": "v3.0.3",
                "latest_date": "latest beta: v3.0.4-beta.8",
                "advice": "there is a newer beta version available",
                "show_update": "1",
                "beta_changelog": "- new React based web UI\n- fixed MLAT sync status for some aggregators\n- updated containers",
                "main_changelog": "",
            }
        )
    states = ["good", "good", "good", "warning", "disconnected", "starting", "unknown", "bad"]
    res = {}
    for idx in indices():
        if lookup(agg, idx):
            random.seed(f"{agg}{idx}")
            res[idx] = {"beast": random.choice(states[:5]), "mlat": random.choice(states), "adsblollink": ["https://my.adsb.lol/x"], "adsbxfeederid": "abc"}
    time.sleep(0.3)
    return json.dumps(res)


@app.route("/api/get_temperatures.json")
def temperatures():
    t = {"cpu": "52", "age": 3}
    if state["temp_sensor"] and state["scenario"] != "fresh":
        t["ext"] = "21"
    return t


@app.route("/api/ip_info")
def ip_info():
    return {"feeder_ip": "203.0.113.5"}


@app.route("/api/stage2_connection")
def stage2_connection():
    return {"stage2_connected": "never", "address": ""}


@app.route("/api/stage2_info")
def stage2_info():
    return json.dumps([{"lat": "47.1", "lon": "-122.1", "alt": "90", "mf_version": "v3.0.4(beta)", "uat_capable": True, "brofm_capable": True} for _ in indices()[1:]])


@app.route("/api/check_remote_feeder/<ip>")
def check_remote_feeder(ip):
    time.sleep(1)
    if ip.startswith("10."):
        return {"status": "ok"}
    return {"name": "garage-feeder", "micro_settings": True, "dump978_at_port": 30978, "brofm_capable": True}


@app.route("/api/sdr_info")
def sdr_info():
    return {
        "sdrdevices": [
            {"type": "rtlsdr", "serial": "1090", "purpose": "1090", "gain": "auto", "biastee": False},
            {"type": "rtlsdr", "serial": "978", "purpose": "978", "gain": "42.1", "biastee": True},
            {"type": "airspy", "serial": "0x35AC63DC2D8C7A4F", "purpose": "other-2", "gain": "21", "biastee": False},
        ],
        "frequencies": {"1090": "1090", "978": "978"},
        "duplicates": "",
        "lsusb_output": "Bus 001 Device 003: ID 0bda:2838 Realtek Semiconductor Corp. RTL2838 DVB-T\nBus 001 Device 004: ID 1d50:60a1 OpenMoko, Inc. Airspy",
        "sdr_warning": "",
    }


@app.route("/api/closest_airport/<lat>/<lon>")
def closest_airport(lat, lon):
    return {"icao": "KSEA", "name": "Seattle-Tacoma International Airport"}


@app.route("/api/check_changelog_status")
def changelog():
    return {"show_changelog": False}


@app.route("/api/mark_changelog_seen", methods=["POST"])
def mark_changelog_seen():
    return {"success": True}


@app.route("/api/scan_wifi")
def scan_wifi():
    time.sleep(1)
    return {"ssids": ["HomeNet", "HomeNet-5G", "Guest"]}


@app.route("/restart", methods=["GET", "POST"])
def restart():
    if time.time() < update_until:
        return "stream-log"
    time.sleep(0.9)
    return "done"


@app.route("/stream-log")
def stream_log():
    def gen():
        for i in range(40):
            yield f"data: [{time.strftime('%H:%M:%S')}] pulling ghcr.io/sdr-enthusiasts/docker-adsb-ultrafeeder ... layer {i}/40\n\n"
            time.sleep(0.15)

    return Response(gen(), mimetype="text/event-stream")


DEV_PAGES = [
    ("Home", "/"), ("Home (widget)", "/widget"), ("Basic setup", "/setup"), ("Stage 2 setup", "/stage2"),
    ("Data sharing", "/aggregators"), ("SDR setup", "/sdr_setup"), ("Change SDR serial", "/change_sdr_serial_ui"),
    ("SDRplay license", "/sdplay_license"), ("Advanced", "/advanced"), ("Expert", "/expert"), ("Map options", "/visualization"),
    ("System management", "/systemmgmt"), ("Support info", "/info"), ("Share diagnostics", "/support"), ("Backup", "/backup"),
    ("Restore", "/restore"), ("Restore (select files)", "/executerestore?zipfile=x.zip"), ("Restarting", "/restarting"), ("Updating", "/restarting?update=1"),
    ("Waiting (log stream)", "/waiting"), ("Shutdown", "/shutdownpage"), ("Login", "/login"),
    ("Hotspot captive portal", "/_hotspot"), ("Hotspot connecting", "/_hotspot-restarting"), ("Recovery app", "/_recovery"),
    ("Recovery login", "/_recovery-login"),
]


@app.route("/_dev")
def dev_index():
    links = "".join(f'<a class="page" href="{u}">{n}<span>{u}</span></a>' for n, u in DEV_PAGES)
    scen = "".join(
        f'<a class="scen{" on" if s == state["scenario"] else ""}" href="/_scenario/{s}?next=/_dev">{s}</a>' for s in SCENARIOS
    )
    return f"""<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>UI preview</title>
<style>body{{font:15px system-ui;max-width:900px;margin:40px auto;padding:0 16px;color:#0f172a;background:#f8fafc}}
h1{{font-size:24px}}.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}}
a{{text-decoration:none}}.page{{display:flex;flex-direction:column;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#0f172a}}
.page:hover{{border-color:#3b82f6}}.page span{{font:12px ui-monospace;color:#64748b}}
.scen{{display:inline-block;padding:6px 12px;margin:0 6px 6px 0;border-radius:8px;border:1px solid #cbd5e1;color:#334155;background:#fff}}
.scen.on{{background:#2563eb;color:#fff;border-color:#2563eb}}p{{color:#475569}}</style>
<h1>ADS-B Feeder UI preview</h1>
<p>Mock server with fake data. Forms don't change anything – after submitting, the page shows which fields the real
feeder would receive. Light/dark follows your Mac's appearance setting (the feeder's theme setting is "auto").</p>
<h3>Feeder mode</h3>{scen}<h3>Pages</h3><div class=grid>{links}</div>"""


@app.route("/_scenario/<name>")
def scenario(name):
    if name in SCENARIOS:
        state["scenario"] = name
    return redirect(request.args.get("next", "/"))


@app.route("/_last_post")
def last_post():
    return state["last_post"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5173)
    parser.add_argument("--scenario", choices=SCENARIOS, default="integrated")
    args = parser.parse_args()
    state["scenario"] = args.scenario
    app.run(port=args.port, debug=True)
