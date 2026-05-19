import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { History, ShieldAlert, Clock, Undo2 } from 'lucide-react';
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

export function CombatRecoveryModal({ open, onClose }: CombatRecoveryModalProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState<number | null>(null);

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
    }
  }, [open]);

  const handleRestore = (id: number, description: string) => {
    if (!confirm(`Are you sure you want to restore the snapshot "${description}"? This will overwrite all active conditions, player HP, and initiative tracker turns.`)) return;
    
    setIsRestoring(id);
    socket.emit('restore_combat_snapshot', { snapshotId: id }, (res: { success: boolean; error?: string }) => {
      setIsRestoring(null);
      if (res.success) {
        toast.success('🔮 Rolled back character and combat status successfully!');
        onClose();
      } else {
        toast.error('Failed to restore snapshot: ' + res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-950/95 border-amber-900/40 text-slate-100 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-amber-400">
            <History className="h-5 w-5 text-amber-500" /> Chronology Recovery Console
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive-foreground/90 flex gap-2.5 items-start">
            <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
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
                        disabled={isRestoring !== null}
                        onClick={() => handleRestore(snap.id, snap.description)}
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                        {isRestoring === snap.id ? 'Restoring...' : 'Restore'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
