# Arcane Ally — DnD Party Sync

A high-performance, self-hosted companion application for D&D 5e. Real-time party management, AI-powered content generation, and a full DM command center — all running on your local hardware.

## The Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Radix UI
- **Backend:** Node.js (Express), Socket.io (real-time sync), Better-SQLite3
- **AI Layer:** Local Ollama integration for PDF parsing, item stat extraction, homebrew generation, lore generation, and actionable entity creation
- **Deployment:** Docker & Docker Compose (optimized for Portainer)

## Core Features

### Real-Time Synchronization
Every HP change, condition, spell slot, buff, and dice roll broadcasts instantly to all connected clients. The one-way state pipeline ensures consistency:

```
Client emit → Server handler → DB mutation → broadcastPartyState() → All screens update
```

HP changes flash red (damage) or green (healing) on character cards. Latency is typically 50-100ms on local networks.

### Character Management
- **D&D Beyond Import** — paste a character URL to pull stats, equipment, spells, and inventory from the DDB API
- **PDF Import** — upload a character sheet PDF; the AI parser extracts stats, classes, abilities, and spells
- **Re-Sync** — pull latest changes from D&D Beyond without creating duplicates
- **Manual Creation** — build a character from scratch with full stat entry

### Interactive Character Sheets
- **Clickable Ability Scores** — click any stat to roll d20 + modifier, broadcast to the DM's Roll Feed
- **Skill & Save Proficiency Dots** — per-skill and per-save proficiency imported from D&D Beyond; dots show none / half / proficient / expertise with amber highlight for expertise
- **Weapon Actions** — click to roll attack (d20 + proficiency + ability mod) and damage simultaneously; weapon stats imported from D&D Beyond
- **Spell Casting** — one-click casting with automatic slot consumption, concentration tracking, and upcasting support
- **Dice Roll History** — collapsible per-character roll history card (last 30 rolls) showing type badge, label, and total
- **Condition Badges** — real-time condition display with DM-applied/removed states and duration countdown
- **Rest Management** — Short Rest (hit dice spending dialog) and Long Rest (full HP/slot/feature restoration)
- **Offline HP Queue** — HP changes made while offline are queued in IndexedDB and replayed automatically on reconnect

### Compendium & Homebrew Manager
- **Split-pane layout** with searchable entity index (left) and stat block inspector/editor (right)
- **Official SRD tab** — search the open5e API for 5e SRD monsters, spells, and magic items
- **Homebrew tab** — local database of custom entities
- **Clone to Homebrew** — copy any SRD entity to your homebrew library for editing
- **AI Generation** — describe a monster, spell, or item; the AI generates a full stat block matching the schema
- **Draft review** — AI-generated entities load as editable drafts; tweak the math before saving
- **Spawn to Combat** — click "Add to Combat Tracker" on any monster to auto-roll initiative and add to the tracker with full stat passthrough

### DM Command Center

**God-Eye View** — compact cards for every party member showing HP bars, AC, conditions, and quick +/-5 HP buttons.

**Initiative Tracker** — automatic initiative rolling (auto-roll d20 + DEX mod for all combatants), turn advancement, visibility toggles, HP tracking, and manual reordering. Three spawn methods: Quick Spawn, Compendium, and AI Lore Console.

- **AoE Multi-Target Effects** — select multiple combatants with checkboxes, then click the AoE button to open a multi-row effect builder (damage, heal, add/remove condition). All targets are resolved in a single DB transaction with a shared group ID for timeline correlation.
- **Quick Encounter Automations** — one-click "Dismiss Dead" removes all dead tracker entries; "Clear All Conditions" wipes conditions from every PC. Both accessible from the DM-only Quick Actions popover.

**AI Lore Console** — creative AI assistant with preset prompts (Room Desc, NPC Idea, Loot Drop, Combat). Generates atmospheric D&D content with **actionable response cards**:
- **Items** — "Send to Party Loot" instantly drops the item into the shared loot pool
- **Monsters** — "Add to Combat Tracker" spawns with auto-rolled initiative and full stats
- **NPCs** — "Save to Notes" stores the NPC in party notes

Buttons disable after use to prevent duplicate spawns.

**DMRollFeed** — aggregated live feed of all player dice rolls with filter toggles (ATK / DMG / SKILL / SAVE / INIT / HP / LOOT / PRIV).

**Encounter Builder** — pre-plan encounters with named monster groups, then start an encounter to spawn all monsters + PCs into the tracker at once.

**DM Prep Panel** — per-character and per-encounter sticky notes accessible from the God-Eye View.

