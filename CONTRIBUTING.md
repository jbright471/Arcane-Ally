# Contributing to Arcane Ally

Thank you for helping improve Arcane Ally. Keep changes focused, testable, and safe for public self-hosting.

## Development Setup

Use Node.js 20 or newer and install from the committed lockfiles.

```bash
cd server
npm ci
npm test
npm start
```

```bash
cd client
npm ci --legacy-peer-deps
npm run dev
```

The checked-in Vite proxy targets the container service `dnd-party-sync-backend:3001`. For host-only development, point both proxy targets in `client/vite.config.ts` to `http://localhost:3001`.

## Before Opening a Pull Request

Run:

```bash
cd server
npm test -- --maxWorkers=1
npm run lint
npm audit --audit-level=high
```

```bash
cd client
npm run lint
npm run build
npm audit --audit-level=high
```

Then verify the affected workflow in a browser at desktop and mobile width.

## Change Guidelines

- Follow existing React, Express, Socket.io, and rules-engine patterns.
- Keep base-sheet data separate from session-state mutations.
- Apply role-safe projections before broadcasting private combat state.
- Add focused tests for shared rules, policy boundaries, authentication, and data retention.
- Update the README, Arcane Codex, changelog, and relevant `docs/` file when behavior changes.
- Do not rewrite historical parser files under `files/` unless the task specifically concerns them.

## Privacy Checklist

Before committing, confirm that the diff does not contain:

- Real `.env` values, PINs, tokens, or API keys
- SQLite databases, journals, or backups
- Character PDFs or private exports
- Personal filesystem paths, LAN addresses, hostnames, or infrastructure names
- Private keys, certificates, or production Compose/Portainer configuration

Use generic placeholders in public examples.

## Commit and Pull Request Notes

- Explain the user-visible behavior and why the change is needed.
- List verification commands and any remaining test gaps.
- Call out migrations, changed defaults, security boundaries, or deployment impact.
- Keep unrelated refactors out of the same change.
