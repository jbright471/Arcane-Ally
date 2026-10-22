import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function projectedMap(status: unknown = 'Bloodied') {
  game.state.dmToken = null;
  game.state.isDm = false;
  access.token = 'synthetic-player-token';
  access.flow = 'companion';
  game.state.mapState = {
    id: 7, name: 'Synthetic map', image_data: null,
    tokens: [
      { id: 2, map_id: 7, entity_id: 'm-visible', entity_name: 'Projected foe', entity_type: 'monster', x: 50, y: 50, is_hidden: 0 },
      { id: 3, map_id: 7, entity_id: 'm-hidden', entity_name: 'Hidden sentinel', entity_type: 'monster', x: 75, y: 50, is_hidden: 1 },
    ],
  };
  game.state.initiativeState = [{
    id: 2, entity_name: 'Projected foe', entity_type: 'monster', current_hp: null, max_hp: null,
    hp_status: status, ac: null, conditions: [], character_id: null, instance_id: 'visible', is_hidden: 0,
    private_current_hp: 77, private_max_hp: 88,
  }];
}

describe('BattleMap', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
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
  afterEach(() => vi.unstubAllGlobals());

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

  it.each(['Healthy', 'Bloodied', 'Critical', 'Dead'])('uses the projected %s label consistently without inventing exact HP', status => {
    projectedMap(status);
    render(<BattleMap />);
    const token = screen.getByRole('img', { name: `Projected foe, health ${status}` });
    expect(token.querySelector('[title]')).toHaveAttribute('title', `Projected foe — Health: ${status}`);
    const legend = screen.getByRole('region', { name: 'Token legend' });
    expect(within(legend).getByLabelText(`Health: ${status}`)).toHaveTextContent(status);
    expect(legend.textContent).not.toMatch(/77|88|\d+\s*\/\s*\d+|\d+%/);
    expect(screen.queryByText('Hidden sentinel')).not.toBeInTheDocument();
    expect(socket.emit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([null, '', 'Hurt', ' Healthy ', {}, 3, ['Healthy']])('does not manufacture health for an unknown or malformed status: %j', status => {
    projectedMap(status);
    render(<BattleMap />);
    expect(screen.getByRole('img', { name: 'Projected foe' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Health:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Healthy', { exact: true })).not.toBeInTheDocument();
  });

  it('does not invent health when the initiative entry or status is absent', () => {
    projectedMap();
    game.state.initiativeState = [];
    const { rerender } = render(<BattleMap />);
    expect(screen.queryByLabelText(/^Health:/)).not.toBeInTheDocument();
    projectedMap();
    delete game.state.initiativeState[0].hp_status;
    rerender(<BattleMap />);
    expect(screen.queryByLabelText(/^Health:/)).not.toBeInTheDocument();
  });

  it('preserves exact HP, AC and conditions when supplied instead of adding a broad label', () => {
    projectedMap();
    Object.assign(game.state.initiativeState[0], { current_hp: 10, max_hp: 20, ac: 15, conditions: ['Prone'] });
    render(<BattleMap />);
    expect(screen.getByText('10/20')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Health:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Armor class 15')).toBeInTheDocument();
    expect(screen.getByLabelText('Condition: Prone')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Projected foe, armor class 15, conditions Prone' }).querySelector('[title]'))
      .toHaveAttribute('title', 'Projected foe — HP: 10/20');
  });

  it('matches projected PC health by character ID without using an unrelated combatant', () => {
    projectedMap('Critical');
    Object.assign(game.state.mapState.tokens[0], { entity_type: 'pc', entity_id: 'pc-4' });
    Object.assign(game.state.initiativeState[0], { entity_type: 'pc', character_id: 4, instance_id: null });
    render(<BattleMap />);
    expect(screen.getByRole('img', { name: 'Projected foe, health Critical' })).toBeInTheDocument();
  });

  it('refreshes token and legend status together when a projected NPC snapshot changes', () => {
    projectedMap('Bloodied');
    game.state.mapState.tokens[0].entity_type = 'npc';
    const { rerender } = render(<BattleMap />);
    expect(screen.getByRole('img', { name: 'Projected foe, health Bloodied' })).toBeInTheDocument();
    game.state.initiativeState = [{ ...game.state.initiativeState[0], hp_status: 'Critical' }];
    rerender(<BattleMap />);
    expect(screen.getByRole('img', { name: 'Projected foe, health Critical' })).toBeInTheDocument();
    expect(screen.getByLabelText('Health: Critical')).toBeInTheDocument();
    expect(screen.queryByLabelText('Health: Bloodied')).not.toBeInTheDocument();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('offers generic, dismissible legend help without fetching or changing the map', async () => {
    projectedMap();
    render(<BattleMap />);
    const trigger = screen.getByRole('button', { name: 'About the token legend' });
    trigger.focus();
    fireEvent.click(trigger);
    const help = await screen.findByRole('dialog', { name: 'Token legend help' });
    expect(help).toHaveTextContent('Only values supplied for your view are shown');
    expect(help).toHaveTextContent('does not tell you whether information is unavailable or empty');
    fireEvent.keyDown(help, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Token legend help' })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('button', { name: 'Close legend help' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Token legend help' })).not.toBeInTheDocument());
    expect(socket.emit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not show a token legend or its help without visible tokens', () => {
    projectedMap();
    game.state.mapState.tokens = [];
    render(<BattleMap />);
    expect(screen.queryByRole('region', { name: 'Token legend' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'About the token legend' })).not.toBeInTheDocument();
  });
});
