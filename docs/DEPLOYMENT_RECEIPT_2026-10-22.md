# October 22 product polish — deployment receipt

Status: committed, pushed, deployed, and verified on October 22, 2026 Eastern time. You explicitly authorized this release after the local implementation and actual synthetic-data app walkthrough.

- Live application: `417ae5e4ef2ebe42ed5ddc827e7405b9bf3532e7` at the [private-LAN app](http://192.168.50.209:5173/).
- Implementation commit: `326eebd2e13fac8b1cd63fd97de8823341101b26`; [PR #6](https://github.com/jbright471/Arcane-Ally/pull/6) merged into `automation/arcane-ally-live-baseline` after [client/build and server checks passed](https://github.com/jbright471/Arcane-Ally/actions/runs/39847945118).
- Previous live application: `7f1e525c565e587ff6d1a76fbb4f19bba04af41c`.
- Release owner: existing Bastet controller and `projects-stack`. No competing Compose stack, force push, or change to the separate `main` history.

## Delivered

- Rules Sage: named non-modal panel, scoped Escape/Close dismissal, launcher focus restoration, and retained drafts/messages.
- Battlemap: recognized server-projected broad health labels only when exact HP is absent, in token descriptions/titles and legend. No inferred hidden values, thresholds, or percentages.
- Arcane Codex: explicitly named search with search semantics and updated feature guidance.
- Legend help: existing popover primitive with keyboard/touch dismissal and neutral missing-data wording; no map writes.
- No server code, schema, dependency definition/lockfile, authentication/authorization policy, or access-grant change. Reveal overlay remains deferred.

## Release gates

- Local rerun: **80 client tests / 16 files** and **163 server tests / 27 files** passed. The server suite used a separate temporary SQLite database with scheduled jobs disabled; source database/sidecar hashes stayed unchanged.
- Client app/config type checks, production build, configured JS/JSX lint, and diff checks passed. Existing lint still excludes TS/TSX.
- Installed controller syntax and **23 path-policy cases** passed. Its unchanged SHA-256 is `83e226d1bb5fa1c75df4b7d5b05897f2130c4ade647085f5a805c0110ab92d01`; no scope expansion was needed.
- Controller plan accepted the exact GitHub baseline SHA. Production image build, copied-database staging preflight, REST matrix, migration-route class presence, audit redaction, and SQLite backup gates passed before service references changed.
- Compose comparison against the saved original matched only the expected app revision/image/frontend substitutions; no other service configuration changed.

## Production verification

Verified at approximately **16:24 Eastern** after deployment:

- Both containers were running with identical `417ae5e4ef2ebe42ed5ddc827e7405b9bf3532e7` labels, `projects-stack` ownership, and zero restarts. Backend health was healthy with `status: ok`; frontend returned HTTP 200.
- Dashboard, Party, DM gate, Battlemap handoff, Archive, and Guide passed at 1280 pixels; Dashboard, DM, and Archive also passed at 390 pixels. Every document navigation returned HTTP 200, socket bootstrap arrived and settled, and the three dock controls stayed in bounds without overlap, horizontal overflow, or covered end-of-page content.
- At **390/768/1280 pixels**, named Codex search filtered and cleared correctly. Rules Sage received opening focus, dismissed by Escape and pointer Close, restored launcher focus, retained an unsent draft, stayed in bounds, and did not intercept Escape outside its non-modal panel.
- Final release browser run recorded **zero page exceptions, console warnings/errors, failed requests, HTTP errors, and non-read HTTP requests**. The only observed outgoing application socket event was the existing read-only party refresh. No question, PIN, upload, effect, combat, map edit, or voice action was submitted.
- Two production screenshots were visually inspected and contain only static UI/an unsent test draft; footer contact text is masked: [Rules Sage mobile](assets/release-2026-10-22/rules-sage-mobile.png), [Codex mobile](assets/release-2026-10-22/codex-search-mobile.png).
- All 32 pre-existing dirty/untracked hardening files, its branch/HEAD/status, and the three source database/sidecar hashes match release preflight. Browser session closed after checks.

Production checks were unauthenticated and read-only. Player/DM health labels, hidden-stat boundaries, cast restrictions, legend interaction, retained answer messages, and malformed-snapshot recovery were exercised against the actual local client/server with synthetic data, not a production campaign. One synthetic rules answer was browser-stubbed; no real LLM answer quality or live multiplayer acceptance is claimed. See [implementation verification and six synthetic screenshots](PRODUCT_POLISH_VERIFICATION_2026-10-22.md).

## Outstanding security maintenance

- The build's automatic client install audit reported nine package advisories (five high/four moderate). This includes build/development dependencies; a new client production-only audit was not run.
- A separate `npm audit --omit=dev --json` in `server/` reported four vulnerable packages: one critical, two high, one moderate. Read-only inspection confirmed the affected versions in the deployed backend: `proxy-addr 2.0.7`, `engine.io 6.6.9`, `multer 2.2.0`, and `qs 6.15.3`.
- Critical: [proxy-addr IP-spoofing advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). High: [Engine.IO protocol-mismatch DoS](https://github.com/advisories/GHSA-2gc4-cqfq-p2gv) and Multer advisories, including [multipart field-name DoS](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm) and [oversized field-index DoS](https://github.com/advisories/GHSA-535w-7cp7-47q4). Moderate: [qs isBuffer DoS](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).
- Dependency definitions and lockfiles are identical to the previous application revision. No audit fix, upgrade, controller extension, or exploit test was performed. These audit findings do not establish exploitability in this app, and passing release tests does not establish security readiness. Prioritize a separately scoped dependency/security update; do not treat older audit counts as current.

## Backup and rollback

- Manifest: `/home/bastet/homelab/arcane-ally/backups/20261022T202259Z-417ae5e/manifest.json`.
- Current image: `sha256:5450d2611bef83846cbc6aa8690f1baad912f66c57ef3c448d486352426f3223`.
- Previous image: `sha256:ae41b108ec38ab5273e4f1fe0469e4c63c38d075b765ca421a1c879287e99f6f`.
- Independent read-only SQLite `quick_check` on `dnd.db` backup returned `ok`. Previous image, `releases/7f1e525/client`, and `docker-compose.yml.pre-7f1e525` backup were verified present.

```bash
ssh bastet@192.168.50.209 /home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh rollback 417ae5e4ef2ebe42ed5ddc827e7405b9bf3532e7
```

This restores the previous service references, not the database. Rollback was not executed. Retain the manifest, database backup, image, frontend tree, and Compose backup. See [deployment operations](DEPLOYMENT.md).

This receipt and its live screenshots are a documentation-only follow-up. A later documentation commit on GitHub is not another application deployment; the verified runtime SHA remains `417ae5e4ef2ebe42ed5ddc827e7405b9bf3532e7`.
