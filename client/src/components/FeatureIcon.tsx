import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export type FeatureIconTone = 'gold' | 'health' | 'mana';
type FeatureIconSize = 'card' | 'heading';

const toneClasses: Record<FeatureIconTone, { frame: string; glyph: string; line: string }> = {
  gold: {
    frame: 'border-primary/35 bg-primary/10 shadow-primary/10',
    glyph: 'text-primary',
    line: 'via-primary/70',
  },
  health: {
    frame: 'border-health/35 bg-health/10 shadow-health/10',
    glyph: 'text-health',
    line: 'via-health/70',
  },
  mana: {
    frame: 'border-mana/35 bg-mana/10 shadow-mana/10',
    glyph: 'text-mana',
    line: 'via-mana/70',
  },
};

const sizeClasses: Record<FeatureIconSize, { frame: string; glyph: string; inset: string }> = {
  card: {
    frame: 'h-14 w-14 rounded-xl',
    glyph: 'h-7 w-7',
    inset: 'inset-1 rounded-lg',
  },
  heading: {
    frame: 'h-7 w-7 rounded-md',
    glyph: 'h-4 w-4',
    inset: 'inset-[3px] rounded-[5px]',
  },
};

type FeatureIconProps = {
  icon: LucideIcon;
  tone?: FeatureIconTone;
  size?: FeatureIconSize;
  className?: string;
  iconClassName?: string;
};

export function FeatureIcon({
  icon: Icon,
  tone = 'gold',
  size = 'card',
  className,
  iconClassName,
}: FeatureIconProps) {
  const toneClass = toneClasses[tone];
  const sizeClass = sizeClasses[size];

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden border shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5',
        sizeClass.frame,
        toneClass.frame,
        className,
      )}
      aria-hidden="true"
    >
      <span className={cn('absolute border border-foreground/5', sizeClass.inset)} />
      <span className={cn('absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent to-transparent', toneClass.line)} />
      <Icon className={cn('relative z-10 transition-transform duration-200 group-hover:scale-110', sizeClass.glyph, toneClass.glyph, iconClassName)} strokeWidth={1.8} />
    </span>
  );
}
