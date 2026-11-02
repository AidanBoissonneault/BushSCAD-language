/**
 * @author Aidan Boissonneault
 * @file interaction-provenance.test.ts
 * @purpose Tests interaction provenance behavior in the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { evalOk } from '../core/test-support.js';

const SOURCE = `
base_unit = mm;
part first {
  sketch profile = rect(20, 10);
  obj body = extrude(profile, 4);
  fillet(@body.[top, bottom].edges, 0.5);
}
part second {
  sketch profile = circle(5);
  obj body = extrude(profile, 4);
}
`;

const IRREGULAR_SPACING_SOURCE = `part   chassis {
  sketch    profile = rect(20, 10);
  obj      body = extrude(profile, 4);
}`;

const OFFSET_POINT_SOURCE = `
base_unit = mm;
part point_reference {
  sketch profile = rect(20, 10);
  obj body = extrude(profile, 4);
  obj pin = cylinder(2, d: 1, @body.top.center(x: 3));
}
`;

describe('evaluated interaction provenance', () => {
  it('distinguishes identical local names by owner and links selector effects', () => {
    const snapshot = evalOk(SOURCE).program.interaction;
    expect(snapshot).toBeDefined();
    const bodies = snapshot!.entities.filter(
      (entity) => entity.kind === 'object' && entity.name === 'body',
    );
    expect(bodies).toHaveLength(2);
    expect(new Set(bodies.map((entity) => entity.id)).size).toBe(2);
    expect(new Set(bodies.map((entity) => entity.ownerId)).size).toBe(2);
    expect(bodies.map((entity) => entity.declarationSpan.col)).toEqual([3, 3]);
    expect(
      snapshot!.effects.find((effect) => effect.kind === 'extrude')?.span.col,
    ).toBeGreaterThan(3);

    const edge = snapshot!.entities.find(
      (entity) => entity.kind === 'edge' && entity.name === 'body.top.edges',
    );
    expect(edge?.ownerId).toBe(bodies[0]?.id);
    expect(edge?.selectorKind).toBe('face-edges');
    expect(
      snapshot!.references.some((reference) =>
        reference.targetIds.includes(edge!.id),
      ),
    ).toBe(true);
    expect(snapshot!.references).toHaveLength(1);
    expect(snapshot!.references[0]?.targetIds).toHaveLength(2);
    expect(bodies[0]?.effectIds.length).toBeGreaterThan(1);
  });

  it('recompiles unchanged source with identical IDs and ordering', () => {
    const first = evalOk(SOURCE).program.interaction;
    const second = evalOk(SOURCE).program.interaction;
    expect(second?.entities.map((entity) => entity.id)).toEqual(
      first?.entities.map((entity) => entity.id),
    );
    expect(second?.effects.map((effect) => effect.id)).toEqual(
      first?.effects.map((effect) => effect.id),
    );
  });

  it('retains exact authored name spans independently of statement spacing', () => {
    const entities = evalOk(IRREGULAR_SPACING_SOURCE).program.interaction!
      .entities;
    expect(
      entities
        .filter((entity) =>
          ['chassis', 'profile', 'body'].includes(entity.name),
        )
        .map((entity) => ({ name: entity.name, linkSpan: entity.linkSpan })),
    ).toEqual([
      {
        name: 'chassis',
        linkSpan: {
          file: 'test.bscd',
          line: 1,
          col: 8,
          endLine: 1,
          endCol: 15,
        },
      },
      {
        name: 'profile',
        linkSpan: {
          file: 'test.bscd',
          line: 2,
          col: 13,
          endLine: 2,
          endCol: 20,
        },
      },
      {
        name: 'body',
        linkSpan: {
          file: 'test.bscd',
          line: 3,
          col: 12,
          endLine: 3,
          endCol: 16,
        },
      },
    ]);
  });

  it('preserves called face centers as point interaction entities', () => {
    const snapshot = evalOk(OFFSET_POINT_SOURCE).program.interaction!;
    const point = snapshot.entities.find(
      (entity) =>
        entity.kind === 'point' && entity.name.includes('body.top.center'),
    );

    expect(point).toBeDefined();
    expect(point?.placement).toMatchObject({
      faceRef: 'body.top.center',
      offsetX: 3,
    });
    expect(
      snapshot.references.some((reference) =>
        reference.targetIds.includes(point!.id),
      ),
    ).toBe(true);
  });

  it('keeps exact bare, called, side, corner, and repeated placements', () => {
    const snapshot = evalOk(`
part reference_points {
  sketch profile = rect(20, 10);
  obj body = extrude(profile, 4);
  obj bare_top = cylinder(1, d: 1, @body.top);
  obj called_top = cylinder(1, d: 1, @body.top());
  obj left_point = cylinder(1, d: 1, @body.left.center);
  obj corner_point = cylinder(1, d: 1, @body.top.front_left());
  for x in [3, 7] {
    obj repeated = cylinder(1, d: 1, @body.top(x: x, y: 2));
  }
}
`).program.interaction!;
    const placements = snapshot.entities
      .map((entity) => entity.placement)
      .filter((placement) => placement?.faceRef.startsWith('body.'));

    expect(placements.map((placement) => placement?.faceRef)).toEqual(
      expect.arrayContaining([
        'body.top',
        'body.left.center',
        'body.top.corner.front_left',
      ]),
    );
    expect(
      placements
        .filter((placement) => placement?.offsetY === 2)
        .map((placement) => placement?.offsetX),
    ).toEqual([3, 7]);
  });

  it('groups reusable sketch geometry and records every distinct consumption', () => {
    const snapshot = evalOk(`
part plate {
  sketch base_profile = rect(30, 20);
  obj body = extrude(base_profile, 4);
  sketch hole = circle(4);
  obj top_hole = cut(hole, 2, @body.top.center);
  obj bottom_hole = cut(hole, 2, @body.bottom.center);
}
`).program.interaction!;
    const definition = snapshot.sketchDefinitions?.find(
      (candidate) => candidate.name === 'hole',
    );
    const instances = snapshot.sketchInstances?.filter(
      (candidate) => candidate.definitionId === definition?.id,
    );

    expect(definition?.primitive).toEqual({ kind: 'circle', diameter: 4 });
    expect(definition?.revision).toBe(1);
    expect(instances).toHaveLength(3);
    expect(instances?.map((instance) => instance.placement?.faceRef)).toEqual([
      'body.top.center',
      'body.bottom.center',
      undefined,
    ]);
    expect(new Set(instances?.map((instance) => instance.id)).size).toBe(3);
  });

  it('keeps same-named cut results distinct from their source sketches', () => {
    const snapshot = evalOk(`
part plate {
  sketch base = rect(30, 20);
  obj base = extrude(base, 4);
  sketch hole = circle(4);
  obj hole = cut(hole, 2, @base.top.center);
}
`).program.interaction!;
    const holes = snapshot.entities.filter((entity) => entity.name === 'hole');
    const cut = snapshot.effects.find((effect) => effect.kind === 'cut');

    expect(holes.map((entity) => entity.kind)).toEqual(['sketch', 'object']);
    expect(cut?.inputEntityIds).toContain(holes[0]?.id);
    expect(cut?.outputEntityIds).toEqual([holes[1]?.id]);
  });

  it('keeps loop-unrolled declarations under one logical sketch definition', () => {
    const snapshot = evalOk(`
part plate {
  sketch base = rect(30, 20);
  obj base = extrude(base, 4);
  for i in range(2) within base.top.width {
    sketch repeated = circle(3);
    obj hole = cut(repeated, 2, @base.top(i, 1));
  }
}
`).program.interaction!;
    const repeated = snapshot.sketchDefinitions?.filter(
      (definition) => definition.sourceSpan.line === 6,
    );

    expect(repeated).toHaveLength(1);
    expect(repeated?.[0]?.entityIds.length).toBeGreaterThanOrEqual(1);
    expect(
      snapshot.sketchInstances?.filter(
        (instance) => instance.definitionId === repeated?.[0]?.id,
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('gives generated objects authored array instance paths', () => {
    const snapshot = evalOk(`
part plate {
  sketch base = rect(30, 20);
  obj body = extrude(base, 4);
  obj pockets = cut(circle(3), 2, @body.[top, bottom]);
}
`).program.interaction!;
    const generated = snapshot.entities.filter(
      (entity) => entity.kind === 'generated-instance',
    );

    expect(generated.map((entity) => entity.instancePath)).toEqual([
      'pockets[0]',
      'pockets[1]',
    ]);
  });

  it('links one authored function call to every loop-unrolled object instance', () => {
    const snapshot = evalOk(`
fn pedestal(width) {
  sketch profile = rect(width, 6);
  obj body = extrude(profile, 4);
}
part plate {
  sketch base = rect(40, 30);
  obj base = extrude(base, 3);
  for x in [8, 24] {
    place(pedestal(6), @base.top(x: x, y: 12));
  }
}
`).program.interaction!;
    const invocations = snapshot.invocations?.filter(
      (invocation) => invocation.name === 'pedestal',
    );

    expect(invocations).toHaveLength(2);
    expect(new Set(invocations?.map((item) => item.id)).size).toBe(2);
    expect(new Set(invocations?.map((item) => item.linkSpan.col))).toEqual(
      new Set([11]),
    );
    expect(new Set(invocations?.flatMap((item) => item.entityIds)).size).toBe(
      2,
    );
  });
});
