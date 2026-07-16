import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Shield, Zap, RotateCcw } from 'lucide-react';
import { type EffectEvent } from './EffectTimeline';
import socket from '../socket';
import { dmFetch } from '../lib/dmFetch';

// Minimal combatant shape — must match InitiativeTracker's Combatant interface
interface Combatant {
  id: number;
  entity_name: string;
  entity_type: 'pc' | 'monster' | 'npc';
  current_hp: number;
  max_hp: number;
  ac: number;
  conditions: string[];
  concentrating_on: string | null;
  hp_status: string;
  character_id: number | null;
  stats_json: Record<string, any> | null;
}

interface CombatantSidebarProps {
  combatant: Combatant | null;
  onClose: () => void;
}

const ABILITY_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
const ABILITY_SHORT: Record<string, string> = {
  strength: 'STR', dexterity: 'DEX', constitution: 'CON',
  intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA',
};

function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

const EVENT_COLOR: Record<string, string> = {
  damage: 'text-red-400',
  heal: 'text-green-400',
  condition_applied: 'text-amber-400',
  condition_removed: 'text-slate-400',
  undo: 'text-slate-300',
};
const EVENT_LABEL: Record<string, string> = {
  damage: 'DMG', heal: 'HEAL', condition_applied: 'COND',
  condition_removed: '-COND', undo: 'UNDO',
};

