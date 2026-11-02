/**
 * @author Aidan Boissonneault
 * @file path-body-expressions.test.ts
 * @purpose Tests path body expressions behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRExtrude, IRSketch, IRSolidCut } from '@bushscad/ir';
import {
  evalErrorMessages,
  evalOps,
  expectProfileSketch,
  opsOfKind,
} from '../core/test-support.js';

describe('path body expression evaluation', () => {
  it('lowers feature and alias algebra to stable atomic body selections', () => {
    const ops = evalOps(`
sketch profile = path(
  outer_bottom = line((0, 0), (20, 0)),
  outer_right = line((20, 20)),
  outer_top = line((0, 20)),
  outer_left = close(),
  inner_bottom = line((5, 5), (15, 5)),
  inner_right = line((15, 15)),
  inner_top = line((5, 15)),
  inner_left = close(),
  outer = loop(outer_bottom),
  hole = inner_bottom,
  direct_subtract = outer_bottom - inner_bottom,
  direct_union = outer_bottom + inner_bottom,
  direct_intersection = outer_bottom & inner_bottom,
  ring = outer - hole,
  restored = ring + hole,
  ignore(ring)
);
obj chosen = extrude(profile.ring, 2);
obj multiple = extrude([profile.ring, profile.hole], 2);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    const selections = new Map(
      sketch.primitive.bodySelections?.map(({ name, bodyIds }) => [
        name,
        bodyIds,
      ]),
    );
    const outer = selections.get('outer');
    const hole = selections.get('hole');
    const ring = selections.get('ring');

    expect(sketch.primitive.closedBodies).toHaveLength(2);
    expect(outer).toHaveLength(2);
    expect(hole).toHaveLength(1);
    expect(ring).toHaveLength(1);
    expect(selections.get('direct_subtract')).toEqual(ring);
    expect(selections.get('direct_union')).toEqual(outer);
    expect(selections.get('direct_intersection')).toEqual(hole);
    expect(selections.get('restored')).toEqual(outer);
    expect(ring).not.toEqual(hole);
    expect(
      sketch.primitive.closedBodies
        ?.filter((body) => body.ignored)
        .map((body) => body.id),
    ).toEqual(ring);

    const extrudes = opsOfKind<IRExtrude>(ops, 'extrude');
    expect(extrudes[0].closedBodyNames).toEqual(['ring']);
    expect(extrudes[1].closedBodyNames).toEqual(['ring', 'hole']);
  });

  it('composes legacy point aliases and applies ignore expressions', () => {
    const ops = evalOps(`
sketch profile = path(
  bottom = line((0, 0), (20, 0)),
  right = line((20, 20)),
  top = line((0, 20)),
  left = close(),
  picked = closed(5, 5),
  copy = picked,
  ignore(copy)
);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    const picked = sketch.primitive.bodySelections?.find(
      (selection) => selection.name === 'picked',
    );
    const copy = sketch.primitive.bodySelections?.find(
      (selection) => selection.name === 'copy',
    );
    expect(copy?.bodyIds).toEqual(picked?.bodyIds);
    expect(sketch.primitive.closedBodies?.[0].ignored).toBe(true);
  });

  it('preserves body selectors in inline extrude solid-cut tools', () => {
    const ops = evalOps(`
sketch profile = path(
  bottom = line((0, 0), (20, 0)),
  right = line((20, 20)),
  top = line((0, 20)),
  left = close(),
  face = loop(bottom)
);
obj base = extrude(profile, 4);
obj channel = cut(extrude(profile.face, 1), @base.top.center);
`);

    const solidCut = opsOfKind<IRSolidCut>(ops, 'solid_cut')[0];
    expect(solidCut.tool).toMatchObject({
      kind: 'operation',
      operation: { kind: 'extrude', closedBodyNames: ['face'] },
    });
  });

  it('preserves body selectors through local sketch placement', () => {
    const ops = evalOps(`
sketch profile = path(
  bottom = line((0, 0), (20, 0)),
  right = line((20, 20)),
  top = line((0, 20)),
  left = close(),
  face = loop(bottom)
) at (7, -3);
obj chosen = extrude(profile.face, 2);
`);

    const sketch = opsOfKind<IRSketch>(ops, 'sketch')[0];
    expect(sketch.primitive).toMatchObject({
      kind: 'sketchAt',
      x: 7,
      y: -3,
      primitive: {
        kind: 'profile',
        bodySelections: [{ name: 'face' }],
      },
    });
    expect(opsOfKind<IRExtrude>(ops, 'extrude')[0].closedBodyNames).toEqual([
      'face',
    ]);
  });

  it('reports features that do not belong to a closed loop', () => {
    expect(
      evalErrorMessages(`
sketch profile = path(
  edge = line((0, 0), (10, 0)),
  open_body = loop(edge)
);
`),
    ).toContain("Path feature 'edge' is not part of a closed loop");
  });

  it('reports valid expressions that select an empty body set', () => {
    expect(
      evalErrorMessages(`
sketch profile = path(
  bottom = line((0, 0), (10, 0)),
  right = line((10, 10)),
  top = line((0, 10)),
  left = close(),
  face = loop(bottom),
  empty = face - face
);
`),
    ).toContain("Path body expression 'empty' selects no closed bodies");
  });
});
