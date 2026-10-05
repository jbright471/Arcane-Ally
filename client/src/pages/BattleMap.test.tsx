import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BattleMap from './BattleMap';

const game = vi.hoisted(() => ({ state: {
  dmToken: 'fixture' as string | null,
  isDm: true,
  mapState: null as any,
  mapStateError: null as any,
  characters: [] as any[],
  initiativeState: [] as any[],
  roundNumber: 0,
  readiness: { connected: false, party: false, initiative: false, combat: false, map: false, dmAuthenticated: false },
} }));
const socket = vi.hoisted(() => ({
  emit: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
}));
const access = vi.hoisted(() => ({ token: null as string | null, flow: null as 'companion' | 'cast' | null }));

vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../socket', () => ({ default: socket, accessCredential: access }));
vi.mock('../hooks/useAuthenticatedResourceUrl', () => ({ useAuthenticatedResourceUrl: () => null }));

describe('BattleMap', () => {
  beforeEach(() => {
    game.state.dmToken = 'fixture';
    game.state.isDm = true;
    game.state.mapState = null;
    game.state.mapStateError = null;
    game.state.characters = [];
    game.state.initiativeState = [];
    game.state.roundNumber = 0;
    game.state.readiness = { connected: false, party: false, initiative: false, combat: false, map: false, dmAuthenticated: false };
    access.token = null;
    access.flow = null;
    socket.emit.mockReset();
    socket.disconnect.mockReset();
    socket.connect.mockReset();
  });

  it('shows recovery rather than a sign-in instruction during a DM reconnect', () => {
    render(<BattleMap />);
    expect(screen.getByRole('status')).toHaveTextContent('Connection lost');
    expect(screen.queryByText(/Sign in as DM/)).not.toBeInTheDocument();
  });

  it('explains DM, companion, and cast access on the public route', () => {
    game.state.dmToken = null;
    game.state.isDm = false;
    render(<BattleMap />);
    expect(screen.getByText('Choose the view your DM shared')).toBeInTheDocument();
    expect(screen.getByText('Player companion')).toBeInTheDocument();
    expect(screen.getByText('Read-only cast')).toBeInTheDocument();
  });

  it('requests a fresh snapshot without emitting a map mutation', () => {
    game.state.mapStateError = { code: 'INVALID_MAP_STATE', issues: ['token_0_x_invalid'] };
    render(<BattleMap />);
    fireEvent.click(screen.getByRole('button', { name: 'Request a fresh snapshot' }));

    expect(socket.emit).toHaveBeenCalledWith('dm_join_room', { dmToken: 'fixture' });
    expect(socket.emit).not.toHaveBeenCalledWith('move_token', expect.anything());
    expect(socket.emit).not.toHaveBeenCalledWith('sync_map_tokens');
    expect(screen.getByRole('alert')).toHaveTextContent('rejected it before rendering tokens');
  });

  it('renders only role-projected AC and condition values and ignores an invalid HP denominator', () => {
    game.state.dmToken = null;
    game.state.isDm = false;
    access.token = 'synthetic-player-token';
    access.flow = 'companion';
    game.state.mapState = {
      id: 7,
      name: 'Synthetic map',
      image_data: null,
      tokens: [
        { id: 1, map_id: 7, entity_id: 'pc-1', entity_name: 'Fixture hero', entity_type: 'pc', x: 25, y: 50, is_hidden: 0 },
        { id: 2, map_id: 7, entity_id: 'm-visible', entity_name: 'Projected foe', entity_type: 'monster', x: 75, y: 50, is_hidden: 0 },
      ],
    };
    game.state.initiativeState = [
      { id: 1, entity_name: 'Fixture hero', entity_type: 'pc', current_hp: 12, max_hp: 20, ac: 15, conditions: ['Prone'], character_id: 1, instance_id: null, is_hidden: 0 },
      { id: 2, entity_name: 'Projected foe', entity_type: 'monster', current_hp: 9, max_hp: 0, ac: null, conditions: [], character_id: null, instance_id: 'visible', is_hidden: 0, private_ac: 99 },
    ];

    render(<BattleMap />);

    expect(screen.getByLabelText('Armor class 15')).toHaveTextContent('AC 15');
    expect(screen.getByLabelText('Condition: Prone')).toBeInTheDocument();
    expect(screen.queryByText('AC 99')).not.toBeInTheDocument();
    expect(screen.queryByText('Infinity%')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fixture hero, armor class 15, conditions Prone')).toBeInTheDocument();
  });
});