### Party Loot Pool
- DM drops items from homebrew library, custom creation, or AI generation
- **Need / Greed / Pass voting** — DM can open a vote on any item; players vote and the server auto-resolves when all connected players have voted (need beats greed; random tiebreak within tier); DM can also force-resolve at any time
- Configurable permission modes: Open, DM Approval, Owner Only
- Real-time sync across all clients

### Audit Log & Event System
- **Effect Timeline** — immutable event store grouped by combat round, tracking damage, healing, conditions, buffs, rests, spell slots, and loot claims
- **Audit Log** — human-readable descriptions of every mutation with DM-accessible undo (event reversal)
- **Idempotency Guards** — every mutation carries a unique request ID; duplicate events from websocket reconnects are automatically deduplicated
- **Permission System** — configurable rules for loot claiming, cross-player effects, and inventory transfers

### Battlemap
- **Token Drag** — tokens represent PCs, monsters, and NPCs as percentage-positioned circles on the map; drag-and-drop with pointer capture API; positions sync to all clients via `move_token` socket
- **HP Overlays** — each token shows a live HP bar correlated from initiative state (green/amber/red)
- **DM Tools** — show/hide hidden tokens; "Sync from Initiative" spawns tokens for all active combatants

### World & Discovery
- **Interactive World Map** — shared overworld with DM-controlled markers and discovery points
- **Quest Tracker** — quest lifecycle management visible to the party
- **World Panel** — time of day, weather (AI-generated), and ambient state
- **Soundboard** — atmospheric audio effects

### Communication
- **WebRTC Voice Chat** — built-in voice communication with speaking indicators
- **DM Whisper** — private messages from DM to individual players
- **Party Notes** — shared notes with categories (lore, npc, quest, general)
- **Rules Assistant** — floating chat widget connected to the AI for rules lookups

### AI-Powered Features
- **Character PDF Parsing** — extract stats from uploaded character sheet PDFs
- **Item Description Parsing** — analyze item text to extract AC bonuses, damage, stat modifiers
- **Homebrew Generation** — AI creates full stat blocks for monsters, spells, and items
- **Actionable Lore** — AI responses include structured entity data with one-click game injection
- **Loot Generation** — context-aware item creation
- **Weather Generation** — atmospheric weather descriptions
- **Session Recap** — AI-generated session summaries from the action log

### Equipment System
- **Slot-based layout** — main hand, off hand, armor, ring, amulet, head, hands, feet
- **QuickEquipParser** — paste item text; AI extracts stats and creates the item
- **ManualItemForm** — full manual item creation with type, rarity, damage, AC, and stat bonuses
- **D&D Beyond sync** — equipment imported and slotted automatically

## App Guidebook

An in-app documentation hub at `/guide` with 17+ searchable guides covering Getting Started, Player Guide, and DM Guide. Includes a contextual `<HelpButton />` component for inline UI explanations.

## Self-Hosting

The project runs entirely on local hardware with no external cloud dependencies.

1. **Environment Config:**
   ```env
   OLLAMA_URL=http://your-ollama-host:11434
   ```

2. **Launch:**
   ```bash
   docker-compose up --build -d
   ```

3. **Access:**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3002`

## Project Structure

```
/client          React frontend (pages, components, hooks, types, lib)
/server          Node.js backend (routes, lib, socket handlers)
  /lib           Rules engine, effect engine, permissions
  /routes        REST API routes (characters, initiative, homebrew, etc.)
/data            SQLite database persistence
```

## API Surface

| Route Group | Endpoints | Purpose |
|---|---|---|
| `/api/characters` | 6 | CRUD, weapons, action log |
| `/api/characters/import` | 3 | DDB URL import, PDF import, re-sync |
| `/api/homebrew` | 7 | Compendium CRUD, AI generation, item assignment |
| `/api/initiative` | 4 | Encounter CRUD, tracker state |
| `/api/quests` | 3 | Quest lifecycle |
| `/api/maps` | 10 | Map CRUD, markers, overworld |
| `/api/npcs` | 4 | NPC CRUD |
| `/api/notes` | 3 | Party notes |
| `/api/dm-notes` | 3 | DM-only notes |
| `/api/automation` | 3 | Automation presets |
| `/api/world` | 3 | World state, time, weather |
| `/api/loot` | 3 | Loot generation, archive, assignment |
| `/api/lore` | 1 | AI lore generation |
| `/api/chat` | 1 | Rules assistant |

**70+ Socket.io real-time events** covering character state, combat, dice, loot, voting, world, voice, effects, automation, permissions, and battlemap tokens.
