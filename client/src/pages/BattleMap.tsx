import { EncounterBoard } from '../components/EncounterBoard';
import { useState, useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { AlertTriangle, RefreshCw, Map, Users, Eye, EyeOff, Shield } from 'lucide-react';
import { toast } from 'sonner';
import socket, { accessCredential } from '../socket';
import { useAuthenticatedResourceUrl } from '../hooks/useAuthenticatedResourceUrl';
import { BattlemapAccessHandoff } from '../components/BattlemapAccessHandoff';
import { UvttPreviewPanel } from '../components/UvttPreviewPanel';
import type { BattleMapToken } from '../lib/battleMapState';

interface InitiativeEntry {
  id: number;
  entity_name: string;
  entity_type: string;
  current_hp: number | null;
  max_hp: number | null;
  ac?: number | null;
  conditions?: unknown;
  hp_status?: unknown;
  character_id: number | null;
  instance_id: string | null;
  is_hidden: number;
}

const TOKEN_COLORS: Record<string, string> = {
  pc:      '#6366f1',  // indigo
  monster: '#ef4444',  // red
  npc:     '#a855f7',  // purple
};

const HP_COLOR = (pct: number) =>
  pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';

const SHARED_HEALTH_LABELS = new Set(['Healthy', 'Bloodied', 'Critical', 'Dead']);

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 2) || '?';
}

