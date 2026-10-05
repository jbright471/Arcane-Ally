import { MonitorUp, ShieldCheck, Smartphone } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export type BattlemapAccessMode = 'public' | 'dm' | 'companion' | 'cast';

const MODE_COPY: Record<Exclude<BattlemapAccessMode, 'public'>, { label: string; detail: string }> = {
  dm: {
    label: 'DM control',
    detail: 'Private controls are available in this browser session.',
  },
  companion: {
    label: 'Player companion',
    detail: 'This link is tied to one character and keeps DM-only information hidden.',
  },
  cast: {
    label: 'Read-only cast',
    detail: 'This display follows the encounter without exposing DM controls.',
  },
};

export function BattlemapAccessHandoff({ mode, compact = false }: { mode: BattlemapAccessMode; compact?: boolean }) {
  if (mode !== 'public') {
    const copy = MODE_COPY[mode];
    return (
      <div
        className={compact
          ? 'flex flex-wrap items-center gap-2 text-xs text-muted-foreground'
          : 'flex flex-wrap items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground'}
        aria-label={`Battlemap access mode: ${copy.label}`}
      >
        <Badge variant="outline" className="border-primary/30 text-primary/80">{copy.label}</Badge>
        <span>{copy.detail}</span>
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-primary/20 bg-secondary/10 p-4" aria-labelledby="battlemap-access-title">
      <div>
        <h2 id="battlemap-access-title" className="font-display text-lg text-primary">Choose the view your DM shared</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Arcane Ally keeps control, player, and shared-screen access separate. Links carry their access privately; this page never displays or creates credentials.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <ShieldCheck className="mb-2 h-5 w-5 text-primary" />
          <h3 className="font-display text-sm">DM control</h3>
          <p className="mt-1 text-xs text-muted-foreground">Use the DM PIN to manage maps, hidden tokens, and encounter tools.</p>
          <Button asChild size="sm" className="mt-3 h-8 text-xs">
            <a href="/dm">Open DM sign-in</a>
          </Button>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <Smartphone className="mb-2 h-5 w-5 text-primary" />
          <h3 className="font-display text-sm">Player companion</h3>
          <p className="mt-1 text-xs text-muted-foreground">Open the character-specific companion link sent by your DM on your own device.</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/40 p-3">
          <MonitorUp className="mb-2 h-5 w-5 text-primary" />
          <h3 className="font-display text-sm">Read-only cast</h3>
          <p className="mt-1 text-xs text-muted-foreground">Open the cast link sent by your DM on a TV or shared encounter display.</p>
        </div>
      </div>
    </section>
  );
}

