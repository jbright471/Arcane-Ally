import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  History, AlertTriangle, RotateCcw, Camera, ArrowRight,
  Heart, Sparkles, Clock, Check, ShieldAlert, Sparkle, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface GlobalDiff {
  round: { current: number; snapshot: number };
  turnIndex: { current: number; snapshot: number };
  activeEntity: { current: string; snapshot: string };
}

interface CombatantDiff {
  key: string;
  name: string;
  type: string;
  action: 'will_be_readded' | 'will_be_removed' | 'will_be_updated';
  hp: { current: number | null; snapshot: number | null };
  tempHp: { current: number | null; snapshot: number | null };
  conditions: { added: string[]; removed: string[] };
  buffs: { added: string[]; removed: string[] };
  spellSlots: { current: Record<string, number>; snapshot: Record<string, number> };
}

interface SnapshotDiff {
  id: number;
  label: string;
  createdAt: string;
  global: GlobalDiff;
  combatants: CombatantDiff[];
}

interface SnapshotSummary {
  id: number;
  label: string;
  round: number;
  turn_index: number;
  created_at: string;
}

interface CombatRecoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CombatRecoveryModal({ open, onOpenChange }: CombatRecoveryModalProps) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Fetch list of snapshots
  const fetchSnapshots = async () => {
    try {
      const res = await fetch('/api/combat/snapshots');
      if (!res.ok) throw new Error('Failed to load snapshots');
      const data = await res.json();
      setSnapshots(data);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/combat/snapshots/audit');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePurgeLogs = async () => {
    if (!confirm('Are you sure you want to permanently delete all recovery history logs?')) return;
    try {
      const res = await fetch('/api/combat/snapshots/audit', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Recovery history purged successfully.');
        setAuditLogs([]);
      } else {
        throw new Error('Failed to purge logs');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (open) {
      fetchSnapshots();
      fetchAuditLogs();
      setSelectedSnapshotId(null);
      setDiff(null);
      setShowConfirm(false);
      setNewLabel('');
    }
  }, [open]);

  // Fetch snapshot diff when selected
  useEffect(() => {
    if (selectedSnapshotId) {
      setLoading(true);
      setDiff(null);
      setShowConfirm(false);
      fetch(`/api/combat/snapshots/${selectedSnapshotId}/diff`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to compute state comparison');
          return res.json();
        })
        .then(data => {
          setDiff(data);
        })
        .catch(err => {
          toast.error(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setDiff(null);
    }
  }, [selectedSnapshotId]);

  // Handle manual snapshot creation
  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/combat/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim() || undefined })
      });
      if (!res.ok) throw new Error('Failed to create snapshot');
      const data = await res.json();
      toast.success(`Combat snapshot "${data.label}" successfully saved!`);
      setNewLabel('');
      fetchSnapshots();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Handle restore action
  const handleRestore = async () => {
    if (!selectedSnapshotId) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/combat/snapshots/${selectedSnapshotId}/restore`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to restore snapshot');
      const data = await res.json();
      toast.success(`Success! Rolled back combat to: "${data.label}"`);
      onOpenChange(false);
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRestoring(false);
      setShowConfirm(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'Z'); // sqlite datetimes are usually UTC
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] w-[95vw] max-h-[90vh] bg-background/95 backdrop-blur-md border-primary/20 flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary">
            <History className="h-5 w-5" />
            Combat Rollback & Encounter Snapshots
          </DialogTitle>
          <DialogDescription>
            Preview and restore historical snapshots of the encounter. Volatile states like character HPs, status conditions, spell slots, and the active initiative sequence will be precisely rolled back.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 flex-1 min-h-0 overflow-hidden">
          {/* Left Panel: Snapshot List and Creation */}
          <div className="md:col-span-4 flex flex-col space-y-4 min-h-0 overflow-hidden border-r border-border/30 pr-4">
            <form onSubmit={handleCreateSnapshot} className="space-y-2 shrink-0">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Take Manual Snapshot</label>
              <div className="flex gap-2">
                <Input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="e.g. Before Fireball..."
                  className="h-8 text-xs bg-secondary/20"
                />
                <Button type="submit" size="sm" className="h-8 px-3 text-xs shrink-0" disabled={creating}>
                  {creating ? <Sparkle className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3 mr-1" />}
                  Save
                </Button>
              </div>
            </form>

            <div className="flex-1 flex flex-col min-h-0">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Available Snapshots</label>
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-1.5 pb-2">
                  {snapshots.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground italic bg-secondary/5 border border-dashed border-border/30 rounded-lg">
                      No snapshots recorded yet.
                    </div>
                  ) : (
                    snapshots.map(snap => (
                      <button
                        key={snap.id}
                        onClick={() => setSelectedSnapshotId(snap.id)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all duration-200 relative group flex flex-col gap-1 ${
                          selectedSnapshotId === snap.id
                            ? 'bg-primary/10 border-primary/45 shadow-sm'
                            : 'bg-secondary/15 border-transparent hover:border-border/40 hover:bg-secondary/25'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground truncate max-w-[130px]">{snap.label}</span>
                          <span className="text-[10px] font-mono bg-secondary/40 text-muted-foreground px-1 py-0.5 rounded leading-none shrink-0">
                            ID: {snap.id}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 mt-1">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {formatDate(snap.created_at)}
                          </span>
                          <Badge variant="outline" className="text-[9px] h-4 font-mono leading-none bg-background/50">
                            R{snap.round} • T{snap.turn_index + 1}
                          </Badge>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Audit Logs panel */}
            <div className="flex-1 flex flex-col min-h-0 border-t border-border/30 pt-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Recovery History</label>
                {auditLogs.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={handlePurgeLogs} className="h-5 px-2 text-[9px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    Purge
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1 pr-2">
                <div className="space-y-1.5 pb-2">
                  {auditLogs.length === 0 ? (
                    <div className="py-4 text-center text-[10px] text-muted-foreground italic bg-secondary/5 border border-dashed border-border/30 rounded-lg">
                      No recovery history recorded.
                    </div>
                  ) : (
                    auditLogs.map(log => {
                      let changedEntities = [];
                      try {
                        changedEntities = JSON.parse(log.changed_entities_json);
                      } catch (e) {}
                      return (
                        <div key={log.id} className="w-full text-left p-2 rounded-lg border text-xs bg-secondary/15 border-border/20 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground truncate max-w-[130px] capitalize">
                              {log.action_type}
                            </span>
                            <span className={`text-[9px] px-1 py-0.5 rounded uppercase font-bold leading-none ${
                               log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {log.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {changedEntities.slice(0, 3).map((e: string, i: number) => (
                              <span key={i} className="text-[9px] bg-background/50 px-1 py-0.5 rounded border border-border/30 text-muted-foreground truncate max-w-[60px]">{e}</span>
                            ))}
                            {changedEntities.length > 3 && (
                              <span className="text-[9px] text-muted-foreground">+{changedEntities.length - 3}</span>
                            )}
                          </div>
                          <div className="text-[9px] text-muted-foreground/80 mt-1 flex justify-between items-center">
                            <span>{formatDate(log.timestamp)}</span>
                            <span className="font-mono opacity-60">Snap ID: {log.snapshot_id}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right Panel: Preview Restore Diff Panel */}
          <div className="md:col-span-8 flex flex-col min-h-0 overflow-hidden">
            {!selectedSnapshotId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground bg-secondary/5 rounded-xl border border-dashed border-border/30">
                <History className="h-10 w-10 text-muted-foreground/30 mb-3 stroke-[1.2]" />
                <h4 className="font-display font-semibold text-foreground/80 text-sm">Select an Encounter Snapshot</h4>
                <p className="text-xs max-w-xs mt-1">Click on a snapshot from the sidebar to inspect its timeline differences and preview the mathematical impacts of a rollback.</p>
              </div>
            ) : loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-muted-foreground/70 animate-pulse">
                <div className="relative w-8 h-8 mb-3 flex items-center justify-center">
                  <div className="absolute inset-0 border-2 border-primary/30 rounded-full" />
                  <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="text-xs font-mono">Computing high-fidelity comparison matrix...</div>
              </div>
            ) : diff ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4">
                {/* Rollback Details Header */}
                <div className="bg-secondary/15 rounded-xl p-3 border border-border/40 shrink-0 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Round Transition</div>
                    <div className="flex items-center justify-center gap-1.5 font-bold mt-1 text-sm">
                      <span className="text-muted-foreground/80">{diff.global.round.current}</span>
                      <ArrowRight className="h-3 w-3 text-primary" />
                      <span className="text-primary">{diff.global.round.snapshot}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Turn Index</div>
                    <div className="flex items-center justify-center gap-1.5 font-bold mt-1 text-sm">
                      <span className="text-muted-foreground/80">Slot {diff.global.turnIndex.current + 1}</span>
                      <ArrowRight className="h-3 w-3 text-primary" />
                      <span className="text-primary">Slot {diff.global.turnIndex.snapshot + 1}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Active Combatant</div>
                    <div className="flex items-center justify-center gap-1.5 font-bold mt-1 text-sm truncate max-w-full">
                      <span className="text-muted-foreground/80 truncate">{diff.global.activeEntity.current}</span>
                      <ArrowRight className="h-3 w-3 text-primary" />
                      <span className="text-primary truncate">{diff.global.activeEntity.snapshot}</span>
                    </div>
                  </div>
                </div>

                {/* Main comparison diff */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Preview Restore Deltas</span>
                    <span className="text-[9px] text-muted-foreground bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                      Comparing {diff.combatants.length} combatant state{diff.combatants.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <ScrollArea className="flex-1 pr-2">
                    <div className="space-y-2 pb-4">
                      {diff.combatants.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground italic bg-secondary/5 border border-dashed border-border/30 rounded-lg">
                          No health or resource variances found between current state and snapshot.
                        </div>
                      ) : (
                        diff.combatants.map(comb => {
                          const isPC = comb.type === 'pc';
                          const hasHpChange = comb.hp.current !== comb.hp.snapshot || comb.tempHp.current !== comb.tempHp.snapshot;
                          const hpDiff = comb.hp.snapshot !== null && comb.hp.current !== null ? comb.hp.snapshot - comb.hp.current : 0;
                          const hasSlots = Object.keys(comb.spellSlots.snapshot).length > 0 || Object.keys(comb.spellSlots.current).length > 0;

                          return (
                            <div key={comb.key} className="bg-secondary/10 border border-border/30 rounded-xl p-3 space-y-2.5">
                              {/* Combatant title line */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-display font-semibold text-xs text-foreground">{comb.name}</span>
                                  <Badge variant="outline" className={`text-[8px] h-3.5 px-1 uppercase ${
                                    isPC ? 'border-primary/30 text-primary bg-primary/5' : 'border-red-500/30 text-red-400 bg-red-500/5'
                                  }`}>
                                    {isPC ? 'PC' : 'Monster'}
                                  </Badge>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider leading-none ${
                                  comb.action === 'will_be_readded'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : comb.action === 'will_be_removed'
                                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {comb.action === 'will_be_readded' ? 'Re-add to list' : comb.action === 'will_be_removed' ? 'Remove' : 'Update'}
                                </span>
                              </div>

                              {/* Grid containing HP, Spell slots and Effects */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                {/* HP and Temp HP Preview */}
                                {hasHpChange && (
                                  <div className="bg-background/40 rounded-lg p-2 border border-border/20 space-y-1">
                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold flex items-center gap-1">
                                      <Heart className="h-3 w-3 text-red-400" /> HP State Transition
                                    </span>
                                    <div className="flex items-center justify-between font-mono mt-1">
                                      <div className="flex items-center gap-1 font-bold">
                                        <span className="text-muted-foreground">{comb.hp.current ?? 'N/A'}</span>
                                        <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                                        <span className={hpDiff > 0 ? "text-health" : hpDiff < 0 ? "text-destructive" : ""}>
                                          {comb.hp.snapshot ?? 'N/A'}
                                        </span>
                                      </div>
                                      {hpDiff !== 0 && (
                                        <span className={`text-[10px] font-bold px-1 py-0.5 rounded leading-none ${
                                          hpDiff > 0 ? "bg-health/20 text-health" : "bg-destructive/20 text-destructive"
                                        }`}>
                                          {hpDiff > 0 ? `+${hpDiff}` : hpDiff} HP
                                        </span>
                                      )}
                                    </div>
                                    {comb.tempHp.current !== comb.tempHp.snapshot && (
                                      <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 pt-0.5">
                                        <span>Temp HP: {comb.tempHp.current ?? 0}</span>
                                        <ArrowRight className="h-2 w-2" />
                                        <span className="text-violet-400 font-bold">{comb.tempHp.snapshot ?? 0}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Spell Slot Pip Grid */}
                                {hasSlots && (
                                  <div className="bg-background/40 rounded-lg p-2 border border-border/20 space-y-1">
                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold flex items-center gap-1">
                                      <Sparkles className="h-3 w-3 text-violet-400" /> Spell Slot Restores
                                    </span>
                                    <div className="grid grid-cols-3 gap-1 pt-1 font-mono text-[9px]">
                                      {Array.from({ length: 9 }).map((_, slotIdx) => {
                                        const tier = slotIdx + 1;
                                        const currUsed = comb.spellSlots.current[tier.toString()] ?? 0;
                                        const snapUsed = comb.spellSlots.snapshot[tier.toString()] ?? 0;
                                        if (currUsed === 0 && snapUsed === 0) return null;

                                        return (
                                          <div key={tier} className="flex justify-between items-center bg-secondary/20 px-1.5 py-0.5 rounded">
                                            <span className="text-muted-foreground font-semibold">T{tier}:</span>
                                            <span className="flex items-center gap-0.5 font-bold">
                                              <span>{currUsed}</span>
                                              <ArrowRight className="h-2 w-2 text-muted-foreground" />
                                              <span className={snapUsed < currUsed ? "text-health" : "text-destructive"}>
                                                {snapUsed}
                                              </span>
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Conditions / Buffs adjustments */}
                              {(comb.conditions.added.length > 0 || comb.conditions.removed.length > 0 ||
                                comb.buffs.added.length > 0 || comb.buffs.removed.length > 0) && (
                                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border/20 text-[10px]">
                                  {/* Added conditions */}
                                  {comb.conditions.added.map(c => (
                                    <Badge key={c} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] py-0 px-1 font-semibold leading-relaxed">
                                      + {c}
                                    </Badge>
                                  ))}
                                  {/* Removed conditions */}
                                  {comb.conditions.removed.map(c => (
                                    <Badge key={c} className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] py-0 px-1 font-semibold leading-relaxed line-through">
                                      - {c}
                                    </Badge>
                                  ))}
                                  {/* Added buffs */}
                                  {comb.buffs.added.map(b => (
                                    <Badge key={b} className="bg-violet-500/20 text-violet-400 border border-violet-500/30 text-[9px] py-0 px-1 font-semibold leading-relaxed">
                                      + {b}
                                    </Badge>
                                  ))}
                                  {/* Removed buffs */}
                                  {comb.buffs.removed.map(b => (
                                    <Badge key={b} className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] py-0 px-1 font-semibold leading-relaxed line-through">
                                      - {b}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Footer warning panel and confirm action buttons */}
                <div className="pt-4 border-t border-border/40 flex items-center justify-between shrink-0 bg-background/50 backdrop-blur p-2 rounded-xl mt-auto">
                  {!showConfirm ? (
                    <>
                      <div className="flex items-center gap-2 text-amber-500/90 max-w-[65%] text-xs">
                        <AlertTriangle className="h-5 w-5 shrink-0 animate-bounce" />
                        <span>Warning: Restoring will overwrite all current hitpoints, status effects, and slots. Ensure you're resolved on this action.</span>
                      </div>
                      <Button
                        onClick={() => setShowConfirm(true)}
                        className="bg-amber-600/90 hover:bg-amber-600 hover:scale-[1.01] transition-transform text-white border-amber-500/30 text-xs font-display flex items-center gap-1.5 shadow"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore Snapshot Preview
                      </Button>
                    </>
                  ) : (
                    <div className="w-full flex flex-col space-y-3 p-1">
                      <div className="bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg text-xs text-rose-400 flex items-center gap-2 font-display">
                        <ShieldAlert className="h-5 w-5 shrink-0" />
                        <span>
                          <strong>CRITICAL ROLLBACK:</strong> You are about to atomically roll back the entire combat session. This action cannot be undone. Are you absolutely certain?
                        </span>
                      </div>
                      <div className="flex justify-end gap-2.5">
                        <Button
                          variant="ghost"
                          onClick={() => setShowConfirm(false)}
                          className="text-xs h-9 hover:bg-secondary/40 font-semibold"
                          disabled={restoring}
                        >
                          <XIcon className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          onClick={handleRestore}
                          className="bg-rose-600 hover:bg-rose-500 hover:scale-[1.01] transition-all text-white font-display text-xs h-9 flex items-center gap-1.5 shadow-md shadow-rose-950/20"
                          disabled={restoring}
                        >
                          {restoring ? (
                            <>
                              <Sparkle className="h-4 w-4 animate-spin" />
                              Rebuilding Space-Time...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              Yes, Restructure Encounter State
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Minimal icons helper
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
