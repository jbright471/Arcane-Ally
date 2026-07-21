import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Activity, BookOpen, Eye, Heart, Map, PackageOpen, Shield,
  Sparkles, Swords, Users, Wifi, WifiOff,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { generateRequestId } from '../lib/requestId';

interface PreviewSnapshot {
  projectionVersion: number;
  generatedAt: string;
  viewer: { characterId: number; characterName: string };
  selectedCharacter: Record<string, any>;
  party: Record<string, any>[];
  initiative: Record<string, any>[];
  effects: Record<string, any>[];
  permissions: Record<string, string>;
  combat: { round: number; turnIndex: number };
  notes: Record<string, any>[];
  sharedLoot: Record<string, any>[];
  world: Record<string, any> | null;
  worldMap: Record<string, any> | null;
  battleMap: Record<string, any> | null;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';
const previewSocket = io(`${SERVER_URL}/player-preview`, {
  autoConnect: false,
  transports: SERVER_URL ? ['websocket'] : ['websocket', 'polling'],
});

const permissionLabels: Record<string, string> = {
  loot_claim: 'Claim shared loot',
  cross_player_effects: 'Affect other characters',
  inventory_transfer: 'Transfer inventory',
  view_monster_hp: 'View exact monster HP',
  edit_party_notes: 'Edit party notes',
  condition_self_apply: 'Apply conditions to self',
};

function hpValues(character: Record<string, any>) {
  return {
    current: character.currentHp ?? character.current_hp ?? character.hp?.current ?? 0,
    max: character.maxHp ?? character.max_hp ?? character.hp?.max ?? 1,
    temp: character.tempHp ?? character.temp_hp ?? character.hp?.temp ?? 0,
  };
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function MapPreview({ title, map }: { title: string; map: Record<string, any> | null }) {
  if (!map) return null;
  const markers = Array.isArray(map.markers) ? map.markers : [];
  const tokens = Array.isArray(map.tokens) ? map.tokens : [];
  return (
    <Card className="border-primary/20 bg-card/70 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2"><Map className="h-4 w-4 text-primary" />{title}: {map.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {map.map_url && <img src={map.map_url} alt={map.name} className="w-full max-h-72 object-contain rounded border border-border bg-black/20" />}
        {(tokens.length > 0 || markers.length > 0) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {tokens.map(token => <Badge key={`token-${token.id}`} variant="outline">{token.entity_name || 'Token'}</Badge>)}
            {markers.map(marker => <Badge key={`marker-${marker.id}`} variant="secondary">{marker.name}</Badge>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PlayerPreview() {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  const credentials = useMemo(() => {
    const hashToken = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (hashToken) sessionStorage.setItem('arcane_player_preview_token', hashToken);
    const token = hashToken || sessionStorage.getItem('arcane_player_preview_token') || '';
    let clientId = sessionStorage.getItem('arcane_player_preview_client_id');
    if (!clientId) {
      clientId = generateRequestId();
      sessionStorage.setItem('arcane_player_preview_client_id', clientId);
    }
    if (window.location.hash) window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    return { token, clientId };
  }, []);

  useEffect(() => {
    const register = () => {
      setConnected(true);
      setError('');
      previewSocket.emit('register_player_preview', credentials);
    };
    const disconnect = () => setConnected(false);
    const receive = (next: PreviewSnapshot) => setSnapshot(next);
    const receiveError = ({ message }: { message?: string }) => setError(message || 'Player preview is unavailable.');

    previewSocket.on('connect', register);
    previewSocket.on('disconnect', disconnect);
    previewSocket.on('player_preview_state', receive);
    previewSocket.on('player_preview_error', receiveError);
    previewSocket.connect();

    return () => {
      previewSocket.off('connect', register);
      previewSocket.off('disconnect', disconnect);
      previewSocket.off('player_preview_state', receive);
      previewSocket.off('player_preview_error', receiveError);
      previewSocket.disconnect();
    };
  }, [credentials]);

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground grid place-items-center p-6">
        <Card className="max-w-md border-destructive/40">
          <CardHeader><CardTitle className="font-display flex items-center gap-2"><Eye className="h-5 w-5" />Player Preview</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{error}</p></CardContent>
        </Card>
      </main>
    );
  }

  if (!snapshot) {
    return <main className="min-h-screen bg-background text-muted-foreground grid place-items-center font-display">Opening player view...</main>;
  }

  const character = snapshot.selectedCharacter;
  const hp = hpValues(character);
  const hpPercent = Math.max(0, Math.min(100, (hp.current / Math.max(1, hp.max)) * 100));
  const conditions = character.conditions || character.activeConditions || [];
  const abilityScores = character.abilityScores || {};
  const spellSlots = character.spellSlotsMax || character.spellSlots || {};

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-primary/30 bg-background/95 backdrop-blur px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded border border-primary/40 bg-primary/10 grid place-items-center"><Eye className="h-5 w-5 text-primary" /></div>
            <div><p className="font-display text-primary leading-tight">Previewing as {snapshot.viewer.characterName}</p><p className="text-xs text-muted-foreground">Read-only player view</p></div>
          </div>
          <Badge variant="outline" className={connected ? 'text-health border-health/40' : 'text-destructive border-destructive/40'}>
            {connected ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}{connected ? 'Live' : 'Reconnecting'}
          </Badge>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-primary/30 bg-card/80">
            <CardHeader className="pb-3"><CardTitle className="font-display text-2xl">{character.name}</CardTitle><p className="text-sm text-muted-foreground">Level {character.level} {character.class || 'Adventurer'}</p></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><p className="text-xs uppercase text-muted-foreground">Hit Points</p><p className="text-xl font-bold">{hp.current}/{hp.max}{hp.temp > 0 ? ` +${hp.temp}` : ''}</p></div>
                <div><p className="text-xs uppercase text-muted-foreground">Armor Class</p><p className="text-xl font-bold">{character.ac ?? 10}</p></div>
                <div><p className="text-xs uppercase text-muted-foreground">Speed</p><p className="text-xl font-bold">{character.speed ?? 30} ft</p></div>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-secondary"><div className={`h-full ${hpPercent <= 25 ? 'bg-destructive' : 'bg-health'}`} style={{ width: `${hpPercent}%` }} /></div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.entries(abilityScores).slice(0, 6).map(([ability, score]) => <div key={ability} className="rounded border border-border bg-secondary/30 p-2 text-center"><p className="text-[10px] text-muted-foreground uppercase">{ability}</p><p className="font-bold">{String(score)}</p></div>)}
              </div>
              <div className="flex flex-wrap gap-2">
                {conditions.map((condition: string) => <Badge key={condition} variant="destructive">{condition}</Badge>)}
                {character.concentratingOn && <Badge variant="outline" className="text-mana border-mana/40"><Sparkles className="h-3 w-3 mr-1" />{character.concentratingOn}</Badge>}
                {conditions.length === 0 && !character.concentratingOn && <span className="text-xs text-muted-foreground">No active conditions or concentration.</span>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/70">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Resources</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {Object.keys(spellSlots).length > 0 ? Object.entries(spellSlots).map(([level, value]: [string, any]) => {
                const max = typeof value === 'number' ? value : value.max || 0;
                const used = character.spellSlotsUsed?.[level] ?? value.used ?? 0;
                return <div key={level} className="flex justify-between"><span>Level {level}</span><span className="font-mono">{Math.max(0, max - used)} / {max}</span></div>;
              }) : <p className="text-muted-foreground">No spell slots.</p>}
              {Object.entries(character.hitDice || {}).map(([die, total]) => <div key={die} className="flex justify-between"><span>Hit Dice {die}</span><span className="font-mono">{Math.max(0, Number(total) - Number(character.hitDiceUsed?.[die] || 0))} / {String(total)}</span></div>)}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="border-primary/20 bg-card/70">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base flex items-center gap-2"><Swords className="h-4 w-4 text-primary" />Initiative {snapshot.combat.round > 0 && `- Round ${snapshot.combat.round}`}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {snapshot.initiative.length === 0 ? <p className="text-sm text-muted-foreground">No active encounter.</p> : snapshot.initiative.map((entry, index) => (
                <div key={entry.id} className={`flex items-center justify-between rounded border p-2 ${entry.is_active ? 'border-primary/50 bg-primary/10' : 'border-border'}`}>
                  <div className="flex items-center gap-3"><span className="font-mono text-sm w-7 text-center">{entry.initiative}</span><div><p className="font-medium">{entry.entity_name}</p><p className="text-[10px] uppercase text-muted-foreground">{index === snapshot.combat.turnIndex ? 'Current turn' : entry.entity_type}</p></div></div>
                  <span className="text-xs text-muted-foreground">{entry.current_hp === null ? (entry.hp_status || 'HP hidden') : `${entry.current_hp}/${entry.max_hp} HP`}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/70">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Visible Party</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2">
              {snapshot.party.map(member => {
                const memberHp = hpValues(member);
                return <div key={member.id} className="rounded border border-border p-3"><div className="flex justify-between gap-2"><p className="font-medium truncate">{member.name}</p><span className="text-xs font-mono">{memberHp.current}/{memberHp.max}</span></div><p className="text-xs text-muted-foreground">Level {member.level} {member.class}</p></div>;
              })}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-primary/20 bg-card/70">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Effect Timeline</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {snapshot.effects.length === 0 ? <p className="text-sm text-muted-foreground">No visible effects.</p> : snapshot.effects.slice(0, 30).map(effect => <div key={effect.id} className="border-l-2 border-primary/40 pl-3 py-1"><p className="text-sm">{effect.description || effect.event_type}</p><p className="text-xs text-muted-foreground">{effect.actor} - Round {effect.session_round ?? 0}</p></div>)}
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-card/70">
            <CardHeader className="pb-3"><CardTitle className="font-display text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Permissions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(snapshot.permissions).map(([key, value]) => <div key={key} className="flex items-center justify-between gap-3 text-sm"><span>{permissionLabels[key] || titleCase(key)}</span><Badge variant="outline" className="shrink-0">{titleCase(value)}</Badge></div>)}
            </CardContent>
          </Card>
        </section>

        {(snapshot.worldMap || snapshot.battleMap) && <section className="grid grid-cols-1 lg:grid-cols-2 gap-4"><MapPreview title="World Map" map={snapshot.worldMap} /><MapPreview title="Battle Map" map={snapshot.battleMap} /></section>}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-primary/20 bg-card/70"><CardHeader className="pb-3"><CardTitle className="font-display text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" />Party Notes</CardTitle></CardHeader><CardContent className="space-y-3">{snapshot.notes.length === 0 ? <p className="text-sm text-muted-foreground">No shared notes.</p> : snapshot.notes.slice(0, 12).map(note => <article key={note.id}><p className="font-medium text-sm">{note.title}</p><p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{note.content}</p></article>)}</CardContent></Card>
          <Card className="border-primary/20 bg-card/70"><CardHeader className="pb-3"><CardTitle className="font-display text-base flex items-center gap-2"><PackageOpen className="h-4 w-4 text-primary" />Shared Loot</CardTitle></CardHeader><CardContent className="space-y-3">{snapshot.sharedLoot.length === 0 ? <p className="text-sm text-muted-foreground">No shared loot.</p> : snapshot.sharedLoot.slice(0, 12).map(item => <article key={item.id}><div className="flex justify-between gap-2"><p className="font-medium text-sm">{item.name}</p><Badge variant="secondary">{item.rarity || item.category || 'Item'}</Badge></div><p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p></article>)}</CardContent></Card>
        </section>
      </div>
    </main>
  );
}
