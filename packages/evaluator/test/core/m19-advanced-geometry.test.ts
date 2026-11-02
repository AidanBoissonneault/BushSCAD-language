/**
 * @author Aidan Boissonneault
 * @file m19-advanced-geometry.test.ts
 * @purpose Tests m19 advanced geometry behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRCut,
  IRExtrude,
  IRFillet,
  IRLoft,
  IRRevolve,
  IRSketch,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalErrors, evalOk, opsOfKind } from './test-support.js';

describe('M19 advanced geometry', () => {
  const metal = {
    id: 'brushed-metal',
    name: 'brushed metal',
    color: '#A7A9AC',
    texture: 'metal' as const,
    roughness: 0.32,
    metalness: 0.8,
  };

  const SRC = `
base_unit = mm;
part m19 {
    sketch profile = path(
        a = line((0,0), (12,0)),
        lip = arc((12,0), (12,6), 4, cw),
        c = line((12,6), (0,6)),
        d = line((0,6), (0,0))
    );
    sketch top = path(
        a = line((0,0), (8,0)),
        b = line((8,0), (8,4)),
        c = line((8,4), (0,4)),
        d = line((0,4), (0,0))
    );
    sketch rail = path(
        path = line((0,0), (0,20))
    );
    obj vase = revolve(profile, 360deg around y);
    obj body = loft(profile, top, height: 20, guide: rail);
    sketch label = rect(3,1);
    obj label = cut(label, 0.5 , @vase.curved(surfaceAngle: 45deg)) wrap: true;
    sketch rib = rect(1,5);
    obj rib = extrude(rib, 0.75 , @vase.curved(surfaceAngle: 90deg)) wrap: true;
    fillet(@vase.lip.edges, 0.25);
}
`;

  it('emits profile sketches, revolve, loft, wrapped cut/extrude, named modifiers, and materials', () => {
    const { program } = evalOk(SRC, {
      materials: {
        catalog: [metal],
        assignments: [
          { target: 'vase', material: metal },
          { target: 'body', material: metal },
        ],
      },
    });

    const profile = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (op) => op.name === 'profile',
    );
    expect(profile?.primitive.kind).toBe('profile');
    expect(
      profile?.primitive.kind === 'profile'
        ? profile.primitive.segments.map((segment) => segment.name)
        : [],
    ).toEqual(['a', 'lip', 'c', 'd']);

    const revolve = opsOfKind<IRRevolve>(program.ops, 'revolve')[0];
    expect(revolve).toMatchObject({
      objName: 'vase',
      sketchName: 'profile',
      angleDeg: 360,
      around: 'y',
    });
    expect(revolve.material?.name).toBe('brushed metal');

    const loft = opsOfKind<IRLoft>(program.ops, 'loft')[0];
    expect(loft).toMatchObject({
      objName: 'body',
      sketchNames: ['profile', 'top'],
      height: 20,
      guide: 'rail',
    });
    expect(loft.material?.name).toBe('brushed metal');

    const cut = opsOfKind<IRCut>(program.ops, 'cut')[0];
    expect(cut.wrap).toBe(true);
    expect(cut.from.surfaceAngleDeg).toBe(45);

    const rib = opsOfKind<IRExtrude>(program.ops, 'extrude').find(
      (op) => op.objName === 'rib',
    );
    expect(rib?.wrap).toBe(true);
    expect(rib?.from?.surfaceAngleDeg).toBe(90);

    expect(opsOfKind<IRFillet>(program.ops, 'fillet')[0].target).toBe(
      'vase.face.lip.edges',
    );
  });

  it('uses planted revolve profiles as equivalent default and named placement anchors', () => {
    const { program } = evalOk(`
base_unit = mm;
part vase {
    sketch profile = path(
        plant foot = line((2,0), (8,0)),
        wall = line((8,0), (8,6)),
        top = line((8,6), (2,6)),
        close = line((2,6), (2,0))
    );
    obj body = revolve(profile, 360deg around y);
    @vase = @foot.center;
    @foot_mount = @foot.center;
    @bottom_mount = @body.bottom.center;
}
part plate {
    sketch base = rect(30, 30);
    obj base = extrude(base, 2);
    place(vase, @base.top.center);
    place(vase, @base.top.center, @foot_mount);
    place(vase, @base.top.center, @bottom_mount);
}
`);
    const placedProfiles = opsOfKind<IRSketch>(program.ops, 'sketch').filter(
      (op) => op.primitive.kind === 'profile' && op.placement?.anchor,
    );
    expect(placedProfiles).toHaveLength(3);
    expect(
      placedProfiles.map((op) => op.placement?.anchor?.localPoint),
    ).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(
      placedProfiles.map((op) => op.placement?.anchor?.localNormal),
    ).toEqual([
      [0, -1, 0],
      [0, -1, 0],
      [0, -1, 0],
    ]);
  });

  it('uses polygon plant suffix as a revolve bottom anchor', () => {
    const { program } = evalOk(`
base_unit = mm;
part knob {
    sketch profile = polygon([(2,0),(8,0),(8,5),(2,5)]) plant;
    obj body = revolve(profile, 360deg around y);
    @knob = @body.bottom.center;
}
part plate {
    sketch base = rect(20, 20);
    obj base = extrude(base, 2);
    place(knob, @base.top.center);
}
`);
    const profile = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (op) => op.primitive.kind === 'polygon' && op.placement?.anchor,
    );
    expect(profile?.placement?.anchor?.localPoint).toEqual([0, 0, 0]);
    expect(profile?.placement?.anchor?.localNormal).toEqual([0, -1, 0]);
  });

  it('keeps path/revolve names mangled inside loops', () => {
    const { program } = evalOk(`
part p {
for i in range(2) {
    sketch profile = path(
        a = line((0,0), (4,0)),
        b = line((4,0), (4,4)),
        c = line((4,4), (0,4)),
        d = line((0,4), (0,0))
    );
    obj vase = revolve(profile, 180deg around z);
}
}
`);
    const revolves = opsOfKind<IRRevolve>(program.ops, 'revolve');
    expect(revolves).toHaveLength(2);
    expect(revolves.map((op) => op.objName)).toEqual(['vase_1', 'vase_3']);
    expect(revolves.map((op) => op.sketchName)).toEqual([
      'profile_0',
      'profile_2',
    ]);
  });

  it('reports invalid path radius, open-operation, and guide errors with spans', () => {
    const errors = evalErrors(`
sketch bad_arc = path(a = arc((0,0), (10,0), 3, cw));
sketch open_profile = path(
    a = line((0,0), (5,0)),
    b = line((5,1), (0,1))
);
sketch closed_guide = path(
    a = line((0,0), (1,0)),
    b = line((1,0), (1,1)),
    c = line((1,1), (0,1)),
    d = line((0,1), (0,0))
);
obj rib = extrude(open_profile, 1);
obj lofted = loft(closed_guide, closed_guide, height: 4, guide: closed_guide);
`);
    const messages = errors.map((error) => error.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "Arc segment 'a' radius must be at least half the chord length",
        "Sketch 'open_profile' is open and cannot be extruded as a solid. Use close() or wrap() to create a closed profile.",
        "loft guide 'closed_guide' must be open",
      ]),
    );
    expect(errors[0]?.span.file).toBe('test.bscd');
  });
});
