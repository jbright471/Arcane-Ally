# November 13 product update — implementation verification

- **Status:** Implemented and first deployed through PR #8 as `aaeb9848e72f3f23266531bd1884d7c7362f5ace`; its [receipt](DEPLOYMENT_RECEIPT_2026-11-13.md) records the product rollout. The [Codex/documentation follow-up](DEPLOYMENT_RECEIPT_2026-11-13_CODEX.md) is now live as `e7dfb5282130d55fe1633248633c52051ceda3ef`, with application logic and dependencies unchanged. This document retains the original local/synthetic feature acceptance details.
- **Scope:** The worthwhile unfinished recommendations from the ten October 23–November 13 product briefs, plus the missing Inspector endpoint reproduced during the actual app walkthrough.
- **Source:** `arcane-ally-update-20261113`, branch `implementation/product-briefs-20261113`, based on published baseline `1e87eb4513d06bd6742617dc13373c1a06970b06`.
- **Production preflight read-back:** Existing Bastet controller returned `417ae5e4ef2ebe42ed5ddc827e7405b9bf3532e7`, frontend/backend running, backend healthy. Installed controller SHA-256 was `83e226d1bb5fa1c75df4b7d5b05897f2130c4ade647085f5a805c0110ab92d01` before any release change.
- The clean original source checkout and the hardening checkout's 20 modified/12 untracked development files were preserved. The conflicted older release checkout was not used.

## Delivered behavior

- **Character-card keyboard ownership:** Enter/Space on nested Inspector, History or menu controls no longer activates enclosing navigation/selection. Root click/Enter/Space and portaled menu behavior remain intact.
- **Working read-only Inspector:** The browser exposed a genuine 404 for `/api/characters/:id/combat-inspector`; no server implementation existed in history. The new endpoint uses the authoritative resolved stats, equipment/buff/aura/feature sources, and existing DM-only authorization. Strict ID checks and character/session checks share a read transaction. A missing session returns 409 instead of creating state. The UI displays actual final values and source rows rather than an unsupported base/dex/equipment formula.
- **Local token spotlight:** Visible legend entries are keyboard/touch controls. Selecting an entry emphasizes its token and temporarily brings it above overlaps. Selection clears by toggle, Clear/Escape, removal, hiding or map change. No saved order, position, role projection, backend event or permission changes.
- **Lifecycle coverage:** Condition removal and same-PC positive/zero/recovered health transitions are covered. Current health/condition rendering passed without runtime changes.
- **Dependency maintenance:** Current client/server production and full audits report zero findings; compatible patched resolutions and narrowly scoped matcher overrides are verified. See [dependency evidence](DEPENDENCY_MAINTENANCE_2026-11-13.md) and [selected machine-readable findings](security/dependency-findings-2026-11-13.json).
- **Tooling/release checks:** Ten selected TS/TSX paths now have documented lint coverage. CI runs lint and dependency gates, with an isolated server-test database. The backend image uses lockfile-based `npm ci`. The controller candidate permits only the reviewed additional manifest/lockfile, Inspector route, lint config and test paths; its other gates remain intact.
- Reveal overlays, broader inspector redesign, movement permissions, lighting and new integrations remain deferred.

## Automated evidence

| Check | Observed result |
| --- | --- |
| Fresh server baseline, isolated DB | 163 tests / 27 files passed before dependency changes |
| CharacterCard fixture before fix | 8 failed / 7 passed; all 15 pass after the ownership guard |
| Spotlight fixture before implementation | 4 failed / 26 passed; all 30 BattleMap tests pass afterward |
| Inspector route before implementation | 8 failed / 3 role-denial tests passed; all 11 pass afterward |
| Inspector UI contract | Old response access failed; both resolved-presentation/error tests pass after adaptation |
| Old dependency regression fixture | Four of six bounded tests fail against the original installed packages; all six pass with patched packages |
| Final client `npm test -- --maxWorkers=1 --reporter=dot` | 106 tests / 18 files passed |
| Final server `npm test -- --maxWorkers=1 --reporter=dot` | 180 tests / 29 files passed, fresh temporary `DB_PATH`, scheduled jobs disabled before imports |
| Client `npm run build` | Passed, including app/config TypeScript checks and production Vite build |
| Client `npm run lint -- --max-warnings=0` | Passed; ten selected TS/TSX paths, existing JS/JSX scope retained |
| Lint coverage probes | Actual TS parser/rules on selected files; controlled debugger statement rejected; outside TSX scope remains explicitly excluded |
| Current `npm audit --json` and `npm audit --omit=dev --json` | Client and server: zero findings in all four graphs |
| Matcher compatibility | Twenty glob cases per inspected consumer/comparison version; real parser, ESLint and synthetic Nodemon child smoke passed |
| Controller `bash -n` and `python docs/deployment/test_release_policy.py` | Passed; 31 positive/negative classification cases |
| `git diff --check` | Passed |

