import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Shield, Activity, User, Eye } from 'lucide-react';

interface InspectorData {
  characterId: string;
  name: string;
  acDetails: {
    base: number;
    dexBonus: number;
    armor: any;
    shield: any;
    finalAC: number;
  };
  abilityScores: Record<string, { base: number; equipmentBonus: number; final: number; modifier: number }>;
  activeConditions: string[];
  activeBuffs: any[];
}

interface CombatStateInspectorModalProps {
  characterId: string;
  characterName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CombatStateInspectorModal({ characterId, characterName, open, onOpenChange }: CombatStateInspectorModalProps) {
  const [data, setData] = useState<InspectorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && characterId) {
      setLoading(true);
      setError(null);
      fetch(`/api/characters/${characterId}/combat-inspector`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch inspector data');
          return res.json();
        })
        .then(data => {
          setData(data);
        })
        .catch(err => {
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, characterId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-background/95 backdrop-blur border-primary/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Eye className="h-5 w-5 text-primary" />
            Combat State Inspector: {characterName}
          </DialogTitle>
          <DialogDescription>
            Real-time breakdown of stat modifiers, equipment bonuses, and active effects.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">Scanning state matrix...</div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">{error}</div>
        ) : data ? (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 pb-4">
              
              {/* AC Breakdown */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold border-b border-border pb-1">
                  <Shield className="h-4 w-4 text-mana" /> Armor Class Resolution
                </h3>
                <div className="bg-secondary/30 rounded-lg p-3 space-y-1 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base AC:</span>
                    <span>{data.acDetails.base}</span>
                  </div>
                  {data.acDetails.dexBonus !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">DEX Modifier{data.acDetails.armor?.dexCap !== null && data.acDetails.armor?.dexCap !== undefined ? ` (Cap: ${data.acDetails.armor?.dexCap})` : ''}:</span>
                      <span className={data.acDetails.dexBonus > 0 ? "text-mana" : "text-destructive"}>
                        {data.acDetails.dexBonus > 0 ? '+' : ''}{data.acDetails.dexBonus}
                      </span>
                    </div>
                  )}
                  {data.acDetails.armor && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Armor ({data.acDetails.armor.name}):</span>
                      <span>{data.acDetails.armor.ac}</span>
                    </div>
                  )}
                  {data.acDetails.shield && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shield ({data.acDetails.shield.name}):</span>
                      <span className="text-mana">+{data.acDetails.shield.ac}</span>
                    </div>
                  )}
                  <div className="pt-2 mt-2 border-t border-border flex justify-between font-bold text-base">
                    <span>Final AC:</span>
                    <span className="text-mana">{data.acDetails.finalAC}</span>
                  </div>
                </div>
              </div>

              {/* Ability Scores */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold border-b border-border pb-1">
                  <User className="h-4 w-4 text-primary" /> Ability Scores
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(data.abilityScores).map(([stat, details]) => (
                    <div key={stat} className="bg-secondary/30 rounded-lg p-2 text-xs font-mono">
                      <div className="font-bold text-center mb-1 text-foreground">{stat.toUpperCase()}</div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base:</span>
                        <span>{details.base}</span>
                      </div>
                      {details.equipmentBonus !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Equip:</span>
                          <span className="text-mana">+{details.equipmentBonus}</span>
                        </div>
                      )}
                      <div className="border-t border-border mt-1 pt-1 flex justify-between font-bold">
                        <span>Total:</span>
                        <span>{details.final} <span className="text-primary text-[10px]">({details.modifier > 0 ? '+' : ''}{details.modifier})</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold border-b border-border pb-1">
                  <Activity className="h-4 w-4 text-destructive" /> Active Conditions
                </h3>
                {data.activeConditions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {data.activeConditions.map((cond, idx) => (
                      <Badge key={idx} variant="destructive">{cond}</Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">None</div>
                )}
              </div>

            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
