import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, useGame } from './GameContext';

const socket = vi.hoisted(() => ({
  connected: true,
  emit: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
  off: vi.fn(),
  on: vi.fn(),
}));

vi.mock('../socket', () => ({ default: socket }));

function EffectStateProbe() {
  const { state } = useGame();
  return <div>{Array.isArray(state.effectEvents) ? 'effect-list' : 'invalid-effect-state'}</div>;
}

describe('GameProvider DM session recovery', () => {
  beforeEach(() => {
    window.localStorage.clear();
    socket.emit.mockReset();
    socket.off.mockReset();
    socket.on.mockReset();
    vi.restoreAllMocks();
  });

  it('keeps effect state renderable when a stored DM session has expired', async () => {
    window.localStorage.setItem('dm_token', 'stale-session-token');
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ code: 'REST_DM_REQUIRED' }),
      clone: () => ({ json: async () => ({ code: 'REST_DM_REQUIRED' }) }),
    } as unknown as Response);

    render(
      <GameProvider>
        <EffectStateProbe />
      </GameProvider>,
    );

    await waitFor(() => expect(window.fetch).toHaveBeenCalledWith('/api/effect-timeline', expect.objectContaining({ headers: expect.any(Headers) })));
    await waitFor(() => expect(screen.getByText('effect-list')).toBeInTheDocument());
    expect(window.localStorage.getItem('dm_token')).toBeNull();
  });
});

afterEach(() => window.history.replaceState({}, '', '/'));
function ReadinessProbe() {
  const { state } = useGame();
  return <pre data-testid="readiness">{JSON.stringify({ ...state.readiness, isDm: state.isDm, characters: state.characters.length })}</pre>;
}
it('requires a DM acknowledgement and fresh snapshots after reconnect', () => {
  localStorage.clear(); socket.on.mockReset();
  render(<GameProvider><ReadinessProbe /></GameProvider>);
  const emit = (event: string, payload?: unknown) => act(() => { socket.on.mock.calls.filter(call => call[0] === event).forEach(call => call[1](payload)); });
  emit('party_state', []);
  expect(JSON.parse(screen.getByTestId('readiness').textContent!).dmAuthenticated).toBe(false);
  emit('dm_room_joined', { success: true });
  expect(JSON.parse(screen.getByTestId('readiness').textContent!).party).toBe(false);
  emit('party_state', []); emit('initiative_state', []); emit('combat_state_sync', { round: 0 }); emit('map_state', null);
  expect(JSON.parse(screen.getByTestId('readiness').textContent!)).toMatchObject({ party: true, initiative: true, combat: true, map: true, dmAuthenticated: true });
  emit('disconnect');
  expect(JSON.parse(screen.getByTestId('readiness').textContent!)).toMatchObject({ party: false, initiative: false, combat: false, map: false, dmAuthenticated: false });
});
it('never inherits a stored DM session in a cast audience view', () => {
  vi.restoreAllMocks(); socket.emit.mockReset();
  window.history.replaceState({}, '', '/encounter/session/cast');
  localStorage.setItem('dm_token', 'fixture');
  const request = vi.spyOn(window, 'fetch');
  render(<GameProvider><ReadinessProbe /></GameProvider>);
  expect(JSON.parse(screen.getByTestId('readiness').textContent!).isDm).toBe(false);
  expect(request).not.toHaveBeenCalled();
  expect(socket.emit).not.toHaveBeenCalledWith('dm_join_room', expect.anything());
});
