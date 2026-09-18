# Deployment operations

## Ownership and source

Bastet's existing controller owns release operations for the two Arcane Ally services inside the shared `projects-stack`. Do not launch a competing project-local Compose stack.

- GitHub: `https://github.com/jbright471/Arcane-Ally`
- Deployment ref: `refs/heads/automation/arcane-ally-live-baseline`
- Controller: `/home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh`
- Compose owner: `/home/bastet/homelab/projects/docker-compose.yml`
- Bare repository: `/home/bastet/homelab/arcane-ally/repository.git`
- Releases/backups: `/home/bastet/homelab/arcane-ally/{releases,backups}`
- Persistent database: `/home/bastet/DnD Project/data/dnd.db`
- Frontend: `http://192.168.50.209:5173/`
- Backend health on Bastet: `http://127.0.0.1:3002/api/health`

`main` has a separate history; do not overwrite it to publish this release. Preserve newer baseline commits, publish the reviewed implementation, then fast-forward the deployment ref. No force push is required.

## Release sequence

1. Review source/docs and run client tests, explicit type checks/build, configured lint, and server tests with an isolated database. Verify affected browser flows. Client lint currently excludes TS/TSX.
2. Commit and push the reviewed release; keep the local tree clean. Confirm GitHub and controller target the same full SHA.
3. Run `status`, then `plan <full-sha>` through the controller. The controller requires the exact deployment-ref head and a fast-forward descendant of the live revision.
4. Run `deploy <full-sha>`. It builds the production image, checks a staging copy of the campaign database, runs the existing REST/access preflight, and verifies a SQLite backup before changing the two service references.
5. Retain the backup manifest, previous image, previous frontend tree, and Compose backup. Verify both revision labels, backend health, frontend response, and affected live routes. Avoid campaign mutations for smoke checks.
6. Record the observed outcome and rollback path. If a controller gate rejects the candidate, resolve the cause within the authorized scope before retrying; never skip preflight/backup checks.

```bash
ssh bastet@192.168.50.209 /home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh status
ssh bastet@192.168.50.209 /home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh plan FULL_SHA
ssh bastet@192.168.50.209 /home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh deploy FULL_SHA
```

## Rollback

Pass the **currently deployed** full SHA, not the desired old SHA:

```bash
ssh bastet@192.168.50.209 /home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh rollback CURRENT_FULL_SHA
```

The controller finds the matching manifest and restores the previous Compose references/image/frontend. It verifies health and revision labels. It does not automatically restore the database. This product release has no schema or dependency changes. Preserve the checked database backup for operator-directed recovery if needed.

## September 17 release preparation

The user authorized documentation, GitHub publication, and deployment. Live status before release: `c16797482fec079795ca5f503f44d992c5ae5d7b`, both services running, backend healthy. GitHub's baseline also includes two newer workflow/documentation commits, which must be preserved.

The user explicitly approved extending the controller's client-only pilot allowlist on September 17. The product change additionally needs `client/package.json`, `client/vite.config.ts`, `server/server.js`, and `server/test/productionServerSecurity.test.js`; `client/README.md` is documentation. The tracked controller copy in `docs/deployment/arcane-ally-deploy.sh` adds only those named paths and preserves all existing revision, staging, backup, and rollback gates. Installation retains the original controller as a dated backup. This preparation record does not claim deployment success.

See [implementation verification](PRODUCT_PLAN_VERIFICATION_2026-09-17.md) for feature scope and evidence. A dated deployment receipt will record the published release and actual live result. Controller validation: `bash -n` and `python3 docs/deployment/test_release_policy.py` passed (15 path-policy cases).

### Build compatibility

The explicit client type check requires testing-library peer types. The Dockerfile client stage uses `npm ci`, matching GitHub; `--legacy-peer-deps` omits those peer packages and failed the first candidate image build before services changed. This is an install-command correction, not a dependency or lockfile upgrade. The additional Dockerfile controller scope is separately subject to user approval before installation.
