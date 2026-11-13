import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterCard } from './CharacterCard';
import type { Character } from '../types/character';
import socket from '../socket';

vi.mock('../context/GameContext', () => ({ useGame: () => ({ state: { isDm: true } }) }));
vi.mock('../socket', () => ({ default: { emit: vi.fn() } }));

const character: Character = {
  id: '42', name: 'Fixture hero', class: 'Wizard', level: 3,
  hp: { current: 12, max: 20, temp: 0 }, ac: 14, speed: 30,
  abilityScores: { STR: 10, DEX: 10, CON: 10, INT: 16, WIS: 10, CHA: 10 },
  conditions: [], conditionDurations: {}, skillProficiencies: {}, saveProficiencies: {},
  equipment: [], homebrewInventory: [], spellSlots: {}, spells: [], abilities: [],
  proficiencyBonus: 2, initiative: 0, activeBuffs: [], activeFeatures: [],
  hitDice: {}, hitDiceUsed: {}, concentratingOn: 'Synthetic ward',
};

function CurrentLocation() {
  return <output aria-label="Current route">{useLocation().pathname}</output>;
}

function renderCard(onClick?: () => void) {
  const result = render(
    <MemoryRouter initialEntries={['/party']}>
      <CharacterCard character={character} onClick={onClick} />
      <CurrentLocation />
    </MemoryRouter>,
  );
  return result.container.querySelector<HTMLElement>('[role="button"]')!;
}

describe('Character card action ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('PointerEvent', MouseEvent);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes('effect-timeline') ? [] : null,
    })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(['click', 'Enter', ' '])('opens the sheet once when the card owns %j', activation => {
    const card = renderCard();
    if (activation === 'click') fireEvent.click(card);
    else fireEvent.keyDown(card, { key: activation });
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/character/42');
    expect(fetch).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it.each(['click', 'Enter', ' '])('calls a supplied selection once when the card owns %j', activation => {
    const select = vi.fn();
    const card = renderCard(select);
    if (activation === 'click') fireEvent.click(card);
    else fireEvent.keyDown(card, { key: activation });
    expect(select).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/party');
    expect(fetch).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it.each([
    ['Combat State Inspector', 'Enter'], ['Combat State Inspector', ' '],
    ['Effect History', 'Enter'], ['Effect History', ' '],
  ])('leaves %s %j activation to the nested button', async (name, key) => {
    const select = vi.fn();
    renderCard(select);
    const trigger = screen.getByRole('button', { name });
    trigger.focus();
    // JSDOM does not synthesize a button's native click after a key event.
    // Assert the key remains available for that default action, then dispatch it.
    expect(fireEvent.keyDown(trigger, { key })).toBe(true);
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    if (name === 'Combat State Inspector') {
      await screen.findByRole('dialog', { name: 'Combat State Inspector: Fixture hero' });
    } else {
      await screen.findByText('No recent effects');
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(select).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/party');
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it.each(['Enter', ' '])('opens and dismisses the portaled options menu using %j without selecting the card', async key => {
    const select = vi.fn();
    const card = renderCard(select);
    const trigger = screen.getByRole('button', { name: 'Character options' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key });
    const item = await screen.findByRole('menuitem', { name: 'Break Concentration' });
    expect(card).not.toContainElement(item);
    expect(select).not.toHaveBeenCalled();
    fireEvent.keyDown(item, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(select).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it.each(['Enter', ' '])('keeps portaled menu %j activation owned by its intended action', async key => {
    const select = vi.fn();
    renderCard(select);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Character options' }), { key: 'Enter' });
    const item = await screen.findByRole('menuitem', { name: 'Break Concentration' });
    fireEvent.keyDown(item, { key });
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith('drop_concentration', { characterId: 42, actor: 'DM' });
    expect(select).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/party');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves pointer opening of nested controls without selecting the card', async () => {
    const select = vi.fn();
    renderCard(select);
    fireEvent.click(screen.getByRole('button', { name: 'Effect History' }));
    await screen.findByText('No recent effects');
    fireEvent.click(screen.getByRole('button', { name: 'Effect History' }));
    await waitFor(() => expect(screen.queryByText('No recent effects')).not.toBeInTheDocument());
    const options = screen.getByRole('button', { name: 'Character options' });
    fireEvent.pointerDown(options, { button: 0, ctrlKey: false });
    const item = await screen.findByRole('menuitem', { name: 'Break Concentration' });
    fireEvent.keyDown(item, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Combat State Inspector' }));
    await screen.findByRole('dialog', { name: 'Combat State Inspector: Fixture hero' });
    expect(select).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/party');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(socket.emit).not.toHaveBeenCalled();
  });
});
