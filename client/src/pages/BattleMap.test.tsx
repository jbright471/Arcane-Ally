import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import BattleMap from './BattleMap';
const game = vi.hoisted(() => ({ state: {
  dmToken: 'fixture' as string | null, isDm: true, mapState: null, characters: [], initiativeState: [], roundNumber: 0,
  readiness: { connected: false, party: false, initiative: false, combat: false, map: false, dmAuthenticated: false },
} }));
vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../socket', () => ({ default: { emit: vi.fn() }, accessCredential: { token: null } }));
vi.mock('../hooks/useAuthenticatedResourceUrl', () => ({ useAuthenticatedResourceUrl: () => null }));
it('shows recovery rather than a sign-in instruction during a DM reconnect', () => {
  render(<BattleMap />);
  expect(screen.getByRole('status')).toHaveTextContent('Connection lost');
  expect(screen.queryByText(/Sign in as DM/)).not.toBeInTheDocument();
});
