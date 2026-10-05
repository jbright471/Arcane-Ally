import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UvttPreviewPanel } from './UvttPreviewPanel';

const receipt = {
  file: { name: 'fixture.dd2vtt', bytes: 128 },
  receipt: {
    kind: 'uvtt-preview',
    formatVersion: '0.3',
    mapSize: { widthCells: 10, heightCells: 8, pixelsPerGrid: 128, pixelWidth: 1280, pixelHeight: 1024 },
    counts: { wallPaths: 1, wallPoints: 2, objectWallPaths: 1, objectWallPoints: 2, portals: 1, lights: 1 },
    image: { mediaType: 'image/png', bytes: 8 },
    warnings: ['Lights are counted for review but are not imported or activated.'],
    persistence: 'none',
  },
};

describe('UvttPreviewPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('dm_token', 'synthetic-dm-session');
    vi.restoreAllMocks();
  });

  it('uploads one file for preview and renders a zero-write receipt', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => receipt,
      clone: () => ({ json: async () => receipt }),
    } as unknown as Response);

    render(<UvttPreviewPanel />);
    fireEvent.click(screen.getByText('Preview a UVTT file'));
    const file = new File(['synthetic uvtt'], 'fixture.dd2vtt', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Choose UVTT file'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('region', { name: 'UVTT preview receipt' })).toBeInTheDocument());
    expect(screen.getByText('1 portals / 1 lights')).toBeInTheDocument();
    expect(screen.getByText('Preview complete. No map or campaign data was changed.')).toBeInTheDocument();
    const [, options] = fetchSpy.mock.calls[0];
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/maps/uvtt/preview');
    expect(options).toMatchObject({ method: 'POST' });
    expect(options?.body).toBeInstanceOf(FormData);
  });

  it('renders a bounded error and no receipt when preview is rejected', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'INVALID_UVTT', error: 'UVTT file must contain valid JSON' }),
      clone: () => ({ json: async () => ({ code: 'INVALID_UVTT' }) }),
    } as unknown as Response);

    render(<UvttPreviewPanel />);
    fireEvent.click(screen.getByText('Preview a UVTT file'));
    fireEvent.change(screen.getByLabelText('Choose UVTT file'), {
      target: { files: [new File(['bad'], 'bad.dd2vtt')] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('UVTT file must contain valid JSON');
    expect(screen.queryByRole('region', { name: 'UVTT preview receipt' })).not.toBeInTheDocument();
  });

  it('fails closed when a successful response has an incomplete receipt', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ receipt: { kind: 'uvtt-preview', persistence: 'none', warnings: [] } }),
      clone: () => ({ json: async () => ({}) }),
    } as unknown as Response);

    render(<UvttPreviewPanel />);
    fireEvent.click(screen.getByText('Preview a UVTT file'));
    fireEvent.change(screen.getByLabelText('Choose UVTT file'), {
      target: { files: [new File(['synthetic'], 'fixture.dd2vtt')] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('preview receipt was not recognized');
  });
});
