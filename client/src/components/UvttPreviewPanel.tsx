import { useRef, useState } from 'react';
import { AlertTriangle, FileCheck2, ScanSearch, Upload } from 'lucide-react';
import { dmFetch } from '../lib/dmFetch';
import { Button } from './ui/button';

interface UvttPreviewReceipt {
  kind: 'uvtt-preview';
  formatVersion: string;
  mapSize: {
    widthCells: number;
    heightCells: number;
    pixelsPerGrid: number;
    pixelWidth: number;
    pixelHeight: number;
  };
  counts: {
    wallPaths: number;
    wallPoints: number;
    objectWallPaths: number;
    objectWallPoints: number;
    portals: number;
    lights: number;
  };
  image: { mediaType: 'image/png'; bytes: number };
  warnings: string[];
  persistence: 'none';
}

interface UvttPreviewResponse {
  file: { name: string; bytes: number };
  receipt: UvttPreviewReceipt;
}

function isPreviewResponse(value: unknown): value is UvttPreviewResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<UvttPreviewResponse>;
  const receipt = candidate.receipt as Partial<UvttPreviewReceipt> | undefined;
  const numbers = [
    candidate.file?.bytes,
    receipt?.mapSize?.widthCells,
    receipt?.mapSize?.heightCells,
    receipt?.mapSize?.pixelsPerGrid,
    receipt?.mapSize?.pixelWidth,
    receipt?.mapSize?.pixelHeight,
    receipt?.counts?.wallPaths,
    receipt?.counts?.wallPoints,
    receipt?.counts?.objectWallPaths,
    receipt?.counts?.objectWallPoints,
    receipt?.counts?.portals,
    receipt?.counts?.lights,
    receipt?.image?.bytes,
  ];
  return receipt?.kind === 'uvtt-preview'
    && receipt.persistence === 'none'
    && Array.isArray(receipt.warnings)
    && receipt.warnings.every(warning => typeof warning === 'string')
    && receipt.image?.mediaType === 'image/png'
    && typeof candidate.file?.name === 'string'
    && numbers.every(number => typeof number === 'number' && Number.isFinite(number) && number >= 0);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UvttPreviewPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<UvttPreviewResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const previewFile = async (file: File) => {
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const response = await dmFetch('/api/maps/uvtt/preview', { method: 'POST', body: form });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : 'UVTT preview failed.';
        throw new Error(message);
      }
      if (!isPreviewResponse(body)) throw new Error('The preview receipt was not recognized.');
      setPreview(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'UVTT preview failed.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const receipt = preview?.receipt;
  const wallPaths = receipt ? receipt.counts.wallPaths + receipt.counts.objectWallPaths : 0;
  const wallPoints = receipt ? receipt.counts.wallPoints + receipt.counts.objectWallPoints : 0;

  return (
    <details className="rounded-lg border border-primary/15 bg-secondary/10 p-3" data-uvtt-preview>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-primary marker:hidden">
        <ScanSearch className="h-4 w-4" />
        Preview a UVTT file
        <span className="ml-auto text-[10px] font-normal uppercase tracking-wider text-muted-foreground">Zero-write</span>
      </summary>
      <div className="mt-3 space-y-3 border-t border-border/30 pt-3">
        <p className="text-xs text-muted-foreground">
          Check DungeonDraft geometry before deciding what to import. Preview does not save a map, activate it, or change campaign data.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".uvtt,.dd2vtt,application/json"
          className="sr-only"
          aria-label="Choose UVTT file"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) void previewFile(file);
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          {loading ? 'Inspecting…' : 'Choose UVTT file'}
        </Button>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {preview && receipt && (
          <section className="space-y-3 rounded-md border border-green-500/25 bg-green-500/5 p-3" aria-label="UVTT preview receipt">
            <div className="flex flex-wrap items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-green-400" />
              <span className="text-sm font-semibold">{preview.file.name}</span>
              <span className="text-[10px] text-muted-foreground">{formatBytes(preview.file.bytes)}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Map size</dt><dd>{receipt.mapSize.widthCells} × {receipt.mapSize.heightCells} cells</dd></div>
              <div><dt className="text-muted-foreground">Pixels</dt><dd>{receipt.mapSize.pixelWidth} × {receipt.mapSize.pixelHeight}</dd></div>
              <div><dt className="text-muted-foreground">Walls</dt><dd>{wallPaths} paths / {wallPoints} points</dd></div>
              <div><dt className="text-muted-foreground">Scene data</dt><dd>{receipt.counts.portals} portals / {receipt.counts.lights} lights</dd></div>
            </dl>
            {receipt.warnings.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-amber-300">Review notes</h3>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {receipt.warnings.map(warning => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            )}
            <p className="text-xs font-semibold text-green-300">Preview complete. No map or campaign data was changed.</p>
          </section>
        )}
      </div>
    </details>
  );
}
