import { cn } from '../lib/utils';

const sizeClasses = {
  sm: 'h-5 w-5 p-[2px]',
  md: 'h-7 w-7 p-[3px]',
  lg: 'h-20 w-20 p-2',
} as const;

type BrandMarkProps = {
  size?: keyof typeof sizeClasses;
  className?: string;
  decorative?: boolean;
};

export function BrandMark({
  size = 'md',
  className,
  decorative = true,
}: BrandMarkProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/20 bg-background/70 shadow-sm shadow-black/30',
        sizeClasses[size],
        className,
      )}
    >
      <img
        src="/arcane-ally-mark.png"
        alt={decorative ? '' : 'Arcane Ally'}
        aria-hidden={decorative ? true : undefined}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  );
}
