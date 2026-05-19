import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { History, ShieldAlert, Clock, Undo2, ChevronRight, UserMinus, UserPlus, Heart, Zap, Sparkles, AlertTriangle, ArrowLeft } from 'lucide-react';
import socket from '../socket';
import { toast } from 'sonner';

interface CombatRecoveryModalProps {
  open: boolean;
  onClose: () => void;
}

interface Snapshot {
  id: number;
  snapshot_time: string;
  description: string;
  combat_round: number;
  combat_turn_index: number;
}

interface SnapshotDiff {
  id: number;
  description: string;
  timestamp: string;
  chronology: {
    round: { current: number; snapshot: number; changed: boolean };
    turnIndex: { current: number; snapshot: number; changed: boolean };
  };
  roster: {
    added: Array<{ id: string; name: string; type: string; hp: number; maxHp: number }>;
    removed: Array<{ id: string; name: string; type: string; hp: number; maxHp: number }>;
    changed: Array<{
      id: string;
      name: string;
      type: string;
      hp: { current: number; snapshot: number; changed: boolean };
      ac: { current: number; snapshot: number; changed: boolean };
      initiative: { current: number; snapshot: number; changed: boolean };
      isActive: { current: boolean; snapshot: boolean; changed: boolean };
    }>;
  };
  characters: Array<{
    id: number;
    name: string;
    hp: {
      current: { hp: number; temp: number };
      snapshot: { hp: number; temp: number };
      changed: boolean;
    };
    conditions: {
      added: string[];
      removed: string[];
      changed: boolean;
    };
    spellSlots: {
      changed: Array<{ level: string; currentUsed: number; snapUsed: number }>;
    };
    buffs: {
      added: string[];
      removed: string[];
      changed: boolean;
    };
  }>;
}

