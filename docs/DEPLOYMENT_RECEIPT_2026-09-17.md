# September 17 product release — deployment receipt

Status: deployed and verified. Deployment completed September 17, 2026 Eastern time (September 18 UTC).

- Live release: `1a47b16297f6cae512dd61f59ee65686dc9d7270`.
- Previous release: `c16797482fec079795ca5f503f44d992c5ae5d7b`.
- GitHub: [product PR #2](https://github.com/jbright471/Arcane-Ally/pull/2), [production-build correction PR #3](https://github.com/jbright471/Arcane-Ally/pull/3). Both passed client/server CI. The final controller/documentation commit adds no application behavior.
- Application: `http://192.168.50.209:5173/`.
- Controller: existing Bastet controller, with explicitly approved server/build paths and Dockerfile scope. Hash: `96781762dc996c4967acc34c130840d493300b57318778e020cd491fb4b41867`.
- Controller backups: `deployment/arcane-ally-deploy.sh.pre-product-20260917` and `deployment/arcane-ally-deploy.sh.pre-buildfix-20260917`, under `/home/bastet/homelab/arcane-ally/`.

## Release checks

- Local: 34 client tests, 154 server tests, explicit application/config type checks, production build, and configured client/server lint passed. Client lint does not cover TS/TSX.
- Controller: Bash syntax and 16 path-policy checks passed; schema, authorization module, lockfiles, environment, database, and Compose-file paths remain blocked.
- Production image: built successfully after changing the client install to `npm ci`; no dependency manifests or lockfiles changed in that correction.
- Staging preflight: passed REST access matrix, audit redaction, and presence of the baseline route-class migration on a copied database.
- Live: frontend/backend revision labels both match the release; both running, backend healthy, restart count zero at verification. Proxied `/api/health` returned HTTP 200 with status `ok`.
- Browser: all five updated Codex section links rendered; unauthenticated Archive displayed DM sign-in with navigation intact. No page exceptions occurred during those checks. Authenticated note/cast/map workflows were verified against isolated fixtures in the implementation phase, not repeated against live campaign data.
- No manual live campaign changes or database restore were performed for verification. No schema migration was introduced by this release.

## Backup and rollback

Manifest: `/home/bastet/homelab/arcane-ally/backups/20260918T012350Z-1a47b16/manifest.json`.

The database backup passed an independent read-only SQLite `quick_check`. The matching Compose backup, prior backend image, and prior frontend release directory were verified present. Rollback itself was not executed.

```bash
ssh bastet@192.168.50.209 /home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh rollback 1a47b16297f6cae512dd61f59ee65686dc9d7270
```

This restores the previous service references through the controller, not the database. See [deployment operations](DEPLOYMENT.md).

## Remaining maintenance

Existing dependency advisories remain: client development tools have two high/two moderate advisories, while client production audit is clean; server production audit reports Multer high and qs moderate advisories. No remediation is claimed here. See [implementation verification](PRODUCT_PLAN_VERIFICATION_2026-09-17.md) for command results and deferred features.

This receipt is a documentation-only follow-up to the deployed SHA. A newer documentation commit on GitHub does not imply a second runtime deployment.
