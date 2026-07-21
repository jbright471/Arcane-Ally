# Player Preview & Command Safety

## Preview the App as a Player

Player-State Preview helps a DM answer, "What can this player see right now?" without signing in as that player or changing campaign state.

1. Open **DM Dashboard** and enter the DM PIN.
2. Find the character in **God-Eye View**.
3. Click the **monitor icon** beside the character's notes icon.
4. Arcane Ally opens a separate tab with a permanent **Previewing as _Character_** banner.
5. Leave that tab open while troubleshooting. It updates as the campaign changes.

The preview works for connected and disconnected characters. It is read-only and shows the selected character's sheet, visible party summaries, encounter order, permitted monster health, relevant effects, current permissions, party notes, shared loot, and revealed maps.

Hidden monsters, undiscovered or DM-only markers, monster stat blocks, boss phases, private prep notes, pending imports, and DM controls are removed by the server before the snapshot is sent. They are not merely hidden with CSS.

Preview links expire after 15 minutes and bind to the first tab that opens them. Open a new preview from the DM Dashboard after expiration. The link token is stored in the URL fragment so normal HTTP request logs do not receive it.

## Why an Action Does Not Run Twice

Browsers and wireless connections sometimes resend a command when an acknowledgement is lost. Arcane Ally gives each protected action a command ID and stores the result in the same database transaction as the game-state change.

On the first delivery:

1. The server records the command ID and a fingerprint of its payload.
2. The rules mutation, timeline event, action log, and command result commit together.
3. The server acknowledges the command and broadcasts the new state.

On a retry with the same ID and payload, the server returns the stored result without changing state again. If the same ID is reused with different data, the server rejects it as a conflict.

The browser's offline HP queue keeps an entry until the server acknowledges it. A timeout leaves the entry queued; reconnecting resends the same ID. A permanent rules rejection is removed instead of retrying forever.

## Current Coverage

Transactional command receipts currently protect:

- damage, healing, and temporary HP
- spell-slot use and unified spell casting
- starting or dropping concentration
- applying or removing conditions
- single- and multi-target buffs
- hit-die use, short rests, and long rests
- party-loot claims and approval requests

Bulk effect application already uses per-target request IDs inside one transaction. Remaining legacy administrative and content-management socket routes will be migrated incrementally; documentation should not claim that every mutation is covered yet.

## Storage and Retention

- `processed_commands` stores command type, actor scope, payload hash, result, and commit time.
- `aggregate_versions` supports optional expected-version checks for conflicting edits.
- Committed receipts older than 30 days are pruned daily.
- A row cap retains the newest 50,000 receipts by default.

These tables contain operational command metadata and results, not DM credentials. They are part of the private runtime SQLite database and are excluded from the public repository.
