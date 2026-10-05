export type BattleMapEntityType = 'pc' | 'monster' | 'npc';

export interface BattleMapToken {
  id: number;
  map_id: number;
  entity_id: string;
  entity_name: string;
  entity_type: BattleMapEntityType;
  x: number;
  y: number;
  is_hidden: 0 | 1;
}

export interface BattleMapState {
  id: number;
  name: string;
  image_data: string | null;
  tokens: BattleMapToken[];
}

export interface BattleMapStateError {
  code: 'INVALID_MAP_STATE';
  issues: string[];
}

export type BattleMapStateParseResult =
  | { ok: true; value: BattleMapState | null; error: null }
  | { ok: false; value: null; error: BattleMapStateError };

const MAX_TOKENS = 500;
const MAX_LABEL_LENGTH = 200;
const MAX_RESOURCE_LENGTH = 2_048;
const ENTITY_TYPES = new Set<BattleMapEntityType>(['pc', 'monster', 'npc']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isBoundedString(value: unknown, { allowEmpty = false, max = MAX_LABEL_LENGTH } = {}): value is string {
  return typeof value === 'string'
    && value.length <= max
    && (allowEmpty || value.trim().length > 0);
}

function invalid(issues: string[]): BattleMapStateParseResult {
  return { ok: false, value: null, error: { code: 'INVALID_MAP_STATE', issues } };
}

/**
 * Convert an untrusted realtime map payload into the small shape the battlemap
 * is allowed to render. Unknown fields are discarded and malformed payloads
 * fail closed instead of reaching token/HP rendering code.
 */
export function parseBattleMapState(input: unknown): BattleMapStateParseResult {
  if (input === null) return { ok: true, value: null, error: null };
  if (!isRecord(input)) return invalid(['snapshot_not_object']);

  const issues: string[] = [];
  const mapId = input.id;
  const name = input.name;
  const imageData = input.image_data;
  const tokens = input.tokens;

  if (!isPositiveInteger(mapId)) issues.push('map_id_invalid');
  if (!isBoundedString(name, { allowEmpty: true })) issues.push('map_name_invalid');
  if (!(imageData === null || isBoundedString(imageData, { allowEmpty: false, max: MAX_RESOURCE_LENGTH }))) {
    issues.push('map_image_invalid');
  }
  if (!Array.isArray(tokens)) issues.push('tokens_not_array');
  else if (tokens.length > MAX_TOKENS) issues.push('tokens_limit_exceeded');

  if (issues.length > 0 || !Array.isArray(tokens) || !isPositiveInteger(mapId) || typeof name !== 'string') {
    return invalid(issues);
  }

  const parsedTokens: BattleMapToken[] = [];
  const tokenIds = new Set<number>();
  const entityIds = new Set<string>();

  tokens.forEach((candidate, index) => {
    const prefix = `token_${index}`;
    if (!isRecord(candidate)) {
      issues.push(`${prefix}_not_object`);
      return;
    }

    const id = candidate.id;
    const candidateMapId = candidate.map_id;
    const entityId = candidate.entity_id;
    const entityName = candidate.entity_name;
    const entityType = candidate.entity_type;
    const x = candidate.x;
    const y = candidate.y;
    const hidden = candidate.is_hidden ?? 0;

    if (!isPositiveInteger(id)) issues.push(`${prefix}_id_invalid`);
    else if (tokenIds.has(id)) issues.push(`${prefix}_id_duplicate`);
    else tokenIds.add(id);

    if (!isPositiveInteger(candidateMapId) || candidateMapId !== mapId) issues.push(`${prefix}_map_id_invalid`);

    if (!isBoundedString(entityId)) issues.push(`${prefix}_entity_id_invalid`);
    else if (entityIds.has(entityId)) issues.push(`${prefix}_entity_id_duplicate`);
    else entityIds.add(entityId);

    if (!isBoundedString(entityName)) issues.push(`${prefix}_name_invalid`);
    if (typeof entityType !== 'string' || !ENTITY_TYPES.has(entityType as BattleMapEntityType)) {
      issues.push(`${prefix}_type_invalid`);
    }
    if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 100) issues.push(`${prefix}_x_invalid`);
    if (typeof y !== 'number' || !Number.isFinite(y) || y < 0 || y > 100) issues.push(`${prefix}_y_invalid`);
    if (hidden !== 0 && hidden !== 1) issues.push(`${prefix}_hidden_invalid`);

    if (
      isPositiveInteger(id)
      && isPositiveInteger(candidateMapId)
      && candidateMapId === mapId
      && isBoundedString(entityId)
      && isBoundedString(entityName)
      && typeof entityType === 'string'
      && ENTITY_TYPES.has(entityType as BattleMapEntityType)
      && typeof x === 'number'
      && Number.isFinite(x)
      && x >= 0
      && x <= 100
      && typeof y === 'number'
      && Number.isFinite(y)
      && y >= 0
      && y <= 100
      && (hidden === 0 || hidden === 1)
    ) {
      parsedTokens.push({
        id,
        map_id: candidateMapId,
        entity_id: entityId,
        entity_name: entityName,
        entity_type: entityType as BattleMapEntityType,
        x,
        y,
        is_hidden: hidden,
      });
    }
  });

  if (issues.length > 0) return invalid([...new Set(issues)]);

  return {
    ok: true,
    value: {
      id: mapId,
      name,
      image_data: imageData as string | null,
      tokens: parsedTokens,
    },
    error: null,
  };
}

