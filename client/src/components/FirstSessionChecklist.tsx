import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { Button } from './ui/button';

export function FirstSessionChecklist() {
  const { state } = useGame();
  const [manual, setManual] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const ready = state.readiness;
  const automatic = ready.connected && ready.party && ready.dmAuthenticated && state.characters.length === 0 && !dismissed;
  const dm = state.isDm && ready.dmAuthenticated;
  if (!automatic && !manual) return <Button variant="outline" onClick={() => setManual(true)}>First-session guide</Button>;
  return <section aria-label="First-session guide" className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
    <div className="flex justify-between items-center gap-3"><h2 className="font-display text-xl">Your first session</h2><Button variant="ghost" onClick={() => { setManual(false); setDismissed(true); }}>Dismiss</Button></div>
    <p className="text-sm text-muted-foreground">{dm ? 'Use these steps to prepare your table. Opening a page does not complete setup.' : 'Ask your DM for your character link. Private setup tools require DM access.'}</p>
    <ol className="list-decimal pl-5 space-y-2">
      {dm ? <li><Link className="underline" to="/character/new">Create a character</Link> or <Link className="underline" to="/character/import">import a sheet</Link>.</li>
        : <li>Open the private character link provided by your DM.</li>}
      <li><Link className="underline" to="/party">Get familiar with the Party Lobby</Link>.</li>
      {dm && <li><Link className="underline" to="/dm">Prepare your encounter and private notes</Link>.</li>}
      <li><Link className="underline" to="/battlemap">Use a map or the mapless encounter board</Link>.</li>
      <li><Link className="underline" to="/guide#welcome">Read the first-session instructions</Link>.</li>
    </ol>
  </section>;
}
