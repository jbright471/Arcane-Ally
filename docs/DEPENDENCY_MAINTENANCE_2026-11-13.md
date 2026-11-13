# Dependency maintenance — November 13, 2026

- **Status:** Your local candidate has updated dependencies and passing checks below. Publication, target-host release gates, and production deployment remain pending.
- **Source:** `arcane-ally-update-20261113`, based on release-baseline commit `1e87eb4513d06bd6742617dc13373c1a06970b06`. These results do not change the running release.
- **Related evidence:** [Product update verification](PRODUCT_UPDATE_VERIFICATION_2026-11-13.md), [client lint scope](CLIENT_LINT_SCOPE.md), and [deployment procedure](DEPLOYMENT.md).

## Current audits

Your November 13 registry checks replace the older advisory counts repeated in the product briefs. These totals count npm-reported vulnerable packages, including dependency-chain effects; they are not counts of independent vulnerabilities or independent audits.

| Dependency graph | Before maintenance | Final candidate |
| --- | --- | --- |
| Client, full | 10 | 0 |
| Client, production only | 1 high, Zod | 0 |
| Server, full | 17 | 0 |
| Server, production only | 5: 1 critical, 3 high, 1 moderate | 0 |

- Full and production-only audits were run separately in both `client/` and `server/`: `npm audit --json` and `npm audit --omit=dev --json`.
- Zero findings means the registry returned no known findings for these candidate dependency graphs at this check. It does not establish application security or deployed-package state.

## What changed

| Candidate dependency | Resolved local version | Reason |
| --- | --- | --- |
| Server proxy-addr | 2.0.8 | Trusted-proxy subnet handling; retain the app's socket-derived source-address behavior. [Advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) |
| Server Engine.IO | 6.6.11 | Update the compatible Socket.IO dependency path; retain transport upgrade/reconnect behavior. [Advisory](https://github.com/advisories/GHSA-2gc4-cqfq-p2gv) |
| Server Multer | 2.5.0 | Includes fixes beyond the briefs' earlier 2.3.0 minimum, including asynchronous file-filter teardown. [Current advisory](https://github.com/advisories/GHSA-q7qp-rjg7-q26m) |
| Server qs | 6.17.1 | Includes the earlier isBuffer fix and newer comma-serialization/array-limit corrections. [isBuffer](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), [serialization](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), [array limit](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) |
| Server body-parser | 2.4.0 | Compressed-body teardown correction. [Upstream advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828) |
| Client Vite / Vitest | 7.3.8 / 4.1.12 | Patched tooling within the existing major versions. |
| Client typescript-eslint | 8.72.2 | Enables the bounded TypeScript lint adoption. |

- Removed unused direct client dependencies `zod` and `@hookform/resolvers` after finding no source references. The hooks linter's compatible development dependency resolves Zod 4.6.7, above the advisory's 4.6.6 patch. This avoids an unused production dependency and requires no application-schema migration. [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
- Scoped minimatch overrides resolve 11.0.8 only for client `@typescript-eslint/typescript-estree` and server ESLint/config-array/Nodemon. Client ESLint 9's minimatch 3.1.5 remains untouched. Version 11.0.8 also fixes the November 11 escape advisory; an earlier 11.x minimum would leave that finding. [Upstream advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-c859-jr93-m5j4)
- The Dockerfile backend stage now uses `npm ci --build-from-source --omit=dev`, preserving native Alpine compilation while installing from the reviewed lockfile.

## Verification and limits

- **Dependency regressions passed:** `server/test/dependencySecurity.test.js` has six bounded package/loopback fixtures: proxy trust, two qs cases, multipart acceptance/index rejection, compressed JSON/error recovery, and polling-to-WebSocket upgrade plus reconnect. Against the old libraries, four fail and two pass; all six pass with the candidate. Small synthetic payloads were used. These are package behavior tests, not production exploit tests; importer limits and authentication policy were not changed.
- **Server suite passed:** `npm test -- --maxWorkers=1` — 169 tests across 28 files, with a temporary database and scheduled jobs disabled before imports.
- **Final client lint/build passed:** `npm run lint -- --max-warnings=0` and `npm run build`; the build includes app/config TypeScript checks. The final scope includes Inspector and its test, for ten selected TS/TSX paths; see the [exact adoption scope and legacy exceptions](CLIENT_LINT_SCOPE.md). Configuration probes preserve JS rules, leave an outside TSX file excluded, and reject a controlled TSX debugger statement.
- **Minimatch compatibility passed:** Twenty brace/extglob/negation/dot/partial/case/Windows/globstar cases pass for each of the four overridden consumers and for the installed 10.2.4 comparison baseline. Real TypeScript parser default-project matching passes on synthetic TSX; real server ESLint configuration rejects an unused binding; Nodemon's watch/ignore matching and a temporary child's start/clean exit pass. No application server or database was used for these tooling checks. Major 11 changes the matching engine and older RegExp APIs; these checks support the inspected consumers, not universal compatibility. [Upstream v11 API/source](https://raw.githubusercontent.com/isaacs/minimatch/v11.0.8/src/index.ts)
- **CI configuration checked locally:** Both jobs audit production dependencies at the moderate threshold and the full graph at the high threshold, without automatic fixes. Client lint precedes tests/build. Server tests receive a per-run database under `runner.temp` and disabled scheduled jobs. Workflow YAML assertions pass; no new GitHub run is claimed.
- **Release-policy candidate passed:** Syntax and all 31 classification cases pass. Exact dependency/Inspector paths trigger runtime rebuilds; the selected lint config and test files are non-runtime changes. Adjacent unreviewed files remain blocked. Target-host installation belongs to the authorized release sequence.
- **Final Node 20 Alpine image passed:** After one bounded restart of the local Docker engine, the final combined image built and its actual runtime package versions, non-root user, native SQLite binding, API health and packaged healthcheck passed. Disposable containers had no mounts and were removed. See the product verification for image identity and scope.

## Release boundary

- This work is dependency maintenance with focused regression checks, not a full application security audit or penetration test. Advisory applicability depends on actual configuration; for example, the newer Multer advisory requires an asynchronous file filter.
- Before a release, publish the reviewed exact candidate, complete any separately authorized controller installation, then run the existing target-host plan, copied-database preflight, verified backup, image/runtime checks, health/revision checks, and rollback-record steps. Keep all existing gates.
- No production deployment or target-host controller installation was performed. Use the [product update verification](PRODUCT_UPDATE_VERIFICATION_2026-11-13.md) for the broader product/browser acceptance and remaining release work.
