import { describe, expect, it } from 'vitest';
import { parseBattleMapState } from './battleMapState';

function validMap(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: 'Synthetic map',
    image_data: null,
    tokens: [{
      id: 1,
      map_id: 7,
      entity_id: 'pc-1',
      entity_name: 'Fixture hero',
      entity_type: 'pc',
      x: 25,
      y: 75,
      is_hidden: 0,
      private_note: 'must be discarded',
    }],
    ...overrides,
  };
}

describe('parseBattleMapState', () => {
  it('accepts null as the explicit no-active-map state', () => {
    expect(parseBattleMapState(null)).toEqual({ ok: true, value: null, error: null });
  });

  it('normalizes a projected map and discards unknown fields', () => {
    const result = parseBattleMapState(validMap());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.tokens[0]).toEqual({
      id: 1,
      map_id: 7,
      entity_id: 'pc-1',
      entity_name: 'Fixture hero',
      entity_type: 'pc',
      x: 25,
      y: 75,
      is_hidden: 0,
    });
    expect(JSON.stringify(result.value)).not.toContain('private_note');
  });

  it.each([
    ['missing token collection', { tokens: undefined }, 'tokens_not_array'],
    ['duplicate token id', { tokens: [validMap().tokens[0], { ...validMap().tokens[0], entity_id: 'pc-2' }] }, 'token_1_id_duplicate'],
    ['duplicate entity id', { tokens: [validMap().tokens[0], { ...validMap().tokens[0], id: 2 }] }, 'token_1_entity_id_duplicate'],
    ['unsupported token type', { tokens: [{ ...validMap().tokens[0], entity_type: 'hazard' }] }, 'token_0_type_invalid'],
    ['non-finite x coordinate', { tokens: [{ ...validMap().tokens[0], x: Number.POSITIVE_INFINITY }] }, 'token_0_x_invalid'],
    ['out-of-range y coordinate', { tokens: [{ ...validMap().tokens[0], y: -1 }] }, 'token_0_y_invalid'],
    ['wrong map id', { tokens: [{ ...validMap().tokens[0], map_id: 99 }] }, 'token_0_map_id_invalid'],
  ])('rejects %s', (_label, overrides, issue) => {
    const result = parseBattleMapState(validMap(overrides));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.issues).toContain(issue);
  });

  it('rejects a non-object snapshot', () => {
    expect(parseBattleMapState('not-a-map')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_MAP_STATE', issues: ['snapshot_not_object'] },
    });
  });
});
