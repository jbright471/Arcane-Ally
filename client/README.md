# Arcane Ally Client

React/Vite frontend for Arcane Ally, the player and DM-facing tabletop companion UI.

## Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS v4
- shadcn/ui + Radix UI primitives
- Socket.io client for real-time party state
- TanStack Query for server-backed data flows

## Common Commands

```bash
npm ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

The Vite dev server runs on `http://localhost:5173` by default. Its default proxy target is `http://backend:3001` for container development. For a host backend, set `ARCANE_BACKEND_URL=http://localhost:3001` (PowerShell: `$env:ARCANE_BACKEND_URL="http://localhost:3001"`) before `npm run dev`. Both REST and Socket.io use this target.

## App Entry Points

- `src/App.tsx` - route layout, socket toasts, pending save/secret roll listeners
- `src/context/GameContext.tsx` - shared party state normalization and resource permissions
- `src/pages/CharacterSheet.tsx` - primary character sheet experience
- `src/pages/DmDashboard.tsx` - DM command center
- `src/pages/AppGuidebook.tsx` - in-app documentation hub
- `src/components/DiceRoller.tsx` - global/embedded dice tray with visibility controls
- `src/components/RollableStat.tsx` - clickable ability, save, skill, and initiative rolls
- `src/components/DMRollFeed.tsx` - DM roll stream with non-public visibility grouping
- `src/components/DmAutomationPanel.tsx` - group effects, save requests, presets, auras, and campaign automation policies
- `src/components/EffectTimeline.tsx` - active and archived encounter history, filtering, pagination, export, and reversal controls

## September product surfaces

- `ArchiveContent.tsx` validates responses and handles loading, empty, retry, expired access, cancellation, and private-state clearing for the page and modal.
- `DmPrepPanel.tsx` and `PrepReferences.tsx` provide private note search, stable ID references, marker contexts, and in-panel drafts. They do not provide offline or collaborative editing.
- `EncounterBoard.tsx` provides shared read-only presentation for mapless Battlemap and cast; server audience projection remains authoritative.
- `FirstSessionChecklist.tsx` waits for confirmed DM and party readiness before automatic opening.
- `GameContext.tsx` tracks connection/domain readiness and consumes read-only map bootstrap; cast/companion paths do not inherit stored DM bootstrap.
- `dmFetch.ts` reuses the global credential boundary and handles current-session expiry. It does not introduce a new authentication scheme.
- `AppGuidebook.tsx` owns Arcane Codex content; `/guide#dm-prep-tools`, `/guide#combat-management`, and `/guide#welcome` are direct section links.

## Roll Visibility

The client supports four roll modes:

| Mode | Who sees the full result? | Player feedback |
|---|---|---|
| Public | Everyone | Full result |
| Private | DM and rolling player | Full result |
| Secret | DM only | Masked "Fate sealed" acknowledgement |
| Super-secret | DM only | No acknowledgement |

Secret and super-secret rolls use the `server_dice_roll` socket event so the result is generated on the backend and never exposed in the browser before routing.

## Automation Policies

DMs configure campaign behavior from **DM Dashboard -> Automation -> Policies**. The panel reads and updates `/api/automation/rules`; changes save immediately and existing behavior remains enabled by default.

Policies cover zero-HP unconscious handling, recovery cleanup, concentration cleanup and check mode, condition duration ticks, initiative synchronization, turn triggers, auras, and curated reactive item handlers.

## Combat History

`EffectTimeline.tsx` shows the active combat session by default. When combat ends, the server archives that encounter and the timeline selector exposes it as a read-only history view. Archived events remain searchable and exportable; destructive clear and reversal actions stay scoped to the current timeline.

Timeline requests accept `sessionId`, `beforeId`, `limit`, `targetId`, and `eventType` query parameters. The timeline browser loads 200 events per page and prepends earlier pages on request; Markdown export retrieves the complete selected history in batches of 500.

## Mobile Builds

Capacitor helpers are available for future mobile packaging:

```bash
npm run build:mobile
npm run cap:sync
npm run cap:android
npm run cap:ios
```

## Validation

Before publishing frontend changes, run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=high
```

`build` and `build:mobile` include explicit app and Node-config type checks. The existing lint configuration covers JS/JSX only; TS/TSX lint is not configured. See [release verification](../docs/PRODUCT_PLAN_VERIFICATION_2026-09-17.md) and [deployment operations](../docs/DEPLOYMENT.md).
