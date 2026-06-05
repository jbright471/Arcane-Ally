import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import socket from '../../socket';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Heart, Shield, Zap, Flame, ShieldAlert } from 'lucide-react';

interface SidebarSheetMiniProps {
  open: boolean;
  onClose: () => void;
}

interface FlashTag {
  id: string;
  text: string;
  colorClass: string;
}

export function SidebarSheetMini({ open, onClose }: SidebarSheetMiniProps) {
  const { state } = useGame();
  const { characters } = state;
  const [flashes, setFlashes] = useState<Record<string, FlashTag[]>>({});
  const prevCharsRef = useRef<Record<string, any>>({});

  // Compare character state changes to trigger floating flash status tags
  useEffect(() => {
    const nextFlashes: Record<string, FlashTag[]> = {};

    characters.forEach((char) => {
      const prev = prevCharsRef.current[char.id];
      if (!prev) return; // Skip initial load

      const charFlashes: FlashTag[] = [];

      // 1. Compare Conditions
      const addedConditions = char.conditions.filter((c: string) => !prev.conditions.includes(c));
      const removedConditions = prev.conditions.filter((c: string) => !char.conditions.includes(c));

      addedConditions.forEach((c: string) => {
        charFlashes.push({
          id: `${char.id}-cond-add-${c}-${Date.now()}-${Math.random()}`,
          text: `+${c}`,
          colorClass: 'bg-purple-900/90 text-purple-100 border-purple-500/50 shadow-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.5)]',
        });
      });

      removedConditions.forEach((c: string) => {
        charFlashes.push({
          id: `${char.id}-cond-rem-${c}-${Date.now()}-${Math.random()}`,
          text: `-${c}`,
          colorClass: 'bg-zinc-800/90 text-zinc-400 border-zinc-600/50',
        });
      });

      // 2. Compare Active Buffs
      const prevBuffNames = (prev.activeBuffs || []).map((b: any) => b.name);
      const currBuffNames = (char.activeBuffs || []).map((b: any) => b.name);

      const addedBuffs = (char.activeBuffs || []).filter((b: any) => !prevBuffNames.includes(b.name));
      const removedBuffs = (prev.activeBuffs || []).filter((b: any) => !currBuffNames.includes(b.name));

      addedBuffs.forEach((b: any) => {
        charFlashes.push({
          id: `${char.id}-buff-add-${b.name}-${Date.now()}-${Math.random()}`,
          text: `+${b.name}`,
          colorClass: 'bg-emerald-950/90 text-emerald-100 border-emerald-500/50 shadow-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.5)]',
        });
      });

      removedBuffs.forEach((b: any) => {
        charFlashes.push({
          id: `${char.id}-buff-rem-${b.name}-${Date.now()}-${Math.random()}`,
          text: `-${b.name}`,
          colorClass: 'bg-amber-950/90 text-amber-100 border-amber-500/50',
        });
      });

      // 3. Compare AC
      if (char.ac !== prev.ac) {
        const diff = char.ac - prev.ac;
        charFlashes.push({
          id: `${char.id}-ac-diff-${Date.now()}-${Math.random()}`,
          text: `${diff > 0 ? '+' : ''}${diff} AC`,
          colorClass: diff > 0
            ? 'bg-blue-950/90 text-blue-100 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
            : 'bg-rose-950/90 text-rose-100 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.5)]',
        });
      }

      // 4. Compare Speed
      if (char.speed !== prev.speed) {
        const diff = char.speed - prev.speed;
        charFlashes.push({
          id: `${char.id}-speed-diff-${Date.now()}-${Math.random()}`,
          text: `${diff > 0 ? '+' : ''}${diff} Speed`,
          colorClass: diff > 0
            ? 'bg-teal-950/90 text-teal-100 border border-teal-500/50 shadow-[0_0_10px_rgba(20,184,166,0.5)]'
            : 'bg-rose-950/90 text-rose-100 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.5)]',
        });
      }

      // 5. Compare Ability Scores
      const abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
      abilities.forEach((ab) => {
        const prevScore = prev.abilityScores?.[ab] || 10;
        const currScore = char.abilityScores?.[ab] || 10;
        if (currScore !== prevScore) {
          const diff = currScore - prevScore;
          charFlashes.push({
            id: `${char.id}-stat-${ab}-${Date.now()}-${Math.random()}`,
            text: `${diff > 0 ? '+' : ''}${diff} ${ab}`,
            colorClass: diff > 0
              ? 'bg-indigo-950/90 text-indigo-100 border border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
              : 'bg-rose-950/90 text-rose-100 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.5)]',
          });
        }
      });

      if (charFlashes.length > 0) {
        nextFlashes[char.id] = charFlashes;
      }
    });

    if (Object.keys(nextFlashes).length > 0) {
      setFlashes((prev) => {
        const updated = { ...prev };
        Object.entries(nextFlashes).forEach(([charId, list]) => {
          updated[charId] = [...(updated[charId] || []), ...list];
        });
        return updated;
      });

      // Clear flashes after 2.5s
      Object.entries(nextFlashes).forEach(([charId, list]) => {
        list.forEach((flash) => {
          setTimeout(() => {
            setFlashes((prev) => {
              const charList = prev[charId] || [];
              return {
                ...prev,
                [charId]: charList.filter((f) => f.id !== flash.id),
              };
            });
          }, 2500);
        });
      });
    }

    // Save current states
    const nextRecord: Record<string, any> = {};
    characters.forEach((c) => {
      nextRecord[c.id] = {
        ac: c.ac,
        speed: c.speed,
        conditions: [...c.conditions],
        activeBuffs: c.activeBuffs.map((b: any) => ({ name: b.name })),
        abilityScores: { ...c.abilityScores },
      };
    });
    prevCharsRef.current = nextRecord;
  }, [characters]);

  const handleAdjustHp = (characterId: string, delta: number) => {
    socket.emit('update_hp', {
      characterId: parseInt(characterId, 10),
      delta,
      actor: 'DM',
      damageType: delta < 0 ? 'slashing' : null,
    });
  };

  const handleToggleSpellSlot = (characterId: string, level: number, index: number, slots: { max: number; used: number }) => {
    // index is 0-based index of pips.
    // used slots are represented as index < slots.used.
    // Clicking a used slot restores it (decrements used count).
    // Clicking an unused slot uses it (increments used count).
    const isUsed = index < slots.used;
    const newUsed = isUsed ? slots.used - 1 : slots.used + 1;
    
    socket.emit('update_character', {
      characterId: parseInt(characterId, 10),
      updates: {
        spell_slots: {
          [level]: Math.max(0, Math.min(slots.max, newUsed)),
        },
      },
      actor: 'DM',
    });
  };

  const getAbilityMod = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  return (
    <Sheet open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-md bg-zinc-950/95 border-r border-gold/20 text-zinc-100 flex flex-col p-0 shadow-[0_0_30px_rgba(0,0,0,0.8)]"
      >
        <SheetHeader className="p-6 border-b border-zinc-900 bg-zinc-950 flex flex-row items-center justify-between">
          <SheetTitle className="text-2xl font-display text-gold tracking-wider flex items-center gap-2">
            <Flame className="w-6 h-6 text-gold animate-pulse-glow" />
            Player Miniatures
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {characters.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 font-body italic">
              No connected players in the campaign.
            </div>
          ) : (
            characters.map((char) => {
              const charFlashes = flashes[char.id] || [];

              return (
                <div
                  key={char.id}
                  className="relative bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3 shadow-md hover:border-gold/30 transition-all duration-300 backdrop-blur-sm"
                >
                  {/* Floating Flash Tags Container */}
                  <div className="absolute right-3 top-3 flex flex-col gap-1 z-20 pointer-events-none items-end">
                    {charFlashes.map((flash) => (
                      <div
                        key={flash.id}
                        className={`px-2 py-0.5 text-[10px] font-display font-bold rounded-md border animate-flash-tag transition-all ${flash.colorClass}`}
                      >
                        {flash.text}
                      </div>
                    ))}
                  </div>

                  {/* Header Row */}
                  <div className="flex justify-between items-start pr-12">
                    <div>
                      <h3 className="text-lg font-display text-zinc-100 tracking-wide">{char.name}</h3>
                      <p className="text-xs text-zinc-400 font-body">
                        Level {char.level} {char.class}
                      </p>
                    </div>

                    {/* AC and Speed badges */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-zinc-950/80 px-2 py-1 rounded border border-zinc-800 text-gold" title="Armor Class">
                        <Shield className="w-3.5 h-3.5 text-gold" />
                        <span className="text-xs font-bold font-display">{char.ac}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-zinc-950/80 px-2 py-1 rounded border border-zinc-800 text-teal-400" title="Speed">
                        <Zap className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold font-display">{char.speed}</span>
                      </div>
                    </div>
                  </div>

                  {/* HP & Quick Adjustments */}
                  <div className="bg-zinc-950/40 p-2.5 rounded-md border border-zinc-900/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-400 font-body">Hit Points</span>
                        <span className="text-sm font-bold font-display">
                          {char.hp.current} / {char.hp.max}
                          {char.hp.temp > 0 && (
                            <span className="text-emerald-400 text-xs ml-1">(+{char.hp.temp} Temp)</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-9 text-xs border-rose-950/80 hover:bg-rose-950/20 text-rose-400"
                        onClick={() => handleAdjustHp(char.id, -5)}
                      >
                        -5
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-9 text-xs border-emerald-950/80 hover:bg-emerald-950/20 text-emerald-400"
                        onClick={() => handleAdjustHp(char.id, 5)}
                      >
                        +5
                      </Button>
                    </div>
                  </div>

                  {/* Ability Scores Grid */}
                  <div className="grid grid-cols-6 gap-1 bg-zinc-950/20 p-1 rounded-md border border-zinc-900/50">
                    {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((ab) => {
                      const score = char.abilityScores?.[ab] ?? 10;
                      const mod = getAbilityMod(score);
                      return (
                        <div key={ab} className="flex flex-col items-center py-1 bg-zinc-950/40 rounded border border-zinc-900/40">
                          <span className="text-[10px] text-zinc-500 font-display font-semibold">{ab}</span>
                          <span className="text-xs font-bold text-zinc-200 font-display mt-0.5">{mod}</span>
                          <span className="text-[9px] text-zinc-600 font-body">{score}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Spell Slots Section */}
                  {Object.keys(char.spellSlots || {}).length > 0 && (
                    <div className="space-y-1.5 mt-1 border-t border-zinc-900 pt-2">
                      <span className="text-xs text-zinc-400 font-display tracking-wider block">Spell Slots</span>
                      <div className="space-y-1">
                        {Object.entries(char.spellSlots).map(([lvlStr, slots]: [string, any]) => {
                          const lvl = parseInt(lvlStr, 10);
                          if (!slots || slots.max <= 0) return null;

                          return (
                            <div key={lvl} className="flex items-center justify-between text-xs py-0.5">
                              <span className="text-zinc-500 font-body">Lvl {lvl}</span>
                              <div className="flex gap-1">
                                {Array.from({ length: slots.max }).map((_, idx) => {
                                  const isUsed = idx < slots.used;
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => handleToggleSpellSlot(char.id, lvl, idx, slots)}
                                      className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${
                                        isUsed
                                          ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 shadow-inner'
                                          : 'bg-gold/80 border-gold shadow-[0_0_6px_rgba(255,215,0,0.4)] hover:bg-gold/50'
                                      }`}
                                      title={isUsed ? "Restore Spell Slot" : "Use Spell Slot"}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Conditions List */}
                  {char.conditions && char.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {char.conditions.map((cond: string) => (
                        <span
                          key={cond}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/40 text-purple-300 border border-purple-900/60 font-display flex items-center gap-1"
                        >
                          <ShieldAlert className="w-2.5 h-2.5" />
                          {cond}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
