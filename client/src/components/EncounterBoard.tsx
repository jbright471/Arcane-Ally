export interface BoardPartyMember {
  id: string; name: string; class?: string; level?: number;
  hp: { current: number | null; max: number | null; temp?: number | null };
  conditions?: string[];
}
export interface BoardCombatant {
  id: number; entity_name: string; entity_type: string; initiative?: number;
  current_hp?: number | null; max_hp?: number | null; hp_status?: string | null;
  is_active?: number; is_hidden?: number;
}
export function EncounterBoard({ party, initiative, round, connected, ready, includeHidden = false }: {
  party: BoardPartyMember[]; initiative: BoardCombatant[]; round: number;
  connected: boolean; ready: boolean; includeHidden?: boolean;
}) {
  if (!connected) return <p role="status">Connection lost. Waiting for a fresh encounter snapshot…</p>;
  if (!ready) return <p role="status">Loading encounter state…</p>;
  const visible = initiative.filter(entry => includeHidden || !entry.is_hidden);
  return <section aria-label="Read-only encounter board" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-display">Mapless encounter</h2><p>Round {round} · Read only</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3"><h3 className="font-semibold">Initiative order</h3>
        {!visible.length && <p>No active encounter. Your DM can start one without a map.</p>}
        <ol className="space-y-2">{visible.map(entry => <li key={entry.id} aria-current={entry.is_active ? 'step' : undefined}
          className="rounded-lg border p-3 aria-[current=step]:border-primary aria-[current=step]:bg-primary/10">
          <p className="font-semibold break-words">{entry.entity_name}{entry.is_hidden ? ' (DM only)' : ''}{entry.is_active ? ' — Current turn' : ''}</p>
          <p className="text-sm text-muted-foreground">Initiative {entry.initiative ?? '—'} · {typeof entry.current_hp === 'number' && typeof entry.max_hp === 'number'
            ? `HP ${entry.current_hp} / ${entry.max_hp}` : entry.hp_status || 'Health not shared'}</p>
        </li>)}</ol>
      </section>
      <section className="space-y-3"><h3 className="font-semibold">Party</h3>
        {!party.length && <p>No party members are visible to this view.</p>}
        <ul className="space-y-2">{party.map(member => <li key={member.id} className="rounded-lg border p-3">
          <p className="font-semibold break-words">{member.name}</p>
          <p className="text-sm text-muted-foreground">{member.class}{member.level ? ` · Level ${member.level}` : ''}</p>
          <p>{typeof member.hp.current === 'number' && typeof member.hp.max === 'number' ? `HP ${member.hp.current} / ${member.hp.max}` : 'Health not shared'}</p>
          {!!member.conditions?.length && <p className="text-sm">{member.conditions.join(', ')}</p>}
        </li>)}</ul>
      </section>
    </div>
  </section>;
}
