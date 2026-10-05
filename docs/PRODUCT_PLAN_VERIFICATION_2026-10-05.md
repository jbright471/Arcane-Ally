# October battlemap plan — local implementation verification

Status: implemented and verified in an isolated local application. This branch has not been pushed, merged, or deployed, and the live Bastet application was not changed.

## Baseline and scope

- Implementation branch: `implementation/product-briefs-20261004` in `arcane-ally-product-20260917`.
- Starting revision: `03e07bfe1a61e5b531bc0a6498464501a204e78b`; its application code matches the deployed `1a47b16297f6cae512dd61f59ee65686dc9d7270` revision.
- The dirty `arcane-ally-hardening` checkout was used only for the approved plan and remained outside the implementation source.
- No package manifest, lockfile, schema, authentication/authorization policy, deployment controller, service, or network setting changed.
- The session-only reveal overlay remains deferred because it adds a new authorized realtime mutation and needs its own review.

## Delivered

- A pure battlemap-state parser validates map and token identifiers, bounded labels/resources, token collections, unique IDs, entity types, hidden flags, and finite 0–100 coordinates. Invalid snapshots render a bounded recovery state; requesting a fresh snapshot never emits token synchronization or movement.
- Effects, Rules, and Voice share one fixed table-tools dock. The shell reserves safe-area-aware space beneath content.
- Battlemap explicitly identifies DM control, character-scoped companion, and read-only cast access. The DM form supplies browser password-manager semantics while the login request remains PIN-only.
- Battlemap AC and condition chips use only fields present in the server-projected initiative entry. Missing or withheld fields render no fallback value.
- `POST /api/maps/uvtt/preview` accepts one bounded in-memory UVTT/DD2VTT upload, validates its embedded PNG and geometry, and returns a deterministic `persistence: none` receipt. It does not save or activate a map.

## Automated checks

| Check | Result |
|---|---|
| Client `npm test -- --run` | Passed: 57 tests in 14 files |
| Server `npm test` | Passed: 163 tests in 27 files |
| Client `npm run typecheck` | Passed |
| Client `npm run build` | Passed: explicit type checks and production Vite build |
| Client `npm run lint` | Passed |
| Server `npm run lint` | Passed |
| Focused production security integration | Passed: unauthenticated preview denied; authenticated preview wrote no map row, token row, or file |
| `git diff --check` | Passed; line-ending notices only |

Coverage includes malformed and valid realtime snapshots, duplicate IDs, coordinate limits, recovery behavior, role-field omission, mobile dock structure, access-mode copy, PIN request shape, valid/malformed/oversized UVTT data, upload authorization, and zero-write persistence assertions.

## Isolated application test

The real client and server were started against a synthetic temporary SQLite database and a generated UVTT fixture. No live campaign data or service was used.

- Public Battlemap displayed distinct DM, companion, and cast handoff choices without credentials.
- DM sign-in succeeded through the actual form, submitted only the PIN, and produced no browser console warning or error.
- An intentionally invalid token coordinate produced the safe recovery state. After correcting only the synthetic fixture, requesting a fresh snapshot rendered the map without a write event.
- The projected synthetic PC and monster displayed permitted AC and condition chips.
- Uploading the synthetic UVTT through the browser returned its dimensions and geometry counts plus the explicit no-persistence receipt. Map count, token count, active-map identity, and map-file count remained unchanged.
- At 390, 768, and 1280 pixels, the three 48-pixel dock controls had no pairwise overlap, stayed inside the viewport, and cleared the final page content. The expanded Voice panel remained inside the mobile viewport above the dock.
- Final browser console result: zero warnings and zero errors. The preview request returned HTTP 200.

## Remaining gate

- This evidence establishes a local release candidate, not a live deployment.
- Before deployment, publish and review the candidate commit, run the deployment controller in plan mode, confirm the allowed file scope, and obtain explicit approval for the live change.
- The reveal overlay remains a separate follow-on; it is not part of this candidate.
