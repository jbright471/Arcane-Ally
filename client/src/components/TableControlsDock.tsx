import type { ReactNode } from 'react';

/**
 * One shared anchor for the three persistent table controls. Keeping the
 * triggers in a single flex row prevents each feature from guessing its own
 * fixed offset at narrow widths.
 */
export function TableControlsDock({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-fit items-end gap-3 rounded-full border border-border/40 bg-background/95 p-1.5 shadow-xl shadow-black/40"
      role="group"
      aria-label="Table tools"
      data-table-controls-dock
    >
      {children}
    </div>
  );
}