export function CombatRecoveryModal({ open, onClose }: CombatRecoveryModalProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState<number | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<SnapshotDiff | null>(null);
  const [loadingDiffId, setLoadingDiffId] = useState<number | null>(null);

  const fetchSnapshots = () => {
    setIsLoading(true);
    socket.emit('get_combat_snapshots', (res: { success: boolean; snapshots?: Snapshot[]; error?: string }) => {
      setIsLoading(false);
      if (res.success && res.snapshots) {
        setSnapshots(res.snapshots);
      } else {
        toast.error('Failed to load snapshots: ' + res.error);
      }
    });
  };

  useEffect(() => {
    if (open) {
      fetchSnapshots();
      setSelectedDiff(null);
    }
  }, [open]);

  const handlePreview = (id: number) => {
    setLoadingDiffId(id);
    socket.emit('get_combat_snapshot_diff', { snapshotId: id }, (res: { success: boolean; diff?: SnapshotDiff; error?: string }) => {
      setLoadingDiffId(null);
      if (res.success && res.diff) {
        setSelectedDiff(res.diff);
      } else {
        toast.error('Failed to fetch snapshot difference preview: ' + res.error);
      }
    });
  };

  const handleRestore = (id: number) => {
    setIsRestoring(id);
    socket.emit('restore_combat_snapshot', { snapshotId: id }, (res: { success: boolean; error?: string }) => {
      setIsRestoring(null);
      if (res.success) {
        toast.success('🔮 Combat and character states rolled back successfully!');
        setSelectedDiff(null);
        onClose();
      } else {
        toast.error('Failed to restore snapshot: ' + res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-950/95 border-amber-900/40 text-slate-100 backdrop-blur-md max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display flex items-center gap-2 text-amber-400">
            <History className="h-5 w-5 text-amber-500" /> 
            {selectedDiff ? 'Chronology Reversion Preview' : 'Chronology Recovery Console'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {selectedDiff ? (
            /* ── Dual-Stage Preview Screen ────────────────────────────── */
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-0"
                onClick={() => setSelectedDiff(null)}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Timelines
              </Button>

              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-xs text-amber-300/90 flex gap-2.5 items-start">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-bold">Proposed Reversion Chronometer:</span> You are about to roll back your live game to checkpoint <strong className="text-amber-200">"{selectedDiff.description}"</strong> from <strong className="text-amber-200">{new Date(selectedDiff.timestamp).toLocaleTimeString()}</strong>. Review all computed deltas carefully below.
                </div>
              </div>

              {/* Chronology shift */}
              <div className="p-3.5 bg-secondary/15 rounded-lg border border-border/25 space-y-2">
                <h4 className="text-[10px] uppercase font-bold text-amber-500/80 tracking-wider">Combat Chronology Shift</h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Round Index:</span>{' '}
                    {selectedDiff.chronology.round.changed ? (
                      <span className="flex items-center gap-1.5 mt-0.5">
                        <span className="line-through text-muted-foreground/60">{selectedDiff.chronology.round.current || 'Out of Combat'}</span>
                        <ChevronRight className="h-3 w-3 text-amber-500" />
                        <span className="text-amber-400 font-bold">{selectedDiff.chronology.round.snapshot || 'Out of Combat'}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300 block mt-0.5">{selectedDiff.chronology.round.current || 'Out of Combat'}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Active Turn:</span>{' '}
                    {selectedDiff.chronology.turnIndex.changed ? (
                      <span className="flex items-center gap-1.5 mt-0.5">
                        <span className="line-through text-muted-foreground/60">Index {selectedDiff.chronology.turnIndex.current + 1}</span>
                        <ChevronRight className="h-3 w-3 text-amber-500" />
                        <span className="text-amber-400 font-bold">Index {selectedDiff.chronology.turnIndex.snapshot + 1}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300 block mt-0.5">Index {selectedDiff.chronology.turnIndex.current + 1}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Roster mutations */}
              {(selectedDiff.roster.added.length > 0 || selectedDiff.roster.removed.length > 0 || selectedDiff.roster.changed.length > 0) && (
                <div className="p-3.5 bg-secondary/15 rounded-lg border border-border/25 space-y-3">
                  <h4 className="text-[10px] uppercase font-bold text-amber-500/80 tracking-wider">Initiative Tracker Roster Changes</h4>
                  <div className="space-y-2 text-xs">
                    {selectedDiff.roster.added.map(item => (
                      <div key={item.id} className="flex items-center gap-2 text-rose-400 bg-rose-500/5 px-2.5 py-1.5 rounded border border-rose-500/10">
                        <UserMinus className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        <span><strong>{item.name}</strong> ({item.type}) will be removed from initiative</span>
                      </div>
                    ))}
                    {selectedDiff.roster.removed.map(item => (
                      <div key={item.id} className="flex items-center gap-2 text-green-400 bg-green-500/5 px-2.5 py-1.5 rounded border border-green-500/10">
                        <UserPlus className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span><strong>{item.name}</strong> ({item.type}) will be restored into initiative</span>
                      </div>
                    ))}
                    {selectedDiff.roster.changed.map(item => (
                      <div key={item.id} className="flex flex-col gap-1 p-2 rounded bg-secondary/20 border border-border/10 font-mono text-[11px]">
                        <div className="font-semibold text-foreground font-display text-xs mb-1">{item.name}</div>
                        {item.hp.changed && (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Heart className="h-3 w-3 text-red-500 shrink-0" />
                            <span>HP:</span>
                            <span className="line-through text-muted-foreground/50">{item.hp.current}</span>
                            <ChevronRight className="h-3 w-3 text-amber-500" />
                            <span className="text-amber-400 font-bold">{item.hp.snapshot}</span>
                          </div>
                        )}
                        {item.ac.changed && (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <span>AC:</span>
                            <span className="line-through text-muted-foreground/50">{item.ac.current}</span>
                            <ChevronRight className="h-3 w-3 text-amber-500" />
                            <span className="text-amber-400 font-bold">{item.ac.snapshot}</span>
                          </div>
                        )}
                        {item.isActive.changed && (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <span>Active Turn:</span>
                            <span className="text-muted-foreground/50">{item.isActive.current ? 'Yes' : 'No'}</span>
                            <ChevronRight className="h-3 w-3 text-amber-500" />
                            <span className="text-amber-400 font-bold">{item.isActive.snapshot ? 'Yes' : 'No'}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Character Session States */}
              {selectedDiff.characters.length > 0 && (
                <div className="p-3.5 bg-secondary/15 rounded-lg border border-border/25 space-y-3">
                  <h4 className="text-[10px] uppercase font-bold text-amber-500/80 tracking-wider">Character Sheets & Stats Rollback</h4>
                  <div className="space-y-3">
                    {selectedDiff.characters.map(char => (
                      <div key={char.id} className="p-3 rounded-lg bg-slate-950 border border-amber-950/40 space-y-2">
                        <div className="font-display font-semibold text-amber-400 text-sm border-b border-border/20 pb-1">{char.name}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                          {/* HP delta */}
                          {char.hp.changed && (
                            <div className="flex items-center gap-1.5">
                              <Heart className="h-3.5 w-3.5 text-red-500" />
                              <span>HP:</span>
                              <span className="text-muted-foreground/60">{char.hp.current.hp} ({char.hp.current.temp}t)</span>
                              <ChevronRight className="h-3 w-3 text-amber-500" />
                              <span className="text-amber-400 font-bold">{char.hp.snapshot.hp} ({char.hp.snapshot.temp}t)</span>
                            </div>
                          )}

                          {/* Spell slots */}
                          {char.spellSlots.changed.map(slot => (
                            <div key={slot.level} className="flex items-center gap-1.5 col-span-2">
                              <Zap className="h-3.5 w-3.5 text-amber-500" />
                              <span>Lvl {slot.level} slots used:</span>
                              <span className="text-muted-foreground/60">{slot.currentUsed}</span>
                              <ChevronRight className="h-3 w-3 text-amber-500" />
                              <span className="text-amber-400 font-bold">{slot.snapUsed}</span>
                            </div>
                          ))}

                          {/* Conditions */}
                          {char.conditions.changed && (
                            <div className="col-span-2 space-y-1 mt-1">
                              <div className="text-[10px] text-muted-foreground">Conditions adjustment:</div>
                              {char.conditions.removed.map(c => (
                                <span key={c} className="inline-flex items-center gap-1 text-[10px] font-display font-semibold px-2 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20 mr-1.5">
                                  ➕ Restores: {c}
                                </span>
                              ))}
                              {char.conditions.added.map(c => (
                                <span key={c} className="inline-flex items-center gap-1 text-[10px] font-display font-semibold px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded border border-rose-500/20 mr-1.5">
                                  ❌ Removes: {c}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Buffs */}
                          {char.buffs.changed && (
                            <div className="col-span-2 space-y-1 mt-1">
                              <div className="text-[10px] text-muted-foreground">Active buffs adjustment:</div>
                              {char.buffs.removed.map(b => (
                                <span key={b} className="inline-flex items-center gap-1 text-[10px] font-display font-semibold px-2 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20 mr-1.5">
                                  ➕ Restores Buff: {b}
                                </span>
                              ))}
                              {char.buffs.added.map(b => (
                                <span key={b} className="inline-flex items-center gap-1 text-[10px] font-display font-semibold px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded border border-rose-500/20 mr-1.5">
                                  ❌ Removes Buff: {b}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDiff.characters.length === 0 &&
               selectedDiff.roster.added.length === 0 &&
               selectedDiff.roster.removed.length === 0 &&
               selectedDiff.roster.changed.length === 0 &&
               !selectedDiff.chronology.round.changed && (
                 <div className="py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border/20 rounded-lg">
                   Live campaign state is completely synchronized with this checkpoint. No adjustments required!
                 </div>
               )}

              {/* Confirm / Revert buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-border/20">
                <Button
                  variant="outline"
                  className="border-border/40 text-slate-300 hover:bg-secondary/40 font-display text-xs"
                  onClick={() => setSelectedDiff(null)}
                  disabled={isRestoring !== null}
                >
                  Cancel Reversion
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-slate-950 font-display font-bold text-xs"
                  onClick={() => handleRestore(selectedDiff.id)}
                  disabled={isRestoring !== null}
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                  {isRestoring ? 'Applying Rollback...' : 'Confirm & Rollback State'}
                </Button>
              </div>
            </div>
          ) : (
            /* ── Checkpoints Timeline Roster Screen ───────────────────── */
            <div className="space-y-4">
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive-foreground/90 flex gap-2.5 items-start">
                <ShieldAlert className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                <div>
                  <span className="font-bold">Cautionary DM Directive:</span> Restoring a checkpoint wipes all subsequent combat developments, reverting player hit points, spell slots, active condition timers, and the initiative round order to this snapshot point. Use this to recover from server crashes, accidental page resets, or misclicks.
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center justify-between">
                  <span>Timeline Checkpoints (Latest 20)</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] hover:bg-secondary/30" onClick={fetchSnapshots} disabled={isLoading}>
                    Refresh Timeline
                  </Button>
                </h4>

                {isLoading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
                    🔮 Querying the cosmic ledger...
                  </div>
                ) : snapshots.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border/20 rounded-lg">
                    No combat checkpoints recorded in the chronicle yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {snapshots.map((snap) => {
                      const formattedTime = new Date(snap.snapshot_time).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });

                      return (
                        <div
                          key={snap.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-amber-950/20 bg-secondary/10 hover:bg-secondary/20 hover:border-amber-500/20 transition-all gap-4"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="font-display font-semibold text-sm text-foreground flex items-center gap-2 truncate">
                              {snap.description}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-amber-500/50" /> {formattedTime}
                              </span>
                              {snap.combat_round > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                                  Round {snap.combat_round}
                                </span>
                              )}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0 font-display text-xs"
                            disabled={loadingDiffId !== null}
                            onClick={() => handlePreview(snap.id)}
                          >
                            <Undo2 className="h-3.5 w-3.5 mr-1" />
                            {loadingDiffId === snap.id ? 'Previewing...' : 'Restore'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
