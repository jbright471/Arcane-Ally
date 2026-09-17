import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { FirstSessionChecklist } from './FirstSessionChecklist';
const game = vi.hoisted(() => ({ state: { isDm: true, characters: [] as unknown[], readiness: { connected: true, party: false, dmAuthenticated: false } } }));
vi.mock('../context/GameContext', () => ({ useGame: () => game }));
beforeEach(() => { game.state.characters = []; game.state.isDm = true; game.state.readiness = { connected: true, party: false, dmAuthenticated: false }; });
it('waits for authoritative DM emptiness and supports dismissal/reopening', () => {
  const view = render(<MemoryRouter><FirstSessionChecklist /></MemoryRouter>);
  expect(screen.queryByRole('region', { name: 'First-session guide' })).not.toBeInTheDocument();
  game.state.readiness = { connected: true, party: true, dmAuthenticated: true };
  view.rerender(<MemoryRouter><FirstSessionChecklist /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Create a character' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  fireEvent.click(screen.getByRole('button', { name: 'First-session guide' }));
  expect(screen.getByRole('link', { name: 'Create a character' })).toBeInTheDocument();
});
it('does not expose privileged steps to a manually opened public checklist', () => {
  game.state.isDm = false;
  render(<MemoryRouter><FirstSessionChecklist /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'First-session guide' }));
  expect(screen.queryByRole('link', { name: 'Create a character' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Read the first-session instructions' })).toHaveAttribute('href', '/guide#welcome');
});
it('does not automatically prompt for a populated table or during reconnect', () => {
  game.state.characters = [{}]; game.state.readiness = { connected: true, party: true, dmAuthenticated: true };
  const view = render(<MemoryRouter><FirstSessionChecklist /></MemoryRouter>);
  expect(screen.queryByRole('region', { name: 'First-session guide' })).not.toBeInTheDocument();
  game.state.characters = []; game.state.readiness.connected = false;
  view.rerender(<MemoryRouter><FirstSessionChecklist /></MemoryRouter>);
  expect(screen.queryByRole('region', { name: 'First-session guide' })).not.toBeInTheDocument();
});
