'use strict';

const {
  projectPartyState,
  projectInitiativeState,
  projectTimeline,
} = require('./clientStateProjection');

function projectWorldMapState(map) {
  if (!map) return null;
  return {
    id: map.id,
    name: map.name,
    map_url: map.map_url || null,
    markers: (map.markers || [])
      .filter(marker => marker.is_discovered === 1 && marker.is_hidden !== 1)
      .map(marker => ({
        id: marker.id,
        parent_map_id: marker.parent_map_id,
        linked_map_id: marker.linked_map_id,
        name: marker.name,
        type: marker.type,
        x: marker.x,
        y: marker.y,
        description: marker.description || '',
        is_discovered: 1,
        is_hidden: 0,
      })),
  };
}

function projectBattleMapState(map) {
  if (!map) return null;
  return {
    id: map.id,
    name: map.name,
    grid_size: map.grid_size,
    map_url: map.map_url || map.image_data || null,
    image_data: map.map_url || map.image_data || null,
    tokens: (map.tokens || [])
      .filter(token => token.is_hidden !== 1)
      .map(token => ({
        id: token.id,
        map_id: token.map_id,
        entity_name: token.entity_name ?? token.label,
        entity_type: token.entity_type,
        entity_id: token.entity_id,
        label: token.label ?? token.entity_name,
        x: token.x,
        y: token.y,
        is_hidden: 0,
      })),
    markers: (map.markers || [])
      .filter(marker => marker.is_hidden !== 1 && marker.is_discovered === 1)
      .map(marker => ({
        id: marker.id,
        name: marker.name,
        type: marker.type,
        x: marker.x,
        y: marker.y,
        description: marker.description || '',
      })),
  };
}

function projectNotes(notes) {
  return (notes || []).map(note => ({
    id: note.id,
    category: note.category,
    title: note.title,
    content: note.content,
    updated_by: note.updated_by,
    updated_at: note.updated_at,
  }));
}

function projectSharedLoot(items) {
  return (items || []).map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    rarity: item.rarity,
    stats_json: item.stats_json,
    dropped_by: item.dropped_by,
    created_at: item.created_at,
    vote_state_json: item.vote_state_json || null,
  }));
}

function buildPlayerViewSnapshot({
  characterId,
  party = [],
  initiative = [],
  timeline = [],
  permissions = {},
  combatState = { round: 0, turnIndex: 0 },
  notes = [],
  sharedLoot = [],
  worldState = null,
  worldMap = null,
  battleMap = null,
  version = 0,
}) {
  const normalizedCharacterId = Number.parseInt(characterId, 10);
  const projectedParty = projectPartyState(party, {
    role: 'player',
    characterId: normalizedCharacterId,
  });
  const selectedCharacter = projectedParty.find(
    character => Number.parseInt(character.id, 10) === normalizedCharacterId,
  );

  if (!selectedCharacter) return null;

  return {
    projectionVersion: version,
    generatedAt: new Date().toISOString(),
    viewer: {
      role: 'player',
      characterId: normalizedCharacterId,
      characterName: selectedCharacter.name,
    },
    selectedCharacter,
    party: projectedParty,
    initiative: projectInitiativeState(initiative, { role: 'player', permissions }),
    effects: projectTimeline(timeline, {
      role: 'player',
      characterId: normalizedCharacterId,
    }),
    permissions: { ...permissions },
    combat: {
      round: Number(combatState.round) || 0,
      turnIndex: Number(combatState.turnIndex) || 0,
    },
    notes: projectNotes(notes),
    sharedLoot: projectSharedLoot(sharedLoot),
    world: worldState,
    worldMap: projectWorldMapState(worldMap),
    battleMap: projectBattleMapState(battleMap),
  };
}

module.exports = {
  buildPlayerViewSnapshot,
  projectBattleMapState,
  projectNotes,
  projectSharedLoot,
  projectWorldMapState,
};
