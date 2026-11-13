# Autonomous Change Workflow Pilot

## Purpose

Use `origin/automation/arcane-ally-live-baseline` as the review base for the scheduled Arcane Ally implementation pilot. The pilot began from the application deployed on Bastet on 2026-08-29; later reviewed releases advance that branch. Resolve its current exact SHA and compare the running application through the [deployment runbook](DEPLOYMENT.md). GitHub `main` has a separate history; reconciling it is outside this pilot.

The pilot may turn one evidence-backed product-brief item into a tested GitHub pull request. It may not merge, deploy, modify live campaign data, or change the baseline branch directly.

## Authority boundary

The scheduled worker may:

- Read the latest dated brief under the separate product-brief checkout.
- Select exactly one bounded, reproducible defect or low/medium-complexity improvement.
- Create one disposable Git worktree and an `automation/arcane-ally-YYYYMMDD-<slug>` branch from `origin/automation/arcane-ally-live-baseline`.
- Add or change narrowly related source, tests, and durable documentation.
- Add a failing test that reproduces the selected defect before implementing the fix, and treat that failure as an expected intermediate state rather than a stop condition. See **Test sequencing**.
- Run repository tests and builds in the disposable worktree.
- Reclaim or prune a disposable worktree and branch left behind by an earlier run that has no open pull request. A leftover worktree is not by itself a reason to stop.
- Commit, push the new branch, and open a pull request against `automation/arcane-ally-live-baseline`.
- Remove its disposable worktree and local branch at the end of every run, whether the run opened a pull request or stopped early.

The scheduled worker must not:

- Push to, merge into, rebase, reset, or force-update `main`, the live baseline, or a release branch.
- Deploy, restart, or reconfigure Bastet, Docker, the LAN application, Tailscale, n8n, the NAS, or any other service.
- Read or modify live databases, campaign state, uploads, environment files, credentials, private keys, or deployment configuration.
- Add dependencies, perform schema/data migrations, change authentication/authorization, or broaden network exposure.
- Combine more than one product outcome in a run.
- Continue when the base is dirty, the latest brief is stale, another pilot pull request is open, or the requested behavior is ambiguous.
- Continue when the pre-existing suite fails at preflight, or when tests cannot be run safely.
- Commit, push, or open a pull request while any test is failing, including its own reproduction test.

## Test sequencing

Fixing a defect necessarily produces a failing test before it produces a passing one. The stop conditions above are therefore evaluated against the **pre-existing** suite, never against the reproduction test the worker has just written.

1. **Preflight.** Run the existing suite unchanged, before selecting or writing anything. If it fails here, the baseline itself is broken: stop, report, and select no item.
2. **Red.** Add the reproduction test for the selected item. It is expected to fail, and that failure is the evidence the item is real. Record the result and continue.
3. **Green.** Implement the narrowest fix that satisfies the brief item. Re-run the full suite.
4. **Gate.** Commit, push, and open the pull request only once the full suite passes, including the new test.

For server preflight and regression checks, set a unique temporary `DB_PATH` and `DISABLE_SCHEDULED_JOBS=true` before any test imports the database. Use the [safe development commands](DEVELOPMENT.md#server-checks); an in-memory helper alone does not prevent opening the default database during module import.

If the fix cannot be made to pass within the declared scope, discard the branch and report the reproduction test and the blocking reason as the run's output, so the next run starts from evidence rather than repeating the analysis.

Stopping at step 2 is not a safe failure. It leaves the defect proven and unfixed, with no pull request, no committed test, and no record of the attempt. Step 4 is the only point at which a failing test ends the run.

## Review and evidence

Before editing, the worker creates a bounded R1 task description. The original pilot's Agentic OS Gemini reviewer hook is historical and optional; it does not require restoring that stack or imply that a reviewer is currently available. Reviewer advice cannot approve or execute work. Codex remains responsible for repository inspection, implementation, diff review, tests, and the final stop/proceed decision.

Every pull request must include:

- The selected brief and evidence.
- The exact baseline commit.
- Scope and files changed.
- Tests and builds run with results, including the reproduction test's failure before the fix and its pass after.
- Security, privacy, data, and deployment impact.
- Rollback instructions.
- Any missing verification or reason the change should not be merged yet.

A run that stops before opening a pull request must still write a dated run record naming the selected item, the step it stopped at, and the blocking reason.

GitHub Actions repeats client lint/tests/build, server tests, and production/full dependency audit gates. Server tests use an isolated temporary database with scheduled jobs disabled. Client TypeScript lint has the [documented incremental scope](CLIENT_LINT_SCOPE.md). During the pilot, a human reviews and merges the pull request and deployment remains a separate manual operation. The separately authorized November maintenance release does not broaden the pilot's dependency, authorization, or deployment permissions.

## Promotion criteria

Do not consider automatic merging until at least two consecutive pilot pull requests:

1. stayed within the declared scope;
2. passed local and GitHub checks;
3. required no corrective follow-up for security, data, or deployment behavior; and
4. were manually reviewed and merged without rollback.

Automatic deployment requires a separate design, tested backup/rollback path, Bastet health gates, and post-deployment observation window. It is not part of this pilot.