export default function BattleMap() {
  const { state } = useGame();
  const isDm = state.isDm;
  const initiativeState = (Array.isArray(state.initiativeState) ? state.initiativeState : []) as InitiativeEntry[];

  const mapState = state.mapState;
  const [showHidden, setShowHidden] = useState(false);
  const [showLegendHelp, setShowLegendHelp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dragging state
  const dragging = useRef<{ tokenId: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [localPositions, setLocalPositions] = useState<Record<number, { x: number; y: number }>>({});
  const mapImageUrl = useAuthenticatedResourceUrl(mapState?.image_data);

  // Resolve HP data for a token from initiative state
  const getCombatData = (token: BattleMapToken) => {
    let entry: InitiativeEntry | undefined;
    if (token.entity_type === 'pc') {
      const charId = parseInt(token.entity_id.replace('pc-', ''));
      entry = initiativeState.find(e => e.character_id === charId);
    } else {
      const instanceId = token.entity_id.replace('m-', '');
      entry = initiativeState.find(e => e.instance_id === instanceId);
    }
    const current = typeof entry?.current_hp === 'number' && Number.isFinite(entry.current_hp) ? entry.current_hp : null;
    const max = typeof entry?.max_hp === 'number' && Number.isFinite(entry.max_hp) && entry.max_hp > 0 ? entry.max_hp : null;
    const ac = typeof entry?.ac === 'number' && Number.isFinite(entry.ac) && entry.ac > 0 ? entry.ac : null;
    const conditions = Array.isArray(entry?.conditions)
      ? [...new Set(entry.conditions
        .filter((condition): condition is string => typeof condition === 'string')
        .map(condition => condition.trim())
        .filter(condition => condition.length > 0 && condition.length <= 40))].slice(0, 6)
      : [];
    const hp = current !== null && max !== null ? { current, max } : null;
    // Consume the projected label only; never infer withheld HP from a label.
    const healthStatus = !hp && typeof entry?.hp_status === 'string' && SHARED_HEALTH_LABELS.has(entry.hp_status)
      ? entry.hp_status : null;
    return { hp, healthStatus, ac, conditions };
  };

  const handlePointerDown = useCallback((e: React.PointerEvent, token: BattleMapToken) => {
    if (!isDm) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = localPositions[token.id] ?? { x: token.x, y: token.y };
    dragging.current = { tokenId: token.id, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }, [isDm, localPositions]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragging.current.startX) / rect.width)  * 100;
    const dy = ((e.clientY - dragging.current.startY) / rect.height) * 100;
    const newX = Math.max(0, Math.min(100, dragging.current.origX + dx));
    const newY = Math.max(0, Math.min(100, dragging.current.origY + dy));
    setLocalPositions(prev => ({ ...prev, [dragging.current!.tokenId]: { x: newX, y: newY } }));
  }, []);

  const handlePointerUp = useCallback((_e: React.PointerEvent) => {
    if (!dragging.current) return;
    const d = dragging.current;
    dragging.current = null;
    const pos = localPositions[d.tokenId];
    if (pos) {
      socket.emit('move_token', { tokenId: d.tokenId, x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10 });
    }
  }, [localPositions]);

  const handleSyncTokens = () => {
    socket.emit('sync_map_tokens');
    toast.success('Synced tokens from initiative tracker.');
  };

  const handleRetrySnapshot = () => {
    if (state.dmToken) {
      socket.emit('dm_join_room', { dmToken: state.dmToken });
      return;
    }
    socket.disconnect();
    socket.connect();
  };

  const tokens = mapState?.tokens ?? [];
  const visibleTokens = isDm && showHidden ? tokens : tokens.filter(t => !t.is_hidden);

  if (state.mapStateError) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-display">Battlemap</h1>
        <BattlemapAccessHandoff mode={isDm ? 'dm' : (accessCredential.flow ?? 'public')} compact={isDm} />
        <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-2">
              <h2 className="font-display text-lg">Battlemap state could not be displayed safely</h2>
              <p className="text-sm text-muted-foreground">
                The realtime snapshot was incomplete or incompatible. Arcane Ally rejected it before rendering tokens or sending a map change.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={handleRetrySnapshot}>
                <RefreshCw className="mr-2 h-4 w-4" /> Request a fresh snapshot
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!mapState) {
    if (!state.dmToken && !accessCredential.token) return <div className="mx-auto max-w-5xl space-y-4"><h1 className="text-3xl font-display">Battlemap</h1><BattlemapAccessHandoff mode="public" /></div>;
    return <div className="space-y-4"><h1 className="text-3xl font-display">Battlemap</h1>
      <BattlemapAccessHandoff mode={isDm ? 'dm' : (accessCredential.flow ?? 'public')} compact />
      <EncounterBoard party={state.characters} initiative={state.initiativeState} round={state.roundNumber}
        connected={state.readiness.connected} ready={state.readiness.map && state.readiness.party && state.readiness.initiative && state.readiness.combat}
        includeHidden={state.readiness.dmAuthenticated} />
      {state.isDm && <p className="text-sm text-muted-foreground">This is your DM view. Use a read-only cast link from the DM tools for a shared screen.</p>}
      {state.isDm && <UvttPreviewPanel />}
    </div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-3 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Map className="h-6 w-6 text-primary shrink-0" />
        <h1 className="text-2xl font-display tracking-wider">{mapState.name || 'Battlemap'}</h1>
        <Badge variant="outline" className="text-[10px] font-mono">{visibleTokens.length} token{visibleTokens.length !== 1 ? 's' : ''}</Badge>
        <div className="ml-auto flex items-center gap-2">
          {isDm && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setShowHidden(v => !v)}>
                    {showHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 opacity-40" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">{showHidden ? 'Hiding hidden tokens' : 'Showing hidden tokens'}</TooltipContent>
              </Tooltip>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSyncTokens}>
                <Users className="h-4 w-4 mr-1.5" /> Sync from Initiative
              </Button>
            </>
          )}
        </div>
      </div>

      <BattlemapAccessHandoff mode={isDm ? 'dm' : (accessCredential.flow ?? 'public')} compact />
      {isDm && <UvttPreviewPanel />}

      {/* Map canvas */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden border border-primary/20 bg-black"
        style={{ aspectRatio: '16/9', userSelect: 'none' }}
        onPointerMove={isDm ? handlePointerMove : undefined}
        onPointerUp={isDm ? handlePointerUp : undefined}
        onPointerLeave={isDm ? handlePointerUp : undefined}
      >
        {mapImageUrl && (
          <img
            src={mapImageUrl}
            alt={mapState.name}
            className="w-full h-full object-contain"
            draggable={false}
          />
        )}

        {/* Tokens */}
        {visibleTokens.map(token => {
          const pos = localPositions[token.id] ?? { x: token.x, y: token.y };
          const combat = getCombatData(token);
          const hpPct  = combat.hp ? Math.max(0, Math.min(1, combat.hp.current / combat.hp.max)) : 1;
          const color  = TOKEN_COLORS[token.entity_type] ?? TOKEN_COLORS.monster;
          const hidden = !!token.is_hidden;
          const accessibleStatus = [
            combat.healthStatus ? `health ${combat.healthStatus}` : null,
            combat.ac ? `armor class ${combat.ac}` : null,
            combat.conditions.length > 0 ? `conditions ${combat.conditions.join(', ')}` : null,
          ].filter(Boolean).join(', ');

          return (
            <div
              key={token.id}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top:  `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                cursor: isDm ? 'grab' : 'default',
                touchAction: 'none',
                opacity: hidden ? 0.5 : 1,
              }}
              onPointerDown={isDm ? (e) => handlePointerDown(e, token) : undefined}
              role="img"
              aria-label={`${token.entity_name}${accessibleStatus ? `, ${accessibleStatus}` : ''}`}
            >
              {/* Token circle */}
              <div
                className="relative flex items-center justify-center rounded-full border-2 text-white font-bold text-[10px] select-none shadow-lg"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: color,
                  borderColor: hidden ? '#888' : 'white',
                  boxShadow: `0 0 6px ${color}80`,
                }}
                title={`${token.entity_name}${combat.hp ? ` — HP: ${combat.hp.current}/${combat.hp.max}` : combat.healthStatus ? ` — Health: ${combat.healthStatus}` : ''}`}
              >
                {getInitials(token.entity_name)}
                {hidden && (
                  <EyeOff className="absolute -top-1 -right-1 h-3 w-3 text-slate-300 bg-black/60 rounded-full p-0.5" />
                )}
                {/* HP bar */}
                {combat.hp && (
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-b-full overflow-hidden"
                    style={{ height: 3 }}
                  >
                    <div
                      style={{
                        width: `${hpPct * 100}%`,
                        height: '100%',
                        backgroundColor: HP_COLOR(hpPct),
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                )}
              </div>
              {/* Name label */}
              <div
                className="absolute top-full mt-0.5 left-1/2 -translate-x-1/2 text-[8px] text-white font-semibold whitespace-nowrap bg-black/60 px-1 rounded pointer-events-none"
              >
                {token.entity_name.split(' ')[0]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Token legend */}
      {visibleTokens.length > 0 && (
        <section aria-label="Token legend" className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-display">Token legend</h2>
            <Popover open={showLegendHelp} onOpenChange={setShowLegendHelp}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="About the token legend" className="h-8 text-xs">
                  About this legend
                </Button>
              </PopoverTrigger>
              <PopoverContent aria-label="Token legend help" align="start" collisionPadding={16} className="max-w-[calc(100vw-2rem)] space-y-3 text-sm">
                <p>Only values supplied for your view are shown. A missing AC, condition, or health badge is not a known value and does not tell you whether information is unavailable or empty.</p>
                <p>Broad health labels may appear instead of exact HP. No HP total or percentage is calculated from a label.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowLegendHelp(false)}>Close legend help</Button>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleTokens.map(token => {
              const combat = getCombatData(token);
              const hpPct  = combat.hp ? Math.max(0, Math.min(1, combat.hp.current / combat.hp.max)) : null;
              const color  = TOKEN_COLORS[token.entity_type] ?? TOKEN_COLORS.monster;
              return (
                <div
                  key={token.id}
                  className="flex items-center gap-1.5 text-xs bg-secondary/30 border border-border/20 rounded px-2 py-1"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-display">{token.entity_name}</span>
                  {combat.hp && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {combat.hp.current}/{combat.hp.max}
                    </span>
                  )}
                  {combat.healthStatus && (
                    <span className="rounded border border-border/50 px-1 text-[10px] text-muted-foreground" aria-label={`Health: ${combat.healthStatus}`}>
                      {combat.healthStatus}
                    </span>
                  )}
                  {combat.ac !== null && (
                    <span className="inline-flex items-center gap-0.5 rounded border border-sky-400/30 bg-sky-400/10 px-1 text-[10px] text-sky-200" aria-label={`Armor class ${combat.ac}`}>
                      <Shield className="h-2.5 w-2.5" /> AC {combat.ac}
                    </span>
                  )}
                  {combat.conditions.map(condition => (
                    <span key={condition} className="rounded border border-amber-400/30 bg-amber-400/10 px-1 text-[10px] text-amber-200" aria-label={`Condition: ${condition}`}>
                      {condition}
                    </span>
                  ))}
                  {token.entity_type !== 'pc' && hpPct !== null && (
                    <span className="text-[10px]" style={{ color: HP_COLOR(hpPct) }}>
                      {Math.round(hpPct * 100)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
