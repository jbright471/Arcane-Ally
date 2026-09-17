import { EncounterBoard, type BoardPartyMember } from '../components/EncounterBoard';
import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import socket, { accessCredential } from '../socket';


interface Combatant {
  id: number;
  character_id: number | null;
  entity_name: string;
  entity_type: 'pc' | 'monster' | 'npc';
  initiative: number;
  current_hp: number | null;
  max_hp: number | null;
  hp_status: string;
  is_active: number;
}

interface CombatState {
  round: number;
  turnIndex: number;
}

export default function EncounterCastView() {
  const [party, setParty] = useState<BoardPartyMember[]>([]);
  const [initiative, setInitiative] = useState<Combatant[]>([]);
  const [combatState, setCombatState] = useState<CombatState>({ round: 0, turnIndex: 0 });
  const [ready, setReady] = useState({ party: false, initiative: false, combat: false });
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [accessError, setAccessError] = useState<string | null>(
    accessCredential.token ? null : 'This cast link is missing its access credential.',
  );

  useEffect(() => {
    const onPartyState = (chars: any[]) => {
      setReady(previous => ({ ...previous, party: true }));
      setParty(chars.map((raw: any) => ({
        id: String(raw.id),
        name: raw.name || 'Unknown',
        class: raw.class || 'Adventurer',
        level: raw.level || 1,
        hp: {
          current: raw.currentHp ?? raw.current_hp ?? null,
          max: raw.maxHp ?? raw.max_hp ?? null,
          temp: raw.tempHp ?? raw.temp_hp ?? 0,
        },
        ac: raw.ac || 10,
        conditions: (raw.conditions || []).map((c: string) => {
          const l = (c || '').toLowerCase().trim();
          return l.charAt(0).toUpperCase() + l.slice(1);
        }),
      } as BoardPartyMember)));
    };

    const onInitiativeState = (state: Combatant[]) => { setInitiative(Array.isArray(state) ? state : []); setReady(previous => ({ ...previous, initiative: true })); };
    const onCombatState = (state: CombatState) => { setCombatState(state); setReady(previous => ({ ...previous, combat: true })); };
    const registerCastView = () => socket.emit(
      'register_cast_view',
      {},
      (result: { success: boolean; message?: string }) => {
        if (!result.success) setAccessError(result.message || 'This cast link is no longer valid.');
      },
    );
    const onConnect = () => {
      setReady({ party: false, initiative: false, combat: false }); setAccessError(null);
      setIsConnected(true);
      registerCastView();
    };
    const onDisconnect = () => { setIsConnected(false); setReady({ party: false, initiative: false, combat: false }); setParty([]); setInitiative([]); };
    const onAccessDenied = ({ message }: { message?: string }) => {
      setAccessError(message || 'This cast link is no longer valid.');
    };
    const onConnectError = (error: Error) => setAccessError(error.message);

    socket.on('party_state', onPartyState);
    socket.on('initiative_state', onInitiativeState);
    socket.on('combat_state_sync', onCombatState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('access_denied', onAccessDenied);
    socket.on('connect_error', onConnectError);

    if (socket.connected && accessCredential.token) registerCastView();

    return () => {
      socket.off('party_state', onPartyState);
      socket.off('initiative_state', onInitiativeState);
      socket.off('combat_state_sync', onCombatState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('access_denied', onAccessDenied);
      socket.off('connect_error', onConnectError);
    };
  }, []);

  if (accessError) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-8">
        <div className="max-w-lg text-center space-y-4">
          <Shield className="h-12 w-12 text-red-700 mx-auto" />
          <h1 className="font-display text-2xl text-red-100">A new cast link is required</h1>
          <p className="text-sm text-white/60">{accessError}</p>
          <p className="text-xs text-white/40">Ask the DM to generate a fresh read-only cast link.</p>
        </div>
      </div>
    );
  }

  return <main className="min-h-dvh bg-background p-4 md:p-8"><div className="mx-auto max-w-6xl space-y-4"><h1 className="font-display text-2xl">Encounter cast</h1><EncounterBoard party={party} initiative={initiative} round={combatState.round} connected={isConnected} ready={ready.party && ready.initiative && ready.combat} /></div></main>;
}
