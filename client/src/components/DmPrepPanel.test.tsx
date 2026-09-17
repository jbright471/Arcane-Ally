import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DmPrepPanel } from './DmPrepPanel';
const game = vi.hoisted(() => ({ token: 'fixture' as string | null }));
vi.mock('../context/GameContext', () => ({ useGame: () => ({ state: { dmToken: game.token } }) }));
vi.mock('../socket', () => ({ default: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }));
const notes = [
  { id: 1, title: 'Forest', content: '@[Tower](note:2)', tags: [], linked_type: 'map_marker', linked_id: 10 },
  { id: 2, title: 'Tower', content: 'Second scene', tags: [], linked_type: 'map_marker', linked_id: 20 },
];
beforeEach(() => { game.token = 'fixture'; localStorage.setItem('dm_token', 'fixture'); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
it('navigates outside the scene filter without discarding a draft, saves, and clears on logout', async () => {
  const request = vi.spyOn(window, 'fetch').mockImplementation(async (_url, init) => {
    if (init?.method === 'PATCH') return new Response(JSON.stringify({ ...notes[0], ...JSON.parse(init.body as string) }));
    return new Response(JSON.stringify(notes));
  });
  const props = { isOpen: true, onClose: vi.fn(), contextFilter: { type: 'map_marker' as const, id: 10 } };
  const view = render(<DmPrepPanel {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: /Forest/ }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Forest draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tower' }));
  expect(screen.getByLabelText('Title')).toHaveValue('Tower');
  fireEvent.click(screen.getByRole('button', { name: 'Back to notes' }));
  fireEvent.click(screen.getByRole('button', { name: /Forest/ }));
  expect(screen.getByLabelText('Title')).toHaveValue('Forest draft');
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  await waitFor(() => expect(request.mock.calls.some(call => call[1]?.method === 'PATCH')).toBe(true));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save note' })).toBeEnabled());
  game.token = null; view.rerender(<DmPrepPanel {...props} />);
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  expect(screen.getByText(/Sign in as DM/)).toBeInTheDocument();
});
it('retains a draft when the server rejects a save', async () => {
  vi.spyOn(window, 'fetch').mockImplementation(async (_url, init) => init?.method === 'PATCH' ? new Response('{}', { status: 500 }) : new Response(JSON.stringify(notes)));
  render(<DmPrepPanel isOpen onClose={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: /Forest/ }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Keep this edit' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('not saved');
  expect(screen.getByLabelText('Title')).toHaveValue('Keep this edit');
});
