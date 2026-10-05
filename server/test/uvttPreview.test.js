'use strict';

import { describe, expect, it } from 'vitest';
import { parseUvttPreview } from '../lib/uvttPreview.js';

function fixture(overrides = {}) {
  return {
    format: 0.3,
    resolution: {
      map_origin: { x: 1, y: 2 },
      map_size: { x: 10, y: 8 },
      pixels_per_grid: 128,
    },
    line_of_sight: [[{ x: 1, y: 2 }, { x: 11, y: 10 }]],
    objects_line_of_sight: [[{ x: 2, y: 3 }, { x: 4, y: 5 }]],
    portals: [{ bounds: [{ x: 2, y: 3 }, { x: 3, y: 3 }], closed: true }],
    lights: [{ position: { x: 6, y: 6 }, range: 3, intensity: 1 }],
    environment: { baked_lighting: true },
    image: 'iVBORw0KGgo=',
    ...overrides,
  };
}

describe('UVTT preview receipt', () => {
  it('returns a deterministic bounded receipt without copying image or geometry data', () => {
    const source = fixture({ future_metadata: { private: 'not returned' } });
    const before = JSON.stringify(source);
    const first = parseUvttPreview(JSON.stringify(source));
    const second = parseUvttPreview(Buffer.from(JSON.stringify(source)));

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: 'uvtt-preview',
      formatVersion: '0.3',
      mapSize: { widthCells: 10, heightCells: 8, pixelsPerGrid: 128, pixelWidth: 1280, pixelHeight: 1024 },
      counts: { wallPaths: 1, wallPoints: 2, objectWallPaths: 1, objectWallPoints: 2, portals: 1, lights: 1 },
      image: { mediaType: 'image/png', bytes: 8 },
      persistence: 'none',
    });
    expect(first.warnings.join(' ')).toMatch(/not imported or activated/i);
    expect(first.warnings.join(' ')).toMatch(/future_metadata/);
    expect(JSON.stringify(first)).not.toMatch(/private|iVBOR|line_of_sight/);
    expect(JSON.stringify(source)).toBe(before);
  });

  it.each([
    ['invalid JSON', '{not-json'],
    ['invalid PNG data', JSON.stringify(fixture({ image: 'not base64!' }))],
    ['non-PNG image', JSON.stringify(fixture({ image: Buffer.from('not a png').toString('base64') }))],
    ['short wall path', JSON.stringify(fixture({ line_of_sight: [[{ x: 0, y: 0 }]] }))],
    ['invalid light position', JSON.stringify(fixture({ lights: [{ position: { x: Infinity, y: 1 } }] }))],
  ])('rejects %s', (_label, source) => {
    expect(() => parseUvttPreview(source)).toThrow(expect.objectContaining({ code: 'INVALID_UVTT' }));
  });

  it('reports an empty-geometry warning without inventing paths', () => {
    const receipt = parseUvttPreview(fixture({ line_of_sight: [], objects_line_of_sight: [] }));
    expect(receipt.counts.wallPaths).toBe(0);
    expect(receipt.warnings).toContain('No wall geometry was found.');
  });
});
