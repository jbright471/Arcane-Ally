import socket from '../socket';
import { toast } from 'sonner';
import { generateRequestId } from '../lib/requestId';

function guardOnline(action: () => void): void {
  if (!navigator.onLine) {
    toast.warning('You are offline. Changes cannot be saved until reconnected.');
    return;
  }
  action();
}

export const backend = {
  // HP
  updateHp: (characterId: string, delta: number, damageType?: string, skipConcentrationAutoRoll?: boolean) => {
    guardOnline(() => socket.emit('update_hp', { characterId: parseInt(characterId), delta, damageType, skipConcentrationAutoRoll, requestId: generateRequestId() }));
  },

  setTempHp: (characterId: string, amount: number) => {
    guardOnline(() => socket.emit('set_temp_hp', { characterId: parseInt(characterId), amount, requestId: generateRequestId() }));
  },

  // Conditions
  applyCondition: (characterId: string, condition: string, durationRounds?: number) => {
    guardOnline(() => socket.emit('apply_condition', { characterId: parseInt(characterId), condition, durationRounds, requestId: generateRequestId() }));
  },

  removeCondition: (characterId: string, condition: string) => {
    guardOnline(() => socket.emit('remove_condition', { characterId: parseInt(characterId), condition, requestId: generateRequestId() }));
  },

  // Spells
  useSpellSlot: (characterId: string, slotLevel: number) => {
    guardOnline(() => socket.emit('use_spell_slot', { characterId: parseInt(characterId), slotLevel, requestId: generateRequestId() }));
  },

  castSpell: (characterId: string, opts: {
    spellName: string;
    spellLevel: number;
    castAtLevel: number;
    isConcentration?: boolean;
    damageDice?: string;
    damageType?: string;
  }) => {
    guardOnline(() => socket.emit('cast_spell', {
      characterId: parseInt(characterId),
      ...opts,
      requestId: generateRequestId(),
    }));
  },

  castConcentrationSpell: (characterId: string, spellName: string, slotLevel?: number) => {
    guardOnline(() => socket.emit('cast_concentration_spell', { characterId: parseInt(characterId), spellName, slotLevel, requestId: generateRequestId() }));
  },

  dropConcentration: (characterId: string) => {
    guardOnline(() => socket.emit('drop_concentration', { characterId: parseInt(characterId), requestId: generateRequestId() }));
  },

  // Hit Dice
  spendHitDie: (characterId: string, dieType: string) => {
    guardOnline(() => socket.emit('spend_hit_die', { characterId: parseInt(characterId), dieType, requestId: generateRequestId() }));
  },

  // Rests
  shortRest: (characterId: string) => {
    guardOnline(() => socket.emit('short_rest', { characterId: parseInt(characterId), requestId: generateRequestId() }));
  },

  longRest: (characterId: string) => {
    guardOnline(() => socket.emit('long_rest', { characterId: parseInt(characterId), requestId: generateRequestId() }));
  },

  // AI / Sync
  syncDdb: async (characterId: string, url: string) => {
    const res = await fetch(`/api/characters/${characterId}/sync`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return res.json();
  },

  parseItem: async (characterId: string, itemId: string, name: string, description: string, isHomebrew: boolean) => {
    const res = await fetch('/api/homebrew/parse-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: parseInt(characterId), itemId, name, description, isHomebrew })
    });
    return res.json();
  },

  deleteCharacter: (characterId: string) => {
    guardOnline(() => socket.emit('delete_character', { characterId: parseInt(characterId) }));
  }
};
