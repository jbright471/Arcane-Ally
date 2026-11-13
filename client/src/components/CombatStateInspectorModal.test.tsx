import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CombatStateInspectorModal } from './CombatStateInspectorModal';

const inspector = {
  characterId: '42', name: 'Fixture hero',
  ac: { finalAC: 19, breakdown: [
    { source: 'imported', value: 16 },
    { source: 'Fixture ring', type: 'gear-bonus', value: 1 },
    { source: 'shield of faith', type: 'buff', value: 2 },
  ] },
  abilityScores: { STR: { final: 21, modifier: 5, breakdown: [
    { source: 'Base', value: 16 },
    { source: 'Fixture ring', type: 'gear-bonus', value: 2 },
    { source: 'Fixture aura', type: 'buff-bonus', value: 1 },
    { source: 'Fixture buff', type: 'buff-bonus', value: 2 },
  ] } },
  activeConditions: ['prone'], activeBuffs: [],
};

describe('Combat state inspector resolved presentation', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('displays the server resolver finals and source rows without inventing armor or equipment formulas', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(inspector)));
    render(<CombatStateInspectorModal characterId="42" characterName="Fixture hero" open onOpenChange={vi.fn()} />);
    await screen.findByText('Final AC:');
    const dialog = screen.getByRole('dialog', { name: 'Combat State Inspector: Fixture hero' });
    expect(within(dialog).getByText('19')).toBeInTheDocument();
    expect(within(dialog).getByText('21')).toBeInTheDocument();
    expect(within(dialog).getByText('(+5)')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Fixture ring')).toHaveLength(2);
    expect(within(dialog).getByText('Fixture aura')).toBeInTheDocument();
    expect(within(dialog).getByText('Fixture buff')).toBeInTheDocument();
    expect(within(dialog).getByText('prone')).toBeInTheDocument();
    expect(within(dialog).queryByText('Base AC:')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('DEX Modifier')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Equip:')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/characters/42/combat-inspector');
  });

  it('contains an unavailable inspector response without presenting made-up stats', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"error":"Character session state unavailable"}', { status: 409 }));
    render(<CombatStateInspectorModal characterId="42" characterName="Fixture hero" open onOpenChange={vi.fn()} />);
    await screen.findByText('Failed to fetch inspector data');
    expect(screen.queryByText('Final AC:')).not.toBeInTheDocument();
  });
});
