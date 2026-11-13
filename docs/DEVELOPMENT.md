# Development and validation

Use the reviewed `automation/arcane-ally-live-baseline` branch. Follow the [application setup](../README.md#quick-start) for host/container proxy configuration and the [client README](../client/README.md) for UI entry points. Bastet release operations remain in the [deployment runbook](DEPLOYMENT.md).

## Validation

Run the checks below from the repository root, with dependencies installed through `npm ci` in each package. These commands use synthetic server test data. Do not point test processes at a campaign database.

### Server checks

Some integration tests import the database singleton before replacing methods with an in-memory helper. Set both variables before starting the test process so that import cannot open `server/dnd.db` and scheduled jobs stay disabled.

PowerShell:

```powershell
$testDbDirectory = Join-Path ([IO.Path]::GetTempPath()) ('arcane-tests-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDbDirectory | Out-Null
$previousDbPath = $env:DB_PATH
$previousScheduledJobs = $env:DISABLE_SCHEDULED_JOBS
Push-Location server
try {
    $env:DB_PATH = Join-Path $testDbDirectory 'tests.db'
    $env:DISABLE_SCHEDULED_JOBS = 'true'
    npm test -- --maxWorkers=1
    if ($LASTEXITCODE -ne 0) { throw 'Server tests failed' }
    npm run lint
    if ($LASTEXITCODE -ne 0) { throw 'Server lint failed' }
    npm audit --omit=dev --audit-level=moderate
    if ($LASTEXITCODE -ne 0) { throw 'Server production dependency audit failed' }
    npm audit --audit-level=high
    if ($LASTEXITCODE -ne 0) { throw 'Server full dependency audit failed' }
} finally {
    $env:DB_PATH = $previousDbPath
    $env:DISABLE_SCHEDULED_JOBS = $previousScheduledJobs
    Pop-Location
}
```

Bash, from the repository root:

```bash
(
  set -e
  validation_directory="$(mktemp -d)"
  cd server
  DB_PATH="$validation_directory/tests.db" DISABLE_SCHEDULED_JOBS=true npm test -- --maxWorkers=1
  npm run lint
  npm audit --omit=dev --audit-level=moderate
  npm audit --audit-level=high
)
```

The test database stays in that temporary directory for inspection. The commands do not read production campaign data. A passing suite describes the code checked; use a new isolated directory for a later run.

### Client checks

From the repository root, enter `client/` and run:

```bash
cd client
npm test -- --maxWorkers=1
npm run lint -- --max-warnings=0
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=moderate
npm audit --audit-level=high
```

The build includes application and Node-config TypeScript checks. Lint covers JS/JSX and the ten reviewed TS/TSX files in [Client lint coverage](CLIENT_LINT_SCOPE.md); it is not application-wide TypeScript lint.

## CI and release checks

- `.github/workflows/automation-pilot.yml` runs client lint/tests/build and server tests on Node 20. Both jobs audit production dependencies at the moderate threshold and the full dependency graph at the high threshold, without automatic dependency fixes.
- The server job disables scheduled jobs. Its test step supplies a per-run temporary `DB_PATH`; runner-dependent expressions belong in step-level configuration.
- Use synthetic browser fixtures for authenticated DM/player/cast behavior, keyboard actions, source stats, role privacy, overlap, and zero-write checks. Component tests alone do not establish browser stacking or live multiplayer behavior.
- Client/server source checks, production-image checks, and Bastet staging/backup/health gates establish different outcomes. Follow the [deployment runbook](DEPLOYMENT.md) for an authorized rollout and preserve the [dated verification evidence](PRODUCT_UPDATE_VERIFICATION_2026-11-13.md).
