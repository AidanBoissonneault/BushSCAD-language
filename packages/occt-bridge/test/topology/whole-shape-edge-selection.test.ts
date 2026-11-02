/**
 * @author Aidan Boissonneault
 * @file whole-shape-edge-selection.test.ts
 * @purpose Tests whole shape edge selection behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { selectWholeShapeEdges } from '../../src/topology/whole-shape-edge-selection.js';

describe('whole-shape edge selection', () => {
  const shared = { IsSame: (other: unknown) => other === shared };
  const outside = { qualifier: 'outer' as const, face: 'outside' };
  const inside = { qualifier: 'inner' as const, face: 'inside' };

  it('selects every object edge for .edges and inferred modifier targets', () => {
    for (const subRef of ['edges', undefined] as const) {
      expect(
        selectWholeShapeEdges({
          subRef,
          inferBareEdges: true,
          shapeEdges: [shared, shared, inside],
          faces: [outside, inside],
          perimeterEdgesForFace: () => [],
        }),
      ).toEqual([shared, inside]);
    }
  });

  it('unions outer loops across outer faces and excludes inner faces', () => {
    expect(
      selectWholeShapeEdges({
        subRef: 'perimeter',
        inferBareEdges: false,
        shapeEdges: [],
        faces: [outside, inside],
        perimeterEdgesForFace: (face) =>
          face === outside ? [shared, shared] : [inside],
      }),
    ).toEqual([shared]);
  });

  it('prefers surviving authored perimeter edges over later feature loops', () => {
    const authored = { IsSame: (other: unknown) => other === authored };
    const cutRim = { IsSame: (other: unknown) => other === cutRim };

    expect(
      selectWholeShapeEdges({
        subRef: 'perimeter',
        inferBareEdges: false,
        shapeEdges: [authored, cutRim],
        faces: [outside],
        perimeterEdgesForFace: () => [authored, cutRim],
        sourcePerimeterEdges: [authored, authored],
      }),
    ).toEqual([authored]);
  });

  it('never substitutes later feature loops for a consumed authored perimeter', () => {
    const cutRim = { IsSame: (other: unknown) => other === cutRim };

    expect(
      selectWholeShapeEdges({
        subRef: 'perimeter',
        inferBareEdges: false,
        shapeEdges: [cutRim],
        faces: [outside],
        perimeterEdgesForFace: () => [cutRim],
        sourcePerimeterEdges: [],
      }),
    ).toEqual([]);
  });

  it('does not infer bare edges for non-modifier consumers', () => {
    expect(
      selectWholeShapeEdges({
        subRef: undefined,
        inferBareEdges: false,
        shapeEdges: [shared],
        faces: [outside],
        perimeterEdgesForFace: () => [shared],
      }),
    ).toEqual([]);
  });
});
