'use strict';

import { describe, expect, it } from 'vitest';
import {
  buildPlayerViewSnapshot,
  projectBattleMapState,
  projectWorldMapState,
} from '../lib/playerViewProjection.js';

describe('playerViewProjection', () => {
  it('keeps the selected sheet private and summarizes other characters', () => {
    const snapshot = buildPlayerViewSnapshot({
      characterId: 1,
      party: [
        { id: 1, name: 'Aria', inventory: [{ name: 'Private Item' }], currentHp: 20, maxHp: 30 },
        { id: 2, name: 'Brom', inventory: [{ name: 'Hidden Inventory' }], currentHp: 15, maxHp: 25 },
      ],
    });

    expect(snapshot.selectedCharacter.inventory).toEqual([{ name: 'Private Item' }]);
    expect(snapshot.party.find(character => character.id === 2).inventory).toBeUndefined();
  });

  it('removes hidden monsters and exact protected monster stats', () => {
    const snapshot = buildPlayerViewSnapshot({
      characterId: 1,
      party: [{ id: 1, name: 'Aria', currentHp: 20, maxHp: 30 }],
      permissions: { view_monster_hp: 'dm_only' },
      initiative: [
        { id: 10, entity_name: 'Visible Orc', entity_type: 'monster', current_hp: 12, max_hp: 20, ac: 14, is_hidden: 0, stats_json: '{"str":16}' },
        { id: 11, entity_name: 'Secret Mage', entity_type: 'monster', current_hp: 30, max_hp: 30, ac: 16, is_hidden: 1, stats_json: '{"int":18}' },
      ],
    });

    expect(snapshot.initiative).toHaveLength(1);
    expect(snapshot.initiative[0].entity_name).toBe('Visible Orc');
    expect(snapshot.initiative[0].current_hp).toBeNull();
    expect(snapshot.initiative[0].ac).toBeNull();
    expect(snapshot.initiative[0].stats_json).toBeUndefined();
  });

  it('only includes discovered, non-hidden map information', () => {
    const world = projectWorldMapState({
      id: 1,
      name: 'World',
      image_path: '/private/world.png',
      map_url: '/api/maps/file/world.png',
      markers: [
        { id: 1, name: 'Town', is_discovered: 1, is_hidden: 0, x: 10, y: 20 },
        { id: 2, name: 'Secret Lair', is_discovered: 0, is_hidden: 0, x: 30, y: 40 },
        { id: 3, name: 'Hidden Army', is_discovered: 1, is_hidden: 1, x: 50, y: 60 },
      ],
    });
    const battle = projectBattleMapState({
      id: 2,
      name: 'Battle',
      image_path: '/private/battle.png',
      map_url: '/api/maps/file/battle.png',
      tokens: [
        { id: 1, label: 'Hero', is_hidden: 0, x: 10, y: 10 },
        { id: 2, label: 'Ambusher', is_hidden: 1, x: 20, y: 20 },
      ],
      markers: [],
    });

    expect(world.markers.map(marker => marker.name)).toEqual(['Town']);
    expect(world.image_path).toBeUndefined();
    expect(battle.tokens.map(token => token.label)).toEqual(['Hero']);
    expect(battle.image_data).toBe('/api/maps/file/battle.png');
    expect(battle.image_path).toBeUndefined();
  });

  it('limits effect history to the selected character and safe system events', () => {
    const snapshot = buildPlayerViewSnapshot({
      characterId: 1,
      party: [{ id: 1, name: 'Aria', currentHp: 20, maxHp: 30 }],
      timeline: [
        { id: 1, target_type: 'character', target_id: 1, event_type: 'damage' },
        { id: 2, target_type: 'character', target_id: 2, event_type: 'damage' },
        { id: 3, target_type: 'system', target_id: null, event_type: 'round_started' },
      ],
    });

    expect(snapshot.effects.map(event => event.id)).toEqual([1, 3]);
  });
});
