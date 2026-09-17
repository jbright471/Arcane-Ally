import { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { dmFetch } from '../lib/dmFetch';
import { DmAccessGate } from './DmAccessGate';
import { Button } from './ui/button';

interface Recap { id: number; recap_text: string; session_date: string | null; created_at: string }
export function parseRecaps(data: unknown): Recap[] {
  if (!Array.isArray(data) || !data.every(item => item && Number.isSafeInteger(item.id) &&
    typeof item.recap_text === 'string' && typeof item.created_at === 'string' &&
    (item.session_date === null || typeof item.session_date === 'string'))) {
    throw new Error('The archive returned an invalid response.');
  }
  return data;
}

export function ArchiveContent() {
  const { state } = useGame();
  const [result, setResult] = useState<{ token: string | null; recaps: Recap[] }>({ token: null, recaps: [] });
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const token = state.dmToken;
  const recaps = token && token === result.token ? result.recaps : [];
  const selected = recaps.find(item => item.id === selectedId);
  useEffect(() => {
    if (!token) { setResult({ token: null, recaps: [] }); setSelectedId(null); setStatus('access'); return; }
    const controller = new AbortController();
    setStatus('loading');
    dmFetch('/api/recaps', { signal: controller.signal }).then(async response => {
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        setResult({ token: null, recaps: [] }); setSelectedId(null); setStatus('access'); return;
      }
      if (!response.ok) throw new Error('Request failed');
      const data = parseRecaps(await response.json());
      if (!controller.signal.aborted) { setResult({ token, recaps: data }); setStatus('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [token, attempt]);

  if (!token || status === 'access') return <section className="space-y-3">
    <p role="status">Session history is private to the DM. Sign in again if your session expired.</p>
    <DmAccessGate><Button onClick={() => setAttempt(n => n + 1)}>Retry archive</Button></DmAccessGate>
  </section>;
  return <section aria-label="Session history" className="space-y-4">
    {status === 'loading' && <p role="status">Loading session history…</p>}
    {status === 'error' && <div role="alert" className="space-y-2"><p>Session history could not be loaded. You can retry without leaving this page.</p><Button onClick={() => setAttempt(n => n + 1)}>Retry archive</Button></div>}
    {status === 'ready' && recaps.length === 0 && <p>No session recaps yet.</p>}
    <div className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)]">
      <nav aria-label="Session recaps" className="max-h-72 overflow-auto md:max-h-[60vh]">
        {recaps.map(recap => <button key={recap.id} aria-current={selectedId === recap.id ? 'true' : undefined}
          className="block w-full rounded border p-3 text-left focus-visible:outline focus-visible:outline-primary aria-[current=true]:bg-primary/10"
          onClick={() => setSelectedId(recap.id)}>Adventure #{recap.id}<span className="block text-sm text-muted-foreground">{recap.session_date || recap.created_at}</span></button>)}
      </nav>
      {selected ? <article className="min-w-0 space-y-3"><h2 className="text-xl font-display">Adventure #{selected.id}</h2><p className="whitespace-pre-wrap break-words">{selected.recap_text}</p></article>
        : recaps.length > 0 && <p>Select a chronicle to read.</p>}
    </div>
  </section>;
}
