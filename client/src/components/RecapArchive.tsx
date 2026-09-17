import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ArchiveContent } from './ArchiveContent';
import { RouteErrorBoundary } from './RouteErrorBoundary';
export function RecapArchive({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Dialog open={open} onOpenChange={value => !value && onClose()}><DialogContent className="max-w-5xl max-h-[85dvh] overflow-auto">
    <DialogHeader><DialogTitle>The Grand Archive</DialogTitle><DialogDescription>Private DM session history</DialogDescription></DialogHeader>
    {open && <RouteErrorBoundary><ArchiveContent /></RouteErrorBoundary>}
  </DialogContent></Dialog>;
}
