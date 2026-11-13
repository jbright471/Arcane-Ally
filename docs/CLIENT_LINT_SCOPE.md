# Client lint coverage

Your client lint check keeps the existing JS/JSX rules and adds TypeScript parsing and recommended correctness rules for this bounded set:

- `client/src/components/CharacterCard.tsx` and `CharacterCard.test.tsx`.
- `client/src/components/CombatStateInspectorModal.tsx` and `CombatStateInspectorModal.test.tsx`.
- `client/src/pages/BattleMap.tsx` and `BattleMap.test.tsx`.
- `client/src/lib/battleMapState.ts` and `battleMapState.test.ts`.
- `client/src/lib/dmFetch.ts` and `dmFetch.test.ts`.

CharacterCard and BattleMap also enforce Rules of Hooks and exhaustive hook dependencies. Other TS/TSX modules are not yet linted. Expand the explicit file list in `client/eslint.config.js` when you review another module; passing lint does not establish application-wide TypeScript lint coverage.

Existing payload and test-double `any` types remain permitted during this adoption. Unused bindings are checked, with underscore-prefixed parameters and uppercase/underscore-prefixed variables exempted. Deliberate empty catch blocks remain permitted for current parsing fallbacks. The recommended TypeScript rules otherwise remain enabled. This is syntax/correctness lint without type-aware rules; retain the separate TypeScript compiler checks.

From `client/`, run:

```powershell
npm run lint -- --max-warnings=0
npm run typecheck
npm test -- --maxWorkers=1
npm run build
```

Your pull-request workflow executes the lint check before client tests/build. Both client and server jobs also run read-only dependency audits after installation: production dependencies must have no moderate-or-higher findings, and the full dependency graph must have no high-or-higher findings. These checks report vulnerabilities; they do not automatically change dependencies.

Its server job sets a per-run database path under the runner's temporary directory and disables scheduled jobs before test imports, so the default source database is not opened by integration-test imports. Local server checks must likewise set a unique temporary `DB_PATH` and `DISABLE_SCHEDULED_JOBS=true` before launching the test process.

For lint-coverage verification, `npx --no-install eslint --print-config src/components/CharacterCard.tsx` must resolve the TypeScript parser and recommended rules. A temporary stdin TSX snippet containing a debugger statement must fail under that filename; `src/lib/battleMapState.ts` must also resolve the TypeScript configuration. Do not retain a deliberately invalid probe in source.
