import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { ShieldAlert, Check, X, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ImportDiffModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportDiffModal({ open, onClose }: ImportDiffModalProps) {
  const { state, socket } = useGame();
  const { pendingImports } = state;
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const activeImports = pendingImports || [];
  
  // Set default selected if not set or if selected is no longer in the list
  const currentImport = activeImports.find(p => p.id === selectedId) || activeImports[0];
  if (currentImport && selectedId !== currentImport.id) {
    setSelectedId(currentImport.id);
  }

  const handleResolve = (id: number, approved: boolean) => {
    if (!socket) return;
    socket.emit('resolve_pending_import', { id, approved });
    toast.success(approved ? 'Character changes approved!' : 'Staged character discarded.');
    if (activeImports.length <= 1) {
      onClose();
    }
  };

  const getSeverityColor = (severity: 'danger' | 'warning' | 'info') => {
    switch (severity) {
      case 'danger':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/50';
      case 'warning':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/50';
      default:
        return 'text-zinc-400 bg-zinc-900 border-zinc-800';
    }
  };

  const renderStatsDiff = (diff: any, incomingData: any) => {
    const statKeys = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    const rows = [];

    // Level
    if (diff.level) {
      rows.push({
        name: 'Character Level',
        oldVal: diff.level.old,
        newVal: diff.level.new,
        changed: true,
      });
    }

    // Max HP
    if (diff.maxHp) {
      rows.push({
        name: 'Max HP',
        oldVal: diff.maxHp.old,
        newVal: diff.maxHp.new,
        changed: true,
      });
    }

    // AC
    if (diff.ac) {
      rows.push({
        name: 'Armor Class (AC)',
        oldVal: diff.ac.old,
        newVal: diff.ac.new,
        changed: true,
      });
    }

    // Ability Scores
    statKeys.forEach(stat => {
      if (diff.stats?.[stat]) {
        rows.push({
          name: `${stat} Score`,
          oldVal: diff.stats[stat].old,
          newVal: diff.stats[stat].new,
          changed: true,
        });
      }
    });

    if (rows.length === 0) {
      return (
        <div className="text-center py-4 text-xs text-muted-foreground italic">
          No core statistical changes detected.
        </div>
      );
    }

    return (
      <div className="border border-border/40 rounded-lg overflow-hidden bg-secondary/15">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-border/40 bg-secondary/30 text-muted-foreground uppercase text-[9px] tracking-wider">
              <th className="p-3 font-display">Stat</th>
              <th className="p-3 font-display text-center">Previous</th>
              <th className="p-3 text-center"></th>
              <th className="p-3 font-display text-center">Incoming</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-secondary/10 transition-colors">
                <td className="p-3 font-medium text-foreground">{row.name}</td>
                <td className="p-3 text-center font-mono text-muted-foreground">{row.oldVal}</td>
                <td className="p-3 text-center text-gold">➔</td>
                <td className="p-3 text-center font-mono text-gold font-bold">{row.newVal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderNewCharacterStats = (incomingData: any) => {
    if (!incomingData) return null;
    const stats = typeof incomingData.stats === 'string' ? JSON.parse(incomingData.stats) : (incomingData.stats || {});
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-secondary/20 border border-border/40 rounded-lg text-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Level</span>
            <span className="text-xl font-display font-bold text-gold">{incomingData.level || 1}</span>
          </div>
          <div className="p-3 bg-secondary/20 border border-border/40 rounded-lg text-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Max HP</span>
            <span className="text-xl font-display font-bold text-health">{incomingData.maxHp || incomingData.max_hp || 10}</span>
          </div>
          <div className="p-3 bg-secondary/20 border border-border/40 rounded-lg text-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Base AC</span>
            <span className="text-xl font-display font-bold text-mana">{incomingData.ac || 10}</span>
          </div>
        </div>

        <div className="p-4 bg-secondary/10 border border-border/30 rounded-lg">
          <h4 className="text-[10px] uppercase font-display text-muted-foreground tracking-wider mb-2">Ability Scores</h4>
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(stats).map(([stat, val]) => (
              <div key={stat} className="p-2 bg-secondary/35 border border-border/40 rounded text-center">
                <span className="text-[9px] font-bold block text-muted-foreground uppercase">{stat}</span>
                <span className="text-sm font-mono font-bold text-foreground">{val as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl border-primary/20 bg-card/95 backdrop-blur-md text-foreground shadow-2xl p-0 overflow-hidden animate-in fade-in-50 duration-200">
        <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-secondary/20">
          <DialogTitle className="text-xl font-display tracking-wider flex items-center gap-2 text-primary">
            <ShieldAlert className="h-5 w-5 text-gold" /> Character Sheet Guardrail
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            DM Queue: Approve or reject incoming player character alterations before mutating the combat state.
          </p>
        </DialogHeader>

        {activeImports.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground italic text-sm">
            No pending imports in the approval queue.
          </div>
        ) : (
          <div className="grid grid-cols-12 h-[480px]">
            {/* Sidebar list of pending imports */}
            <div className="col-span-4 border-r border-border/40 bg-secondary/10 flex flex-col">
              <span className="p-3 text-[9px] uppercase font-display text-muted-foreground tracking-wider border-b border-border/35">
                Staged Imports ({activeImports.length})
              </span>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {activeImports.map((item) => {
                    const hasDanger = item.flags?.some((f: any) => f.severity === 'danger');
                    const hasWarning = item.flags?.some((f: any) => f.severity === 'warning');
                    const isNew = !item.characterId;

                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all duration-150 flex flex-col gap-1 ${
                          item.id === currentImport.id
                            ? 'bg-primary/10 border-primary/40 text-gold'
                            : 'border-transparent hover:bg-secondary/40 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="text-xs font-bold block truncate font-display">{item.playerName}</span>
                          {isNew ? (
                            <Badge className="text-[8px] bg-emerald-400/10 text-emerald-400 border border-emerald-500/25 px-1 py-0 rounded">NEW</Badge>
                          ) : (
                            <Badge className="text-[8px] bg-mana/10 text-mana border border-mana/20 px-1 py-0 rounded">SYNC</Badge>
                          )}
                        </div>
                        <span className="text-[9px] truncate font-mono text-muted-foreground/60">{item.url}</span>
                        {item.flags?.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {hasDanger && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" title="Danger alerts" />
                            )}
                            {hasWarning && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Warning alerts" />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Detailed view panel */}
            <div className="col-span-8 flex flex-col bg-card">
              <ScrollArea className="flex-1 p-6 space-y-4">
                <div className="space-y-4">
                  {/* Character Meta */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-display font-bold text-foreground">{currentImport.playerName}</h3>
                      <span className="text-[10px] font-mono text-muted-foreground block">{currentImport.url}</span>
                    </div>
                    {!currentImport.characterId ? (
                      <Badge className="bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 font-display">New Character</Badge>
                    ) : (
                      <Badge className="bg-mana/15 border border-mana/35 text-mana font-display">Existing Character Sync</Badge>
                    )}
                  </div>

                  {/* Warning/Danger Messages */}
                  {currentImport.flags && currentImport.flags.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] uppercase font-display text-muted-foreground tracking-wider">Guardrail Warnings</h4>
                      <div className="space-y-1.5">
                        {currentImport.flags.map((flag: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg border text-xs flex gap-2 items-start ${getSeverityColor(flag.severity)}`}
                          >
                            <Shield className={`h-4 w-4 shrink-0 mt-0.5 ${flag.severity === 'danger' ? 'text-rose-400' : 'text-amber-400'}`} />
                            <div>
                              <span className="font-bold uppercase text-[9px] mr-1 block tracking-wider opacity-80">{flag.severity}</span>
                              <p className="text-foreground">{flag.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats comparison */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] uppercase font-display text-muted-foreground tracking-wider">Statistical Alterations</h4>
                    {currentImport.characterId
                      ? renderStatsDiff(currentImport.diff || {}, currentImport.incomingData)
                      : renderNewCharacterStats(currentImport.incomingData)
                    }
                  </div>
                </div>
              </ScrollArea>

              {/* Bottom Actions */}
              <div className="p-4 border-t border-border/40 bg-secondary/10 flex justify-end gap-3 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-display border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => handleResolve(currentImport.id, false)}
                >
                  <X className="h-4 w-4 mr-1" /> Discard
                </Button>
                <Button
                  size="sm"
                  className="font-display bg-primary text-primary-foreground hover:bg-primary/95"
                  onClick={() => handleResolve(currentImport.id, true)}
                >
                  <Check className="h-4 w-4 mr-1" /> Approve Sync
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
