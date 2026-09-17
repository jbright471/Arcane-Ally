import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ArchiveContent } from './ArchiveContent';
import { RecapArchive } from './RecapArchive';
import { RouteErrorBoundary } from './RouteErrorBoundary';

const game = vi.hoisted(() => ({ token: 'fixture-dm' as string | null }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({ state: { dmToken: game.token } }) }));
vi.mock('./DmAccessGate', () => ({ DmAccessGate: () => <p>DM sign in</p> }));
const recap = { id: 1, recap_text: 'Private fixture chronicle', session_date: null, created_at: '2026-09-17' };
beforeEach(() => { game.token = 'fixture-dm'; localStorage.setItem('dm_token', game.token); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('Archive recovery', () => {
  it('does not request or display private data while signed out', () => {
    game.token = null;
    const request = vi.spyOn(window, 'fetch');
    render(<ArchiveContent />);
    expect(screen.getByText('DM sign in')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
  it('loads with credentials, selects a recap, and clears it on access loss', async () => {
    const request = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify([recap])));
    const view = render(<ArchiveContent />);
    fireEvent.click(await screen.findByRole('button', { name: /Adventure #1/ }));
    expect(screen.getByText(recap.recap_text)).toBeInTheDocument();
    expect(new Headers(request.mock.calls[0][1]?.headers).get('authorization')).toBe('Bearer fixture-dm');
    game.token = null; view.rerender(<ArchiveContent />);
    expect(screen.queryByText(recap.recap_text)).not.toBeInTheDocument();
  });
  it('distinguishes a valid empty archive', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response('[]'));
    render(<ArchiveContent />);
    expect(await screen.findByText('No session recaps yet.')).toBeInTheDocument();
  });
  it.each([401, 403])('contains HTTP %s without rendering an error object', async status => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response('{"code":"REST_DM_REQUIRED"}', { status }));
    render(<ArchiveContent />);
    expect(await screen.findByText('DM sign in')).toBeInTheDocument();
  });
  it.each(['{}', '[{"id":1}]', 'not-json'])('handles malformed data and retries: %s', async body => {
    vi.spyOn(window, 'fetch').mockResolvedValueOnce(new Response(body)).mockResolvedValueOnce(new Response('[]'));
    render(<ArchiveContent />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry archive' }));
    expect(await screen.findByText('No session recaps yet.')).toBeInTheDocument();
  });
  it.each(['server', 'network'])('recovers from %s failure', async kind => {
    const request = vi.spyOn(window, 'fetch');
    if (kind === 'server') request.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    else request.mockRejectedValueOnce(new Error('offline'));
    request.mockResolvedValueOnce(new Response('[]'));
    render(<ArchiveContent />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry archive' }));
    expect(await screen.findByText('No session recaps yet.')).toBeInTheDocument();
  });
  it('aborts on unmount and rejects late data', async () => {
    let complete!: (response: Response) => void;
    const request = vi.spyOn(window, 'fetch').mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const view = render(<ArchiveContent />); view.unmount();
    expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true);
    complete(new Response(JSON.stringify([recap])));
    await waitFor(() => expect(screen.queryByText(recap.recap_text)).not.toBeInTheDocument());
  });
  it('keeps navigation mounted when rendering fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Broken = () => { throw new Error('fixture'); };
    render(<><nav>App navigation</nav><RouteErrorBoundary><Broken /></RouteErrorBoundary></>);
    expect(screen.getByText('App navigation')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('could not be displayed');
  });
});

it('reloads private history when the modal is reopened', async () => {
  const request = vi.spyOn(window, 'fetch').mockImplementation(async () => new Response('[]'));
  const view = render(<RecapArchive open onClose={() => {}} />);
  await screen.findByText('No session recaps yet.');
  view.rerender(<RecapArchive open={false} onClose={() => {}} />);
  view.rerender(<RecapArchive open onClose={() => {}} />);
  await screen.findByText('No session recaps yet.');
  expect(request).toHaveBeenCalledTimes(2);
});
