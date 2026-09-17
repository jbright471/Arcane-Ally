import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useGame } from '../context/GameContext';
import { dmFetch } from '../lib/dmFetch';
import { PrepReferenceEditor, PrepReferenceText } from './PrepReferences';
import socket from '../socket';

interface DmPrepNote {
  id: number; linked_type: string; linked_id: number | null;
  title: string; content: string; tags: string[];
}
interface ContextFilter {
  type: 'encounter' | 'npc' | 'effect_event' | 'quest' | 'general' | 'map_marker';
  id?: number; label?: string;
}
interface Draft { title: string; content: string; tags: string; linked_type: string; linked_id: number | null }
const draftOf = (note: DmPrepNote): Draft => ({ title: note.title, content: note.content, tags: note.tags.join(', '), linked_type: note.linked_type, linked_id: note.linked_id });
function parseNotes(value: unknown): DmPrepNote[] {
  if (!Array.isArray(value) || !value.every(note => Number.isSafeInteger(note?.id) && typeof note.title === 'string' && typeof note.content === 'string' && Array.isArray(note.tags) && note.tags.every((tag: unknown) => typeof tag === 'string'))) throw new Error('Invalid note response');
  return value;
}
export function DmPrepPanel({ isOpen, onClose, contextFilter }: { isOpen: boolean; onClose: () => void; contextFilter?: ContextFilter }) {
  const { state } = useGame();
  const token = state.dmToken;
  const currentToken = useRef(token); currentToken.current = token;
  const [index, setIndex] = useState<{ token: string | null; notes: DmPrepNote[] }>({ token: null, notes: [] });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selected, setSelected] = useState<number | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const notes = token && token === index.token ? index.notes : [];
  const selectedNote = notes.find(note => note.id === selected);
  const draft = token !== index.token || selected === null ? undefined : drafts[selected] || (selectedNote && draftOf(selectedNote));
  const contextKey = `${contextFilter?.type}:${contextFilter?.id}`;
  useEffect(() => { setSelected(null); }, [contextKey]);
  useEffect(() => {
    setDrafts({}); setSelected(null); setIndex({ token: null, notes: [] }); setError('');
  }, [token]);
  useEffect(() => {
    if (!isOpen || !token) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    dmFetch('/api/dm-notes', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Could not load private notes. Check your DM session and retry.');
      const values = parseNotes(await response.json());
      if (!controller.signal.aborted && currentToken.current === token) setIndex({ token, notes: values });
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isOpen, token, reload]);
  useEffect(() => {
    if (!isOpen || !token) return;
    const refresh = () => setReload(count => count + 1);
    const events = ['dm_note_created', 'dm_note_updated', 'dm_note_deleted'];
    events.forEach(event => socket.on(event, refresh));
    return () => { events.forEach(event => socket.off(event, refresh)); };
  }, [isOpen, token]);
  const dirty = Object.entries(drafts).some(([id, value]) => {
    const saved = notes.find(note => String(note.id) === id);
    return !saved || JSON.stringify(value) !== JSON.stringify(draftOf(saved));
  });
  const close = useCallback(() => {
    if (dirty && !window.confirm('Discard unsaved note edits and close?')) return;
    setDrafts({}); setSelected(null); onClose();
  }, [dirty, onClose]);
  function change(patch: Partial<Draft>) {
    if (selected !== null && draft) setDrafts(previous => ({ ...previous, [selected]: { ...draft, ...patch } }));
  }
  async function save() {
    if (!draft || selected === null || !token) return;
    const id = selected;
    setSaving(true); setError('');
    try {
      const response = await dmFetch(id === 'new' ? '/api/dm-notes' : `/api/dm-notes/${id}`, {
        method: id === 'new' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, title: draft.title.trim() || 'Untitled', tags: draft.tags.split(',').map(value => value.trim()).filter(Boolean) }),
      });
      if (!response.ok) throw new Error('Note was not saved. Your draft is still here; retry after checking access.');
      const note = parseNotes([await response.json()])[0];
      if (currentToken.current !== token) return;
      setIndex(previous => ({ token, notes: [note, ...previous.notes.filter(value => value.id !== note.id)] }));
      setDrafts(previous => { const next = { ...previous }; delete next[id]; return next; });
      setSelected(note.id);
      socket.emit('relay_dm_note', { event: id === 'new' ? 'dm_note_created' : 'dm_note_updated', data: note });
    } catch (reason) { if (currentToken.current === token) setError(reason instanceof Error ? reason.message : 'Save failed'); }
    finally { setSaving(false); }
  }
  async function remove(note: DmPrepNote) {
    if (!window.confirm(`Delete ${note.title || 'Untitled'}?`)) return;
    try {
      const response = await dmFetch(`/api/dm-notes/${note.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Note was not deleted. Check access and retry.');
      if (currentToken.current !== token) return;
      setIndex(previous => ({ ...previous, notes: previous.notes.filter(value => value.id !== note.id) }));
      setDrafts(previous => { const next = { ...previous }; delete next[note.id]; return next; }); setSelected(null);
      socket.emit('relay_dm_note', { event: 'dm_note_deleted', data: { id: note.id } });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Delete failed'); }
  }
  const filtered = notes.filter(note => (!contextFilter || contextFilter.type === 'general' ||
    (note.linked_type === contextFilter.type && (contextFilter.id === undefined || note.linked_id === contextFilter.id))) &&
    (!tag || note.tags.includes(tag)) && `${note.title} ${note.content}`.toLowerCase().includes(search.toLowerCase()));
  return <Sheet open={isOpen} onOpenChange={open => !open && close()}>
    <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
      <SheetHeader className="p-4 border-b"><SheetTitle>Private prep notes</SheetTitle><SheetDescription>{contextFilter?.label || 'Your DM planning space'}</SheetDescription></SheetHeader>
      {!token ? <p className="p-4" role="status">Sign in as DM to open private notes.</p> : <div className="p-4 overflow-auto space-y-4 min-h-0">
        {loading && <p role="status">Loading notes…</p>}
        {error && <div role="alert"><p>{error}</p><Button onClick={() => setReload(count => count + 1)}>Retry loading</Button></div>}
        {selected !== null ? <>
          <Button variant="outline" onClick={() => setSelected(null)}>Back to notes</Button>
          {selected !== 'new' && !selectedNote && !loading && <p role="status">This note is no longer available. Any unsaved draft is retained until you close the panel.</p>}
          {draft && <fieldset disabled={saving} className="space-y-4">
            <label className="block text-sm">Title<Input value={draft.title} onChange={event => change({ title: event.target.value })} /></label>
            <PrepReferenceEditor value={draft.content} onChange={content => change({ content })} notes={notes} currentId={typeof selected === 'number' ? selected : undefined} />
            <label className="block text-sm">Tags, separated by commas<Input value={draft.tags} onChange={event => change({ tags: event.target.value })} /></label>
            <div className="rounded border p-3 space-y-2"><h3 className="text-sm font-semibold">Preview</h3><PrepReferenceText content={draft.content} notes={notes} onOpen={setSelected} /></div>
            <div className="flex gap-2"><Button disabled={selected !== 'new' && !selectedNote} onClick={save}>{saving ? 'Saving…' : 'Save note'}</Button>{selectedNote && <Button variant="outline" onClick={() => remove(selectedNote)}>Delete note</Button>}</div>
          </fieldset>}
        </> : <>
          <label className="block text-sm">Search notes<Input value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label className="block text-sm">Filter by tag<select className="block w-full rounded border bg-background p-2" value={tag} onChange={event => setTag(event.target.value)}><option value="">All tags</option>{[...new Set(notes.flatMap(note => note.tags))].map(value => <option key={value}>{value}</option>)}</select></label>
          <Button onClick={() => { setDrafts(previous => ({ ...previous, new: previous.new || { title: '', content: '', tags: '', linked_type: contextFilter?.type || 'general', linked_id: contextFilter?.id ?? null } })); setSelected('new'); }}>New note</Button>
          {!loading && !error && !filtered.length && <p>No notes match this view.</p>}
          <ul className="space-y-2">{filtered.map(note => <li key={note.id}><button className="w-full rounded border p-3 text-left" onClick={() => setSelected(note.id)}><span className="font-semibold">{note.title || 'Untitled'}</span><span className="block text-sm text-muted-foreground">#{note.id} · {note.linked_type}{drafts[note.id] ? ' · Draft retained' : ''}</span></button></li>)}</ul>
        </>}
      </div>}
    </SheetContent>
  </Sheet>;
}
