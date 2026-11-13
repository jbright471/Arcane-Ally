# Documentation

## Current references

- [Application overview and setup](../README.md).
- [Client entry points and validation](../client/README.md).
- [Development checks and isolated server test databases](DEVELOPMENT.md).
- [REST access matrix and Character Inspector contract](REST_ACCESS_MATRIX.md).
- [Client lint coverage and CI boundaries](CLIENT_LINT_SCOPE.md).
- [Automation policies and combat history](AUTOMATION_AND_COMBAT_HISTORY.md).
- [Interactive rolls and visibility](PHASE_7.1_INTERACTIVE_ROLLS.md).
- [Autonomous change pilot scope](AUTONOMOUS_CHANGE_WORKFLOW.md) — one bounded tested PR per run; its worker cannot merge, deploy, add dependencies, migrate data, or change authorization. The original Agentic OS reviewer hook is historical and optional.
- [Deployment ownership, current runtime revision, and rollback](DEPLOYMENT.md).

Arcane Codex at `/guide` in the app contains your player and DM workflows. Use the deployment runbook for the current running revision. Markdown-only GitHub follow-ups do not change that revision; bundled Codex article changes require a client build and deployment.

## November 13 release evidence

- [Product implementation and acceptance](PRODUCT_UPDATE_VERIFICATION_2026-11-13.md).
- [Dependency maintenance and audit limits](DEPENDENCY_MAINTENANCE_2026-11-13.md).
- [Current Codex/documentation deployment receipt](DEPLOYMENT_RECEIPT_2026-11-13_CODEX.md).
- [Initial product deployment receipt](DEPLOYMENT_RECEIPT_2026-11-13.md).

## Release history

- October 22: [implementation verification](PRODUCT_POLISH_VERIFICATION_2026-10-22.md) and [deployment receipt](DEPLOYMENT_RECEIPT_2026-10-22.md).
- October 5: [implementation verification](PRODUCT_PLAN_VERIFICATION_2026-10-05.md) and [deployment receipt](DEPLOYMENT_RECEIPT_2026-10-05.md).
- September 17: [implementation verification](PRODUCT_PLAN_VERIFICATION_2026-09-17.md) and [deployment receipt](DEPLOYMENT_RECEIPT_2026-09-17.md).
- [R1-E architecture capsule](AGENTIC_OS_ARCHITECTURE.md) records the original authorization scope and September extension. It is historical; the current API contract and deployment state live in the references above.

Keep dated checks and release receipts as historical evidence. Their test counts, audit findings, and runtime SHAs describe their recorded dates.
