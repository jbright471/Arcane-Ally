/**
 * SharedLootPool — player-facing card that shows the shared party loot pool.
 *
 * Supports Need/Greed/Pass voting when a DM opens a vote on an item.
 * DM can open votes, force-resolve, or cancel them.
 */

import { useEffect } from 'react';
import { Gem, Swords, Trash2, Vote, X, Zap } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useGame } from '../context/GameContext';
import { toast } from 'sonner';
import socket from '../socket';
import type { LootVote } from '../types/character';

const RARITY_COLORS: Record<string, string> = {
  Common:      'text-foreground/60',
  Uncommon:    'text-green-400',
  Rare:        'text-blue-400',
  'Very Rare': 'text-violet-400',
  Legendary:   'text-amber-400',
  Artifact:    'text-red-400',
};

const RARITY_BORDER: Record<string, string> = {
  Common:      'border-border/40',
  Uncommon:    'border-green-800/30',
  Rare:        'border-blue-800/30',
  'Very Rare': 'border-violet-800/30',
  Legendary:   'border-amber-700/30',
  Artifact:    'border-red-700/30',
};

interface SharedLootPoolProps {
  /** Character that will receive claimed items */
  characterId?: string;
  characterName?: string;
  /** DM mode — show remove/vote-open buttons instead of claim */
  isDm?: boolean;
}

