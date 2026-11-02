/**
 * @author Aidan Boissonneault
 * @file m18-tags-and-rotate.test.ts
 * @purpose Tests m18 tags and rotate behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRCut,
  IRExtrude,
  IRFillet,
  IROp,
  IRRotate,
  IRSketch,
} from '@bushscad/ir';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  evalErrorMessages,
  evalOk,
  evalOpsWithPartBoundaries,
  opsOfKind,
} from './test-support.js';

/**
 * Type used for axis rotation.
 */
type AxisRotation = NonNullable<
  NonNullable<IRSketch['placement']>['axisRotationDeg']
>;

/**
 * Collects per-axis placement rotations from emitted sketches.
 *
 * Why:
 * Placement rotation tests assert the same normalized IR field across inline
 * sources and example files, so keeping the extraction shared avoids drift.
 */
function axisPlacementRotations(ops: IROp[]): AxisRotation[] {
  return opsOfKind<IRSketch>(ops, 'sketch')
    .map((op) => op.placement?.axisRotationDeg)
    .filter((rotation): rotation is AxisRotation => Boolean(rotation));
}

describe('M18 tags and rotate', () => {
  it('resolves object anchor declarations as global references', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch profile = rect(20, 10);
    obj base = extrude(profile, 4) {
        @top_face = @base.top;
        @front_edge = @base.top.front_edge;
    }
    sketch hole = circle(3);
    obj hole = cut(hole, 1 , @top_face.center);
    fillet(@front_edge, 0.5);
}
`);
    const cut = opsOfKind<IRCut>(program.ops, 'cut')[0];
    const fillet = opsOfKind<IRFillet>(program.ops, 'fillet')[0];
    expect(cut.from.faceRef).toBe('base.top.center');
    expect(fillet.target).toBe('base.top.edge.front');
  });

  it('passes anchor references through function parameters', () => {
    const { program } = evalOk(`
base_unit = mm;
fn drill(target, d) {
    sketch h = circle(d);
    return {
        obj h = cut(h, 1 , @target.center),
    }
}
part p {
    sketch profile = rect(20, 10);
    obj base = extrude(profile, 4) {
        @mounting_face = @base.top;
    }
    place(drill(mounting_face, 3), @mounting_face.center);
}
`);
    const cut = opsOfKind<IRCut>(program.ops, 'cut')[0];
    const sketch = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (op) => op.name !== 'profile',
    );
    expect(cut.from.faceRef).toBe('base.top.center');
    expect(sketch?.placement?.faceRef).toBe('base.top.center');
  });

  it('emits placement-time and post-placement rotations', () => {
    const { program } = evalOk(`
base_unit = mm;
part bracket {
    sketch foot = rect(4, 4);
    obj foot = extrude(foot, 2);
}
part p {
    sketch base = rect(20, 10);
    obj base = extrude(base, 4);
    place(bracket, @base.top.center) rotate(90deg);
    rotate base 45deg around z;
}
`);
    const placed = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (op) => op.placement?.rotationDeg === 90,
    );
    const rotate = opsOfKind<IRRotate>(program.ops, 'rotate')[0];
    expect(placed?.placement?.rotationDeg).toBe(90);
    expect(rotate).toMatchObject({
      target: 'base',
      angleDeg: 45,
      around: 'z',
    });
  });

  it('emits placement-time axis rotations , @keyword, positional, and helper forms', () => {
    const { program } = evalOk(`
base_unit = mm;
part bracket {
    sketch foot = rect(4, 4);
    obj foot = extrude(foot, 2);
}
part p {
    sketch base = rect(20, 10);
    obj base = extrude(base, 4);
    place(bracket, @base.top.center) rotate(x: 10deg, y: 20deg, z: 30deg);
    place(bracket, @base.top.center) rotate(1deg, 2deg, 3deg);
    place(bracket, @base.top.center) rotateX(15deg);
    place(bracket, @base.top.center) rotateY(25deg);
    place(bracket, @base.top.center) rotateZ(35deg);
}
`);
    const placements = axisPlacementRotations(program.ops);
    expect(placements).toEqual(
      expect.arrayContaining([
        { x: 10, y: 20, z: 30 },
        { x: 1, y: 2, z: 3 },
        { x: 15 },
        { y: 25 },
        { z: 35 },
      ]),
    );
  });

  it('evaluates the full M18 advanced geometry example with resolved rotate, material, and side anchor metadata', () => {
    const source = readFileSync(
      new URL(
        '../../../../examples/test-12-M18-advanced-geometry.bscd',
        import.meta.url,
      ),
      'utf8',
    );
    const program = { ops: evalOpsWithPartBoundaries(source) };
    const rotate = opsOfKind<IRRotate>(program.ops, 'rotate').find(
      (op) => op.angleDeg === 12,
    );
    const placedSideArm = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (op) => op.placement?.anchor?.localNormal[0] === -1,
    );
    expect(rotate?.target).toBe(placedSideArm?.name);
    expect(rotate?.target).not.toBe('arm');
    expect(placedSideArm?.placement?.anchor).toMatchObject({
      localNormal: [-1, 0, 0],
    });
    expect(placedSideArm?.placement?.anchor?.localPoint).not.toEqual([0, 0, 0]);

    const partIndex = program.ops.findIndex(
      (op) => op.kind === 'part' && op.name === 'm18_rotate_tag_demo',
    );
    const partExtrudes = opsOfKind<IRExtrude>(
      program.ops.slice(partIndex + 1),
      'extrude',
    );
    expect(partExtrudes.length).toBeGreaterThan(0);
    expect(partExtrudes.every((op) => op.material?.name === 'marble PLA')).toBe(
      true,
    );
  });

  it('evaluates the M18 rotation feature example across placement, world-axis, face-axis, and component-target rotations', () => {
    const source = readFileSync(
      new URL(
        '../../../../examples/test-13-M18-rotation-features.bscd',
        import.meta.url,
      ),
      'utf8',
    );
    const { program } = evalOk(source);

    const defaultPlacementRotations = opsOfKind<IRSketch>(program.ops, 'sketch')
      .map((op) => op.placement?.rotationDeg)
      .filter((rotation): rotation is number => rotation !== undefined);
    expect(defaultPlacementRotations).toEqual(expect.arrayContaining([10]));

    expect(axisPlacementRotations(program.ops)).toEqual(
      expect.arrayContaining([
        { z: 45 },
        { x: 0, y: 45, z: 15 },
        { x: 15 },
        { y: 15 },
        { z: 60 },
      ]),
    );

    const rotateOps = opsOfKind<IRRotate>(program.ops, 'rotate');
    expect(rotateOps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'base', angleDeg: 5, around: 'x' }),
        expect.objectContaining({ target: 'base', angleDeg: 10, around: 'y' }),
        expect.objectContaining({ target: 'hub', angleDeg: 15, around: 'z' }),
      ]),
    );

    expect(rotateOps.find((op) => op.angleDeg === 22.5)?.around).toMatchObject({
      faceRef: 'base.top.center',
    });

    const latestComponentRotate = rotateOps.find((op) => op.angleDeg === 12);
    expect(latestComponentRotate?.target).not.toBe('rotor_tab');
    expect(latestComponentRotate?.around).toMatchObject({
      faceRef: 'hub.top.center',
    });
  });

  it('reports component rotate targets that were never placed as evaluator errors', () => {
    const messages = evalErrorMessages(`
base_unit = mm;
part bracket {
    sketch foot = rect(4, 4);
    obj foot = extrude(foot, 2);
}
part p {
    rotate bracket 45deg around z;
}
`);
    expect(
      messages.some((message) =>
        message.includes("No placed instance of 'bracket'"),
      ),
    ).toBe(true);
  });
});
