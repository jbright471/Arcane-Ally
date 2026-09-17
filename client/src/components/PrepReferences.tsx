import { useRef, useState } from 'react';

export interface NoteReference { id: number; title: string }
export function referenceToken(note: NoteReference) {
  return `@[${note.title.replace(/[\]\r\n]/g, ' ')}](note:${note.id})`;
}

export function PrepReferenceText({ content, notes, onOpen }: {
  content: string; notes: NoteReference[]; onOpen: (id: number) => void;
}) {
  const pattern = /@\[([^\]\r\n]*)\]\(note:([1-9]\d*)\)/g;
  const pieces = [];
  let end = 0;
  for (const match of content.matchAll(pattern)) {
    pieces.push(content.slice(end, match.index));
    const id = Number(match[2]);
    const target = notes.find(note => note.id === id);
    pieces.push(target ? <button key={match.index} type="button" className="text-primary underline underline-offset-4"
      onClick={() => onOpen(id)}>{target.title || 'Untitled'}</button>
      : <span key={match.index} className="text-muted-foreground">{match[1]} (note unavailable)</span>);
    end = match.index! + match[0].length;
  }
  pieces.push(content.slice(end));
  return <div className="whitespace-pre-wrap break-words">{pieces}</div>;
}

export function PrepReferenceEditor({ value, onChange, notes, currentId }: {
  value: string; onChange: (value: string) => void; notes: NoteReference[]; currentId?: number;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; end: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const options = mention ? notes.filter(note => note.id !== currentId && note.title.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 8) : [];
  function locate(text: string, caret: number) {
    const match = text.slice(0, caret).match(/(?:^|\s)@([^@\n\[\]]*)$/);
    setMention(match ? { start: caret - match[1].length - 1, end: caret, query: match[1] } : null);
    setActive(0);
  }
  function insert(note: NoteReference) {
    if (!mention) return;
    const token = referenceToken(note);
    onChange(value.slice(0, mention.start) + token + value.slice(mention.end));
    const caret = mention.start + token.length;
    setMention(null);
    requestAnimationFrame(() => { field.current?.focus(); field.current?.setSelectionRange(caret, caret); });
  }
  return <div className="space-y-2">
    <label className="text-sm" htmlFor="prep-content">Note content</label>
    <textarea id="prep-content" ref={field} value={value} rows={7} role="combobox"
      aria-autocomplete="list" aria-expanded={!!mention} aria-controls="prep-mentions"
      aria-activedescendant={mention && options[active] ? `prep-option-${options[active].id}` : undefined}
      aria-describedby="prep-reference-help" className="w-full rounded border bg-background p-3 text-sm"
      onChange={event => { onChange(event.target.value); locate(event.target.value, event.target.selectionStart); }}
      onSelect={event => locate(value, event.currentTarget.selectionStart)}
      onKeyDown={event => {
        if (!mention) return;
        if (event.key === 'Escape' || event.key === 'Tab') { setMention(null); return; }
        if (options.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault(); setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
        } else if (event.key === 'Enter' && options[active]) { event.preventDefault(); insert(options[active]); }
      }} />
    <p id="prep-reference-help" className="text-xs text-muted-foreground">Type @ to link another private note. Use arrow keys and Enter to select.</p>
    {mention && <ul id="prep-mentions" role="listbox" aria-label="Private note references" className="rounded border bg-card p-1">
      {options.map((note, index) => <li key={note.id} id={`prep-option-${note.id}`} role="option" aria-selected={index === active}
        onMouseDown={event => event.preventDefault()} onClick={() => insert(note)}
        className={`cursor-pointer rounded p-2 text-sm ${index === active ? 'bg-primary/15' : ''}`}>{note.title || 'Untitled'} <span className="text-muted-foreground">#{note.id}</span></li>)}
      {!options.length && <li role="presentation" className="p-2 text-sm">No matching notes.</li>}
    </ul>}
  </div>;
}
