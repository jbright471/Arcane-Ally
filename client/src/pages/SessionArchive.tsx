import { ArchiveContent } from '../components/ArchiveContent';
export default function SessionArchive() {
  return <div className="mx-auto max-w-5xl space-y-5"><h1 className="text-3xl font-display">The Grand Archive</h1><p className="text-muted-foreground">Your session recaps</p><ArchiveContent /></div>;
}
