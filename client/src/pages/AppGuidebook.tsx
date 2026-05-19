/**
 * AppGuidebook — the master documentation hub for Arcane Ally.
 * Split-pane layout: sidebar navigation on the left, content on the right.
 * Dark-fantasy themed, searchable, with sections for Getting Started,
 * Player Guide, and DM Guide.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import {
  BookOpen, Search, Scroll, Swords, Eye, Shield, Heart, Sparkles,
  Dices, Moon, Sun, Gem, Users, Zap, Map, HelpCircle, ChevronRight,
  Mic, Globe, Package, ClipboardList, Compass, ArrowLeft, Smartphone, History,
} from 'lucide-react';

// ── Guide content data ───────────────────────────────────────────────────

interface GuideSection {
  id: string;
  title: string;
  category: 'getting-started' | 'player' | 'dm';
  icon: typeof BookOpen;
  content: string;
}

const GUIDE_SECTIONS: GuideSection[] = [
  // ── Getting Started ────────────────────────────────────────────────
  {
    id: 'welcome',
    title: 'Welcome to Arcane Ally',
    category: 'getting-started',
    icon: BookOpen,
    content: `# Welcome to Arcane Ally

Arcane Ally is a **real-time D&D 5e party management tool** that connects players and Dungeon Masters through a shared, live game state. Every HP change, condition, spell slot, and loot drop syncs instantly across all connected devices.

## What Makes This Different

Unlike static character sheets, Arcane Ally is **event-driven**. When the DM deals damage, your HP bar drops in real-time. When you cast a spell, your slot is consumed and the DM sees it on their timeline. Everything flows through a single pipeline:

> **Your Action** → Server → Broadcast → Every Screen Updates

## Core Concepts

- **Characters** are imported from D&D Beyond or created manually
- **Session State** tracks HP, conditions, spell slots, and hit dice separately from the base character — so your sheet stays clean between sessions
- **The Effect Timeline** is an immutable audit log of every game event — damage, healing, conditions, rests, and more
- **The Compendium** is your homebrew library plus a searchable gateway to the entire 5e SRD — monsters, spells, and items at your fingertips
- **Actionable AI** — the AI Lore Console generates items, monsters, and NPCs with interactive buttons to inject them directly into the live game state
- **Voice Chat** — built-in WebRTC voice communication, no external apps needed
- **Idempotency Guards** — every mutation carries a unique request ID, preventing duplicate events from websocket reconnects

## Quick Start

1. **Import your character** — paste your D&D Beyond URL or upload a PDF
2. **Join the party** — navigate to the Party Lobby to see everyone
3. **Open your sheet** — click your character card to access the full interactive sheet
4. **Roll dice** — click any ability score, saving throw, or weapon to roll instantly
5. **Use the Guide** — look for the small **?** icons next to UI elements for contextual help`,
  },
  {
    id: 'importing',
    title: 'Importing Characters',
    category: 'getting-started',
    icon: Users,
    content: `# Importing Characters

Arcane Ally supports two import methods: **D&D Beyond URL** and **PDF Upload**.

## D&D Beyond Import

1. Navigate to **Import DDB** from the sidebar
2. Paste your full D&D Beyond character URL (e.g. \`https://www.dndbeyond.com/characters/12345678\`)
3. Click **Import** — the app will fetch your character data directly from D&D Beyond's API
4. Your ability scores, equipment, spells, and inventory are all imported automatically

> **Tip:** Make sure your character is set to **Public** on D&D Beyond, otherwise the API will return an error.

## PDF Import

1. Navigate to **Import DDB** and switch to the **PDF** tab
2. Upload your exported character sheet PDF
3. The AI parser (powered by Ollama) will extract your stats, class, level, and abilities
4. Review the parsed data and confirm

> **Note:** PDF parsing uses AI and may not be 100% accurate for heavily customized sheets. Always double-check the imported values.

## Re-Syncing

Already imported but leveled up on D&D Beyond? Open your character sheet and click the **Sync** button in the header to pull the latest data without creating a duplicate.`,
  },
  {
    id: 'ui-overview',
    title: 'Understanding the Interface',
    category: 'getting-started',
    icon: Map,
    content: `# Understanding the Interface

## The Sidebar

The collapsible sidebar on the left provides navigation to every major feature. It has two groups:

- **Navigation** — Dashboard, New Character, Import DDB, Party Lobby, Equipment, Compendium, World Map, Battlemap, Guide
- **DM Tools** — DM Dashboard, Party Notes, Session Archive

## The Character Sheet

Your character sheet is divided into panels:

- **Header** — Name, class, level, AC, and HP bar with quick +/- buttons
- **Ability Scores** — Six clickable stat blocks. Click any score to roll a check (d20 + modifier)
- **Actions Panel** — Weapon attacks and spell actions. Click to roll attack + damage
- **Spells** — Full spell list with preparation toggles, slot tracking, and concentration management
- **Inventory** — Equipment and items, with the ability to parse item descriptions via AI
- **Conditions** — Active conditions displayed as removable badges

## Real-Time Indicators

- **HP Bar** flashes red on damage, green on healing
- **Condition Badges** appear/disappear in real-time when the DM applies or removes them
- **The Effect Stream** (bottom-right) shows a live feed of all game events across the party
- **Voice indicators** show who is currently speaking in voice chat

## Contextual Help

Look for the small **?** icons (help buttons) throughout the interface. Click or hover to see a styled popover explaining that specific UI element. These provide quick, in-context explanations without leaving the page.`,
  },

  // ── Player Guide ───────────────────────────────────────────────────
  {
    id: 'combat-rolling',
    title: 'Combat & Rolling',
    category: 'player',
    icon: Dices,
    content: `# Combat & Rolling

Everything in Arcane Ally is designed to be **click-to-roll**. No manual math required.

## Ability Checks

Click any of the six **Ability Score blocks** on your character sheet. This immediately:

1. Rolls **d20 + your ability modifier**
2. Broadcasts the result to the **DM's Roll Feed** in real-time
3. Displays the roll in the **Effect Stream** for all players to see

The modifier is calculated automatically from your imported ability scores: \`floor((score - 10) / 2)\`.

## Weapon Attacks

In the **Actions Panel**, each weapon shows its attack bonus and damage dice. Clicking a weapon:

1. Rolls the **Attack Roll** — d20 + proficiency bonus + ability modifier
2. Rolls the **Damage** — the weapon's damage dice + ability modifier
3. Sends both rolls to the DM's feed with the weapon name and damage type (slashing, piercing, etc.)

> **Tip:** Weapons tagged with *Finesse* use the higher of STR or DEX automatically.

## Spell Casting

From the **Spells panel**, click a prepared spell to cast it:

1. If the spell requires an **attack roll**, it rolls d20 + spellcasting modifier + proficiency
2. If the spell has a **save DC**, it displays your DC for the DM
3. A **spell slot** of the appropriate level is consumed automatically
4. If the spell requires **Concentration**, it's tracked — casting another concentration spell drops the first

### Upcasting

To upcast a spell at a higher level:

1. Click the spell name to open its detail popover
2. Select the higher slot level from the **Cast at Level** dropdown
3. The damage dice scale automatically based on the spell's \`higher_levels\` description
4. The higher-level slot is consumed instead

> **Important:** You cannot upcast if you have no remaining slots at the chosen level. The button will be disabled.

## The DM Sees Everything

Every roll you make is broadcast to the DM's **Roll Feed** panel in real-time. The feed shows:
- Your character name
- The roll type (ability check, attack, damage)
- The total result and individual dice
- The damage type (if applicable)

This means the DM never has to ask "What did you roll?" — it's already on their screen.`,
  },
  {
    id: 'resting',
    title: 'Resting & Recovery',
    category: 'player',
    icon: Moon,
    content: `# Resting & Recovery

D&D 5e has two types of rest, and Arcane Ally handles both with a single click.

## Short Rest

Click the **Short Rest** button on your character sheet. This:

1. Opens the **Hit Dice Spending** dialog
2. Shows your available hit dice (based on your class and level)
3. Click a hit die to roll it — the result + your CON modifier is added to your current HP
4. You can spend multiple hit dice, one at a time
5. HP cannot exceed your maximum

> **Tip:** You regain half your total hit dice (rounded down, minimum 1) on a Long Rest. Spend them strategically.

### What Short Rest Does NOT Do:
- Does **not** restore spell slots (except for Warlocks — Pact Magic slots restore on short rest)
- Does **not** remove conditions
- Does **not** reset feature uses (except abilities that explicitly say "recharges on a short rest")

## Long Rest

Click the **Long Rest** button. This performs a full reset:

1. **HP restored to maximum** — your current HP is set to your max HP
2. **All spell slots restored** — every expended slot across all levels is refilled
3. **Hit dice restored** — you regain half your total hit dice (rounded down, minimum 1)
4. **Feature uses reset** — any class features with "per long rest" charges are refilled

> **Important:** Long Rest is a significant game event. The DM's audit log records it, and the Effect Timeline shows the full restoration. Use it when the DM confirms the party is actually resting for 8 hours.

## Rest Events in the Timeline

Both rest types are logged in the **Effect Timeline** and **Audit Log**:
- Short Rest: shows how many hit dice were spent and total HP recovered
- Long Rest: shows the full restoration summary

The DM can see exactly when each player rested and what was restored.`,
  },
  {
    id: 'conditions-buffs',
    title: 'Conditions & Buffs',
    category: 'player',
    icon: Shield,
    content: `# Conditions & Buffs

## Conditions

Conditions in D&D 5e (Blinded, Charmed, Frightened, etc.) are applied and removed by the DM. When a condition is applied to your character:

1. A **colored badge** appears on your character card and sheet
2. The badge is visible to all players in the Party Lobby
3. The condition appears in the **Effect Timeline** with a timestamp

You can see all active conditions in the **Conditions** section of your character sheet. Hover over a badge to see the condition's mechanical effects.

> **Note:** Only the DM can apply or remove conditions. If you think a condition should be removed (e.g., you made your save), let the DM know — they'll remove it from their dashboard.

## Buffs

Buffs are temporary stat modifications applied by the DM (e.g., from spells like Bless, Shield of Faith, or Haste). When a buff is active:

- It appears in your character's **Active Buffs** list
- Any stat modifications are reflected in your rolls automatically
- The buff has a duration tracked by the DM's automation system

## Concentration

If you're concentrating on a spell:
- A **glowing indicator** shows the spell name on your character card
- Taking damage triggers an automatic **Concentration Check** (CON save, DC = max(10, damage/2))
- If you fail, concentration drops and the DM is notified
- Casting another concentration spell automatically drops the current one`,
  },
  {
    id: 'equipment-inventory',
    title: 'Equipment & Inventory',
    category: 'player',
    icon: Gem,
    content: `# Equipment & Inventory

## Your Inventory

The **Equipment Manager** (accessible from the sidebar) shows all your items in a slot-based layout. Items imported from D&D Beyond are automatically placed in appropriate slots:

- **Main Hand / Off Hand** — Weapons and shields
- **Armor** — Chest slot
- **Accessories** — Rings, amulets, boots, gloves, headgear

## AI Item Parsing

If an item's stats weren't fully imported, click the **Parse with AI** button on the item. The AI will analyze the item's description and extract:
- AC bonuses
- Damage dice
- Stat modifiers
- Attunement requirements

## QuickEquipParser

From the Equipment page, click **Quick Parse**. Paste raw item text from a book, website, or homebrew note and the AI extracts a full structured item with stats, ready to equip.

## Manual Item Creation

Click **Add Item** to open the Manual Item Form. Enter all item details yourself:
- Name, type, category, rarity
- Damage dice, damage type, AC bonus
- Stat bonuses, charges, attunement
- Full description text

## Shared Party Loot

When the DM drops loot, it appears in the **Party Loot Pool** — a shared inventory visible to all players. To claim an item:

1. Find the item in the **Party Loot Pool** card on your character sheet
2. Click **Claim** — the item moves from the shared pool to your personal inventory
3. Other players can no longer see or claim that item

> **Note:** If the DM has set loot permissions to "DM Approval," your claim will be queued and the DM must approve it before the transfer happens.`,
  },

  // ── DM Guide ───────────────────────────────────────────────────────
  {
    id: 'god-eye-view',
    title: 'The God-Eye View',
    category: 'dm',
    icon: Eye,
    content: `# The God-Eye View

The DM Dashboard's **God-Eye View** is your real-time party overview. Every character in the party appears as a compact card showing:

- **Name, Class, and Level**
- **HP Bar** with current/max values — color-coded (green → red as HP drops)
- **AC** value
- **Active Conditions** as clickable badges (click to toggle)
- **Quick HP buttons** — +5 / -5 for fast adjustments

## Real-Time HP Syncing

HP changes are **bidirectional and instant**:

1. When you click +5/-5 on a character, the \`update_hp\` event fires
2. The server validates the change and updates the database
3. A \`party_state\` broadcast pushes the new HP to every connected client
4. The character's card flashes **red** (damage) or **green** (healing)
5. The Event Timeline records the change with actor, target, amount, and damage type

> **Latency:** Changes typically appear on all screens within 50-100ms on a local network.

## Quick Condition Management

Click any condition badge on a character card to toggle it. The God-Eye View supports all standard 5e conditions:

Blinded, Charmed, Deafened, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious, Exhaustion.

## The Audit Trail

Every action you take is recorded in two places:
- **Effect Timeline** — the immutable event store, grouped by round
- **Audit Log** — human-readable descriptions of every mutation

You can **reverse** any event from the Audit Log by clicking the undo button. This applies the inverse operation (e.g., reversing damage heals the target for the same amount).`,
  },
  {
    id: 'ai-lore-console',
    title: 'AI Lore Console & Actionable Responses',
    category: 'dm',
    icon: Sparkles,
    content: `# AI Lore Console

The **AI Lore Console** at the bottom of the DM Dashboard is your creative assistant. It connects to your local Ollama instance to generate atmospheric, high-fantasy content on the fly.

## Basic Usage

Type any prompt and press Enter (or click **Ask**). The AI will respond with evocative, D&D-flavored text. Example prompts:

- *"Describe a room in an abandoned dwarven forge"*
- *"Generate a mysterious NPC the party meets at the crossroads"*
- *"Create a unique magic weapon found in a dragon's hoard"*

## Preset Quick-Prompts

Four preset buttons give you instant access to common generation types:
- **Room Desc** — atmospheric room descriptions
- **NPC Idea** — unique NPCs with quirks and secrets
- **Loot Drop** — interesting mundane or magic items
- **Combat** — flavorful combat descriptions

## Actionable Responses

When the AI generates a specific game entity (item, monster, or NPC), the response includes **interactive action cards** below the narrative text:

### Items
The AI generates structured item data with rarity, category, damage, and properties. Click **Send to Party Loot** to instantly drop the item into the **Shared Party Loot Pool** where players can claim it.

### Monsters
Generated monsters include full stat blocks (HP, AC, ability scores, actions). Click **Add to Combat Tracker** to spawn the monster directly into the **Initiative Tracker** with auto-rolled initiative.

### NPCs
NPC responses include role, personality, appearance, and a secret. Click **Save to Notes** to store the NPC in the Party Notes for future reference.

> **Tip:** Once you click an action button, it disables and shows "Added!" to prevent accidental duplicates. The entity is immediately live in the game state.

## Send to Notes

Every lore response has a **Send to Notes** button that saves the narrative text (without entity data) to the Party Notes, making it accessible to all players.`,
  },
  {
    id: 'combat-management',
    title: 'Running Combat',
    category: 'dm',
    icon: Swords,
    content: `# Running Combat

## The Initiative Tracker

The **Initiative Tracker** is your combat command center. It supports:

- **Automatic initiative rolling** — click **Roll** in the header to roll d20 + DEX mod for every combatant at once
- **Turn management** — Advance/Reverse buttons step through the turn order
- **HP tracking** — inline +/- buttons on each combatant
- **Visibility toggle** — hide monsters from players until they're revealed
- **Reordering** — use the chevron buttons on hover to adjust tie-break order

## Combatant Sidecar

Click any combatant's **name** to open the sidecar panel on the right. It shows:

- Live HP bar and conditions
- Full stat block (ability scores, saving throws, resistances, immunities, traits, and actions) — available for monsters spawned from the Compendium
- **Effect History** — the last 8 events targeting that combatant, updating in real time

Click the same name again (or press Escape) to close it. This lets you reference a monster's stat block mid-combat without leaving the tracker.

## AoE / Multi-Target Effects

To apply an effect to multiple combatants at once:

1. Click the **checkbox** (⬜) next to each target in the tracker — the checkbox turns orange when selected
2. Once ≥1 target is selected, an orange **AoE** button appears in the tracker header
3. Click **AoE** to open the effect builder modal
4. Add one or more effect rows: **Damage** (value + type), **Heal**, or **Condition**
5. Click **Apply** — all effects are applied atomically in a single database transaction

Results appear per-target in the modal summary. All events from the same AoE share a **group ID** in the Effect Timeline.

## Quick Actions (DM)

The ⚙ (Settings) button in the tracker header opens Quick Actions:

- **Dismiss Dead** — instantly removes all combatants with HP ≤ 0
- **Clear All Conditions** — wipes every condition from all player characters (useful after a long rest in camp)

## Spawning Monsters

### 1. Quick Spawn
Click **+** in the tracker header. Enter a name, HP, AC, and initiative modifier.

### 2. From the Compendium
Open the **Compendium**, find a monster (SRD or homebrew), and click **Add to Combat**. The monster's full stat block is preserved in the tracker and available in the sidecar.

### 3. From the AI Lore Console
Ask the AI to generate a monster. Click **Add to Combat Tracker** on the response card.

## Encounter Builder

For pre-planned encounters:

1. Click **Encounters** in the combat controls
2. Create a named encounter with a list of monsters (name, HP, AC, count)
3. Click **Start Encounter** to clear the tracker and spawn all monsters + party PCs at once

> **Tip:** The automation system can auto-apply aura effects and process turn-start/turn-end triggers if you've configured them in the Automation panel.`,
  },
  {
    id: 'loot-management',
    title: 'Managing Loot & Inventory',
    category: 'dm',
    icon: Gem,
    content: `# Managing Loot & Inventory

## The Shared Loot Pool

The Shared Loot Pool is a party-wide inventory that all players can see. Items in the pool can be claimed by individual players.

### Dropping Loot

There are three ways to add items to the pool:

1. **Loot Drop Modal** — Click the **Loot** button in the God-Eye View. Choose from existing homebrew items or create a quick custom item with name, rarity, category, and description.

2. **AI Lore Console** — Ask the AI to generate loot. Click **Send to Party Loot** on the actionable response card.

3. **Compendium** — Browse items in the Compendium and use them as templates.

### Permission Modes

The **Permission Config** panel (in the right column of the DM Dashboard) controls how loot claiming works:

- **Open** — Players can claim freely (default)
- **DM Approval** — Claims are queued and require your approval
- **Owner Only** — Only the character's owner can interact with their inventory

### Homebrew Items

The **Compendium** is your homebrew library. Create custom items with full stat blocks:
- Type (Weapon, Armor, Wondrous Item, etc.)
- Rarity
- AC bonus, damage dice, stat bonuses
- Attunement requirements
- Full description

Items saved to the Compendium can be dropped into the loot pool or assigned directly to a character's inventory.

> **Tip:** Use the **Generate with AI** button in the Compendium to have the AI create a full stat block from a description. Review the numbers before saving — the AI is creative but sometimes generous with the math.`,
  },
  {
    id: 'automation-permissions',
    title: 'Automation & Permissions',
    category: 'dm',
    icon: Zap,
    content: `# Automation & Permissions

## The Automation Panel

Click **Automation** in the DM Dashboard header to open the automation configuration. This panel controls:

- **DM Approval Queue** — Toggle the master switch to require DM approval for player actions that affect shared state
- **Effect Processing** — Configure automatic aura effects, turn triggers, and condition duration tracking
- **Broadcast Throttling** — The timeline broadcast is debounced to 100ms to prevent spam during rapid multi-target effects

## Access Control Matrix

The **Access Control** card in the right column of the DM Dashboard is a visual permission matrix with three columns — **Open**, **Approval**, **DM/Owner Only** — and six configurable categories:

### Combat
| Permission | What it controls |
|---|---|
| **Apply Effects to Others** | Can players cast heals, damage, or conditions on another player's character? |
| **Self-Apply Conditions** | Can players toggle conditions (e.g. Prone) on their own character? |
| **Monster HP Visibility** | Can players see exact HP numbers on enemy tokens? |

### Loot & Items
| Permission | What it controls |
|---|---|
| **Loot Claims** | Who can take items from the shared loot pool — Open, DM Approval, or Owner Only |
| **Item Transfer** | Can players trade items between themselves without DM involvement? |

### World
| Permission | What it controls |
|---|---|
| **Party Notes** | Can players add or edit shared party notes, or is that DM-only? |

Click any cell to activate it. Unavailable combinations (e.g. "Approval" for a binary permission) are shown as **—**. Hover any row to see a description of what the permission controls.

> **DM actions always bypass all restrictions.** Permission checks only apply to player-initiated socket events.

## Idempotency Guards

Every mutation in the system carries a unique **request ID**. If a reconnecting websocket replays the same event, the server detects the duplicate and skips it. This prevents:
- Double-applying damage on reconnect
- Duplicate buff applications
- Accidental loot duplication

## Event Reversal

As DM, you can **undo** any event from the Audit Log. Click the undo button on an event to apply the inverse:
- Damage → heals the target for the same amount
- Condition applied → removes the condition
- Buff applied → removes the buff
- Loot claimed → returns the item to the pool

The reversal is itself logged as a new event, maintaining the full audit trail.`,
  },

  // ── New: Compendium & SRD ──────────────────────────────────────────
  {
    id: 'compendium',
    title: 'The Compendium',
    category: 'dm',
    icon: Globe,
    content: `# The Compendium & Homebrew Manager

The Compendium is your unified interface for browsing official 5e content and managing homebrew entities. Open it from the **Compendium** button in the DM Dashboard header (amber book icon) or from the sidebar.

## Split-Pane Layout

The Compendium opens as a slide-out panel with two panes:
- **Left Pane (Index)** — searchable, filterable list of entities
- **Right Pane (Inspector)** — full stat block display with edit/spawn actions

## Official SRD Tab

Click the **Official SRD** tab at the top of the left pane to search the open5e API. This gives you access to the entire 5e Systems Reference Document:

- **Monsters** — full stat blocks with ability scores, actions, legendary actions, senses, languages
- **Spells** — level, school, casting time, range, components, duration, description, higher-level scaling
- **Magic Items** — type, rarity, attunement, description

Type in the search bar and results appear after a 400ms debounce. Filter by entity type (Monsters / Spells / Items) using the tabs below the search bar.

> **Tip:** SRD entities are read-only. To customize one, click **Clone to Homebrew** — this copies the entity to your local library where you can edit it freely.

## Homebrew Tab

The **Homebrew** tab shows all entities you've created or cloned. These are stored locally in your database and fully editable.

### Creating Homebrew

Click the **+ Monster**, **+ Spell**, or **+ Item** button in the header. This opens the Entity Creator in the right pane with:

1. **Name** and **Description** fields
2. **Generate with AI** button — describe the entity in the description field, then click to have the AI create a full stat block
3. The AI-generated stats load as a **Draft** — review and tweak every field before saving
4. Click **Save to Compendium** to store it permanently

### Editing Existing Entities

Select a homebrew entity from the list, then click **Edit** in the inspector header. All fields become editable:
- Monster: HP, AC, Speed, CR, ability scores, saving throws, abilities, actions, legendary actions
- Spell: level, school, casting time, range, components, duration, concentration, description
- Item: type, rarity, attunement, AC bonus, damage, description

Click **Save** to persist your changes.

## Spawning Monsters

On any monster stat block (SRD or homebrew), click **Add to Combat** to:
1. Auto-roll initiative (d20 + DEX modifier)
2. Add the monster to the Initiative Tracker with full stats
3. The monster's complete stat block is preserved in the tracker for reference during combat`,
  },
  {
    id: 'voice-chat',
    title: 'Voice Chat',
    category: 'player',
    icon: Mic,
    content: `# Voice Chat

Arcane Ally includes **built-in WebRTC voice communication** — no Discord or external apps needed.

## Joining Voice

The voice chat widget is available on every page. Click the **microphone icon** to join the voice channel. All connected players and the DM share a single voice room.

## Features

- **Push-to-talk or open mic** — choose your preferred mode
- **Speaking indicators** — active speakers are highlighted in the voice panel
- **Low latency** — peer-to-peer WebRTC connections for minimal delay
- **No external dependencies** — runs entirely through your local server

## How It Works

Voice uses WebRTC with the server acting as a signaling relay:
1. When you join, the client sends a \`voice_join\` event
2. The server coordinates offer/answer/ICE candidate exchange between peers
3. Audio streams flow directly between browsers (peer-to-peer)
4. Speaking detection triggers \`voice_speaking\` events for visual indicators

> **Note:** Voice quality depends on your local network. For best results, ensure all players are on the same LAN or have a stable connection to the host machine.`,
  },
  {
    id: 'companion-view',
    title: 'Player Companion View',
    category: 'player',
    icon: Smartphone,
    content: `# Player Companion View

The **Companion View** is a streamlined, mobile-optimized page designed to stay open on your phone while the full app runs on a laptop or tablet. It shows everything you need during your turn — HP, conditions, attacks, spell slots, and dice — without any navigation overhead.

## Opening the Companion View

Ask your DM to share the companion URL for your character. They can generate it instantly:

1. DM opens your character sheet
2. Clicks the **📱 phone icon** in the sheet header
3. The URL is copied to clipboard — they send it to you

The URL looks like: \`http://[server-address]/companion/3\`

Open it on your phone. It connects to the same live session — no login required.

## What You See

### HP at a Glance
Your current and maximum HP are displayed in large, color-coded numbers at the top:
- **Green** — Healthy (above 50% HP)
- **Amber** — Bloodied (25–50% HP)
- **Red** — Critical (below 25% HP)
- **Grey** — Dead or unconscious

The HP bar updates in real time whenever the DM changes your HP.

### Conditions
Active conditions appear as orange badges below the HP bar. If the DM set a duration, you'll see the remaining rounds (e.g. **Prone (2r)**).

### Ability Scores
All six ability scores with their modifiers are displayed in a compact grid for quick reference.

### Quick Attacks

Tap any weapon in the **Quick Attacks** panel to instantly roll both attack and damage:

1. The app rolls **d20 + your attack bonus** for the to-hit roll
2. Rolls your **damage dice + modifier** automatically
3. Both rolls are broadcast to the DM's Roll Feed in real time
4. Criticals show a special toast notification

### Spell Slot Tracker
Spell slot pips show how many slots remain at each level. These update live when the DM processes spells or when you take a rest.

### Dice Roller
Tap **Dice Roller** at the bottom to expand a full dice roller. Supports all die types with a **Private/Public** toggle — private rolls appear only in the DM's feed, not the party stream.

## Live Sync

The companion view connects to the same server socket as the main app. All changes made by the DM (HP, conditions, buffs) appear on your companion screen within milliseconds.

> **Note:** The companion view is read-optimized. For deeper sheet interaction — managing inventory, editing spells, viewing feats — use the full character sheet at \`/character/:id\`.`,
  },
  {
    id: 'world-quests',
    title: 'World Map & Quests',
    category: 'player',
    icon: Compass,
    content: `# World Map & Quests

## The World Map

Navigate to **World Map** from the sidebar to see the shared overworld. The DM controls discovery — markers and points of interest appear as the party explores.

### Map Features
- **Markers** — the DM places named markers on the map for towns, dungeons, and points of interest
- **Discovery mode** — markers can be hidden until the DM reveals them
- **Token sync** — the DM can sync map tokens to track party position

## The World Panel

The **World Panel** appears in the DM Dashboard and shows:
- **Time of Day** — the DM can advance time, affecting the game world
- **Weather** — AI-generated atmospheric weather descriptions
- **Current location** and world state

## Quest Tracker

The **Quest Tracker** is visible to all players and managed by the DM:

- **Active Quests** — currently in-progress quests with descriptions and objectives
- **Quest States** — quests progress through stages (active, completed, failed)
- **DM Management** — the DM creates, updates, and resolves quests from the DM Dashboard

> **Tip:** Quests are a great way to keep the party focused between sessions. The DM can update quest descriptions with new information as the story progresses.`,
  },
  {
    id: 'dm-prep-tools',
    title: 'DM Prep & Session Tools',
    category: 'dm',
    icon: ClipboardList,
    content: `# DM Prep & Session Tools

## DM Prep Panel

Click **Prep Notes** in the DM Dashboard header to open the Prep Panel. This is your private notepad for session planning:

- **Per-character notes** — click the sticky note icon on any character card in the God-Eye View to open notes specific to that character
- **Per-encounter notes** — click the sticky note icon next to the Encounters button for encounter-specific prep
- **General notes** — the default view for miscellaneous session prep
- **Context filtering** — notes are tagged by type and filtered automatically based on where you opened them

## Party Notes

Navigate to **Party Notes** from the sidebar. These are shared with the entire party:
- **Categories** — lore, npc, quest, general
- **AI integration** — "Send to Notes" from the AI Lore Console pushes lore text directly here
- **Collaborative** — players and the DM can all contribute

## DM-Only Notes

Private notes that only the DM can see, stored separately from party notes. Use these for plot secrets, NPC motivations, and encounter plans.

## NPC Manager

Click **NPCs** in the God-Eye View to manage your NPC roster:
- Create NPCs with name, description, and role
- Quick reference during sessions
- AI-generated NPCs from the Lore Console can be saved here via "Save to Notes"

## Session Management

### Ending a Session

Click **End Session** in the DM Dashboard header. This:
1. Archives the current action log
2. Generates an **AI-powered session recap** summarizing key events
3. The recap is stored in the **Session Archive** for future reference

### Session Archive

Navigate to **Session Archive** from the sidebar to browse past session recaps. Each entry includes the AI-generated narrative summary and a timestamp.

## Soundboard

The **Soundboard** card in the DM Dashboard provides atmospheric audio:
- Play ambient sounds during exploration, combat, or roleplay
- Sounds are broadcast to all connected clients
- Start/stop controls with named sound effects`,
  },
  {
    id: 'effect-timeline',
    title: 'Effect Timeline & Audit Trail',
    category: 'dm',
    icon: Scroll,
    content: `# Effect Timeline & Audit Trail

Arcane Ally maintains a comprehensive, immutable record of every game event. This serves as both a reference during play and a historical record of the campaign.

## Effect Timeline

The **Effect Timeline** card in the DM Dashboard's right column shows events grouped by combat round:

- **DMG** (red) — who dealt how much of what damage type to whom
- **HEAL** (green) — restoration amounts
- **COND** (orange) — conditions applied/removed with timestamps
- **BUFF** (blue) — buff applications and removals
- **CON✓ / CONC!** (violet/rose) — concentration check results
- **AUTO** (orange) — automated aura or turn-trigger effects
- **UNDO** (slate) — reversal records

Each event type has a distinct color badge. Use the legend at the top to filter by type — click a badge to show only those events.

## AoE Group Events

When the DM applies an **Area of Effect** (multi-target) effect, all events from that action are grouped together in the timeline with an orange ⚡ **AoE** header row showing:

- Number of targets hit
- Total damage dealt (if applicable)
- An expand/collapse chevron to show/hide the individual per-target events

The DM can **undo the entire group at once** using the ↩ button on the group header. This reverses all events in the batch atomically — no need to undo each target one by one.

## Per-Event Undo (DM only)

Individual events also have a per-event ↩ undo button. Clicking it:
1. Applies the inverse operation (damage → heals the target; condition applied → removes it)
2. Creates a new **UNDO** record in the timeline
3. Marks the original event as reversed (shown with strikethrough + 40% opacity)

> **Tip:** Reversal is for correcting mistakes, not time travel. The original event stays in the log, marked as reversed, preserving the full audit trail.

## Exporting the Combat Log

Click the **↓ download** button (next to the filter bar) to export the full timeline as a **Markdown file**. The file is named \`combat-log-YYYY-MM-DD.md\` and contains:

- A header with the date and total event count
- One section per round with a formatted table of events
- Reversed events shown with ~~strikethrough~~ so they're clearly visible

This is ideal for session notes, Discord recaps, or archiving what actually happened in a dramatic encounter.

## Filtering the Timeline

- **Text filter** — type a character name, event type, or keyword to narrow down events
- **Type badges** — click any badge (DMG, HEAL, COND, etc.) in the legend to filter to that type
- Click the same badge again to clear the filter

## Audit Log

The **Audit Log** (in the DM Dashboard) provides human-readable descriptions of every mutation. Filter by category: **Combat**, **Status**, **Conc.**, **Resources**, **Auto**.`,
  },
  {
    id: 'ai-features',
    title: 'AI Features Overview',
    category: 'getting-started',
    icon: Sparkles,
    content: `# AI Features Overview

Arcane Ally integrates with your local **Ollama** instance to provide AI-powered features throughout the app. All AI processing happens on your hardware — no cloud APIs, no data leaves your network.

## Where AI Is Used

### Character Import (PDF Parsing)
Upload a character sheet PDF and the AI extracts:
- Name, class, level
- Ability scores
- Spells, features, inventory
- Hit points, armor class

### Item Description Parsing
In the Equipment Manager, click **Parse with AI** on any item. The AI reads the description and extracts:
- AC bonuses, damage dice
- Stat modifiers, attunement requirements
- Item type and properties

### QuickEquipParser
Paste raw item text (from a book, website, or homebrew note) and the AI parses it into a structured item with full stats.

### Homebrew Generation (Compendium)
Describe a monster, spell, or item in plain English. The AI generates a complete stat block:
- Monsters: HP, AC, speed, ability scores, actions, legendary actions, resistances
- Spells: level, school, range, components, duration, description
- Items: type, rarity, damage, AC bonus, attunement, properties

### Lore Console (Actionable Responses)
The DM's AI Lore Console generates atmospheric content. When it creates specific game entities, **interactive action cards** appear:
- **Items** → "Send to Party Loot" drops the item into the shared loot pool
- **Monsters** → "Add to Combat Tracker" spawns with auto-rolled initiative
- **NPCs** → "Save to Notes" stores the NPC for reference

### Weather Generation
The World Panel uses AI to generate atmospheric weather descriptions that fit the current game context.

### Session Recaps
When the DM ends a session, the AI generates a narrative summary of key events from the action log.

### Rules Assistant
The floating "Rules Sage" chat widget answers D&D 5e rules questions using AI.

## Configuration

AI features require a running Ollama instance. Set the URL in your environment:
\`\`\`
OLLAMA_URL=http://your-ollama-host:11434
\`\`\`

> **Tip:** If Ollama is unavailable, AI features gracefully degrade — the app remains fully functional, you just won't be able to generate content or parse PDFs.`,
  },
  {
    id: 'modifier-trace',
    title: 'Modifier Trace Overlay',
    category: 'player',
    icon: Sparkles,
    content: `# Modifier Trace Overlay
    
Arcane Ally calculates all of your character sheet statistics in real-time, tracing every active item, passive ability, temporary buff, and environmental condition to its exact source.

## Hoverable Stat Provenance
Hover or tap any primary statistic on your Character Sheet (such as Ability Scores, Armor Class, Speed, Initiative, Saving Throws, and Skills) to view a detailed popover overlay:
- **Base Score**: The un-modified attribute score of your character.
- **Active Equipment**: Flat bonuses, armor changes, or modifiers granted by currently equipped weapons, shields, and accessories.
- **Temporary Effects**: Dynamic bonuses applied to your character by the DM (such as the *Bless* spell, *Haste*, or homebrew active effects).
- **Environmental Conditions**: Reductions, disadvantages, advantage flags, or automatic failure overrides caused by current conditions (e.g. *Grappled*, *Paralyzed*, or *Exhausted*).

## Real-Time Updates
Whenever the DM grants you a new dynamic buff, drops a condition on you, or you claim and equip a magic item from the Shared Loot Pool, the calculations are recalculated atomically. Every tooltip update happens instantaneously with absolutely zero page refreshes required.`,
  },
  {
    id: 'combat-recovery',
    title: 'Combat Recovery & Snapshots',
    category: 'dm',
    icon: History,
    content: `# Combat Recovery & Snapshots

Live sessions are full of chaotic twists. Arcane Ally features an automated chronology engine that records complete snapshots of your game world at every critical phase boundary.

## Automated Checkpoint Creation
Snapshots are recorded silently in the background whenever:
- An **encounter is initiated**
- A **new turn begins** or is advanced
- The **previous turn is rolled back**
- Dead combatants are dismissed
- Status conditions are bulk cleared
- An **encounter is concluded**

Each snapshot is a complete deep copy of the combat universe, capturing the initiative order, active round/turn index, current player hit points, active temporary conditions, remaining condition round durations, and consumed spell slots.

## Reverting the Chronology
If a player's browser crashes, the server encounters a disconnect, or you make a combat misclick, you can restore state cleanly:
- Click the **Recover** button in the *Combat Controls* panel on the DM Dashboard.
- The *Chronology Recovery Console* lists the latest 20 saved checkpoints with descriptive names (e.g. *"Next Turn: Round 2, Turn 3"*) and precise time-stamps.
- Click **Restore** next to your chosen checkpoint.
- After a confirmation warning, the entire state of active characters, HP, and the initiative tracker will instantly roll back to that exact timeline checkpoint.`,
  },
];

// ── Category metadata ────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'getting-started' as const, label: 'Getting Started', icon: BookOpen, color: 'text-primary' },
  { key: 'player' as const, label: 'Player Guide', icon: Shield, color: 'text-health' },
  { key: 'dm' as const, label: 'DM Guide', icon: Eye, color: 'text-red-400' },
];

// ── Simple Markdown-ish renderer ─────────────────────────────────────────

function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let inBlockquote = false;
  let bqLines: string[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushBlockquote = () => {
    if (bqLines.length > 0) {
      elements.push(
        <div key={`bq-${elements.length}`} className="border-l-2 border-primary/40 bg-primary/5 rounded-r-md px-4 py-2.5 my-3">
          {bqLines.map((l, i) => (
            <p key={i} className="text-sm text-primary/80 italic leading-relaxed">
              {renderInline(l)}
            </p>
          ))}
        </div>
      );
      bqLines = [];
    }
    inBlockquote = false;
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-1 my-2 ml-1">
          {listItems.map((li, i) => (
            <li key={i} className="flex gap-2 text-sm text-foreground/80 leading-relaxed">
              <ChevronRight className="h-3.5 w-3.5 text-primary/50 shrink-0 mt-1" />
              <span>{renderInline(li)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Blockquotes
    if (trimmed.startsWith('> ')) {
      if (!inBlockquote) { flushList(); inBlockquote = true; }
      bqLines.push(trimmed.slice(2));
      continue;
    }
    if (inBlockquote) flushBlockquote();

    // Unordered list items
    if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      if (!inList) { inList = true; }
      listItems.push(trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
      continue;
    }
    if (inList) flushList();

    // Headings
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h-${elements.length}`} className="font-display text-2xl text-primary tracking-wide mt-2 mb-3">
          {trimmed.slice(2)}
        </h1>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h-${elements.length}`} className="font-display text-lg text-foreground/90 tracking-wide mt-6 mb-2 border-b border-border/30 pb-1">
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h-${elements.length}`} className="font-display text-sm font-semibold text-foreground/80 tracking-wide mt-4 mb-1.5">
          {trimmed.slice(4)}
        </h3>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      elements.push(<hr key={`hr-${elements.length}`} className="border-border/30 my-4" />);
      continue;
    }

    // Empty line
    if (!trimmed) {
      continue;
    }

    // Paragraph
    elements.push(
      <p key={`p-${elements.length}`} className="text-sm text-foreground/75 leading-relaxed my-1.5">
        {renderInline(trimmed)}
      </p>
    );
  }

  // Flush remaining
  if (inBlockquote) flushBlockquote();
  if (inList) flushList();

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  // Process inline formatting: **bold**, *italic*, `code`
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(<strong key={key++} className="text-foreground font-semibold">{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)/s);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>);
      parts.push(<em key={key++} className="text-foreground/60 italic">{italicMatch[2]}</em>);
      remaining = italicMatch[3];
      continue;
    }

    // Code
    const codeMatch = remaining.match(/^(.*?)`(.+?)`(.*)/s);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-secondary/60 text-primary/90 text-xs font-mono">
          {codeMatch[2]}
        </code>
      );
      remaining = codeMatch[3];
      continue;
    }

    // No more matches — push the rest
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ── Main Component ───────────────────────────────────────────────────────

export default function AppGuidebook() {
  const [activeId, setActiveId] = useState(GUIDE_SECTIONS[0].id);
  const [search, setSearch] = useState('');

  const filteredSections = useMemo(() => {
    if (!search.trim()) return GUIDE_SECTIONS;
    const q = search.toLowerCase();
    return GUIDE_SECTIONS.filter(s =>
      s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    );
  }, [search]);

  const activeSection = GUIDE_SECTIONS.find(s => s.id === activeId) ?? GUIDE_SECTIONS[0];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-6 overflow-hidden">
      {/* ── Guide Sidebar (Arcane Codex) ─────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-border/40 bg-card z-10 flex flex-col">
        {/* Back to App */}
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-b border-border/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-display tracking-wide text-xs uppercase">Back to Dashboard</span>
        </Link>

        {/* Header */}
        <div className="px-4 py-4 border-b border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <Scroll className="h-5 w-5 text-primary" />
            <h1 className="font-display text-lg tracking-wide text-primary">Arcane Codex</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search guides..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          {CATEGORIES.map(cat => {
            const sections = filteredSections.filter(s => s.category === cat.key);
            if (sections.length === 0) return null;
            const CatIcon = cat.icon;

            return (
              <div key={cat.key}>
                <div className="flex items-center gap-2 px-2 mb-1.5">
                  <CatIcon className={cn('h-3.5 w-3.5', cat.color)} />
                  <span className={cn('text-[10px] font-display tracking-widest uppercase', cat.color)}>
                    {cat.label}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {sections.map(section => {
                    const SIcon = section.icon;
                    const isActive = section.id === activeId;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveId(section.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-all',
                          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          isActive
                            ? 'bg-primary/10 text-primary border-l-2 border-primary'
                            : 'text-muted-foreground hover:text-foreground/80 hover:bg-secondary/30 border-l-2 border-transparent',
                        )}
                      >
                        <SIcon className={cn('h-3.5 w-3.5 shrink-0', isActive ? cat.color : 'text-muted-foreground/40')} />
                        <span className="truncate">{section.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredSections.length === 0 && (
            <div className="py-8 text-center text-muted-foreground/30 italic text-xs">
              No guides match your search
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/20 text-center">
          <p className="text-[9px] text-muted-foreground/30 font-display tracking-widest uppercase">
            Arcane Ally v1.0
          </p>
        </div>
      </aside>

      {/* ── Content Area ─────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-6 text-[10px] text-muted-foreground/40 font-display tracking-wider uppercase">
            <Link to="/" className="hover:text-primary transition-colors">Arcane Ally</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Guide</span>
            <ChevronRight className="h-3 w-3" />
            <span>{CATEGORIES.find(c => c.key === activeSection.category)?.label}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-muted-foreground/60">{activeSection.title}</span>
          </div>

          {/* Rendered guide content */}
          <article className="pb-16">
            {renderMarkdown(activeSection.content)}
          </article>

          {/* Next/Prev navigation */}
          <GuideNavFooter
            sections={GUIDE_SECTIONS}
            activeId={activeId}
            onNavigate={setActiveId}
          />
        </div>
      </main>
    </div>
  );
}

// ── Navigation Footer ────────────────────────────────────────────────────

function GuideNavFooter({
  sections,
  activeId,
  onNavigate,
}: {
  sections: GuideSection[];
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  const idx = sections.findIndex(s => s.id === activeId);
  const prev = idx > 0 ? sections[idx - 1] : null;
  const next = idx < sections.length - 1 ? sections[idx + 1] : null;

  return (
    <div className="flex justify-between items-center border-t border-border/30 pt-6">
      {prev ? (
        <button
          onClick={() => onNavigate(prev.id)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
        >
          <ChevronRight className="h-4 w-4 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
          <div className="text-left">
            <div className="text-[9px] font-display uppercase tracking-wider text-muted-foreground/40">Previous</div>
            <div className="font-display">{prev.title}</div>
          </div>
        </button>
      ) : <div />}
      {next ? (
        <button
          onClick={() => onNavigate(next.id)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group text-right"
        >
          <div>
            <div className="text-[9px] font-display uppercase tracking-wider text-muted-foreground/40">Next</div>
            <div className="font-display">{next.title}</div>
          </div>
          <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      ) : <div />}
    </div>
  );
}