export function SharedLootPool({ characterId, characterName, isDm }: SharedLootPoolProps) {
  const { state } = useGame();
  const items = state.sharedLoot;

  // Listen for loot vote results and show toasts
  useEffect(() => {
    const handler = ({ itemName, winner, winType }: { itemName: string; winner: { id: string; name: string } | null; winType: string }) => {
      if (winner) {
        toast.success(`${winner.name} won ${itemName}! (${winType})`, { duration: 6000 });
      } else {
        toast.info(`No one claimed ${itemName} — it stays in the pool.`, { duration: 5000 });
      }
    };
    socket.on('loot_vote_result', handler);
    return () => { socket.off('loot_vote_result', handler); };
  }, []);

  if (items.length === 0) return null;

  const handleClaim = (lootId: number, itemName: string) => {
    if (!characterId || !characterName) {
      toast.error('No character selected to claim loot.');
      return;
    }
    socket.emit('claim_loot', {
      lootId,
      characterId: parseInt(characterId),
      characterName,
    });
    toast.success(`${characterName} claimed ${itemName}!`);
  };

  const handleRemove = (lootId: number) => {
    socket.emit('remove_loot', { lootId });
  };

  const handleOpenVote = (lootId: number) => {
    socket.emit('loot_vote_open', { lootId });
  };

  const handleCancelVote = (lootId: number) => {
    socket.emit('loot_vote_cancel', { lootId });
  };

  const handleForceResolve = (lootId: number) => {
    socket.emit('loot_vote_force_resolve', { lootId });
  };

  const handleVote = (lootId: number, vote: LootVote) => {
    if (!characterId || !characterName) {
      toast.error('No character selected.');
      return;
    }
    socket.emit('loot_vote_cast', {
      lootId,
      vote,
      characterId: parseInt(characterId),
      characterName,
    });
  };

  return (
    <Card className="border-gold/20 bg-gold/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-sm flex items-center gap-2 text-gold">
          <Gem className="h-4 w-4" />
          Party Loot Pool
          <Badge variant="outline" className="text-[9px] ml-auto border-gold/30 text-gold">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map(item => {
          const stats = item.stats as Record<string, unknown>;
          const category = (stats?.category as string) || item.category || 'Item';
          const voteState = item.voteState;
          const isVoteOpen = voteState?.status === 'open';
          const myVote = characterId ? voteState?.votes[characterId]?.vote : undefined;
          const needCount  = isVoteOpen ? Object.values(voteState!.votes).filter(v => v.vote === 'need').length  : 0;
          const greedCount = isVoteOpen ? Object.values(voteState!.votes).filter(v => v.vote === 'greed').length : 0;
          const passCount  = isVoteOpen ? Object.values(voteState!.votes).filter(v => v.vote === 'pass').length  : 0;

          return (
            <div
              key={item.id}
              className={`rounded-lg border p-3 bg-secondary/20 space-y-1.5 ${RARITY_BORDER[item.rarity] || 'border-border/40'} ${isVoteOpen ? 'ring-1 ring-amber-500/30' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`font-display text-sm font-bold ${RARITY_COLORS[item.rarity] || ''}`}>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[8px] h-4">{item.rarity}</Badge>
                    <span className="text-[9px] text-muted-foreground">{category}</span>
                    {isVoteOpen && (
                      <Badge className="text-[8px] h-4 bg-amber-600/80 text-white border-0">
                        <Vote className="h-2.5 w-2.5 mr-0.5" /> Voting
                      </Badge>
                    )}
                  </div>
                </div>

                {/* DM controls */}
                {isDm && (
                  <div className="flex items-center gap-1 shrink-0">
                    {isVoteOpen ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[9px] text-emerald-400 hover:text-emerald-300"
                          onClick={() => handleForceResolve(item.id)}
                          title="Force resolve vote now"
                        >
                          <Zap className="h-3 w-3" />
                        </Button>
                        <button
                          onClick={() => handleCancelVote(item.id)}
                          className="text-muted-foreground/30 hover:text-destructive/70 transition-colors"
                          title="Cancel vote"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[9px] text-amber-400 hover:text-amber-300"
                          onClick={() => handleOpenVote(item.id)}
                          title="Open Need/Greed vote"
                        >
                          <Vote className="h-3 w-3 mr-0.5" /> Vote
                        </Button>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="text-muted-foreground/30 hover:text-destructive/70 transition-colors mt-1"
                          title="Remove from pool"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Player claim (no vote open) */}
                {!isDm && !isVoteOpen && (
                  <Button
                    size="sm"
                    onClick={() => handleClaim(item.id, item.name)}
                    className="h-7 text-[10px] font-display bg-gold text-primary-foreground hover:bg-gold/90 shrink-0"
                  >
                    <Swords className="h-3 w-3 mr-1" /> Claim
                  </Button>
                )}
              </div>

              {item.description && (
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              )}

              {/* Quick stat badges */}
              <div className="flex flex-wrap gap-1">
                {stats?.damageType && (
                  <Badge variant="outline" className="text-[8px] h-4 text-red-400 border-red-800/30">
                    {stats.damageCount as number || 1}{stats.damageDice as string} {stats.damageType as string}
                  </Badge>
                )}
                {(stats?.baseAc as number) > 0 && (
                  <Badge variant="outline" className="text-[8px] h-4 text-mana border-mana/30">
                    AC {stats.baseAc as number}{(stats?.plusBonus as number) > 0 ? `+${stats.plusBonus}` : ''}
                  </Badge>
                )}
                {stats?.requiresAttunement && (
                  <Badge variant="outline" className="text-[8px] h-4 text-purple-400 border-purple-800/30">
                    Attunement
                  </Badge>
                )}
                {(stats?.charges as number) && (
                  <Badge variant="outline" className="text-[8px] h-4 text-muted-foreground">
                    {stats.charges as number} charges
                  </Badge>
                )}
              </div>

              {/* Vote buttons — shown when vote is open */}
              {isVoteOpen && !isDm && (
                <div className="space-y-1">
                  {myVote ? (
                    <p className="text-[10px] text-muted-foreground italic">
                      Your vote: <span className={`font-bold ${myVote === 'need' ? 'text-emerald-400' : myVote === 'greed' ? 'text-blue-400' : 'text-muted-foreground'}`}>
                        {myVote.charAt(0).toUpperCase() + myVote.slice(1)}
                      </span>
                    </p>
                  ) : (
                    <div className="flex gap-1 mt-1.5">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-[10px] bg-emerald-600/80 hover:bg-emerald-600"
                        onClick={() => handleVote(item.id, 'need')}
                        disabled={!!myVote}
                      >
                        Need {needCount > 0 && <span className="ml-1 opacity-70">({needCount})</span>}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-[10px]"
                        onClick={() => handleVote(item.id, 'greed')}
                        disabled={!!myVote}
                      >
                        Greed {greedCount > 0 && <span className="ml-1 opacity-70">({greedCount})</span>}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 h-7 text-[10px] text-muted-foreground"
                        onClick={() => handleVote(item.id, 'pass')}
                        disabled={!!myVote}
                      >
                        Pass
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Vote tally (DM view when vote open) */}
              {isVoteOpen && isDm && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="text-emerald-400">Need: {needCount}</span>
                  <span className="text-blue-400">Greed: {greedCount}</span>
                  <span>Pass: {passCount}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
