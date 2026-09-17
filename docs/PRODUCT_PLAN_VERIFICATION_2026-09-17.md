# September product plan — local implementation verification

Status: implementation locally verified; documentation and release preparation authorized. Deployment receipts are tracked in [deployment operations](DEPLOYMENT.md).

## Delivered

- Archive page and modal share validated loading, empty, access, failure, retry, cancellation, and private-state clearing behavior. Route failures leave navigation available.
- Explicit application and build-config TypeScript checks are now part of production/mobile builds. The 37 reproduced baseline errors were repaired without disabling checks.
- Sidebar CSS-variable widths work with the installed Tailwind version. The shell reserves space for floating controls, the Guide adapts to tablet/mobile widths, and Party/DM controls wrap. DM dashboard columns reflow to keep utility panels usable.
- Private prep supports keyboard-selectable `@` references stored by note ID, cross-context navigation, renamed/missing targets, draft retention between notes, safe text previews, and clear save failures.
- World-map markers open context-specific private prep. DM editing follows the actual session rather than a local role switch.
- Battlemap uses a shared read-only encounter board when no map is active. The cast surface uses the same presentation with its existing server-projected audience data.
- Authorized bootstrap includes a read-only map snapshot; opening Battlemap no longer runs token synchronization. Map activation/deactivation and reconnect are handled explicitly.
- First-session guidance opens automatically only after an authenticated DM receives an empty party snapshot. It can be dismissed/reopened and links to existing routes and a routable Guide section.
- Cast/companion bootstrap does not inherit a stored DM session. Session expiry clears private state and reconnects the socket without DM authority.

## Important correction to the planning analysis

The baseline already installs `apiCredentialBoundary.ts` globally from `main.tsx`. Individual callers lacking explicit headers were **not** proof of an authentication defect. The implementation reuses that same credential construction through `withApiCredential`; `dmFetch` adds bounded session-expiry handling. No new credential format, permission policy, or audience policy was introduced.

The sidebar problem was confirmed as obsolete CSS-variable width syntax, not a missing per-page padding adjustment.

## Baseline and preservation

- Started from clean revision `c16797482fec079795ca5f503f44d992c5ae5d7b` on a new `implementation/product-plan-20260917` worktree.
- Bastet's documented controller reported the same revision, running frontend, and healthy backend before implementation. No deployment command was run.
- The separate reports/development checkout and the conflicted September 5 integration were preserved. Small, reviewed type repairs were adapted from that earlier work; transaction/cascade/UVTT integration was not copied wholesale.
- No schema or dependency changes. The Vite development proxy accepts `ARCANE_BACKEND_URL` for isolated local verification; its default container target is unchanged.

## Checks

| Check | Result |
|---|---|
| Client `npm test` | Passed: 34 tests in 10 files |
| Client `npm run typecheck` | Passed: explicit `tsconfig.app.json` and `tsconfig.node.json` |
| Client `npm run build` | Passed: explicit type checks followed by production Vite build |
| Client `npm run lint` | Passed, but existing ESLint configuration covers JS/JSX only; TS/TSX lint is not configured |
| Server `npm test` with `DB_PATH=:memory:` and scheduled jobs disabled | Passed: 154 tests in 26 files |
| Server `npm run lint` | Passed |
| `git diff --check` | Passed |

Server integration tests start the actual application against temporary SQLite databases. The added integration case proves that map snapshots/reconnect do not modify map tokens, player snapshots remove hidden tokens, public/cast audiences do not receive map payloads, marker-linked notes remain separate, and private prep events do not enter player/public/cast delivery.

Client coverage includes malformed/failed/expired Archive requests, abort, retry, access-loss clearing, modal reopening, shell survival, external credential boundaries, stale-session responses, note references, retained drafts and rejected saves, withheld health, hidden actors, bootstrap ordering, reconnect recovery, audience bootstrap, and role-appropriate onboarding.

## Browser verification

Used a separate local frontend/backend and a synthetic temporary database. No live campaign writes, imports, combat actions, or authenticated live inspection were performed.

- Archive sign-in, valid empty state, expired token clearing, and sign-in recovery passed.
- Created two fixture notes, selected a reference with the keyboard, saved it, and followed the reference in the panel.
- Created marker-linked prep for one fixture marker; the second marker retained its separate empty view.
- Verified mapless-to-active-map-to-mapless transitions and fresh state after socket reconnect.
- Created a cast link through the DM UI, opened it in another tab sharing browser storage, confirmed no DM-history request, and verified revocation removes the board.
- Populated cast view omitted the hidden fixture monster and exact monster HP. The DM board retained its permitted information.
- Onboarding appeared for the settled empty DM fixture and stayed suppressed after adding a character.
- Dashboard, Party, Battlemap, Archive, and Guide were checked at 390, 768, 1024, 1280, and 1440 widths. Additional authenticated checks exposed DM toolbar/utility-panel overflow and a cramped Guide tablet layout. After correcting those layouts, all affected widths passed without document/content overflow; DM was additionally checked at 1536 and 1920 pixels. Floating controls remained below content. Expanded/collapsed desktop sidebar and mobile Escape dismissal were exercised.
- No page exceptions occurred during the route matrix. Expected authorization failures were exercised separately and are not presented as zero-network-error runs.

Privacy-reviewed screenshots are retained in the local product-briefs evidence folder, outside this release tree. They contain synthetic fixture names only. The scene-marker fixture intentionally has no image asset; this verifies linkage and access, not new map-image upload/rendering behavior.

## Limits and next gate

- The three implementation phases are delivered. Release publication and deployment are separately recorded in the deployment receipt; local tests alone do not establish live state.
- Automated lint does not cover TypeScript; explicit type checks, regression tests, browser verification, and local diff review were used. No new lint dependency was installed.
- Draft retention is in-memory within the open prep panel, not offline storage or collaborative conflict resolution. Closing with unsaved edits requires a discard decision.
- Advanced player preview, collaborative party notes, replay integration, import receipts, UVTT/lighting, and cascades remain the explicitly deferred backlog.
- No live migration or restore was run because there is no schema change and no deployment in this task.

## Publication recheck — September 17

After the Codex/documentation refresh, client `npm test -- --maxWorkers=1` passed 34 tests; server ran the same command with `DB_PATH=:memory:` and scheduled jobs disabled, passing 154 tests. Client production build (including both TypeScript projects) and configured client/server lint passed.

Dependency audit is **not clean**: client `npm audit --audit-level=high` reports two high and two moderate development-tool advisories; `npm audit --omit=dev --audit-level=high` passes with zero advisories. Server production audit reports one high (Multer) and one moderate (qs). Both lockfiles are unchanged from the deployed baseline; no dependency remediation is claimed in this release. Track these as separate maintenance work. These findings do not change the application's access policy or network exposure.

Codex browser recheck: all five updated section deep links loaded without page exceptions, and the prep guide fit at 390px. This docs-only preview had no running backend, so expected socket connection errors are not counted as application exceptions. The candidate deployment controller passed `bash -n` and 15 policy checks, including blocked schema/auth/lockfile/environment/infrastructure paths.