function miniEventSummary(ev: EffectEvent): string {
  try {
    const p = JSON.parse(ev.payload_json || '{}');
    switch (ev.event_type) {
      case 'damage': return `${p.value ?? '?'} ${p.damageType || ''} dmg`;
      case 'heal': return `+${p.value ?? '?'} HP`;
      case 'condition_applied': return `${p.condition} applied`;
      case 'condition_removed': return `${p.condition} removed`;
      default: return ev.description || ev.event_type;
    }
  } catch { return ev.event_type; }
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function StatBlock({ stats }: { stats: Record<string, any> }) {
  const abilities = ABILITY_KEYS.map(k => ({
    key: k,
    short: ABILITY_SHORT[k],
    score: Number(stats[k]) || 10,
  }));

  const saves = stats.special_abilities?.filter((a: any) =>
    typeof a.name === 'string' && a.name.includes('Saving Throw')
  ) || [];

  const resistances: string[] = typeof stats.damage_resistances === 'string'
    ? stats.damage_resistances.split(',').map((s: string) => s.trim()).filter(Boolean)
    : (Array.isArray(stats.damage_resistances) ? stats.damage_resistances : []);

  const immunities: string[] = typeof stats.damage_immunities === 'string'
    ? stats.damage_immunities.split(',').map((s: string) => s.trim()).filter(Boolean)
    : (Array.isArray(stats.damage_immunities) ? stats.damage_immunities : []);

  const vulnerabilities: string[] = typeof stats.damage_vulnerabilities === 'string'
    ? stats.damage_vulnerabilities.split(',').map((s: string) => s.trim()).filter(Boolean)
    : (Array.isArray(stats.damage_vulnerabilities) ? stats.damage_vulnerabilities : []);

  const condImmunities: string[] = typeof stats.condition_immunities === 'string'
    ? stats.condition_immunities.split(',').map((s: string) => s.trim()).filter(Boolean)
    : (Array.isArray(stats.condition_immunities)
        ? stats.condition_immunities.map((c: any) => typeof c === 'string' ? c : c?.name || '')
        : []);

  const actions: Array<{ name: string; desc: string }> = Array.isArray(stats.actions)
    ? stats.actions.slice(0, 6)
    : [];

  const specials: Array<{ name: string; desc: string }> = Array.isArray(stats.special_abilities)
    ? stats.special_abilities.slice(0, 4)
    : [];

  return (
    <div className="space-y-3">
      {/* Core stats row */}
      <div className="flex items-center gap-3 text-[10px]">
        {stats.armor_class !== undefined && (
          <span className="flex items-center gap-1 text-mana font-bold">
            <Shield className="h-3 w-3" /> {stats.armor_class}
          </span>
        )}
        {stats.speed && (
          <span className="text-muted-foreground">
            Spd {typeof stats.speed === 'object' ? stats.speed.walk ?? Object.values(stats.speed)[0] : stats.speed} ft
          </span>
        )}
        {stats.challenge_rating !== undefined && (
          <span className="text-muted-foreground">CR {stats.challenge_rating}</span>
        )}
        {stats.hit_dice && (
          <span className="text-muted-foreground">{stats.hit_dice}</span>
        )}
      </div>

      {/* Ability scores */}
      <div className="grid grid-cols-6 gap-1 text-center">
        {abilities.map(({ short, score }) => (
          <div key={short} className="bg-secondary/20 rounded p-1">
            <div className="text-[8px] font-bold text-muted-foreground/60 uppercase">{short}</div>
            <div className="text-[11px] font-bold text-foreground">{score}</div>
            <div className="text-[9px] text-primary/70">{abilityMod(score)}</div>
          </div>
        ))}
      </div>

      {/* Saving throws from stats */}
      {stats.saving_throws && Object.keys(stats.saving_throws).length > 0 && (
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground/50 font-bold mb-1">Saving Throws</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(stats.saving_throws).map(([save, val]) => (
              <span key={save} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/40 border border-blue-700/30 text-blue-300">
                {save.slice(0, 3).toUpperCase()} {String(val).startsWith('+') || String(val).startsWith('-') ? val : `+${val}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Resistances / immunities */}
      {resistances.length > 0 && (
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground/50 font-bold mb-1">Resistances</div>
          <div className="flex flex-wrap gap-1">
            {resistances.map(r => (
              <span key={r} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950/30 border border-blue-700/20 text-blue-300">{r}</span>
            ))}
          </div>
        </div>
      )}
      {immunities.length > 0 && (
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground/50 font-bold mb-1">Immunities</div>
          <div className="flex flex-wrap gap-1">
            {immunities.map(r => (
              <span key={r} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900/60 border border-slate-600/30 text-slate-300">{r}</span>
            ))}
          </div>
        </div>
      )}
      {vulnerabilities.length > 0 && (
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground/50 font-bold mb-1">Vulnerabilities</div>
          <div className="flex flex-wrap gap-1">
            {vulnerabilities.map(r => (
              <span key={r} className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950/40 border border-rose-700/30 text-rose-300">{r}</span>
            ))}
          </div>
        </div>
      )}
      {condImmunities.length > 0 && (
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground/50 font-bold mb-1">Condition Immunities</div>
          <div className="flex flex-wrap gap-1">
            {condImmunities.map(r => (
              <span key={r} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900/40 border border-slate-600/20 text-slate-400">{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Special abilities */}
      {specials.length > 0 && (
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground/50 font-bold mb-1">Traits</div>
          <div className="space-y-1.5">
            {specials.map(a => (
              <div key={a.name}>
                <span className="text-[10px] font-semibold text-primary/80 italic">{a.name}. </span>
                <span className="text-[9px] text-foreground/60 leading-snug">{a.desc?.slice(0, 120)}{a.desc?.length > 120 ? '…' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div>
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground/50 font-bold mb-1">Actions</div>
          <div className="space-y-1.5">
            {actions.map(a => (
              <div key={a.name} className="border-l-2 border-primary/20 pl-2">
                <div className="text-[10px] font-semibold text-foreground/80">{a.name}</div>
                <div className="text-[9px] text-foreground/50 leading-snug">{a.desc?.slice(0, 150)}{a.desc?.length > 150 ? '…' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Effect trail ─────────────────────────────────────────────────────────────

function EffectTrail({ targetName }: { targetName: string }) {
  const [events, setEvents] = useState<EffectEvent[]>([]);

  useEffect(() => {
    dmFetch('/api/effect-timeline')
      .then(r => r.json())
      .then((all: EffectEvent[]) => {
        setEvents(all.filter(e => e.target_name === targetName).slice(-8));
      })
      .catch(() => {});

    const handler = (all: EffectEvent[]) => {
      setEvents(all.filter(e => e.target_name === targetName).slice(-8));
    };
    socket.on('timeline_update', handler);
    return () => { socket.off('timeline_update', handler); };
  }, [targetName]);

  if (events.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground/40 italic py-2">No recorded effects yet.</p>
    );
  }

  return (
    <div className="space-y-0.5">
      {events.map(ev => {
        const isUndo = ev.phase === 'undo';
        const label = EVENT_LABEL[isUndo ? 'undo' : ev.event_type] ?? '???';
        const color = EVENT_COLOR[isUndo ? 'undo' : ev.event_type] ?? 'text-muted-foreground';
        const isReversed = ev.is_reversed === 1;
        return (
          <div key={ev.id} className={`flex items-center gap-1.5 text-[9px] ${isReversed ? 'opacity-40' : ''}`}>
            <span className={`font-bold ${color} w-9 shrink-0`}>{label}</span>
            <span className={`text-foreground/60 flex-1 ${isReversed ? 'line-through' : ''}`}>
              {miniEventSummary(ev)}
            </span>
            {isReversed && <RotateCcw className="h-2 w-2 text-slate-500 shrink-0" />}
            <span className="text-muted-foreground/30 font-mono shrink-0">R{ev.session_round}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CombatantSidebar({ combatant, onClose }: CombatantSidebarProps) {
  const isOpen = combatant !== null;
  const hp = combatant?.current_hp ?? 0;
  const maxHp = combatant?.max_hp ?? 1;
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const isDead = hp <= 0;
  const hpBarColor = isDead ? 'bg-muted-foreground/40'
    : hpPct > 50 ? 'bg-health'
    : hpPct > 25 ? 'bg-gold'
    : 'bg-destructive';
  const hpTextColor = isDead ? 'text-muted-foreground'
    : hpPct > 50 ? 'text-health'
    : hpPct > 25 ? 'text-gold'
    : 'text-destructive';
  const isPC = combatant?.entity_type === 'pc';
  const hasStats = combatant?.stats_json && Object.keys(combatant.stats_json).length > 0;

  return (
    <Sheet open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="w-80 sm:max-w-sm bg-[hsl(240_10%_7%)] border-l border-primary/20 p-0 flex flex-col"
      >
        {combatant && (
          <>
            {/* Header */}
            <SheetHeader className="px-4 pt-5 pb-3 border-b border-primary/10 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <SheetTitle className="font-display text-primary leading-tight">
                    {combatant.entity_name}
                  </SheetTitle>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isPC ? (
                      <Badge variant="outline" className="text-[7px] h-3.5 px-1 border-blue-500/30 text-blue-400">PC</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[7px] h-3.5 px-1 border-red-500/30 text-red-400">
                        {combatant.entity_type === 'monster' ? 'MONSTER' : 'NPC'}
                      </Badge>
                    )}
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Shield className="h-2.5 w-2.5 text-mana" /> {combatant.ac}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xl font-bold tabular-nums leading-none ${hpTextColor}`}>
                    {hp}
                  </div>
                  <div className="text-[9px] text-muted-foreground/50">/ {maxHp} HP</div>
                </div>
              </div>

              {/* HP bar */}
              <div className="h-1.5 rounded-full bg-secondary/30 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${hpBarColor}`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>

              {/* Conditions */}
              {(combatant.conditions.length > 0 || combatant.concentrating_on) && (
                <div className="flex flex-wrap gap-1">
                  {combatant.concentrating_on && (
                    <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/30 leading-none flex items-center gap-0.5">
                      <Zap className="h-2 w-2" />
                      {combatant.concentrating_on.length > 12
                        ? combatant.concentrating_on.slice(0, 12) + '…'
                        : combatant.concentrating_on}
                    </span>
                  )}
                  {combatant.conditions.map(cond => (
                    <span key={cond} className="text-[7px] font-bold px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 leading-none">
                      {cond}
                    </span>
                  ))}
                </div>
              )}
            </SheetHeader>

            {/* Body */}
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-5">
                {/* Stat block */}
                {hasStats && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-primary/50 font-bold mb-2">Stat Block</div>
                    <StatBlock stats={combatant.stats_json!} />
                  </div>
                )}
                {!hasStats && !isPC && (
                  <p className="text-[10px] text-muted-foreground/40 italic">
                    No stat block — quick-spawned without Compendium data.
                  </p>
                )}
                {isPC && !hasStats && (
                  <p className="text-[10px] text-muted-foreground/40 italic">
                    Full PC stats available on the character sheet.
                  </p>
                )}

                {/* Effect trail */}
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-primary/50 font-bold mb-2">
                    Effect History
                  </div>
                  <EffectTrail targetName={combatant.entity_name} />
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