Server tests use synthetic identities/data. The Inspector tests exercise the actual router, resolver and authorization middleware with a real in-memory SQLite database; repeated valid/invalid reads leave `total_changes()` unchanged. Existing production-server tests also exercise the actual entry point and role boundaries.

## Actual browser acceptance

Your real built frontend and real backend ran on loopback ports 53013/33013 against a newly migrated, synthetic SQLite database. A test-only preload forced the unchanged server listener to loopback. No production campaign database was copied, no real AI question was sent, and scheduled jobs were disabled.

- At **390/768/1280 pixels**, actual DM sign-in, Inspector's real resolved response, nested Inspector/History/menu keys, options Escape/focus return, legend selection and overlapping-token hit-testing passed without horizontal overflow.
- Those final actual-app checks recorded **zero page exceptions, console warnings/errors, HTTP errors, or non-read API requests** after synthetic sign-in. The only observed outgoing socket event was the existing `dm_join_room` bootstrap. No menu mutation, map synchronization, token movement or campaign edit was submitted.
- Before/after hashes of synthetic `characters`, `session_states`, `map_tokens` and `initiative_tracker` tables match.
- An additional real-component fixture verified root navigation/custom callbacks, intended portaled actions with the mutation stubbed, and native touch at all three widths. It proved the initial overlap problem before spotlight was added.
- Player-snapshot fixtures verify condition clearing, zero/recovery health, withheld data, selection invalidation and no API/socket mutation. Player drag emits nothing; existing DM drag still emits the expected synthetic move event. These are isolated fixtures, not authenticated production multiplayer acceptance.
- The initial Inspector failure was a missing route. The global API credential boundary already worked; a temporary credential-helper detour was reverted. Browser-harness timing/runner issues were corrected before the final passing run.

Synthetic/static screenshot evidence, visually reviewed:

- [Actual Inspector at phone width](assets/product-update-2026-11-13/inspector-mobile.png)
- [Actual DM spotlight at phone width](assets/product-update-2026-11-13/spotlight-dm-mobile.png)
- [Player-projected spotlight fixture at desktop width](assets/product-update-2026-11-13/spotlight-player-desktop.png)

## Production-image verification

- Final local image: `arcane-ally:product-briefs-20261113-local`, ID `sha256:1e5d794e2905bc266adede0520bcf7bae6932a88a4abce407a8764d76ba048e1`.
- Node 20.20.2 Alpine build passed, including native compilation. Runtime runs as UID 1000, with npm/Corepack removed.
- Actual runtime inspection confirmed Engine.IO 6.6.11, proxy-addr 2.0.8, Multer 2.5.0, qs 6.17.1, Express 5.2.1 and Socket.IO 4.8.3.
- Native better-sqlite3 12.6.2 / SQLite 3.51.2 passed an in-memory create/insert/select check. A disposable image instance with no mounts, a fresh `/tmp` database and disabled jobs passed `/api/health` and the packaged healthcheck.
- A local Docker interruption was resolved with one bounded restart. All task-owned disposable Docker containers were removed. This image smoke does not replace Bastet's exact-revision image build, copied-database preflight, backup or post-deployment checks.

## Release boundaries

- No schema or role-policy change. No production authentication or campaign mutation was used for local acceptance.
- This is focused dependency and product verification, not a full security audit, penetration test, performance study, screen-reader user test, voice/importer/AI evaluation or live multiplayer acceptance.
- GitHub execution, exact target revision, installed-controller verification, copied-database preflight, checked backup, live health/labels, read-only route checks and rollback evidence are recorded in the [completed deployment receipt](DEPLOYMENT_RECEIPT_2026-11-13.md).
- Use the existing controller and `projects-stack`; never launch a competing production Compose stack. Rollback restores service references, not the database. See [deployment operations](DEPLOYMENT.md).
