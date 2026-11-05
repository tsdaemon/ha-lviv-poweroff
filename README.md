[![SWUbanner](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/banner-direct-single.svg)](https://stand-with-ukraine.pp.ua/)

![HA Poltava PowerOff Logo](https://raw.githubusercontent.com/OLDIN/ha-poltava-poweroff/main/custom_components/poltava_poweroff/brand/icon.png)

# ⚡️ Home Assistant Poltava PowerOff

An integration for electricity shutdown schedules of [PoltavaOblEnergo][poltavaoblenergo]. Based on the official schedule from [poe.pl.ua][poltavaoblenergo-gpv], with [EnergyUA][energyua] as a fallback.

This integration for [Home Assistant][home-assistant] provides information about planned electricity shutdowns of [PoltavaOblEnergo][poltavaoblenergo] in Poltava oblast:
calendar of planned shutdowns, time sensors for the next planned power on and off events.

**Where the schedule comes from:** first the hourly outage schedule (ГПВ) published by PoltavaOblEnergo itself on [poe.pl.ua][poltavaoblenergo-gpv]; when that site is unreachable or has no schedule for today yet, the community driven project [EnergyUA][energyua]. A day neither source has keeps its cached schedule (see [below](#when-the-sites-are-down)).

**💡 Note:** This project is not affiliated with [EnergyUA][energyua] or [PoltavaOblEnergo][poltavaoblenergo] in any way. This integration is developed by an individual.
Provided data may be incorrect or misleading, follow the official channels for reliable information.

> This integration is inspired by [ha-yasno-outages](https://github.com/denysdovhan/ha-yasno-outages) by [Denys Dovhan](https://github.com/denysdovhan).

## Installation

The quickest way to install this integration is via [HACS][hacs-url] by clicking the button below:

[![Add to HACS via My Home Assistant][hacs-install-image]][hasc-install-url]

If it doesn't work, adding this repository to HACS manually by adding this URL:

1. Visit **HACS** → **Integrations** → **...** (in the top right) → **Custom repositories**
1. Click **Add**
1. Paste `https://github.com/OLDIN/ha-poltava-poweroff` into the **URL** field
1. Chose **Integration** as a **Category**
1. **Poltava Power Offline** will appear in the list of available integrations. Install it normally.

## Usage

This integration is configurable via UI. On **Settings → Devices & Services** page, click **Add Integration** and search for **Poltava Power Offline**.

1. **Pick the schedule source** (where the outage schedule comes from):

   ![Choosing the schedule source](https://raw.githubusercontent.com/OLDIN/ha-poltava-poweroff/main/pics/config_source.png)

   | Source | What it does |
   |---|---|
   | **Poltava oblast — poe.pl.ua, energy-ua.info as a fallback** (default, recommended) | The official Poltavaoblenergo schedule; energy-ua.info when poe.pl.ua is down or has no schedule for today yet |
   | Poltava oblast — poe.pl.ua only | Only the official site |
   | Poltava oblast — energy-ua.info only | Only the community site (the behaviour before 0.6.0) |

2. **Pick your queue** (1.1 … 6.2). Find it by your address on [poe.pl.ua][poltavaoblenergo-gpv] or [EnergyUA][energyua].

The same queue from the same source can be added only once. To switch the source or the queue later, open the entry in **Settings → Devices & Services** and choose **⋮ → Reconfigure**: the entities, their history and your automations stay. Entries created before 0.6.0 use the default source.

Other regions can be added as new sources, see [Adding a schedule source](#adding-a-schedule-source).

![Outage card](https://raw.githubusercontent.com/OLDIN/ha-poltava-poweroff/main/pics/card.png)

### Entities

| Entity | Description |
|---|---|
| `sensor.power_state` | `Power ON` / `Power OFF` right now, by the schedule. Attributes: today's and tomorrow's periods, `next_off`, `next_on`, `queue`, freshness flags (see below) |
| `sensor.next_power_off` | When the next outage starts |
| `sensor.next_power_on` | When power returns (end of the current or next outage) |
| `sensor.schedule_updated` | When the schedule on the site last **changed** |
| `sensor.schedule_last_fetch` | Diagnostic: last successful request to the site |
| `select.poweroff_view_queue` | Which queue the card shows (see [queue switcher](#viewing-other-queues-queue-switcher)) |
| `calendar.poltava_poweroff_calendar` | Planned outages as calendar events |
| `event.poweroff_schedule_changed` | Fires when the schedule of your queue is published or changes (see [below](#schedule-change-event)) |

An outage that crosses midnight (e.g. 21:00–24:00 today and 00:00–02:00 tomorrow) is treated as one outage: `next_power_on` is 02:00, not 00:00.

![Sensors](https://raw.githubusercontent.com/OLDIN/ha-poltava-poweroff/main/pics/sensors.png)

### Manual Data Refresh

The integration automatically updates data every **5 minutes**. If you need to force an immediate update (e.g., when the schedule changes on the website), you can use the service:

**Via Developer Tools:**
1. Go to **Settings → Developer Tools → Services**
2. Select `poltava_poweroff.refresh` from the service dropdown
3. Click **Call Service**

**Via YAML (automation/script):**
```yaml
service: poltava_poweroff.refresh
```

### Schedule change event

`event.poweroff_schedule_changed` fires once for every day whose schedule changed (today and later; nothing fires on the very first fetch after installation):

| Event type | When |
|---|---|
| `published` | A day that was unknown got a schedule — usually tomorrow's, published in the evening |
| `changed` | The outages of an already known day changed |

Attributes of the last event: `day` (`today` / `tomorrow` / `later`), `date`, `queue`, `periods` and `previous_periods` (`[{"start": "09:00", "end": "11:00"}]`), `periods_text` and `previous_periods_text` (`"09:00–11:00, 15:00–17:30"`, empty when there are no outages), `outage_hours`.

```yaml
triggers:
  - trigger: state
    entity_id: event.poweroff_schedule_changed
conditions:
  - "{{ trigger.from_state is not none and trigger.from_state.state != 'unavailable' }}"  # skip restarts
actions:
  - action: notify.mobile_app_my_phone
    data:
      message: "Графік на {{ trigger.to_state.attributes.day }}: {{ trigger.to_state.attributes.periods_text }}"
```

### Blueprints

Ready-made automations; import them with one click and pick your phone in the form:

| Blueprint | What it does | Import |
|---|---|---|
| Schedule changed | Push notification when tomorrow's schedule is published or today's/tomorrow's changes, e.g. *«⚠️ Графік на сьогодні змінився — Черга 4.1: 08:00–10:00 (2 год без світла). Було: 08:00–09:30.»* | [![Import](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2FOLDIN%2Fha-poltava-poweroff%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fpoltava_poweroff%2Fschedule_changed.yaml) |
| Outage warning | Notification (and optionally a TTS announcement) N minutes before the next outage, plus any extra actions (turn on the boiler, shut down a PC…). Follows schedule changes | [![Import](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2FOLDIN%2Fha-poltava-poweroff%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fpoltava_poweroff%2Foutage_warning.yaml) |

The files live in [`blueprints/automation/poltava_poweroff/`](blueprints/automation/poltava_poweroff/).

### Viewing other queues (queue switcher)

The card has a queue chip in its header (🏠 marks your queue). Pick any of 1.1…6.2 to see that queue's schedule; a blue banner reminds you that you're viewing someone else's queue and offers **Повернутись** (back to your queue). The card UI is in Ukrainian.

- The choice is stored in `select.poweroff_view_queue` and survives restarts. It is shared by everyone in the household.
- Sensors, the calendar and your automations **always** follow the queue you configured — the switcher only changes what the card shows.
- Only your queue and the last selected one are polled in the background; another queue is fetched the moment you select it (cached for 5 minutes, and kept on disk like your own).
- The card finds the select automatically. To pin it explicitly use `queue_entity: select.poweroff_view_queue`, or hide the switcher with `queue_entity: false`.

![Queue switcher](https://raw.githubusercontent.com/OLDIN/ha-poltava-poweroff/main/pics/card_queue_switcher.png)

### When the sites are down

The schedule is cached on disk (`.storage/poltava_poweroff.<entry_id>`) by **date**, so:

- if poe.pl.ua is unreachable or has no schedule for today, energy-ua.info is used instead, and vice versa;
- if both are unreachable, return an error page, a Cloudflare challenge or "Немає даних" (no data), the last good schedule stays visible — sensors do **not** go empty or `unavailable`. This also covers energy-ua.info coming back after its own downtime with an empty hourly scale under "Немає даних" (seen on 2026-10-31): that is "no data", not "no outages";
- after a Home Assistant restart the schedule is restored from cache even if the site is still down;
- at midnight tomorrow's schedule becomes today's automatically, without contacting the site.

The card shows an orange banner when it is displaying a cached schedule, and a "Графік оновлено …" (schedule updated) line with the time the schedule last **changed**. Hover it (or tap on a phone) to see when the site was last checked successfully and why the last attempt failed.

![Site is down](https://raw.githubusercontent.com/OLDIN/ha-poltava-poweroff/main/pics/card_site_down.png)

| Entity / attribute | Meaning |
|---|---|
| `sensor.schedule_updated` | When the schedule on the site last changed (not just re-fetched) |
| `sensor.schedule_last_fetch` (diagnostic) | Last successful request to the site |
| `sensor.power_state` → `data_stale` | `true` while the last request failed and cached data is shown |
| `sensor.power_state` → `last_error` | Why the last request failed (human-readable Ukrainian text shown on the card, e.g. `Сайт відповів помилкою HTTP 502` = "the site returned HTTP 502") |
| `sensor.power_state` → `today_known` / `tomorrow_known` | Whether the site has published a schedule for that day |
| `sensor.power_state` → `queue` | Your queue as shown on the site, e.g. `4.1` |

Example — notify when the site has been unreachable for over an hour:

```yaml
trigger:
  - platform: template
    value_template: >
      {{ state_attr('sensor.power_state', 'data_stale')
         and (now() - states('sensor.schedule_last_fetch') | as_datetime) > timedelta(hours=1) }}
```

Integration also provides a calendar view of planned outages. You can add it to your dashboard as well via [Calendar card][calendar-card].

![Calendar](https://raw.githubusercontent.com/OLDIN/ha-poltava-poweroff/main/pics/calendar.png)

### Lovelace “Snail” (Poweroff Timeline Card)

The card is bundled with the integration and registered as a Lovelace resource automatically (dashboards in the default storage mode), with `?v=<version>` so browsers pick up new versions after an update.

1. Go to **Settings → Devices & Services**, add **Poltava Power Offline**, and select your queue.
2. Click the badge below to open Home Assistant’s card editor with a pre-filled configuration.

[![Add Lovelace Card via My Home Assistant](https://my.home-assistant.io/badges/lovelace_card.svg)](https://my.home-assistant.io/redirect/lovelace_card/?config=%7B%22type%22%3A%22custom%3Apoweroff-timeline-card%22%2C%22entity%22%3A%22sensor.power_state%22%7D)

3. Alternatively, open your dashboard and choose **Edit → Add card → Custom: Power Off Timeline Card**. All options can be set in the visual editor, with a live preview:

![Card editor](https://raw.githubusercontent.com/OLDIN/ha-poltava-poweroff/main/pics/card_editor.png)

Or use **Show code editor**:

```yaml
type: custom:poweroff-timeline-card
entity: sensor.power_state          # required
# show_queue_switcher: false                  # optional: hide the queue switcher (default true)
# queue_entity: select.poweroff_view_queue   # optional: found automatically
# battery_entity: sensor.ups_runtime          # optional: battery runtime left, see below
# auto_tomorrow: false                        # optional: don't switch to tomorrow when today's outages are over
```

The old `queue_entity: false` still hides the switcher, but the visual editor asks to replace it with `show_queue_switcher: false`.

4. Reload the dashboard (hard refresh if needed).

#### Battery runout mark (optional)

Got a battery, UPS or power station? Point the card at a sensor with its remaining runtime and it shows
whether the charge lasts until power comes back:

```yaml
type: custom:poweroff-timeline-card
entity: sensor.power_state
battery_entity: sensor.ups_runtime   # remaining runtime: hours, or min / s / d units, or "H:MM"
```

![Battery runout mark](https://raw.githubusercontent.com/OLDIN/ha-poltava-poweroff/main/pics/card_battery.gif)

- A **red line** on the spiral marks the moment the battery runs out (on the tab of that day), with a legend item.
  When the load changes and the forecast jumps, the line glides along the spiral to its new spot instead of jumping.
- A line under the spiral compares it with the next power-on (the end of the current or next outage of your home queue):
  *«Заряду вистачить до 18:40, світло о 17:00»* or, highlighted, *«Заряду не вистачить: до 03:21, світло о 04:00»*.
- Without `battery_entity`, while the sensor is unavailable, or while another queue is shown in the switcher, the card looks exactly as before.

The integration ships its own icon and logo in `custom_components/poltava_poweroff/brand/` (supported since Home Assistant 2026.3), so it shows up on **Settings → Devices & Services** without an entry in the `home-assistant/brands` repository.

The card uses its own font (Inter, bundled in `www/fonts/`), so it looks the same on every device and works offline.

> If your dashboards use YAML mode for resources, add `/local/poltava_poweroff/poweroff-timeline-card.js` (type: module) to `lovelace: resources:` yourself.

## Adding a schedule source

Sources live in [`custom_components/poltava_poweroff/sources/`](custom_components/poltava_poweroff/sources/). To support another region or site:

1. **Write a provider** in `sources/<name>.py` — a class with:

   ```python
   class MyCityScrapper:
       site = "example.com"                      # shown in errors and logs

       def __init__(self, queue: str) -> None:   # queue id such as "1-1"
           ...

       async def get_power_off_periods(self) -> tuple[DayPeriods, DayPeriods]:
           """(today, tomorrow): a list of PowerOffPeriod (hours from midnight, end 0.0 = 24:00),
           [] = no outages that day, None = the site has no data for that day."""

       async def validate(self) -> bool:         # the site answers (used when adding the integration)
           ...
   ```

   Raise `ScraperError` with a short Ukrainian message (it is shown on the card) when the site is down or returns an unexpected page — never return `[]` for an error page, that would wipe the cached schedule. See [`sources/base.py`](custom_components/poltava_poweroff/sources/base.py) for the contract and helpers (`merge_periods`, `FallbackProvider` to chain several sites).

2. **Register it** in [`sources/__init__.py`](custom_components/poltava_poweroff/sources/__init__.py):

   ```python
   SourceInfo(id="mycity", title="MyCity Power Offline", queues=UA_QUEUES, factory=MyCityScrapper),
   ```

   The `id` is stored in config entries, so it must never change once released. `queues` lists the queue ids the user can pick.

3. **Name it** in the `selector.source.options` section of `strings.json`, `translations/en.json` and `translations/uk.json` (a test checks that every source has a name in every file).

4. **Test it** with a saved page from the site, like [`tests/test_sources.py`](tests/test_sources.py) does for poe.pl.ua, and add a mock route in `scripts/mock_energyua.py` if you want to try it in the local Home Assistant.

## Dev Container workflow

For local development we ship a ready-to-go [VS Code Dev Container](.devcontainer.json):

1. Install the Dev Containers extension and run **Dev Containers: Reopen in Container**. The image is built from the repo `Dockerfile`, applying the `git` and `docker-outside-of-docker` features so you can commit and use Docker inside the workspace.
2. The container expects at least 4 CPUs, 8 GB RAM and 20 GB of disk (see `hostRequirements`). Codespaces or local Docker Desktop should prompt you if the host is undersized.
3. During `postCreateCommand` the helper script `scripts/setup` installs Python tooling and hooks. When the container starts, `scripts/devcontainer_ha_guard.sh` launches Home Assistant via `scripts/develop`, keeps it running, and tails output into `/tmp/ha.log`. The guard’s own status messages end up in `/tmp/ha-guard.log` (tail it when diagnosing autostart issues).
4. Forwarded port 8123 is labeled “Home Assistant”. Once logs show `Home Assistant is up`, visit `http://localhost:8123/` (or the forwarded URL in Codespaces) to test the custom card/integration. Restarting the server is as easy as `docker restart <container>` or stopping the guard script.
5. Use environment variables `HA_LOG`, `HA_HEALTHCHECK_URL`, `HA_HEALTHCHECK_ATTEMPTS`, or `HA_RESTART_DELAY` to tweak the guard behaviour when needed.

## Development

### Running Tests

Python tests run against a real Home Assistant core (`pytest-homeassistant-custom-component`). Dependency versions are pinned in `requirements.txt` (Python 3.13):

```bash
pip install -r requirements.txt     # or: scripts/setup_dev_env.sh (creates .venv-ha)

pytest                                              # all tests
pytest tests/test_coordinator.py -v                 # one file
pytest --cov=custom_components/poltava_poweroff --cov-report=html
```

**What is covered:** page parsing and site failures (HTTP errors, Cloudflare/maintenance pages, "Немає даних"), the on-disk cache and restarts, midnight rollover and outages crossing midnight, DST days, the queue switcher, the config flow, and a full integration setup.

**Notes:**
- `pytest.ini` adds `custom_components` and the repo root to `PYTHONPATH`
- The minimum supported Home Assistant version is in `hacs.json` (tests also pass on 2024.11)

### Local Home Assistant with mock sites (UI + screenshots)

Same approach as in `ha-silpo`: a real Home Assistant process with the integration symlinked in, talking to a local mock of energy-ua.info and poe.pl.ua that you can "break" on demand.

```bash
scripts/setup_dev_env.sh          # once: creates .venv-ha (HA + test deps + Playwright Chromium)
scripts/dev_ha_ui.sh up           # HA on http://127.0.0.1:8124/poweroff/0  (admin / poweroff1234)
scripts/dev_ha_ui.sh mode http500 # site down → card shows cached schedule + banner
scripts/dev_ha_ui.sh mode garbage # Cloudflare / maintenance page
scripts/dev_ha_ui.sh mode nodata  # "Немає даних" — known days are kept
scripts/dev_ha_ui.sh mode ok
curl -X POST 127.0.0.1:8798/_test/poe -d '{"mode": "down"}'   # poe.pl.ua only: same | ok | down | empty | timeout
scripts/dev_ha_ui.sh restart      # restart HA only — schedule must come back from cache
scripts/dev_ha_ui.sh shot site_down   # screenshots/site_down.png (full dashboard)
scripts/dev_ha_ui.sh readme       # re-take the README screenshots in pics/ (incl. card_battery.png)
scripts/dev_ha_ui.sh down
```

The mock (`scripts/mock_energyua.py`) renders pages in the sites' HTML format; by default poe.pl.ua follows the energy-ua `mode`. Change the schedule with
`curl -X POST 127.0.0.1:8798/_test/schedule -d '{"today": [[8, 9.5]], "tomorrow": null}'`.
The integration reads the site addresses from `POLTAVA_POWEROFF_BASE_URL` (defaults to `https://energy-ua.info`) and `POLTAVA_POWEROFF_POE_URL` (defaults to `https://www.poe.pl.ua/customs/newgpv-info.php`).
Runtime files (`ha_config/`, `.venv-ha/`, `screenshots/`) are git-ignored.

### Running JavaScript Tests

The project includes tests for the Lovelace card UI component. To run JavaScript tests:

```bash
# Install Node.js dependencies (first time only)
npm install

# Run all JavaScript tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

**JavaScript Test Coverage:**
- Component initialization and configuration
- UI rendering (spiral chart, legend, next-outage line, buttons)
- Tab switching (today/tomorrow) and keeping a manual choice
- Pattern building for power off periods
- Queue switcher (select entity discovery, menu, loading state, "Повернутись")
- Cached-schedule banner and the "Графік оновлено" tooltip
- Bundled font, re-render only on own entity changes
- Edge cases (missing entities, empty periods)
- **Image snapshots** - Visual regression testing with PNG images

**Image Snapshots:**
The tests render the card in headless Chromium (Puppeteer) and compare it with reference PNGs in `tests/js/__snapshots__/`. The card ships its own font (Inter, `www/fonts/`), so the pictures are the same on macOS, Linux and CI — one set of references for everyone. The clock is frozen during these tests and tiny rendering differences are tolerated. On a mismatch the test writes `*-actual-diff.png` and `*-diff.png` next to the reference (git-ignored). If Chromium cannot start, the snapshot tests are skipped.

To update snapshots after intentional UI changes:
```bash
rm tests/js/__snapshots__/*.png
npm test
```

### Continuous Integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

| Job | What it checks |
|---|---|
| **Lint (pre-commit, mypy)** | The same pre-commit hooks as locally (ruff, ruff-format, whitespace, YAML) and mypy |
| **Python tests** | `pytest` with coverage against a real Home Assistant core |
| **Card tests (vitest + snapshots)** | `npm test`; on failure the snapshot diffs are uploaded as an artifact |
| **hassfest (Home Assistant)** | Official validation of `manifest.json`, translations, services |
| **HACS validation** | Repository is valid for HACS (needs a repo description, topics and enabled Issues) |

A separate **Release** workflow (`release.yml`) runs after merges that change the version in `manifest.json` and publishes the GitHub Release.

If the card snapshots differ only because CI renders with another Chromium build, run the workflow manually (**Actions → CI → Run workflow**, tick *update-snapshots*) and commit the PNGs from the `snapshots` artifact.

**Protecting `main`** (Settings → Rules → Rulesets → New branch ruleset, target `main`):
- *Require a pull request before merging* — with 0 required approvals for a solo maintainer (GitHub doesn't let you approve your own PR), or 1 approval plus yourself in the bypass list;
- *Require status checks to pass* — select the five jobs above;
- *Block force pushes* and *Restrict deletions*.

With `main` protected, every release goes through a PR; `scripts/bump_version.py` does both halves (see [Version Management](#version-management)).

### Version Management

Bump the version in a PR; after the merge the **Release** workflow tags and publishes it:

```bash
# 1. Bump, write RELEASE_NOTES_X.Y.Z.md, commit, push the branch and open a PR.
#    Run it on your feature branch, or on main (it then creates release/vX.Y.Z).
python scripts/bump_version.py patch --pr      # or minor / major

# 2. Merge the PR (CI green). .github/workflows/release.yml sees the new
#    version in manifest.json, creates tag vX.Y.Z and the GitHub Release.

# Manual fallback if the workflow didn't run: same steps from your machine.
python scripts/bump_version.py release
```

Nothing is ever pushed to `main` directly. Both commands accept `-d/--dry-run` to print the git/gh commands without running them (`release -d` still switches to `main` and fast-forwards it, since that's needed to read the merged version).

**Bump options** (`major|minor|patch`):
- `-n, --notes`: only generate `RELEASE_NOTES_X.Y.Z.md` (release dates use Kyiv time)
- `-c, --commit`: commit the bump and notes (creates `release/vX.Y.Z` when run on `main`)
- `-p, --pr`: commit, push the branch and open a pull request (needs `gh auth login`)

**Release options**: `--no-gh-release` pushes only the tag.

`release` refuses to run with a dirty tree, when `main` can't be fast-forwarded, or when the tag already exists on GitHub (i.e. the version wasn't bumped).

See [docs/VERSION_MANAGEMENT.md](docs/VERSION_MANAGEMENT.md) for details.

## Versioning and Updates

This integration uses [semantic versioning](https://semver.org/) (MAJOR.MINOR.PATCH). The version is stored in `custom_components/poltava_poweroff/manifest.json`.

### For Users

**HACS automatically detects updates** when:
- A new version is released (version in `manifest.json` changes)
- You have the integration installed via HACS

#### Method 1: Update via HACS (Recommended)

1. Go to **HACS** → **Integrations**
2. Find **Poltava Power Offline** in the list
3. If an update is available, you'll see an **Update** button (or a version badge showing available update)
4. Click **Update** button
5. Wait for the update to complete
6. **Restart Home Assistant** (Settings → System → Restart)

#### Method 2: Manual Update via File System

If you installed the integration manually (not via HACS):

1. Download the release archive from [GitHub Releases](https://github.com/OLDIN/ha-poltava-poweroff/releases) (or `git clone` the repository anywhere on your computer)
2. Replace the folder `/config/custom_components/poltava_poweroff` with `custom_components/poltava_poweroff` from the archive (e.g. via the **Samba share** or **File editor** add-on)
3. **Restart Home Assistant** (Settings → System → Restart)

#### Method 3: Reinstall via HACS

If the update doesn't appear or you have issues:

1. Go to **HACS** → **Integrations**
2. Find **Poltava Power Offline**
3. Click the **...** (three dots) menu → **Redownload**
4. **Restart Home Assistant**

**Note:** After updating, the installed version is shown in **HACS → Poltava Power Offline**. If the card still looks old, hard-refresh the browser.

### For Developers

Releases use `scripts/bump_version.py`, see [Version Management](#version-management):

```bash
python scripts/bump_version.py patch --pr   # bug fixes:        0.1.0 -> 0.1.1
python scripts/bump_version.py minor --pr   # new features:     0.1.0 -> 0.2.0
python scripts/bump_version.py major --pr   # breaking changes: 0.1.0 -> 1.0.0
# merge the PR — the Release workflow tags it and publishes the GitHub Release
```

**How HACS detects updates:**
- HACS periodically checks the repository and offers the **latest GitHub Release** (the tag created by `release`)
- Only repositories without any releases fall back to the newest commit of the default branch
- So a version bump merged into `main` reaches users once the Release workflow (or `bump_version.py release`) has published it
- Users can trigger a check manually: HACS → ⋮ → **Update information**

<!-- References -->

[energyua]: https://energy-ua.info/
[poltavaoblenergo-gpv]: https://www.poe.pl.ua/disconnection/power-outages/
[poltavaoblenergo]: https://www.poe.pl.ua/
[home-assistant]: https://www.home-assistant.io/
[hacs-url]: https://github.com/hacs/integration
[hasc-install-url]: https://my.home-assistant.io/redirect/hacs_repository/?owner=OLDIN&repository=ha-poltava-poweroff&category=integration
[hacs-install-image]: https://my.home-assistant.io/badges/hacs_repository.svg
[calendar-card]: https://www.home-assistant.io/dashboards/calendar/
