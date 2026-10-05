# October 5 product release — deployment receipt

Status: published, deployed, and verified on October 5, 2026 Eastern time. The user authorized documentation, Arcane Codex, GitHub publication, and production deployment.

- Current application revision: `7f1e525c565e587ff6d1a76fbb4f19bba04af41c`.
- First October release: `ffa89aa9729339a5f63bd8ed02769fdc87b3a528`; the final revision adds the mobile sign-in correction discovered during production testing.
- Previous September application revision: `1a47b16297f6cae512dd61f59ee65686dc9d7270`.
- GitHub: [product and Codex PR #4](https://github.com/jbright471/Arcane-Ally/pull/4), [mobile sign-in correction PR #5](https://github.com/jbright471/Arcane-Ally/pull/5). Both merged after passing client tests/build and server tests: [PR #4 checks](https://github.com/jbright471/Arcane-Ally/actions/runs/37313888030), [PR #5 checks](https://github.com/jbright471/Arcane-Ally/actions/runs/37315139360).
- Application: [private-LAN app](http://192.168.50.209:5173/).
- Deployment owner: existing Bastet controller and `projects-stack`; no competing Compose stack was created.

## Delivered scope

- Fail-closed battlemap snapshot validation and a read-only fresh-snapshot recovery path.
- One responsive Effects/Rules/Voice dock with reserved page space.
- Explicit DM, character-companion, and read-only-cast handoff; browser-friendly DM PIN form semantics without changing the PIN-only request.
- AC and condition chips drawn only from server-projected fields.
- DM-only, bounded in-memory UVTT/DD2VTT preview returning a `persistence: none` receipt, not an imported or active map.
- Arcane Codex instructions for the dock, preview limits, role visibility, recovery, and the actual Voice controls.

No dependency, schema, authentication/authorization-policy, or network-control change was introduced. The reveal overlay remains deferred. Existing dependency advisories were not remediated by this release; the prior audit record is historical, not a new audit.

## Release and controller checks

- Local implementation: 57 client tests in 14 files, 163 server tests in 27 files, explicit client app/config type checks, production build, and configured linters passed. Client lint still excludes TS/TSX.
- Synthetic application walkthrough covered actual DM sign-in, malformed-state recovery, projected chips, UVTT upload with unchanged map/token/file counts, and dock geometry at 390/768/1280 pixels. See [implementation verification](PRODUCT_PLAN_VERIFICATION_2026-10-05.md).
- Controller scope was extended only for runtime files `server/routes/maps.js` and `server/lib/uvttPreview.js`, plus test-only files `server/test/uvttPreview.test.js` and `server/test/clientStateProjection.test.js`. Revision, staging, backup, health, and rollback gates remain unchanged.
- Installed controller SHA-256: `83e226d1bb5fa1c75df4b7d5b05897f2130c4ade647085f5a805c0110ab92d01`. Bash syntax and all 23 path-policy cases passed against the installed controller.
- Previous controller retained at `/home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh.pre-battlemap-20261005` (SHA-256 `96781762dc996c4967acc34c130840d493300b57318778e020cd491fb4b41867`).
- Both release plans were eligible, both production images built, and both staging preflights passed the REST matrix, audit redaction, and baseline route-class presence checks against copied databases.
- Both releases passed verified SQLite backup checks before changing the two service references.

## Final production checks

Verified again at approximately 09:22 Eastern on October 5:

- Frontend and backend are running with identical `7f1e525c565e587ff6d1a76fbb4f19bba04af41c` revision labels and zero restart counts. The backend is healthy; its health endpoint returns `status: ok`.
- At 390 by 844 pixels, `/battlemap`, `/dm`, `/archive`, and the Codex combat-management, common-problems, voice-chat, and UI-overview sections rendered the expected content, retained the main landmark, and had no horizontal overflow. Document navigations returned HTTP 200; subsequent guide fragments were same-document navigations.
- The final route matrix recorded zero page errors, console errors, console warnings, and failed requests.
- `/dm` and `/archive` were checked separately at widths 390, 768, and 1280: document width equaled viewport width, the visually hidden username occupied one pixel, and the PIN field remained visible.
- The first live mobile check found that inherited full-width styling on the hidden username widened the sign-in page. PR #5 corrects that styling without changing authentication behavior; the final production layout matrix passes.
- Privacy-safe screenshots were visually checked: [mobile Archive sign-in](assets/release-2026-10-05/mobile-archive.png), [mobile Battlemap handoff](assets/release-2026-10-05/mobile-battlemap.png).

Production checks were unauthenticated and read-only. No campaign/player content, credentials, or connection identifiers were retained in the screenshots. Authenticated recovery/chip/preview behavior was exercised against synthetic local data, not live campaign data. No manual live campaign mutation or database restore was performed.

## Backup and rollback

Final deployment manifest: `/home/bastet/homelab/arcane-ally/backups/20261005T131514Z-7f1e525/manifest.json`.

- Previous application: `ffa89aa9729339a5f63bd8ed02769fdc87b3a528`.
- Current backend image: `sha256:ae41b108ec38ab5273e4f1fe0469e4c63c38d075b765ca421a1c879287e99f6f`.
- Previous backend image: `sha256:c66926f162e6ef4a81547061d5d8d344d509f88008f5d9dd0a79d243214ac5a6`.
- The database backup passed an independent read-only SQLite `quick_check`; the previous image, frontend directory, and Compose backup were verified present.
- First October release manifest is also retained: `/home/bastet/homelab/arcane-ally/backups/20261005T130529Z-ffa89aa/manifest.json`, with the September revision as its previous release.

```bash
ssh bastet@192.168.50.209 /home/bastet/homelab/arcane-ally/deployment/arcane-ally-deploy.sh rollback 7f1e525c565e587ff6d1a76fbb4f19bba04af41c
```

This rolls the current service references back to the first October release, not the database. Rollback was not executed. See [deployment operations](DEPLOYMENT.md).

This receipt is a documentation-only follow-up to the deployed application SHA. A newer documentation commit on GitHub does not imply another runtime deployment.
