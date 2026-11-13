# November 13 Codex and documentation follow-up — deployment receipt

- **Status:** Committed, pushed, merged and deployed through Bastet's existing controller on November 13, 2026 Eastern.
- **Current live application:** `e7dfb5282130d55fe1633248633c52051ceda3ef` at [Arcane Ally](http://192.168.50.209:5173/).
- **Publication:** [PR #10](https://github.com/jbright471/Arcane-Ally/pull/10), head `f2dda8ae4d7262a531f756e57cbb2bbd52eb7374`; both jobs passed in [run 43489322217](https://github.com/jbright471/Arcane-Ally/actions/runs/43489322217) before merge/deployment.
- **Previous live application:** `aaeb9848e72f3f23266531bd1884d7c7362f5ace`. Its [product release receipt](DEPLOYMENT_RECEIPT_2026-11-13.md) retains the original feature/dependency acceptance.

## Updated documentation

- Arcane Codex explains card-root versus nested keyboard actions, DM Inspector values/source rows, snapshot retry, History and concentration-menu use. Existing spotlight guidance remains available.
- Hosting/AI articles match the configured AI/internet boundary, production PIN/origin checks, actual Vite proxy, PowerShell commands, lockfile installs, private service routing, healthcheck behavior and voice prerequisites.
- README, client README, REST Inspector contract, lint/CI guidance and pilot references match the implemented release. The new [documentation index](README.md) and [development guide](DEVELOPMENT.md) provide current entry points and isolated, fail-fast validation commands. Dated evidence remains historical.
- Only Markdown and Codex article content changed. No application logic, dependencies, schemas, roles or deployment-controller policy changed.

## Validation and rollout

- Existing Guide search test, application/config type checks, production build and configured server lint passed. Current changed-document links and diff checks passed.
- The PowerShell validation snippet's four simulated native failure positions stop later checks and restore environment/cwd. The Bash snippet passed syntax checking; no manual Bash server-test execution is claimed.
- Both GitHub jobs passed, including the configured audit, lint, test and build gates.
- Controller plan accepted the exact merged revision. Bastet image build, copied-database preflight, REST matrix, migration-route class, audit-redaction, backup and health gates passed before references switched.
- The controller remains SHA-256 `bb121decabec5185ffd603ba29fd95c553ee8a9d62d900742cbb2f763f4c77cf`, with all 31 previously verified policy cases unchanged.
- Both exact app containers carry `e7dfb5282130d55fe1633248633c52051ceda3ef`, belong to `projects-stack`, are running with zero restarts, and the backend is healthy. The frontend has no Docker health status; HTTP/browser checks verify it.
- Current backend image: `sha256:db6fb3978667c30162a1aebfdd02547377369105520635a8746c3085e9278783`.

## Live Codex acceptance

- At **390/768/1280 pixels**, Guide returned HTTP 200. Search discovered the new card/Inspector section, current hosting/AI guidance and retained spotlight instructions; clearing restored all 28 entries. No horizontal overflow was found.
- Final signed-out read-only checks recorded zero page exceptions, console warnings/errors, failed HTTP responses, non-read requests or outgoing application socket events. No credential, question, voice action or campaign mutation was submitted.
- [Mobile Codex section](assets/release-2026-11-13-codex/inspector-guidance-mobile.png) shows static documentation only; footer/dock are masked and the final image was visually reviewed. Browser closed afterward.
- This verifies documentation delivery and navigation, not a new authenticated gameplay, AI-quality, voice or security assessment. The earlier product verification retains those acceptance boundaries.

## Backup and rollback

- Manifest: `/home/bastet/homelab/arcane-ally/backups/20261113T191041Z-e7dfb52/manifest.json`.
- Its `dnd.db` passed independent `PRAGMA quick_check` opened with `mode=ro&immutable=1`; no campaign rows were read.
- Previous image retained: `sha256:c4e89f58f880ca941f2b05ed0995ba5bc2b71a8d8d956e0b21a1412934dfddcf`.
- Previous frontend retained: `/home/bastet/homelab/arcane-ally/releases/aaeb984/client`.
- Compose backup retained: `/home/bastet/homelab/arcane-ally/backups/20261113T191041Z-e7dfb52/docker-compose.yml.pre-aaeb984`.
- Current Compose equals that backup after exactly two full-SHA and three short-SHA substitutions, confined to five backend/frontend release-reference lines. Other content matches.

```bash
ssh bastet@192.168.50.209 /home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh rollback e7dfb5282130d55fe1633248633c52051ceda3ef
```

Rollback was not executed; it restores service references, not the database. See the [deployment runbook](DEPLOYMENT.md). This receipt is a Markdown/image follow-up and requires no additional application deployment.
