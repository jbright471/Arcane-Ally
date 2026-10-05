'use strict';

const MAX_UVTT_FILE_BYTES = 16 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PATHS = 5_000;
const MAX_POINTS = 100_000;
const MAX_LIGHTS = 2_000;
const SUPPORTED_FIELDS = new Set([
  'format',
  'resolution',
  'image',
  'line_of_sight',
  'objects_line_of_sight',
  'portals',
  'lights',
  'environment',
]);

class UvttPreviewError extends Error {
  constructor(message, code = 'INVALID_UVTT') {
    super(message);
    this.name = 'UvttPreviewError';
    this.code = code;
  }
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new UvttPreviewError(`${label} must be an object`);
  }
  return value;
}

function finiteNumber(value, label, { min = -Infinity, max = Infinity } = {}) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && value.trim() === '')) {
    throw new UvttPreviewError(`${label} must be between ${min} and ${max}`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new UvttPreviewError(`${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

function validatePoint(point, label) {
  const source = record(point, label);
  finiteNumber(source.x, `${label}.x`, { min: -10_000, max: 10_000 });
  finiteNumber(source.y, `${label}.y`, { min: -10_000, max: 10_000 });
}

function inspectPaths(value, label) {
  if (value === undefined) return { pathCount: 0, pointCount: 0 };
  if (!Array.isArray(value) || value.length > MAX_PATHS) {
    throw new UvttPreviewError(`${label} must contain at most ${MAX_PATHS} paths`);
  }

  let pointCount = 0;
  value.forEach((pathValue, pathIndex) => {
    if (!Array.isArray(pathValue) || pathValue.length < 2) {
      throw new UvttPreviewError(`${label}[${pathIndex}] must contain at least two points`);
    }
    pointCount += pathValue.length;
    if (pointCount > MAX_POINTS) {
      throw new UvttPreviewError(`UVTT geometry exceeds ${MAX_POINTS} points`);
    }
    pathValue.forEach((point, pointIndex) => validatePoint(point, `${label}[${pathIndex}][${pointIndex}]`));
  });

  return { pathCount: value.length, pointCount };
}

function parseImage(value) {
  if (typeof value !== 'string') throw new UvttPreviewError('UVTT image must be base64-encoded PNG data');
  const encoded = value.replace(/^data:image\/png;base64,/i, '').replace(/\s+/g, '');
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    throw new UvttPreviewError('UVTT image must be base64-encoded PNG data');
  }

  const decoded = Buffer.from(encoded, 'base64');
  const canonicalInput = encoded.replace(/=+$/, '');
  const canonicalDecoded = decoded.toString('base64').replace(/=+$/, '');
  if (canonicalInput !== canonicalDecoded) throw new UvttPreviewError('UVTT image contains invalid base64 data');
  if (decoded.length > MAX_IMAGE_BYTES) {
    throw new UvttPreviewError(`UVTT image exceeds ${MAX_IMAGE_BYTES / 1024 / 1024} MB`, 'UVTT_IMAGE_TOO_LARGE');
  }
  if (decoded.length < 8 || decoded.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new UvttPreviewError('UVTT image is not a PNG');
  }
  return decoded.length;
}

function decodeSource(input) {
  if (Buffer.isBuffer(input)) {
    if (input.length > MAX_UVTT_FILE_BYTES) {
      throw new UvttPreviewError(`UVTT file exceeds ${MAX_UVTT_FILE_BYTES / 1024 / 1024} MB`, 'UVTT_FILE_TOO_LARGE');
    }
    input = input.toString('utf8');
  }
  if (typeof input === 'string') {
    if (Buffer.byteLength(input, 'utf8') > MAX_UVTT_FILE_BYTES) {
      throw new UvttPreviewError(`UVTT file exceeds ${MAX_UVTT_FILE_BYTES / 1024 / 1024} MB`, 'UVTT_FILE_TOO_LARGE');
    }
    try {
      input = JSON.parse(input);
    } catch {
      throw new UvttPreviewError('UVTT file must contain valid JSON');
    }
  }
  return record(input, 'UVTT document');
}

function parseUvttPreview(input) {
  const source = decodeSource(input);
  const resolution = record(source.resolution, 'resolution');
  const mapSize = record(resolution.map_size, 'resolution.map_size');
  if (resolution.map_origin !== undefined) record(resolution.map_origin, 'resolution.map_origin');

  const widthCells = finiteNumber(mapSize.x, 'resolution.map_size.x', { min: 0.1, max: 1_000 });
  const heightCells = finiteNumber(mapSize.y, 'resolution.map_size.y', { min: 0.1, max: 1_000 });
  const pixelsPerGrid = finiteNumber(resolution.pixels_per_grid, 'resolution.pixels_per_grid', { min: 1, max: 4_096 });
  if (resolution.map_origin) {
    finiteNumber(resolution.map_origin.x ?? 0, 'resolution.map_origin.x', { min: -10_000, max: 10_000 });
    finiteNumber(resolution.map_origin.y ?? 0, 'resolution.map_origin.y', { min: -10_000, max: 10_000 });
  }

  const imageBytes = parseImage(source.image);
  const walls = inspectPaths(source.line_of_sight, 'line_of_sight');
  const objectWalls = inspectPaths(source.objects_line_of_sight, 'objects_line_of_sight');

  const portals = source.portals ?? [];
  if (!Array.isArray(portals) || portals.length > MAX_PATHS) {
    throw new UvttPreviewError(`portals must contain at most ${MAX_PATHS} entries`);
  }
  let portalPointCount = 0;
  portals.forEach((portal, index) => {
    const candidate = record(portal, `portals[${index}]`);
    if (!Array.isArray(candidate.bounds) || candidate.bounds.length < 2) {
      throw new UvttPreviewError(`portals[${index}].bounds must contain at least two points`);
    }
    portalPointCount += candidate.bounds.length;
    if (portalPointCount > MAX_POINTS) {
      throw new UvttPreviewError(`UVTT portal geometry exceeds ${MAX_POINTS} points`);
    }
    candidate.bounds.forEach((point, pointIndex) => validatePoint(point, `portals[${index}].bounds[${pointIndex}]`));
  });

  const lights = source.lights ?? [];
  if (!Array.isArray(lights) || lights.length > MAX_LIGHTS) {
    throw new UvttPreviewError(`lights must contain at most ${MAX_LIGHTS} entries`);
  }
  lights.forEach((light, index) => {
    const candidate = record(light, `lights[${index}]`);
    validatePoint(candidate.position, `lights[${index}].position`);
    finiteNumber(candidate.range ?? 0, `lights[${index}].range`, { min: 0, max: 1_000 });
    finiteNumber(candidate.intensity ?? 1, `lights[${index}].intensity`, { min: 0, max: 100 });
  });

  const warnings = [];
  if (walls.pathCount + objectWalls.pathCount === 0) warnings.push('No wall geometry was found.');
  if (portals.length > 0) warnings.push('Portals are counted for review but are not imported or activated.');
  if (lights.length > 0) warnings.push('Lights are counted for review but are not imported or activated.');
  if (source.environment?.baked_lighting === true) warnings.push('Baked lighting is present but is not rendered by this preview.');
  const unsupportedFields = Object.keys(source)
    .filter(key => !SUPPORTED_FIELDS.has(key))
    .sort()
    .map(key => key.slice(0, 40));
  if (unsupportedFields.length > 0) {
    warnings.push(`Unsupported top-level fields are ignored: ${unsupportedFields.slice(0, 10).join(', ')}${unsupportedFields.length > 10 ? ', …' : ''}.`);
  }

  return {
    kind: 'uvtt-preview',
    formatVersion: String(source.format ?? 'unknown').slice(0, 32),
    mapSize: {
      widthCells,
      heightCells,
      pixelsPerGrid,
      pixelWidth: Math.round(widthCells * pixelsPerGrid),
      pixelHeight: Math.round(heightCells * pixelsPerGrid),
    },
    counts: {
      wallPaths: walls.pathCount,
      wallPoints: walls.pointCount,
      objectWallPaths: objectWalls.pathCount,
      objectWallPoints: objectWalls.pointCount,
      portals: portals.length,
      lights: lights.length,
    },
    image: { mediaType: 'image/png', bytes: imageBytes },
    warnings,
    persistence: 'none',
  };
}

module.exports = {
  MAX_IMAGE_BYTES,
  MAX_LIGHTS,
  MAX_PATHS,
  MAX_POINTS,
  MAX_UVTT_FILE_BYTES,
  UvttPreviewError,
  parseUvttPreview,
};
