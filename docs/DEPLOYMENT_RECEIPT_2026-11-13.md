# November 13 product update — deployment receipt

- **Status:** Published, deployed through Bastet's existing controller, and verified November 13, 2026 Eastern.
- **Live application:** `aaeb9848e72f3f23266531bd1884d7c7362f5ace` at [Arcane Ally on Bastet](http://192.168.50.209:5173/).
- **Publication:** [PR #8](https://github.com/jbright471/Arcane-Ally/pull/8), implementation `f585e66245094be9ae199ae33607e6f1e3a205cb`, workflow correction `889f655e21b4bad33b25c5e2c6369a7cd8377e41`. Both jobs passed on that exact head in [run 43483719807](https://github.com/jbright471/Arcane-Ally/actions/runs/43483719807) before merge/deployment.
- **Previous live application:** `417ae5e4ef2ebe42ed5ddc827e7405b9bf3532e7`.
- **Owner:** Existing Bastet controller and shared `projects-stack`; only the two Arcane Ally services were recreated.

## Delivered

- Character-card keyboard event ownership, working read-only DM Inspector, local legend-to-token spotlight, and condition/PC-health lifecycle coverage.
- Current patched dependencies, bounded TypeScript lint, CI audit gates, isolated CI server database, lockfile-based backend image install, and exact deployment-policy additions.
- No schema or role-policy change. Existing projections and DM movement restrictions remain. Reveal, lighting, movement expansion and new integrations stay deferred.
- [Implementation/browser evidence](PRODUCT_UPDATE_VERIFICATION_2026-11-13.md), [dependency evidence](DEPENDENCY_MAINTENANCE_2026-11-13.md), and [lint scope](CLIENT_LINT_SCOPE.md) retain the detailed checks and limits.

## Gates completed

- Local final checks: **106 client tests / 18 files**, **180 server tests / 29 files**, app/config type checks, production build, scoped lint, and diff checks passed. Server tests used a fresh temporary database with scheduled jobs disabled before imports.
- Both package graphs returned zero current findings in full and production-only npm audits. GitHub independently passed client/server install and audit gates, client lint/tests/build, and server tests.
- An initial workflow validation error prevented jobs from starting because the runner temporary path was at job scope. Moving that expression to the server test-step environment fixed it; the successful exact-head run above is the release evidence.
- The controller candidate passed Bash syntax and **31 positive/negative path-policy cases** locally and again on Bastet. The installed script was backed up and hash-checked before atomic replacement.
- Installed controller SHA-256: `bb121decabec5185ffd603ba29fd95c553ee8a9d62d900742cbb2f763f4c77cf`.
- Retained controller backup: `/home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh.pre-product-update-20261113`, verified SHA-256 `83e226d1bb5fa1c75df4b7d5b05897f2130c4ade647085f5a805c0110ab92d01`.
- Linux staging rejected a Windows-line-ending working-copy upload before installation. The installed candidate was restaged from the exact LF Git blob and passed all checks; no controller gate was bypassed.
- Controller plan accepted the exact merged deployment-ref head. Bastet's production image build, copied-database preflight, migration-route class, REST access matrix, audit redaction and backup gates passed before service references switched.

## Production verification

- Both containers carry matching `aaeb9848e72f3f23266531bd1884d7c7362f5ace` revision labels, belong to `projects-stack`, are running and have zero restarts. Backend health is healthy; frontend has no Docker healthcheck status and was verified by HTTP/browser checks.
- Backend image: `sha256:c4e89f58f880ca941f2b05ed0995ba5bc2b71a8d8d956e0b21a1412934dfddcf`, tag `arcane-ally-backend:aaeb984`.
- Independent installed-package read-back confirmed Node 20.20.2, proxy-addr 2.0.8, Engine.IO 6.6.11, Multer 2.5.0, qs 6.17.1 and body-parser 2.4.0.
- Signed-out desktop Dashboard, Party, DM gate, Battlemap handoff, Archive and Guide, plus phone Dashboard/DM gate/Guide, all returned HTTP 200. Each established its socket connection; dock controls stayed in bounds without overlap or horizontal overflow. No authenticated party state was expected or received by the signed-out browser.
- At **390/768/1280 pixels**, Guide search narrowed 28 entries to one for `spotlight`, displayed the new Running Combat instructions, and restored all 28 after clearing. Rules Sage opened with Close focus and dismissed by Escape with launcher focus restored. No question was submitted.
- Final live browser checks recorded **zero page exceptions, console warnings/errors, HTTP errors, non-read API requests, or outgoing application socket events**. No PIN, import, effect, HP, combat, voice, token or map mutation was submitted to production. Browser closed afterward.
- [Live mobile spotlight guidance](assets/release-2026-11-13/guide-spotlight-mobile.png) contains static documentation only; footer and dock are masked and the final image was visually reviewed.
- Authenticated Inspector/card/spotlight/health acceptance remains the actual local synthetic client/server walkthrough and role-specific fixtures. These public production checks do not claim live multiplayer, screen-reader, importer, voice or AI acceptance, or a full security audit.

## Backup and rollback

- Manifest: `/home/bastet/homelab/arcane-ally/backups/20261113T183653Z-aaeb984/manifest.json`.
- Backup database: the same directory's `dnd.db`; independent SQLite `PRAGMA quick_check` returned `ok`, opened with `mode=ro&immutable=1`. No campaign rows were read for this verification.
- Retained previous image: `sha256:5450d2611bef83846cbc6aa8690f1baad912f66c57ef3c448d486352426f3223`.
- Retained previous frontend: `/home/bastet/homelab/arcane-ally/releases/417ae5e/client`.
- Retained Compose backup: `/home/bastet/homelab/arcane-ally/backups/20261113T183653Z-aaeb984/docker-compose.yml.pre-417ae5e`.
- Current Compose exactly matches that backup after the expected two full-revision and three short-revision substitutions. Its five changed lines are confined to the backend's three and frontend's two release references; all other content matches.

```bash
ssh bastet@192.168.50.209 /home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh rollback aaeb9848e72f3f23266531bd1884d7c7362f5ace
```

Rollback was not executed. It restores previous service references, not the database. Preserve the manifest, checked database backup, previous image/frontend and Compose backup. See [deployment operations](DEPLOYMENT.md).

This receipt and its screenshot are documentation-only follow-up. A later documentation HEAD is not a second application deployment; the verified runtime SHA remains `aaeb9848e72f3f23266531bd1884d7c7362f5ace`.
